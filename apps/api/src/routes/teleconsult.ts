// @ts-nocheck

/**
 * /teleconsult/* — In-App Video Teleconsultation REST + WS upgrade.
 *
 *   POST   /sessions                  doctor creates from an appointment
 *   GET    /sessions/:id              participant reads (with ICE servers)
 *   GET    /sessions/me/active        any user: their current waiting/active session
 *   POST   /sessions/:id/start        doctor moves `requested → ringing`
 *   POST   /sessions/:id/end          participant ends (idempotent)
 *   POST   /sessions/:id/ws-ticket    mints a 60s purpose-scoped JWT for WS upgrade
 *   WS     /sessions/:id/ws           DO upgrade (ticket or cookie)
 *
 * Auth on REST: same JWT-or-cookie middleware as everything else.
 * Auth on WS: short-lived ticket (mobile) OR portal_session cookie (web).
 *
 * Audit events:
 *   teleconsult.session.create       on POST /sessions
 *   teleconsult.session.start        on DO-mediated `requested→active` flip
 *   teleconsult.session.end          on POST /sessions/:id/end
 */

import { Hono } from "hono";
import { and, eq, inArray, or, desc } from "drizzle-orm";
import {
  teleconsultSessions,
  appointments,
  doctors,
  patients,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { generateToken, verifyToken } from "../lib/crypto";
import { writeAudit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const teleconsultRouter = new Hono<AppEnvironment>();
teleconsultRouter.use("*", authMiddleware);

const TICKET_TTL_SECONDS = 60;
const PARTY_MAX = 2;

// ─── Helper: ICE servers from env ─────────────────────────
// We pass STUN as the floor; TURN is opt-in via `wrangler secret put`.
// Without TURN, symmetric-NAT clients can't connect (~12% of mobile +
// corporate networks). Document this loudly in `wrangler.toml`.
function buildIceServers(env) {
  const stun = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  if (!env.TURN_URLS) return stun;
  let urls = [];
  try {
    const parsed = JSON.parse(env.TURN_URLS);
    if (Array.isArray(parsed)) urls = parsed;
  } catch {
    return stun;
  }
  if (urls.length === 0) return stun;
  return [
    ...urls.map((u) => ({
      urls: u,
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL,
    })),
    ...stun,
  ];
}

// ─── Helper: nanoid-ish short room id ─────────────────────
// 12 chars from crypto.getRandomValues, base32 alphabet. Avoids `0/O/1/I`
// for legibility when shown in URLs.
function shortRoomId() {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < buf.length; i++) s += alphabet[buf[i] % alphabet.length];
  return s;
}

// ─── Helper: resolve userId → participant identity ─────────
// Used by the WS upgrade path to verify the caller is a real participant
// of the session before handing off to the DO.
async function resolveParticipant(db, userId, session) {
  // Doctor: their doctor.userId == this userId.
  // Patient: their patient.userId == this userId.
  // Either path yields `role`.
  const [doctor] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  if (doctor && doctor.id === session.doctorId) {
    return { role: "doctor", userId };
  }
  if (userId === session.patientUserId) {
    return { role: "patient", userId };
  }
  return null;
}

// ─── POST /sessions ───────────────────────────────────────
// Doctor creates a teleconsult session for an appointment. Returns the
// row + `roomId` so the doctor's portal page can navigate to
// `/portal/teleconsult/[roomId]`.
teleconsultRouter.post("/sessions", requireRole("doctor"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const appointmentId = body?.appointmentId;
  if (!appointmentId || typeof appointmentId !== "string") {
    return c.json({ error: "appointmentId required" }, 400);
  }

  // Find the doctor row matching this user.
  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  // Validate the appointment belongs to this doctor + is eligible.
  const [appt] = await db
    .select()
    .from(appointments)
    .where(
      and(eq(appointments.id, appointmentId), eq(appointments.doctorId, doctor.id))
    )
    .limit(1);
  if (!appt) {
    return c.json({ error: "Appointment not found or not owned by you" }, 404);
  }
  if (!["scheduled", "confirmed", "in_progress"].includes(appt.status)) {
    return c.json(
      {
        error: `Appointment status ${appt.status} cannot start a teleconsult`,
      },
      409
    );
  }

  // Patient userId (the join column for WS auth).
  const [patient] = await db
    .select({ userId: patients.userId })
    .from(patients)
    .where(eq(patients.id, appt.patientId))
    .limit(1);
  if (!patient?.userId) {
    return c.json({ error: "Patient has no linked user account" }, 400);
  }

  // Close out any prior live sessions for this appointment (partial unique
  // index means exactly one live row allowed).
  const existing = await db
    .select()
    .from(teleconsultSessions)
    .where(
      and(
        eq(teleconsultSessions.appointmentId, appointmentId),
        inArray(teleconsultSessions.status, ["requested", "ringing", "active"])
      )
    );
  for (const row of existing) {
    await db
      .update(teleconsultSessions)
      .set({
        status: "failed",
        endedAt: new Date().toISOString(),
        lastError: "superseded by new session",
      })
      .where(eq(teleconsultSessions.id, row.id));
  }

  const roomId = shortRoomId();
  const [created] = await db
    .insert(teleconsultSessions)
    .values({
      appointmentId,
      doctorId: doctor.id,
      patientUserId: patient.userId,
      status: "requested",
      roomId,
    })
    .returning();

  await writeAudit(db, {
    userId: patient.userId,
    actorUserId: userId,
    action: "teleconsult.session.create",
    resource: "teleconsult_session",
    resourceId: created.id,
    details: { roomId, appointmentId, doctorId: doctor.id },
    ip: c.req.header("cf-connecting-ip"),
  });

  return c.json({
    id: created.id,
    roomId: created.roomId,
    status: created.status,
    appointmentId: created.appointmentId,
  });
});

// ─── GET /sessions/me/active ───────────────────────────────
// Returns the user's currently-live session (requested | ringing |
// active), if any. Mobile polls this on mount to decide whether to
// show the "Join video visit" CTA.
teleconsultRouter.get("/sessions/me/active", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const dbUser = c.get("dbUser");
  if (!dbUser) return c.json({ session: null });

  let filter;
  if (dbUser.role === "doctor") {
    const [doctor] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doctor) return c.json({ session: null });
    filter = eq(teleconsultSessions.doctorId, doctor.id);
  } else if (dbUser.role === "patient" || dbUser.role === "caretaker") {
    filter = eq(teleconsultSessions.patientUserId, userId);
  } else {
    return c.json({ session: null });
  }

  const [row] = await db
    .select()
    .from(teleconsultSessions)
    .where(
      and(
        filter,
        inArray(teleconsultSessions.status, ["requested", "ringing", "active"])
      )
    )
    .orderBy(desc(teleconsultSessions.createdAt))
    .limit(1);

  return c.json({
    session: row
      ? {
          id: row.id,
          roomId: row.roomId,
          status: row.status,
          appointmentId: row.appointmentId,
          createdAt: row.createdAt,
        }
      : null,
  });
});

// ─── GET /sessions/:id ────────────────────────────────────
// Participant-only read. Returns full row + ICE servers.
teleconsultRouter.get("/sessions/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(teleconsultSessions)
    .where(eq(teleconsultSessions.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Session not found" }, 404);

  const participant = await resolveParticipant(db, userId, row);
  if (!participant) return c.json({ error: "Not a participant" }, 403);

  // Look up the patients.id for the appointment so the doctor's
  // PatientSidebar can fetch /doctor-portal/patients/:id/overview
  // without a second round-trip on the client.
  const [appt] = await db
    .select({ patientId: appointments.patientId })
    .from(appointments)
    .where(eq(appointments.id, row.appointmentId))
    .limit(1);

  return c.json({
    session: { ...row, patientId: appt?.patientId ?? null },
    iceServers: buildIceServers(c.env),
    partyMax: PARTY_MAX,
    you: participant,
  });
});

// ─── POST /sessions/:id/start ──────────────────────────────
// Doctor moves session `requested → ringing`. Optional — the DO will
// auto-flip on first peer connect — but a doctor-tap is a nice UX cue
// and we use this audit hook for the "doctor opened the room" event.
teleconsultRouter.post("/sessions/:id/start", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(teleconsultSessions)
    .where(eq(teleconsultSessions.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Session not found" }, 404);

  const participant = await resolveParticipant(db, userId, row);
  if (!participant) return c.json({ error: "Not a participant" }, 403);
  if (participant.role !== "doctor") {
    return c.json({ error: "Only the doctor can start a session" }, 403);
  }
  if (row.status !== "requested") {
    return c.json({ error: `Cannot start session in status ${row.status}` }, 409);
  }

  await db
    .update(teleconsultSessions)
    .set({ status: "ringing", startedAt: new Date().toISOString() })
    .where(eq(teleconsultSessions.id, id));

  await writeAudit(db, {
    userId: row.patientUserId,
    actorUserId: userId,
    action: "teleconsult.session.start",
    resource: "teleconsult_session",
    resourceId: id,
    details: { from: "requested", to: "ringing" },
    ip: c.req.header("cf-connecting-ip"),
  });

  return c.json({ ok: true, status: "ringing" });
});

// ─── POST /sessions/:id/end ───────────────────────────────
// Idempotent. Either participant can end; the DO does the actual peer
// closure on next message but we stamp the DB row eagerly.
teleconsultRouter.post("/sessions/:id/end", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(teleconsultSessions)
    .where(eq(teleconsultSessions.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Session not found" }, 404);

  const participant = await resolveParticipant(db, userId, row);
  if (!participant) return c.json({ error: "Not a participant" }, 403);

  if (["ended", "failed", "timeout"].includes(row.status)) {
    return c.json({ ok: true, status: row.status, alreadyEnded: true });
  }

  const now = new Date();
  const endedAt = now.toISOString();
  const startedAtMs = row.startedAt ? Date.parse(row.startedAt) : 0;
  const durationSec = startedAtMs
    ? Math.max(0, Math.round((now.getTime() - startedAtMs) / 1000))
    : null;

  await db
    .update(teleconsultSessions)
    .set({ status: "ended", endedAt, durationSec })
    .where(eq(teleconsultSessions.id, id));

  await writeAudit(db, {
    userId: row.patientUserId,
    actorUserId: userId,
    action: "teleconsult.session.end",
    resource: "teleconsult_session",
    resourceId: id,
    details: {
      cause: "user",
      durationSec,
      role: participant.role,
    },
    ip: c.req.header("cf-connecting-ip"),
  });

  // Best-effort: poke the DO to close all sockets. If the DO is
  // hibernating this also wakes it briefly; harmless if it's not.
  try {
    const ns = c.env.TELECONSULT_ROOM;
    if (ns) {
      const doId = ns.idFromName(row.roomId);
      const stub = ns.get(doId);
      await stub.fetch("https://do/close", { method: "POST" });
    }
  } catch (err) {
    // DO might be evicted; DB row is authoritative.
  }

  return c.json({ ok: true, status: "ended", durationSec });
});

// ─── POST /sessions/:id/ws-ticket ─────────────────────────
// Mints a 60s purpose-scoped JWT. Mobile uses this because RN's
// WebSocket can't attach cookies from the SecureStore JWT path.
teleconsultRouter.post("/sessions/:id/ws-ticket", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(teleconsultSessions)
    .where(eq(teleconsultSessions.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Session not found" }, 404);

  const participant = await resolveParticipant(db, userId, row);
  if (!participant) return c.json({ error: "Not a participant" }, 403);

  if (["ended", "failed", "timeout"].includes(row.status)) {
    return c.json({ error: "Session already ended" }, 410);
  }

  const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const expiresAt = Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS;
  const ticket = await generateToken(userId, secret, {
    purpose: "teleconsult_ws",
    sessionId: row.id,
    roomId: row.roomId,
    role: participant.role,
    exp: expiresAt,
  });
  return c.json({
    ticket,
    expiresAt,
    url: `/teleconsult/sessions/${encodeURIComponent(row.id)}/ws?ticket=${encodeURIComponent(ticket)}`,
  });
});

// ─── WS /sessions/:id/ws ──────────────────────────────────
// Hand off to the TeleconsultRoom DO. We do ticket validation here
// BEFORE upgrading so the DO never sees unverified peers.
teleconsultRouter.get("/sessions/:id/ws", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  // If authMiddleware already resolved the user (e.g. via cookie for
  // portal), trust it; otherwise require the ticket.
  let resolvedUserId = userId;
  let resolvedRole: string | null = null;

  const ticket = c.req.query("ticket");
  if (ticket) {
    const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
    const decoded = await verifyToken(ticket, secret);
    if (!decoded || decoded.purpose !== "teleconsult_ws") {
      return c.json({ error: "Invalid ticket" }, 401);
    }
    if (decoded.sessionId !== id) {
      return c.json({ error: "Ticket session mismatch" }, 401);
    }
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ error: "Ticket expired" }, 401);
    }
    resolvedUserId = decoded.sub;
    resolvedRole = decoded.role;
  } else if (!userId) {
    return c.json({ error: "Missing auth" }, 401);
  }

  const [row] = await db
    .select()
    .from(teleconsultSessions)
    .where(eq(teleconsultSessions.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Session not found" }, 404);

  const participant = await resolveParticipant(db, resolvedUserId, row);
  if (!participant) return c.json({ error: "Not a participant" }, 403);
  // If a ticket told us the role, trust it over a stale cookie role.
  if (resolvedRole && resolvedRole !== participant.role) {
    return c.json({ error: "Role mismatch" }, 403);
  }

  const ns = c.env.TELECONSULT_ROOM;
  if (!ns) {
    return c.json({ error: "Teleconsult not configured" }, 503);
  }
  const doId = ns.idFromName(row.roomId);
  const stub = ns.get(doId);

  // Forward the upgrade request to the DO. We attach the verified
  // userId + role as headers — the DO reads these on accept.
  const doUrl = `https://do/upgrade`;
  const doReq = new Request(doUrl, {
    headers: {
      Upgrade: "websocket",
      "X-Teleconsult-User-Id": resolvedUserId,
      "X-Teleconsult-Role": participant.role,
    },
  });
  return stub.fetch(doReq);
});

export default teleconsultRouter;
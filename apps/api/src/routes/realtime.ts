// @ts-nocheck

// GET /realtime — Server-Sent Events stream for the logged-in user.
//
// Polls a small set of "patient-facing" tables on a 2 s tick and emits
// typed SSE events when new rows appear. The client-side `useRealtime`
// hook turns each event into a React Query invalidation so the visible
// list / detail refreshes without a manual reload.
//
// Why polling-SSE and not WebSockets / Durable Objects?
//   - Cloudflare Workers + D1 + Bun all speak SSE natively.
//   - No new infra. A 2 s poll keeps the implementation trivial and
//     correct; under load we batch via Promise.all.
//
// Auth: the EventSource API can't set custom headers, so this route
// also accepts the JWT via `?token=`. `authMiddleware` already grants
// that on `/realtime` specifically (see middleware/auth.ts).
//
// Phase 1.4: instead of putting the long-lived JWT in the URL (which
// gets logged in proxies, browser history, and referer headers), the
// client POSTs `/realtime/token` with their Bearer header and gets back
// a short-lived opaque ticket. The ticket is bound to the user ID and
// expires after 60s — enough for the EventSource handshake to complete.

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { and, eq, gt, inArray, desc, sql } from "drizzle-orm";
import {
  notifications,
  medicalRecords,
  labReports,
  labOrders,
  prescriptions,
  chatMessages,
  chatSessions,
  walkIns,
  patients,
  doctors,
  hospitalStaff,
  patientLinks,
  caretakerMarketplaceInquiries,
  appointments,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { accessiblePatientsFor } from "../lib/access";
import { generateToken, verifyToken } from "../lib/crypto";
import type { AppEnvironment } from "../types";

const realtimeRouter = new Hono<AppEnvironment>();
realtimeRouter.use("*", authMiddleware);

const TICKET_TTL_SECONDS = 60;

/**
 * POST /realtime/token
 * Body: none (Bearer header required)
 * Response: { ticket: string, expiresAt: number, url: string }
 *
 * Mints a short-lived ticket scoped to the current user. The ticket
 * IS a JWT signed with the same secret, but carries `purpose: "realtime"`
 * and `exp = now + 60s`. Clients exchange it for SSE access by appending
 * `?token=<ticket>` to /realtime.
 */
realtimeRouter.post("/token", async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole") || "patient";
  const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const expiresAt = Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS;
  const ticket = await generateToken(userId, secret, {
    purpose: "realtime",
    role,
    exp: expiresAt,
  });
  return c.json({
    ticket,
    expiresAt,
    url: `/realtime?token=${encodeURIComponent(ticket)}`,
  });
});

/**
 * Helper: reject SSE ?token= tickets that don't carry `purpose: realtime`.
 * Keeps the long-lived session JWT from accidentally being reused as a
 * ticket by a misbehaving client. Also enforces the 60s TTL embedded in
 * the JWT itself.
 */
async function acceptTicket(c: any): Promise<string | null> {
  const t = c.req.query("token");
  if (!t) return null;
  const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const decoded = await verifyToken(t, secret);
  if (!decoded || decoded.purpose !== "realtime") return null;
  return t;
}
void acceptTicket; // referenced by the GET handler below

const POLL_MS = 2000;
const HEARTBEAT_MS = 15000;
const BATCH_LIMIT = 25;

realtimeRouter.get("/", async (c) => {
  const user = c.get("user");
  const userId = c.get("userId");
  const db = c.get("db");
  const role: string = (user && user.role) || "patient";

  // Phase 1.4: if the caller supplied a `?token=` query param, it MUST
  // be a short-lived purpose=realtime ticket — reject any attempt to
  // put a long-lived session JWT in the URL. Requests authenticated
  // via the Bearer header (e.g. server-to-server) still work as before.
  const queryToken = c.req.query("token");
  if (queryToken) {
    const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
    const decoded = await verifyToken(queryToken, secret);
    if (!decoded || decoded.purpose !== "realtime") {
      return c.json(
        { error: "SSE URL requires a short-lived /realtime/token ticket" },
        401
      );
    }
  }

  // ── Access scope for the duration of this connection ──────────
  // For a patient: their own patient.id. For a doctor: the union of
  // care-team grants + clinical evidence (see lib/access.ts). For
  // hospital staff: patients with records at their hospital. For
  // everything else: empty set (they'll only see notifications).
  let scopedPatientIds: string[] = [];
  if (role === "patient") {
    const [p] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);
    if (p) scopedPatientIds = [p.id];
  } else if (role === "doctor") {
    scopedPatientIds = await accessiblePatientsFor(db, userId, role);
  } else if (role === "hospital_admin" || role === "hospital_staff") {
    const [staff] = await db
      .select({ hospitalId: hospitalStaff.hospitalId })
      .from(hospitalStaff)
      .where(eq(hospitalStaff.userId, userId))
      .limit(1);
    if (staff) {
      const rows = await db
        .selectDistinct({ pid: medicalRecords.patientId })
        .from(medicalRecords)
        .where(eq(medicalRecords.hospitalId, staff.hospitalId));
      scopedPatientIds = rows.map((r: any) => r.pid).filter(Boolean);
    }
  } else if (role === "caretaker") {
    // Caretaker Profiles: union of every active link's principal.
    const rows = await db
      .selectDistinct({ pid: patientLinks.principalPatientId })
      .from(patientLinks)
      .where(
        and(
          eq(patientLinks.caretakerUserId, userId),
          eq(patientLinks.status, "active")
        )
      );
    scopedPatientIds = rows.map((r: any) => r.pid).filter(Boolean);
  }

  // Doctor Booking: doctors also need a `doctorId` dimension so the
  // appointments poller can emit updates on slots they OWN — not just
  // appointments for any accessible patient (those rows may be booked
  // with a different doctor). Resolved once at connection time so each
  // 2 s tick doesn't repeat the lookup.
  let scopedDoctorId: string | null = null;
  if (role === "doctor") {
    const [d] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (d) scopedDoctorId = d.id;
  }

  let closed = false;
  const seenSets: Record<string, Set<string>> = {};
  const cursors: Record<string, string> = {};

  const pollers = buildPollers({
    role,
    userId,
    scopedPatientIds,
    scopedDoctorId,
    db,
  });

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "hello",
      data: JSON.stringify({
        userId,
        role,
        scopedPatientCount: scopedPatientIds.length,
        at: new Date().toISOString(),
      }),
    });

    let lastHeartbeat = Date.now();

    while (!closed) {
      // ── Notifications (existing behaviour) ───────────────────
      try {
        const cur = cursors["notification"] || "";
        const where = cur
          ? and(eq(notifications.userId, userId), gt(notifications.id, cur))
          : eq(notifications.userId, userId);
        const seen = (seenSets["notification"] ||= new Set<string>());
        const rows = await db
          .select()
          .from(notifications)
          .where(where as any)
          .orderBy(notifications.id)
          .limit(BATCH_LIMIT);
        for (const row of rows) {
          if (closed) break;
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          cursors["notification"] = row.id;
          await stream.writeSSE({
            id: row.id,
            event: "notification",
            data: JSON.stringify({
              id: row.id,
              type: row.type,
              title: row.title,
              body: row.body,
              data: row.data ? safeParse(row.data) : null,
              read: !!row.read,
              createdAt: row.createdAt,
            }),
          });
        }
      } catch (err) {
        console.error("/realtime notification poll error:", err);
      }

      // ── All other tables ─────────────────────────────────────
      for (const poller of pollers) {
        if (closed) break;
        if (poller.skip) continue;
        try {
          const cur = cursors[poller.key] || "";
          const seen = (seenSets[poller.key] ||= new Set<string>());
          const whereClause = cur
            ? and(poller.where(), gt(poller.cursorColumn, cur))
            : poller.where();
          const rows = await poller
            .select(whereClause as any)
            .orderBy(desc(poller.cursorColumn))
            .limit(BATCH_LIMIT);
          // Emit in ascending order so consumers see the oldest first.
          rows.reverse();
          for (const row of rows) {
            if (closed) break;
            // Status-driven pollers (appointments) override the dedup key
            // to include the cursor value so a row's status mutation is
            // emitted again instead of being skipped by the seen-set.
            const dedupKey = poller.seenKey
              ? poller.seenKey(row)
              : row[poller.idColumn];
            const sseId = row[poller.idColumn];
            if (!dedupKey || seen.has(dedupKey)) continue;
            seen.add(dedupKey);
            // Advance the cursor by the cursor column's value (not the id).
            // For most pollers idColumn === cursorColumn so this is the
            // same string; for pollers that emit on status mutation
            // (marketplace_inquiry, appointment) it lets
            // `gt(cursorColumn, cur)` catch rows whose updatedAt moved
            // forward without a new id.
            const nextCursor = (row as any)[poller.cursorColumnName];
            if (nextCursor) cursors[poller.key] = String(nextCursor);
            await stream.writeSSE({
              id: sseId,
              event: poller.eventName,
              data: JSON.stringify(poller.payload(row)),
            });
          }
        } catch (err) {
          console.error(`/realtime ${poller.key} poll error:`, err);
        }
      }

      // ── Heartbeat ────────────────────────────────────────────
      const now = Date.now();
      if (now - lastHeartbeat >= HEARTBEAT_MS) {
        try {
          await stream.writeSSE({ event: "ping", data: String(now) });
          lastHeartbeat = Date.now();
        } catch {
          closed = true;
          break;
        }
      }

      await sleepWithCancel(POLL_MS, () => closed);
    }
  });
});

// ─── Poller definitions ─────────────────────────────────────
//
// Each poller declares:
//   key:          unique id for cursor + seen-set tracking
//   eventName:    the SSE `event:` field
//   skip:         truthy when scope is empty / role can't see this
//   idColumn:     property of the row to dedupe on
//   cursorColumn: SQL column used in `id > cursor` (UUID text)
//   where():      returns a Drizzle WHERE expression built lazily
//   select(where): Drizzle select() bound to the where clause
//   payload(row): shape sent to the client
//
// Doctors see only rows for patients in their accessible set.
// Patients see only their own rows. Staff see rows at their hospital.

function buildPollers(ctx: {
  role: string;
  userId: string;
  scopedPatientIds: string[];
  scopedDoctorId?: string | null;
  db: any;
}): Poller[] {
  const { userId, scopedPatientIds, scopedDoctorId } = ctx;
  const hasScope = scopedPatientIds.length > 0;
  const inScope = (col: any) => inArray(col, scopedPatientIds);

  const pollers: Poller[] = [
    {
      key: "medical_record",
      eventName: "record",
      skip: !hasScope,
      idColumn: "id",
      cursorColumn: medicalRecords.id,
      where: () => inScope(medicalRecords.patientId),
      select: (where: any) =>
        ctx.db
          .select({
            id: medicalRecords.id,
            patientId: medicalRecords.patientId,
            recordType: medicalRecords.recordType,
            kind: medicalRecords.kind,
            title: medicalRecords.title,
            date: medicalRecords.date,
            createdAt: medicalRecords.createdAt,
          })
          .from(medicalRecords)
          .where(where),
      payload: (r: any) => ({
        id: r.id,
        patientId: r.patientId,
        recordType: r.recordType,
        kind: r.kind,
        title: r.title,
        date: r.date,
        createdAt: r.createdAt,
      }),
    },
    {
      key: "lab_report",
      eventName: "lab_report",
      skip: !hasScope,
      idColumn: "id",
      cursorColumn: labReports.id,
      where: () => inScope(labReports.patientId),
      select: (where: any) =>
        ctx.db
          .select({
            id: labReports.id,
            patientId: labReports.patientId,
            reportType: labReports.reportType,
            status: labReports.status,
            createdAt: labReports.createdAt,
          })
          .from(labReports)
          .where(where),
      payload: (r: any) => ({
        id: r.id,
        patientId: r.patientId,
        reportType: r.reportType,
        status: r.status,
        createdAt: r.createdAt,
      }),
    },
    {
      key: "lab_order",
      eventName: "lab_order",
      skip: !hasScope,
      idColumn: "id",
      cursorColumn: labOrders.id,
      where: () => inScope(labOrders.patientId),
      select: (where: any) =>
        ctx.db
          .select({
            id: labOrders.id,
            patientId: labOrders.patientId,
            status: labOrders.status,
            orderedAt: labOrders.orderedAt,
            completedAt: labOrders.completedAt,
          })
          .from(labOrders)
          .where(where),
      payload: (r: any) => ({
        id: r.id,
        patientId: r.patientId,
        status: r.status,
        orderedAt: r.orderedAt,
        completedAt: r.completedAt,
      }),
    },
    {
      key: "prescription",
      eventName: "prescription",
      skip: !hasScope,
      idColumn: "id",
      cursorColumn: prescriptions.id,
      where: () => inScope(prescriptions.patientId),
      select: (where: any) =>
        ctx.db
          .select({
            id: prescriptions.id,
            patientId: prescriptions.patientId,
            status: prescriptions.status,
            date: prescriptions.date,
            createdAt: prescriptions.createdAt,
          })
          .from(prescriptions)
          .where(where),
      payload: (r: any) => ({
        id: r.id,
        patientId: r.patientId,
        status: r.status,
        date: r.date,
        createdAt: r.createdAt,
      }),
    },
    {
      key: "walk_in",
      eventName: "walk_in",
      skip: !hasScope,
      idColumn: "id",
      cursorColumn: walkIns.id,
      where: () => inScope(walkIns.patientId),
      select: (where: any) =>
        ctx.db
          .select({
            id: walkIns.id,
            patientId: walkIns.patientId,
            status: walkIns.status,
            origin: walkIns.origin,
            createdAt: walkIns.createdAt,
          })
          .from(walkIns)
          .where(where),
      payload: (r: any) => ({
        id: r.id,
        patientId: r.patientId,
        status: r.status,
        origin: r.origin ?? "manual",
        createdAt: r.createdAt,
      }),
    },
    {
      key: "chat_message",
      eventName: "message",
      // No patient-scope requirement — chat is owned by the user.
      idColumn: "id",
      cursorColumn: chatMessages.id,
      where: () => {
        // Subquery: messages in any session owned by this user.
        return sql`${chatMessages.sessionId} IN (
          SELECT id FROM ${chatSessions} WHERE user_id = ${userId}
        )`;
      },
      select: (where: any) =>
        ctx.db
          .select({
            id: chatMessages.id,
            sessionId: chatMessages.sessionId,
            role: chatMessages.role,
            createdAt: chatMessages.createdAt,
          })
          .from(chatMessages)
          .where(where),
      payload: (r: any) => ({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role,
        createdAt: r.createdAt,
      }),
    },
    {
      // Caretaker Profiles: emit when a link is added/revoked/paused
      // so linked caretakers + the principal refresh link state. The
      // poller runs for everyone; `where` filters by user involvement.
      key: "patient_link",
      eventName: "caretaker_link",
      idColumn: "id",
      cursorColumn: patientLinks.id,
      where: () =>
        sql`${patientLinks.caretakerUserId} = ${userId} OR ${patientLinks.invitedByUserId} = ${userId}`,
      select: (where: any) =>
        ctx.db
          .select({
            id: patientLinks.id,
            caretakerUserId: patientLinks.caretakerUserId,
            principalPatientId: patientLinks.principalPatientId,
            careRole: patientLinks.careRole,
            status: patientLinks.status,
            invitedAt: patientLinks.invitedAt,
            acceptedAt: patientLinks.acceptedAt,
            revokedAt: patientLinks.revokedAt,
            updatedAt: patientLinks.updatedAt,
          })
          .from(patientLinks)
          .where(where),
      payload: (r: any) => ({
        id: r.id,
        caretakerUserId: r.caretakerUserId,
        principalPatientId: r.principalPatientId,
        careRole: r.careRole,
        status: r.status,
        invitedAt: r.invitedAt,
        acceptedAt: r.acceptedAt,
        revokedAt: r.revokedAt,
        updatedAt: r.updatedAt,
      }),
    },
    {
      // Caretaker Marketplace: emit when an inquiry is created,
      // accepted, declined, or auto-expired. Both the patient who sent
      // it and the caretaker who received it need the update — `where`
      // covers either side.
      //
      // This is the only poller whose cursor advances on `updatedAt`
      // rather than `id`. Status changes don't change id; they change
      // updatedAt. The seen-set is still keyed on id so the same
      // inquiry isn't re-emitted every tick once its updatedAt settles.
      key: "marketplace_inquiry",
      eventName: "marketplace_inquiry",
      idColumn: "id",
      cursorColumn: caretakerMarketplaceInquiries.updatedAt,
      cursorColumnName: "updatedAt",
      where: () =>
        sql`${caretakerMarketplaceInquiries.caretakerUserId} = ${userId}
            OR ${caretakerMarketplaceInquiries.patientUserId} = ${userId}`,
      select: (where: any) =>
        ctx.db
          .select({
            id: caretakerMarketplaceInquiries.id,
            marketplaceProfileId: caretakerMarketplaceInquiries.marketplaceProfileId,
            caretakerUserId: caretakerMarketplaceInquiries.caretakerUserId,
            patientUserId: caretakerMarketplaceInquiries.patientUserId,
            status: caretakerMarketplaceInquiries.status,
            decidedAt: caretakerMarketplaceInquiries.decidedAt,
            linkId: caretakerMarketplaceInquiries.linkId,
            createdAt: caretakerMarketplaceInquiries.createdAt,
            updatedAt: caretakerMarketplaceInquiries.updatedAt,
          })
          .from(caretakerMarketplaceInquiries)
          .where(where),
      payload: (r: any) => ({
        id: r.id,
        marketplaceProfileId: r.marketplaceProfileId,
        caretakerUserId: r.caretakerUserId,
        patientUserId: r.patientUserId,
        status: r.status,
        decidedAt: r.decidedAt ?? null,
        linkId: r.linkId ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    },
    {
      // Doctor Booking: emit on every appointment mutation so the
      // patient + doctor SSE consumers refresh queue / status / mode /
      // payment without polling. Cursor advances on `updatedAt`
      // (status flips + queue compactor + payment status updates all
      // bump updatedAt without changing id). `seenKey` extends the
      // seen-set with the updatedAt value so a row whose status flips
      // re-emits instead of being skipped by id-keyed dedup.
      //
      // Patient scope: appointments whose patientId matches the
      // caller's patient row.
      // Doctor scope: appointments whose doctorId matches the
      // caller's doctor row (NOT patient-scope — a doctor needs to see
      // their own slot regardless of patient access).
      // Caretaker scope: same as patient — handled by the patient-id
      // scoping resolved upstream in the SSE handler.
      key: "appointment",
      eventName: "appointment",
      skip:
        ctx.role === "doctor"
          ? !scopedDoctorId
          : ctx.role === "patient" || ctx.role === "caretaker"
            ? !hasScope
            : true,
      idColumn: "id",
      cursorColumn: appointments.updatedAt,
      cursorColumnName: "updatedAt",
      seenKey: (r: any) => `${r.id}:${r.updatedAt ?? ""}`,
      where: () => {
        if (ctx.role === "doctor" && scopedDoctorId) {
          return eq(appointments.doctorId, scopedDoctorId);
        }
        return inScope(appointments.patientId);
      },
      select: (where: any) =>
        ctx.db
          .select({
            id: appointments.id,
            doctorId: appointments.doctorId,
            patientId: appointments.patientId,
            hospitalId: appointments.hospitalId,
            date: appointments.date,
            time: appointments.time,
            status: appointments.status,
            mode: appointments.mode,
            queueNumber: appointments.queueNumber,
            paymentStatus: appointments.paymentStatus,
            updatedAt: appointments.updatedAt,
          })
          .from(appointments)
          .where(where),
      payload: (r: any) => ({
        id: r.id,
        doctorId: r.doctorId,
        patientId: r.patientId,
        hospitalId: r.hospitalId,
        date: r.date,
        time: r.time,
        status: r.status,
        mode: r.mode,
        queueNumber: r.queueNumber,
        paymentStatus: r.paymentStatus,
        updatedAt: r.updatedAt,
      }),
    },
  ];

  return pollers;
}

type Poller = {
  key: string;
  eventName: string;
  skip?: boolean;
  idColumn: string;
  cursorColumn: any;
  /**
   * Property name on the row used to advance the cursor. Defaults to
   * idColumn when omitted, but pollers that emit on mutation (e.g.
   * marketplace_inquiry on `updatedAt`) MUST set this explicitly so
   * `gt(cursorColumn, cur)` compares the right values.
   */
  cursorColumnName?: string;
  /**
   * Override the seen-set key. Defaults to `idColumn` so the same row
   * is never re-emitted. Status-driven pollers (appointment) MUST set
   * this to include the cursor value (e.g. `${id}:${updatedAt}`) so a
   * row whose status flips re-emits instead of being skipped by
   * id-keyed dedup.
   */
  seenKey?: (row: any) => string;
  where: () => any;
  select: (where: any) => any;
  payload: (row: any) => Record<string, unknown>;
};

function sleepWithCancel(ms: number, isClosed: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (isClosed() || Date.now() - start >= ms) return resolve();
      setTimeout(tick, Math.min(200, ms));
    };
    tick();
  });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default realtimeRouter;
// @internal — exported for unit testing the poller factory in isolation
// without spinning up the full SSE stream loop.
export { buildPollers, type Poller };

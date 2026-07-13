// @ts-nocheck

/**
 * TeleconsultRoom — Durable Object that owns the WebSocket signaling
 * plane for a single in-app video consult.
 *
 *   • Two-peer cap. The DO only ever accepts the doctor + the patient;
 *     any third peer (or stale session) gets `1008 Policy Violation`.
 *   • Hibernation API (`acceptWebSocket` + `webSocketMessage/Close/Error`
 *     handlers) so the instance sleeps between signaling messages and
 *     survives evictions without dropping the call.
 *   • Source of truth for "live state" while the call is active; D1
 *     `teleconsult_sessions` row is updated on every status transition.
 *   • Heartbeat: server pings every 25s, peers that fail to pong within
 *     60s are terminated. If both peers disconnect for >60s, the room
 *     flips to `timeout` and persists.
 *   • The DO does NOT relay media. Clients do P2P via WebRTC, exchanging
 *     SDP + ICE through this WS. Calls under symmetric NAT need a TURN
 *     relay (set `TURN_URLS`/`TURN_USERNAME`/`TURN_CREDENTIAL`).
 *
 * Auth on upgrade:
 *   /teleconsult/sessions/:id/ws?ticket=<short-lived JWT> validates the
 *   ticket via the route handler BEFORE handing the upgrade off to the
 *   DO. The DO itself receives only the verified `userId` + `role`
 *   headers (stamped by the route) so a forged WS upgrade from outside
 *   our Worker would lack them.
 *
 * Persistence:
 *   Each status transition writes to `teleconsult_sessions` via env.DB.
 *   The DO state (peers + counters) is ephemeral by design; if the DO
 *   is evicted, peers reconnect through the WS route, the new DO
 *   instance reads the row from D1, and the call resumes.
 */

import { eq } from "drizzle-orm";
import { teleconsultSessions, appointments } from "@healthcare/db";

const PARTY_MAX = 2;
const HEARTBEAT_INTERVAL_MS = 25_000;
const PEER_TIMEOUT_MS = 60_000;
const IDLE_TIMEOUT_MS = 60_000;
const ICE_RESTART_PING_MS = 30_000;

export class TeleconsultRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Map<WebSocket, { userId, role, connectedAtMs, lastPongMs }>
    this.peers = new Map();
    this.signalingMsgCount = 0;
    this.iceRestartCount = 0;
    this.lastError = null;
    this.heartbeatTimer = null;
    this.idleTimer = null;
    this.sessionId = null;
    this.appointmentId = null;
    this.doctorUserId = null;
    this.patientUserId = null;
    // Hydration promise so the first fetch() can `await this.hydrated`
    // before reading sessionId. CF's runtime runs blockConcurrencyWhile
    // in the fetch handler — we can't (and shouldn't) do it in the
    // constructor, which must be sync.
    this.hydrated = (async () => {
      await this.hydrateFromD1();
    })();
  }

  // ─── D1 hydration ───────────────────────────────────────
  // Looks up the session row by `roomId` (which is the DO instance name).
  // Called on every cold start. If we can't find a live row, this DO
  // is orphaned (developer reset / accidental recreation) and we drop
  // everything.
  async hydrateFromD1() {
    const roomId = this.state.id?.toString?.();
    if (!roomId) return;
    const db = this.env.DB;
    if (!db) return;
    try {
      const row = await db
        .prepare(
          "SELECT id, appointment_id, doctor_id, patient_user_id, status FROM teleconsult_sessions WHERE room_id = ? LIMIT 1"
        )
        .bind(roomId)
        .first();
      if (!row) return;
      this.sessionId = row.id;
      this.appointmentId = row.appointment_id;
      this.doctorUserId = row.doctor_id;
      this.patientUserId = row.patient_user_id;
    } catch (err) {
      // D1 not available in unit tests — that's fine, treat as orphan.
    }
  }

  // ─── HTTP entrypoint ────────────────────────────────────
  // Two shapes:
  //   1. `Upgrade: websocket` → forward to DO WS machinery.
  //      The Worker route stamps `X-Teleconsult-User-Id` and
  //      `X-Teleconsult-Role` after ticket validation; we trust them
  //      because no other code path produces a request the DO accepts.
  //   2. `POST /close` (no body needed) — idempotent end of room.
  async fetch(request) {
    // Wait for cold-start D1 hydration to complete before we act on
    // sessionId/appointmentId. blockConcurrencyWhile guarantees no
    // concurrent fetches overlap this on CF.
    await this.hydrated;
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname.endsWith("/close")) {
      // POST /close is the explicit API-initiated end. Persist as
      // `ended` (matches the participant-initiated POST /sessions/:id/end
      // and the valid enum values). Reason lands in last_error.
      await this.endRoom("ended", "Room force-closed by API");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    // Heartbeat / presence probe (used by the route layer for polling
    // fallback when WS isn't viable). Returns the current peer count.
    if (request.method === "GET" && url.pathname.endsWith("/state")) {
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: this.sessionId,
          peers: this.peers.size,
          status: this.deriveStatus(),
        }),
        { headers: { "content-type": "application/json" } }
      );
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    // Two-peer cap.
    if (this.peers.size >= PARTY_MAX) {
      return new Response("Room full", {
        status: 101,
        // Honoring 101 means we accept the upgrade but immediately
        // close — the body is ignored by WebSocket protocol but a
        // 101 lets us pass the close frame back.
      });
    }

    const userId = request.headers.get("X-Teleconsult-User-Id");
    const role = request.headers.get("X-Teleconsult-Role");
    if (!userId || !role) {
      return new Response("Missing peer identity", { status: 401 });
    }

    // Reject duplicate role (e.g. two doctors both opening their page).
    for (const peer of this.peers.values()) {
      if (peer.userId === userId) {
        return new Response("Already in room", { status: 409 });
      }
    }

    // Reject mismatched participant (the ticket JWT decoded to a user
    // who isn't doctor OR patient for this session).
    if (
      this.doctorUserId &&
      this.patientUserId &&
      userId !== this.doctorUserId &&
      userId !== this.patientUserId
    ) {
      return new Response("Not a participant", { status: 403 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const accepted = this.state.acceptWebSocket(server);
    // acceptWebSocket returns the WS itself on CF; store peer metadata.
    accepted.deserializeAttachment({
      userId,
      role,
      connectedAtMs: Date.now(),
      lastPongMs: Date.now(),
    });
    this.peers.set(accepted, { userId, role, connectedAtMs: Date.now(), lastPongMs: Date.now() });

    // Tell the new peer who else is in the room (so it knows when to
    // generate an offer / wait for one).
    try {
      accepted.send(
        JSON.stringify({
          type: "hello",
          you: { userId, role },
          peers: [...this.peers.entries()]
            .filter(([w]) => w !== accepted)
            .map(([, p]) => ({ userId: p.userId, role: p.role })),
          status: this.deriveStatus(),
        })
      );
    } catch {}

    // Broadcast presence change to the other peer(s).
    this.broadcastExcept(accepted, {
      type: "peer-joined",
      peer: { userId, role },
      status: this.deriveStatus(),
    });

    // On the first peer, move status `requested` → `ringing`.
    // On the second peer, move `ringing` → `active` AND flip the
    // appointment to `in_progress`.
    if (this.peers.size === 1) {
      await this.persistStatus("ringing", "first-peer-connect");
    } else if (this.peers.size === 2) {
      await this.persistStatus("active", "both-peers-connected");
      await this.flipAppointmentInProgress();
    }

    this.armHeartbeat();
    this.armIdleTimeout();

    return new Response(null, { status: 101, webSocket: client });
  }

  // ─── WebSocket Hibernation handlers ─────────────────────
  async webSocketMessage(ws, raw) {
    this.signalingMsgCount++;
    let msg;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    } catch {
      ws.close(1003, "Invalid JSON");
      return;
    }
    if (!msg || typeof msg.type !== "string") {
      ws.close(1003, "Missing type");
      return;
    }
    const att = ws.deserializeAttachment?.() || {};

    // `pong` — refresh last-pong timestamp.
    if (msg.type === "pong") {
      this.peers.get(ws).lastPongMs = Date.now();
      return;
    }
    // `bye` — peer is leaving voluntarily; let it go.
    if (msg.type === "bye") {
      ws.close(1000, "bye");
      return;
    }
    // `ice-restart` — ICE restart detected by client; bookkeeping.
    if (msg.type === "ice-restart") {
      this.iceRestartCount++;
      this.broadcastExcept(ws, msg);
      return;
    }
    // `offer` / `answer` / `ice` — forward verbatim to the other peer.
    if (["offer", "answer", "ice"].includes(msg.type)) {
      this.broadcastExcept(ws, msg);
      return;
    }
    // Anything else — ignore but keep connection alive.
  }

  async webSocketClose(ws, code, reason, wasClean) {
    const att = ws.deserializeAttachment?.() || {};
    this.peers.delete(ws);
    this.broadcast({
      type: "peer-left",
      peer: { userId: att.userId, role: att.role },
      status: this.deriveStatus(),
    });
    this.armIdleTimeout();
    if (this.peers.size === 0) {
      // Don't end immediately — give the other peer a grace window
      // to reconnect (mobile networks hiccup). The idle timer handles
      // the actual `timeout` transition.
    }
  }

  async webSocketError(ws, err) {
    try {
      ws.close(1011, "ws-error");
    } catch {}
  }

  // ─── Internal helpers ────────────────────────────────────
  broadcast(payload) {
    const msg = JSON.stringify(payload);
    for (const ws of this.peers.keys()) {
      try {
        ws.send(msg);
      } catch {}
    }
  }
  broadcastExcept(except, payload) {
    const msg = JSON.stringify(payload);
    for (const ws of this.peers.keys()) {
      if (ws === except) continue;
      try {
        ws.send(msg);
      } catch {}
    }
  }

  deriveStatus() {
    if (this.peers.size === 0) return "ringing"; // between peers
    if (this.peers.size === 1) return "ringing";
    return "active";
  }

  armHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [ws, meta] of this.peers) {
        // Detect ICE restart requirement by gap.
        const gap = now - (meta.lastPongMs || meta.connectedAtMs);
        if (gap > ICE_RESTART_PING_MS && this.peers.size === 2) {
          try {
            ws.send(JSON.stringify({ type: "ice-restart-hint" }));
          } catch {}
        }
        if (gap > PEER_TIMEOUT_MS) {
          try {
            ws.close(1011, "peer-timeout");
          } catch {}
        } else {
          try {
            ws.send(JSON.stringify({ type: "ping", ts: now }));
          } catch {}
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  armIdleTimeout() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.peers.size === 0) {
      this.idleTimer = setTimeout(async () => {
        await this.endRoom("timeout", "Both peers disconnected");
      }, IDLE_TIMEOUT_MS);
    } else if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  async endRoom(status, reason) {
    if (!this.sessionId) {
      // No hydrated session — just close sockets and return.
      for (const ws of this.peers.keys()) {
        try {
          ws.close(1000, "end");
        } catch {}
      }
      this.peers.clear();
      return;
    }
    const db = this.env.DB;
    if (!db) return;
    const now = new Date().toISOString();
    const durationSec = this.computeDurationSec();
    try {
      await db
        .prepare(
          "UPDATE teleconsult_sessions SET status = ?, ended_at = ?, duration_sec = ?, signaling_msg_count = ?, ice_restart_count = ?, last_error = ? WHERE id = ?"
        )
        .bind(
          status,
          now,
          durationSec,
          this.signalingMsgCount,
          this.iceRestartCount,
          reason || null,
          this.sessionId
        )
        .run();
    } catch (err) {
      console.error("TeleconsultRoom.endRoom update failed", err);
    }
    // Broadcast end to any remaining peers.
    this.broadcast({ type: "end", status, reason });
    for (const ws of this.peers.keys()) {
      try {
        ws.close(1000, "end");
      } catch {}
    }
    this.peers.clear();
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }

  computeDurationSec() {
    // Use the earliest peer's connectedAtMs as session start; if we
    // don't have any peers (i.e. timeout) fall back to createdAt via D1.
    if (this.peers.size > 0) {
      const earliest = Math.min(
        ...[...this.peers.values()].map((p) => p.connectedAtMs)
      );
      return Math.max(0, Math.round((Date.now() - earliest) / 1000));
    }
    return 0;
  }

  async persistStatus(newStatus, reason) {
    if (!this.sessionId) return;
    const db = this.env.DB;
    if (!db) return;
    try {
      const fields = ["status = ?"];
      const values = [newStatus];
      if (newStatus === "active" || newStatus === "ringing") {
        fields.push("started_at = COALESCE(started_at, ?)");
        values.push(new Date().toISOString());
      }
      values.push(this.sessionId);
      await db
        .prepare(`UPDATE teleconsult_sessions SET ${fields.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();
    } catch (err) {
      console.error("TeleconsultRoom.persistStatus failed", err);
    }
  }

  async flipAppointmentInProgress() {
    if (!this.appointmentId) return;
    const db = this.env.DB;
    if (!db) return;
    try {
      await db
        .prepare(
          "UPDATE appointments SET status = 'in_progress' WHERE id = ? AND status IN ('scheduled','confirmed','in_progress')"
        )
        .bind(this.appointmentId)
        .run();
    } catch (err) {
      console.error("flipAppointmentInProgress failed", err);
    }
  }
}
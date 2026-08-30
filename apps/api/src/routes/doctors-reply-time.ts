import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

export type MessageRow = {
  senderRole: "patient" | "doctor" | "system";
  createdAt: string;
};

/**
 * Compute median minutes between patient messages and the next doctor reply.
 * Walks messages in order; pairs each patient→doctor sequence. Returns
 * `null` median on empty sample.
 */
export function computeReplyTimeMedian(messages: MessageRow[]) {
  const pairs: number[] = [];
  let lastPatientAt: number | null = null;
  for (const m of messages) {
    const t = new Date(m.createdAt).getTime();
    if (m.senderRole === "patient") {
      lastPatientAt = t;
    } else if (m.senderRole === "doctor" && lastPatientAt !== null && t > lastPatientAt) {
      pairs.push(Math.round((t - lastPatientAt) / 60_000));
      lastPatientAt = null;
    }
  }
  if (pairs.length === 0) {
    return { medianMinutes: null, sampleSize: 0 };
  }
  pairs.sort((a, b) => a - b);
  const mid = Math.floor(pairs.length / 2);
  const median =
    pairs.length % 2 === 1
      ? pairs[mid]
      : Math.round((pairs[mid - 1] + pairs[mid]) / 2);
  return { medianMinutes: median, sampleSize: pairs.length };
}

export const replyTimeRouter = new Hono<AppEnvironment>();

/**
 * GET /doctors/:id/reply-time
 *
 * Returns median first-response minutes for the given doctor over the last
 * 30 days. `doctorId` parameter is `doctors.id` (not `users.id`) — matches
 * `messages_conversations.doctorId` foreign key.
 *
 * Auth required (any authenticated user can read).
 */
replyTimeRouter.get("/:id/reply-time", authMiddleware, async (c) => {
  const doctorId = c.req.param("id");
  const rows = (await c.env.DB.prepare(
    "SELECT m.sender_role AS senderRole, m.created_at AS createdAt FROM messages m JOIN messages_conversations mc ON mc.id = m.conversation_id WHERE mc.doctor_id = ? AND m.created_at > datetime('now', '-30 days') AND m.sender_role != 'system' ORDER BY m.created_at ASC"
  )
    .bind(doctorId)
    .all()) as { results: MessageRow[] };
  const result = computeReplyTimeMedian((rows.results as any[]) ?? []);
  return c.json({ ...result, computedAt: new Date().toISOString() });
});

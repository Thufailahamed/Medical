// @ts-nocheck
// Phase Caretaker-Profiles: caretaker-context middleware. Runs AFTER
// authMiddleware, sibling of family-context.ts.
//
// Reads `x-active-principal-patient-id` from the request header. If set,
// verifies a `patient_links` row exists where
// (caretakerUserId = caller's userId, principalPatientId = headerId,
// status='active'). On valid → sets `c.get("activePrincipalPatientId")` +
// `c.get("activeCaretakerLinkId")`. On invalid (deleted, paused, revoked,
// not theirs) → 410 Gone + `{ reason: "principal_access_gone" }` so the
// client clears its store (mirrors `family_member_gone` shape).
//
// If the header is absent, falls back to `users.activePrincipalPatientId`
// column (durable cross-device state). The header, when present, wins —
// the client knows more than the server column.
//
// No-op for non-caretaker roles (they don't carry an active-principal
// header — they act on URL/body-specified patientIds directly via
// canActAsPatient).

import { and, eq } from "drizzle-orm";
import { patientLinks, users } from "@healthcare/db";
import { createDb } from "../lib/db";
import type { AppEnvironment } from "../types";

declare module "hono" {
  interface ContextVariableMap {
    activePrincipalPatientId?: string;
    activeCaretakerLinkId?: string;
  }
}

export const caretakerContextMiddleware = async (
  c: any,
  next: any
): Promise<any> => {
  const userId = c.get("userId");
  if (!userId) return next(); // unauthenticated — let auth handle it

  const dbUser = c.get("dbUser");
  const role = dbUser?.role;

  // Non-caretaker users never carry this header — no-op fast path.
  if (role !== "caretaker") {
    return next();
  }

  const db = createDb(c.env.DB);
  const headerId = (c.req.header("x-active-principal-patient-id") || "").trim();
  let activeId: string | null = null;
  let activeLinkId: string | null = null;

  if (headerId) {
    // Header wins. Verify an active link connects this caretaker to
    // the requested principal.
    const [link] = await db
      .select({
        id: patientLinks.id,
        status: patientLinks.status,
      })
      .from(patientLinks)
      .where(
        and(
          eq(patientLinks.caretakerUserId, userId),
          eq(patientLinks.principalPatientId, headerId),
          eq(patientLinks.status, "active")
        )
      )
      .limit(1);

    if (link) {
      activeId = headerId;
      activeLinkId = link.id;
    } else {
      // Header set but link missing/paused/revoked — treat as gone.
      // Clear the durable column too so the next request without a
      // header doesn't resurrect the revoked state.
      try {
        await db
          .update(users)
          .set({ activePrincipalPatientId: null })
          .where(eq(users.id, userId));
      } catch {
        // best effort — middleware never throws
      }
      return c.json(
        {
          error: "Active principal is no longer available",
          reason: "principal_access_gone",
        },
        410
      );
    }
  } else {
    // Header absent: fall back to durable server column. Validate the
    // stored id still corresponds to an active link — revocations
    // happening on another device must propagate here.
    const stored = (dbUser?.activePrincipalPatientId as string | null) || null;
    if (stored) {
      const [link] = await db
        .select({ id: patientLinks.id })
        .from(patientLinks)
        .where(
          and(
            eq(patientLinks.caretakerUserId, userId),
            eq(patientLinks.principalPatientId, stored),
            eq(patientLinks.status, "active")
          )
        )
        .limit(1);
      if (link) {
        activeId = stored;
        activeLinkId = link.id;
      } else {
        // Stale column. Clear it.
        try {
          await db
            .update(users)
            .set({ activePrincipalPatientId: null })
            .where(eq(users.id, userId));
        } catch {
          // best effort
        }
      }
    }
  }

  c.set("activePrincipalPatientId", activeId || "");
  c.set("activeCaretakerLinkId", activeLinkId || "");
  return next();
};

// @ts-nocheck
// ─── Phase 3.1: SLMC verification ─────────────────────────
// Doctor-facing endpoint that records an SLMC registration number on the
// caller's doctor profile and stamps `slmc_verified_at` with a manual-review
// pass result. NO external API call — SLMC does not publish a programmatic
// lookup. Verification is a flag until Phase 3.2 negotiates an integration.
//
// Phase 3.2 will replace the flag with a real SLMC directory check
// (slmc.gov.lk public search) once an integration partner is in place.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { doctors } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { slmcVerifySchema } from "../lib/validators";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const slmcRouter = new Hono<AppEnvironment>();

// Authenticated doctor submits their SLMC registration number. We update
// the doctor's row identified by userId; create the doctor row if missing.
// Manual verification flag is set immediately — see module docstring.
slmcRouter.post(
  "/slmc/verify",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");

    const body = await c.req.json().catch(() => ({}));
    const parsed = slmcVerifySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "Validation failed",
          details: flattenTranslated(parsed.error, c.get("locale")),
        },
        400
      );
    }
    const slmcRegistrationNo = parsed.data.slmcRegistrationNo;

    // Duplicate guard — unique partial index means a second doctor
    // trying to claim the same number would 500 at the DB layer. Catch
    // it here as 409 to keep the API contract clean.
    const [existingByNo] = await db
      .select({ id: doctors.id, userId: doctors.userId })
      .from(doctors)
      .where(eq(doctors.slmcRegistrationNo, slmcRegistrationNo))
      .limit(1);
    if (existingByNo && existingByNo.userId !== userId) {
      return c.json(
        { error: "SLMC number already registered to another doctor" },
        409
      );
    }

    // Find or create the doctor row.
    const [existing] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);

    const verifiedAt = new Date().toISOString();

    if (existing) {
      const [updated] = await db
        .update(doctors)
        .set({
          slmcRegistrationNo,
          slmcVerifiedAt: verifiedAt,
        } as any)
        .where(eq(doctors.userId, userId))
        .returning();
      return c.json({
        slmcRegistrationNo: updated.slmcRegistrationNo,
        slmcVerifiedAt: updated.slmcVerifiedAt,
      });
    }

    // First-time doctor record (no specialization set yet — that's
    // collected during onboarding, not here). Specialization NOT NULL
    // means we can't insert a stub; surface a 412 instead.
    return c.json(
      {
        error:
          "Doctor profile missing. Complete onboarding (specialization required) before registering SLMC.",
      },
      412
    );
  }
);

export default slmcRouter;
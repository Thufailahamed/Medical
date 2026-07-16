// @ts-nocheck
// ─── Pharmacy router (Phase E-Rx 9) ─────────────────────────────
//
// Mounted at /pharmacy. Role-gated to role=pharmacy. Allows a
// pharmacist to list signed prescriptions awaiting dispensing for
// their active tenant, view detail, flip them to "dispensed", or
// reject them (which writes a "cancelled" audit row carrying the
// pharmacy's reason).
//
// Why a parallel router instead of widening /doctor/prescriptions/:id?
// The doctor endpoints enforce `prescriptions.doctorId = <this doctor>`
// ownership + filter the list by `doctorId`. A pharmacy user has no
// `doctors` row, and pharmacy is tenant-scoped, not prescriber-scoped
// — so the cleanest answer is a separate router that mirrors the
// state-machine + audit pattern but does its own scoping.
//
// State changes go through `applyRxTransition` (apps/api/src/lib/rxStatus.ts)
// so the same atomic guard + audit pair covers pharmacy transitions.
// The audit `details.reason` for cancellations lets reviewers trace
// stockouts back to the pharmacy that flagged them.

import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  prescriptions,
  medicines,
  doctors,
  patients,
  users,
  hospitals,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { applyRxTransition, consumeDispenseTokenAndTransition } from "../lib/rxStatus";
import { audit } from "../lib/audit";
import { notify } from "../lib/notifications";
import { dispenseTokenSchema } from "@healthcare/shared/validators";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();

// ─── Validation ─────────────────────────────────────────────────

const cancelBodySchema = z
  .object({
    reason: z.string().min(1).max(500).optional(),
  })
  .strict();

/** Truncate a token for the audit row — never log the full value. */
function tokenTail(t: string): string {
  return t.length >= 10 ? `${t.slice(0, 6)}…${t.slice(-4)}` : "***";
}

/** Resolve a display name for the dispensing pharmacy. Pharmacy users
 *  don't have a `pharmacies` table — we use the active hospital's
 *  name. Falls back to a synthetic label so the public /verify surface
 *  always has something to render. */
async function resolvePharmacyDisplayName(
  db: any,
  hospitalId: string | null
): Promise<string> {
  if (!hospitalId) return "Independent pharmacy";
  try {
    const [h] = await db
      .select({ name: hospitals.name })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);
    if (h?.name) return h.name;
  } catch {
    /* fall through */
  }
  return `Pharmacy #${hospitalId.slice(-6)}`;
}

// ─── Helpers ────────────────────────────────────────────────────

/** Read tenant context from middleware-set values. Falls back to user
 *  columns when the client didn't send headers. Pharmacy users are
 *  always tenant-scoped — we never let them see cross-tenant data. */
function resolveTenant(c: any): { hospitalId: string | null; clinicId: string | null } {
  const h = (c.get("activeHospitalId") as string | null | undefined) ?? null;
  const k = (c.get("activeClinicId") as string | null | undefined) ?? null;
  return { hospitalId: h, clinicId: k };
}

/** Loads a prescription with joins, scoped to the active tenant when
 *  one is set. Returns null if the row doesn't exist or isn't in
 *  the tenant. */
async function loadRxForPharmacy(
  db: any,
  id: string,
  tenant: { hospitalId: string | null; clinicId: string | null }
) {
  const [row] = await db
    .select({
      id: prescriptions.id,
      patientId: prescriptions.patientId,
      hospitalId: prescriptions.hospitalId,
      status: prescriptions.status,
      // Migration 0059: needed by the dispense route for token matching
      // + diagnostic differentiation (token_missing vs token_mismatch vs
      // token_consumed). Surfaced on every read so the route never has
      // to re-query.
      dispenseToken: prescriptions.dispenseToken,
      dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
    })
    .from(prescriptions)
    .where(eq(prescriptions.id, id))
    .limit(1);
  if (!row) return null;
  if (tenant.hospitalId && row.hospitalId && row.hospitalId !== tenant.hospitalId) {
    return null;
  }
  // prescriptions has no clinic_id column today. Until clinic-scoped
  // prescriptions are modeled, clinic-only pharmacy tenants cannot see
  // hospital prescriptions through this route.
  if (!tenant.hospitalId && tenant.clinicId) {
    return null;
  }
  return row;
}

// ─── GET /pharmacy/prescriptions ────────────────────────────────
//
// List prescriptions scoped to the active tenant. The `status` query
// param accepts the standard Rx enum (signed|dispensed|cancelled|
// draft). Defaults to `signed` — what a pharmacist needs at login.
router.get(
  "/prescriptions",
  authMiddleware,
  requireRole("pharmacy"),
  async (c) => {
    const db = c.get("db");
    const tenant = resolveTenant(c);
    const status = c.req.query("status") || "signed";
    const limit = Math.min(
      500,
      Math.max(1, parseInt(c.req.query("limit") || "200", 10) || 200)
    );

    const conditions: any[] = [];
    if (status !== "all") {
      conditions.push(eq(prescriptions.status, status));
    }
    if (tenant.hospitalId) {
      conditions.push(eq(prescriptions.hospitalId, tenant.hospitalId));
    } else if (tenant.clinicId) {
      return c.json({ prescriptions: [], count: 0 });
    }
    // Phase QR-Code Check-in & Dispensing: when a patient scans their
    // QR at the pharmacy desk, the portal redirects to this endpoint
    // with `?patient=<patientId>` so the pharmacist sees ONLY that
    // patient's signed Rx — empty-state card when none.
    const patientIdQ = c.req.query("patient");
    if (patientIdQ) {
      conditions.push(eq(prescriptions.patientId, patientIdQ));
    }

    const rows = await db
      .select({
        id: prescriptions.id,
        patientId: prescriptions.patientId,
        doctorId: prescriptions.doctorId,
        diagnosis: prescriptions.diagnosis,
        notes: prescriptions.notes,
        date: prescriptions.date,
        createdAt: prescriptions.createdAt,
        status: prescriptions.status,
        signedAt: prescriptions.signedAt,
        dispensedAt: prescriptions.dispensedAt,
        cancelledAt: prescriptions.cancelledAt,
        cancellationReason: prescriptions.cancellationReason,
        // Migration 0059: the single-use redemption token (set by
        // /sign). The pharmacy portal reads this back so its dispense
        // button can POST it on `x-dispense-token`. NULL on legacy
        // signed Rx — the portal should surface a clear "re-issue
        // required" state instead of letting dispense 400 silently.
        dispenseToken: prescriptions.dispenseToken,
        dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
        patientName: users.name,
        patientNic: users.nic,
      })
      .from(prescriptions)
      .innerJoin(patients, eq(patients.id, prescriptions.patientId))
      .innerJoin(users, eq(users.id, patients.userId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(prescriptions.date), desc(prescriptions.createdAt))
      .limit(limit);

    // Medicine counts in a single grouped query, mirroring the doctor
    // list at doctor.ts:738 so the row shape stays parallel.
    let medCountMap = new Map<string, number>();
    if (rows.length) {
      const medRows = await db
        .select({
          prescriptionId: medicines.prescriptionId,
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(medicines)
        .where(
          sql`${medicines.prescriptionId} IN (${sql.join(
            rows.map((r) => sql`${r.id}`),
            sql`, `
          )})`
        )
        .groupBy(medicines.prescriptionId);
      for (const m of medRows) {
        if (m.prescriptionId) {
          medCountMap.set(m.prescriptionId, Number(m.count) || 0);
        }
      }
    }

    const enriched = rows.map(({ patientName, patientNic, ...r }) => ({
      ...r,
      title: r.diagnosis
        ? `Prescription — ${r.diagnosis}`
        : "Prescription",
      patient: { id: r.patientId, name: patientName, nic: patientNic },
      medicineCount: medCountMap.get(r.id) ?? 0,
    }));

    return c.json({ prescriptions: enriched, count: enriched.length });
  }
);

// ─── GET /pharmacy/prescriptions/:id ────────────────────────────
//
// Single prescription detail for the pharmacy flow. Tenant-scoped;
// no ownership check (any pharmacy in the tenant can view).
router.get(
  "/prescriptions/:id",
  authMiddleware,
  requireRole("pharmacy"),
  async (c) => {
    const db = c.get("db");
    const tenant = resolveTenant(c);
    const id = c.req.param("id");

    const scoped = await loadRxForPharmacy(db, id, tenant);
    if (!scoped) {
      return c.json({ error: "Prescription not found" }, 404);
    }

    const [row] = await db
      .select({
        id: prescriptions.id,
        patientId: prescriptions.patientId,
        hospitalId: prescriptions.hospitalId,
        diagnosis: prescriptions.diagnosis,
        notes: prescriptions.notes,
        date: prescriptions.date,
        createdAt: prescriptions.createdAt,
        status: prescriptions.status,
        signedAt: prescriptions.signedAt,
        signedPayloadHash: prescriptions.signedPayloadHash,
        dispensedAt: prescriptions.dispensedAt,
        cancelledAt: prescriptions.cancelledAt,
        cancellationReason: prescriptions.cancellationReason,
        // Migration 0059: single-use redemption token + consumed
        // timestamp. The pharmacy portal's dispense button reads
        // these to compose the x-dispense-token header.
        dispenseToken: prescriptions.dispenseToken,
        dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
        doctorName: users.name,
        doctorSpecialization: doctors.specialization,
        doctorSlmcNo: doctors.slmcRegistrationNo,
      })
      .from(prescriptions)
      .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(eq(prescriptions.id, id))
      .limit(1);
    if (!row) {
      return c.json({ error: "Prescription not found" }, 404);
    }

    const [patientUser] = await db
      .select({ name: users.name, nic: users.nic })
      .from(users)
      .innerJoin(patients, eq(patients.userId, users.id))
      .where(eq(patients.id, row.patientId))
      .limit(1);

    const medRows = await db
      .select()
      .from(medicines)
      .where(eq(medicines.prescriptionId, id));

    return c.json({
      prescription: {
        ...row,
        patient: patientUser
          ? { name: patientUser.name, nic: patientUser.nic }
          : null,
        medicines: medRows.map((m: any) => ({ ...m, instructions: m.notes })),
      },
    });
  }
);

// ─── POST /pharmacy/prescriptions/:id/dispense ──────────────────
//
// Migration 0059: signed → dispensed is one-time-use. The pharmacist
// must present the `x-dispense-token` header (read from the QR the
// patient scanned or typed from the printed PDF). The transition +
// consume happens in a single conditional UPDATE; if the token has
// already been redeemed the WHERE clause matches zero rows and we
// follow up with a SELECT to differentiate the 4xx reason:
//   - missing header → 400 dispense_token_required
//   - prescription row gone → 404
//   - token doesn't match → 404 token_mismatch (no leak)
//   - token already consumed → 409 token_consumed
//   - wrong status (cancelled / already dispensed) → 409
//
// Tenant scoping unchanged from the pre-0059 version.
router.post(
  "/prescriptions/:id/dispense",
  authMiddleware,
  requireRole("pharmacy"),
  async (c) => {
    const db = c.get("db");
    const tenant = resolveTenant(c);
    const userId = c.get("userId");
    const id = c.req.param("id");

    // Migration 0059: require the single-use token. Header is the
    // canonical path (one tap from the QR-scanned portal); the
    // shape mirrors what the pharmacy portal already sends for
    // the (now-deprecated) `x-via-qr-token` logging header.
    const tokenRaw = c.req.header("x-dispense-token") || "";
    const parsedToken = dispenseTokenSchema.safeParse(tokenRaw);
    if (!parsedToken.success) {
      return c.json(
        {
          error: "dispense_token_required",
          message:
            "Provide the dispense token (base64url 20-64 chars) on the x-dispense-token header. It comes from the signed PDF's QR URL `?t=...` or the printed token under the signature block.",
        },
        400
      );
    }
    const token = parsedToken.data;

    const scoped = await loadRxForPharmacy(db, id, tenant);
    if (!scoped) {
      return c.json({ error: "Prescription not found" }, 404);
    }
    if (scoped.status !== "signed") {
      return c.json(
        {
          error: `Cannot dispense a ${scoped.status} prescription`,
          status: scoped.status,
          prescriptionId: id,
        },
        409
      );
    }
    if (!scoped.dispenseToken) {
      // Migration 0059: legacy signed Rx (pre-0059) have no token.
      // Force re-issue to keep the one-time-use guarantee airtight
      // rather than letting them slip through. Documented in the
      // migration file header.
      return c.json(
        {
          error: "dispense_token_missing",
          message:
            "This prescription was signed before redemption tokens were required and cannot be dispensed via the token-protected flow. Re-issue from the doctor portal.",
          prescriptionId: id,
        },
        400
      );
    }

    const now = new Date().toISOString();
    const pharmacyName = await resolvePharmacyDisplayName(
      db,
      tenant.hospitalId
    );

    const updated = await consumeDispenseTokenAndTransition({
      db,
      table: prescriptions,
      id,
      token,
      from: "signed",
      to: "dispensed",
      patch: {
        dispensedAt: now,
        dispenseTokenConsumedAt: now,
        dispensedByUserId: userId,
        dispensedByPharmacyName: pharmacyName,
      },
      actorId: userId,
      action: "prescription.dispensed",
      details: { actorRole: "pharmacy", tokenTail: tokenTail(token) },
      tokenColumns: {
        dispenseToken: prescriptions.dispenseToken,
        dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
      },
    });

    if (!updated) {
      // WHERE failed. Differentiate via a fresh read so the client
      // gets a useful error (the conditional UPDATE semantics make
      // this the only way to learn *why* the guard didn't fire).
      const [fresh] = await db
        .select({
          status: prescriptions.status,
          dispenseToken: prescriptions.dispenseToken,
          dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
        })
        .from(prescriptions)
        .where(eq(prescriptions.id, id))
        .limit(1);
      if (!fresh) {
        return c.json({ error: "Prescription not found" }, 404);
      }
      if (fresh.dispenseTokenConsumedAt) {
        return c.json(
          {
            error: "token_consumed",
            message:
              "This prescription has already been dispensed. The QR can only be redeemed once.",
            prescriptionId: id,
            dispensedAt: fresh.dispenseTokenConsumedAt,
          },
          409
        );
      }
      if (fresh.dispenseToken !== token) {
        // Don't leak whether the row exists; the caller already
        // passed the tenant + status checks above, so this is
        // effectively "wrong token for this Rx".
        return c.json(
          {
            error: "token_mismatch",
            message:
              "The dispense token doesn't match this prescription. Re-scan the QR.",
            prescriptionId: id,
          },
          404
        );
      }
      if (fresh.status !== "signed") {
        return c.json(
          {
            error: `Cannot dispense a ${fresh.status} prescription`,
            status: fresh.status,
            prescriptionId: id,
          },
          409
        );
      }
      // Fallback: shouldn't happen; the rows looked valid.
      return c.json(
        {
          error: "Concurrent modification",
          prescriptionId: id,
        },
        409
      );
    }

    const [patient] = await db
      .select({ userId: patients.userId })
      .from(patients)
      .where(eq(patients.id, scoped.patientId))
      .limit(1);
    if (patient?.userId) {
      await notify({
        db,
        userId: patient.userId,
        type: "prescription",
        title: "Prescription dispensed",
        body: "Your prescription has been dispensed by the pharmacy.",
        data: { kind: "prescription_dispensed", prescriptionId: id },
      });
    }

    return c.json({
      ok: true,
      prescriptionId: id,
      status: "dispensed",
      dispensedAt: updated.dispensedAt ?? now,
      dispensedBy: {
        pharmacyName:
          updated.dispensedByPharmacyName ?? pharmacyName,
        userId: updated.dispensedByUserId ?? userId,
      },
    });
  }
);

// ─── POST /pharmacy/prescriptions/:id/reject ────────────────────
//
// Pharmacy-side reject: signed → cancelled with a reason. Reuses the
// state-machine `applyRxTransition` so the cancel guard + audit row
// mirror the doctor's cancel path. The `reason` ends up in the
// audit row's `details.reason` and on the prescriptions
// `cancellationReason` column.
router.post(
  "/prescriptions/:id/reject",
  authMiddleware,
  requireRole("pharmacy"),
  async (c) => {
    const db = c.get("db");
    const tenant = resolveTenant(c);
    const userId = c.get("userId");
    const id = c.req.param("id");

    let rawBody: unknown = {};
    try {
      rawBody = await c.req.json();
    } catch {
      // empty body is allowed
    }
    const parsed = cancelBodySchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      return c.json(
        { error: "Invalid reject body", issues: parsed.error.flatten() },
        400
      );
    }
    const reason = parsed.data.reason ?? null;

    const scoped = await loadRxForPharmacy(db, id, tenant);
    if (!scoped) {
      return c.json({ error: "Prescription not found" }, 404);
    }
    if (scoped.status !== "signed") {
      return c.json(
        {
          error: `Cannot reject a ${scoped.status} prescription`,
          status: scoped.status,
          prescriptionId: id,
        },
        409
      );
    }

    const updated = await applyRxTransition({
      db,
      table: prescriptions,
      id,
      from: "signed",
      to: "cancelled",
      patch: {
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason,
      },
      actorId: userId,
      action: "prescription.cancelled",
      details: { actorRole: "pharmacy", reason },
    });

    if (!updated) {
      return c.json(
        {
          error: "Prescription is not in 'signed' state",
          prescriptionId: id,
        },
        409
      );
    }

    const [patient] = await db
      .select({ userId: patients.userId })
      .from(patients)
      .where(eq(patients.id, scoped.patientId))
      .limit(1);
    if (patient?.userId) {
      await notify({
        db,
        userId: patient.userId,
        type: "prescription",
        title: "Prescription rejected",
        body: reason || "The pharmacy rejected your prescription.",
        data: { kind: "prescription_rejected", prescriptionId: id, reason },
      });
    }

    return c.json({
      ok: true,
      prescriptionId: id,
      status: "cancelled",
      cancelledAt: updated.cancelledAt ?? null,
      cancellationReason: updated.cancellationReason ?? null,
    });
  }
);

export default router;

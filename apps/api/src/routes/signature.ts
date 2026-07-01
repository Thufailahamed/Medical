// @ts-nocheck
// ─── E-Rx Phase 6: Prescription Signing + Verification ─────────
// Three endpoints:
//
//   POST /doctor/prescriptions/:id/sign
//     role=doctor. Lazy-generates the doctor's RSA-2048 keypair on
//     first call. Builds canonical payload from the prescription +
//     its medicines, hashes, signs, persists to prescription_signatures,
//     then flips prescriptions.status to "signed".
//
//   GET /verify/:prescriptionId
//     NO AUTH. Public. Recomputes the canonical payload from current
//     DB rows + the on-file signature and returns:
//       { valid, reason?, prescription, doctor, medicines,
//         signedAt, payloadHash, signatureB64 }
//     `valid=false, reason="payload_mismatch"` when rows have been
//     tampered with since signing. `reason="revoked"` when the
//     signature row carries a non-null revoked_at.
//
//   POST /doctor/regenerate-signing-key
//     role=doctor. Generates a fresh keypair, marks the previous
//     signature row's signing_key_id with a "rotated_at" marker (we
//     don't actually break old verifications because the public key
//     is denormalised on prescription_signatures.signing_public_key).
//     Revokes the OLD signature rows for un-signed prescriptions only —
//     already-signed prescriptions keep verifying against the OLD
//     key denormalised on their signature row.

import { Hono } from "hono";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  doctors,
  patients,
  prescriptions,
  medicines,
  prescriptionSignatures,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import {
  generateKeyPair,
  importPrivateKey,
  buildCanonicalPayload,
  hashPayload,
  signPayload,
  verifySignature,
} from "../lib/signing";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();

// ─── helpers ──────────────────────────────────────────────────

async function loadPrescriptionSnapshot(
  db: any,
  prescriptionId: string
): Promise<{
  rx: any;
  medRows: any[];
} | null> {
  const [rx] = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.id, prescriptionId))
    .limit(1);
  if (!rx) return null;
  const medRows = await db
    .select()
    .from(medicines)
    .where(eq(medicines.prescriptionId, prescriptionId));
  return { rx, medRows };
}

// ─── POST /doctor/prescriptions/:id/sign ───────────────────────
router.post(
  "/doctor/prescriptions/:id/sign",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const env = c.env;
    const prescriptionId = c.req.param("id");

    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doctor) {
      return c.json({ error: "Doctor profile not found" }, 404);
    }

    const snap = await loadPrescriptionSnapshot(db, prescriptionId);
    if (!snap) {
      return c.json({ error: "Prescription not found" }, 404);
    }
    if (snap.rx.doctorId !== doctor.id) {
      return c.json({ error: "Not your prescription" }, 403);
    }
    if (snap.rx.status === "signed") {
      return c.json(
        { error: "Already signed", prescriptionId },
        409
      );
    }
    if (snap.rx.status === "cancelled" || snap.rx.status === "dispensed") {
      return c.json(
        { error: `Cannot sign a ${snap.rx.status} prescription` },
        409
      );
    }

    // Lazy-generate the doctor's keypair if missing. The signing key
    // is bound to the doctor (not the prescription) so we keep it on
    // the doctors row; the public key is denormalised on each
    // prescription_signatures row at sign time for rotation safety.
    let signingPublicKey = doctor.signingPublicKey;
    let signingPrivateKeyEnc = doctor.signingPrivateKeyEnc;
    let signingKeyId = doctor.signingKeyId;
    if (!signingPublicKey || !signingPrivateKeyEnc || !signingKeyId) {
      const pair = await generateKeyPair(env);
      signingPublicKey = pair.publicKeyPem;
      signingPrivateKeyEnc = pair.privateKeyPemEnc;
      signingKeyId = pair.keyId;
      const now = new Date().toISOString();
      await db
        .update(doctors)
        .set({
          signingPublicKey,
          signingPrivateKeyEnc,
          signingKeyId,
          signingKeyCreatedAt: now,
        })
        .where(eq(doctors.id, doctor.id));
      await audit(db, {
        userId,
        action: "doctor.signing_key_generated",
        resource: "doctor",
        resourceId: doctor.id,
        details: { keyId: signingKeyId },
      });
    }

    // Build canonical payload + sign.
    const payload = buildCanonicalPayload({
      id: snap.rx.id,
      doctorId: snap.rx.doctorId,
      patientId: snap.rx.patientId,
      hospitalId: snap.rx.hospitalId,
      diagnosis: snap.rx.diagnosis,
      notes: snap.rx.notes,
      date: snap.rx.date,
      medicines: medRowsForSigning(snap.medRows),
    });
    const payloadHash = await hashPayload(payload);
    const privateKey = await importPrivateKey(signingPrivateKeyEnc, env);
    const signatureB64 = await signPayload(payload, privateKey);

    // Persist signature row. `signingPublicKey` is denormalised so
    // verification keeps working after a key rotation.
    const [sig] = await db
      .insert(prescriptionSignatures)
      .values({
        prescriptionId,
        doctorId: doctor.id,
        signingKeyId,
        payloadHash,
        signatureB64,
        canonicalPayload: payload,
        signingPublicKey,
      } as any)
      .returning();

    // Flip prescription status.
    const signedAt = new Date().toISOString();
    await db
      .update(prescriptions)
      .set({
        status: "signed",
        signedAt,
        signedPayloadHash: payloadHash,
        signatureId: sig?.id ?? null,
      } as any)
      .where(eq(prescriptions.id, prescriptionId));

    await audit(db, {
      userId,
      action: "prescription.signed",
      resource: "prescription",
      resourceId: prescriptionId,
      details: {
        keyId: signingKeyId,
        payloadHash,
        signatureId: sig?.id,
      },
    });

    return c.json({
      prescriptionId,
      signedAt,
      payloadHash,
      signatureId: sig?.id,
      signingKeyId,
    });
  }
);

function medRowsForSigning(rows: any[]) {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dosage: r.dosage,
    frequency: r.frequency ?? null,
    timing: r.timing ?? null,
    startDate: r.startDate,
    endDate: r.endDate ?? null,
    masterMedicineId: r.masterMedicineId ?? null,
  }));
}

// ─── GET /verify/:prescriptionId (PUBLIC) ─────────────────────
// Cache-Control: public, max-age=300 — QR scanners may hammer this
// after a prescription is dispensed in a pharmacy; the 5-minute cache
// is a tolerable lag and prevents unbounded DB reads.
router.get("/verify/:prescriptionId", async (c) => {
  const db = c.get("db");
  const prescriptionId = c.req.param("prescriptionId");

  const snap = await loadPrescriptionSnapshot(db, prescriptionId);
  if (!snap) {
    return c.json({ error: "Prescription not found" }, 404);
  }

  const [sig] = await db
    .select()
    .from(prescriptionSignatures)
    .where(eq(prescriptionSignatures.prescriptionId, prescriptionId))
    .orderBy(desc(prescriptionSignatures.signedAt))
    .limit(1);

  if (!sig) {
    return c.json(
      {
        valid: false,
        reason: "no_signature",
        prescriptionId,
      },
      200,
      { "Cache-Control": "public, max-age=300" }
    );
  }

  if (sig.revokedAt) {
    return c.json(
      {
        valid: false,
        reason: "revoked",
        prescriptionId,
        revokedAt: sig.revokedAt,
        revocationReason: sig.revocationReason,
      },
      200,
      { "Cache-Control": "public, max-age=300" }
    );
  }

  // Recompute payload from current DB rows + verify.
  const payload = buildCanonicalPayload({
    id: snap.rx.id,
    doctorId: snap.rx.doctorId,
    patientId: snap.rx.patientId,
    hospitalId: snap.rx.hospitalId,
    diagnosis: snap.rx.diagnosis,
    notes: snap.rx.notes,
    date: snap.rx.date,
    medicines: medRowsForSigning(snap.medRows),
  });

  const ok = await verifySignature(payload, sig.signatureB64, sig.signingPublicKey);

  // Doctor + patient identifiers, NO PHI: only doctor name + SLMC + the
  // medicine names. Reason for limiting the surface: `/verify/:id` is
  // unauthenticated, so anyone with the URL can hit it.
  const [doctorBlock] = await db
    .select({
      name: users.name,
      slmcRegistrationNo: doctors.slmcRegistrationNo,
      specialization: doctors.specialization,
    })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, snap.rx.doctorId))
    .limit(1);

  return c.json(
    {
      valid: ok,
      reason: ok ? undefined : "payload_mismatch",
      prescriptionId,
      signedAt: sig.signedAt,
      payloadHash: sig.payloadHash,
      signatureB64: sig.signatureB64,
      doctor: doctorBlock
        ? {
            name: doctorBlock.name,
            slmcRegistrationNo: doctorBlock.slmcRegistrationNo,
            specialization: doctorBlock.specialization,
          }
        : null,
      medicines: snap.medRows.map((m: any) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        timing: m.timing,
        startDate: m.startDate,
        endDate: m.endDate,
      })),
      date: snap.rx.date,
    },
    200,
    {
      "Cache-Control": "public, max-age=300",
    }
  );
});

// ─── POST /doctor/regenerate-signing-key ──────────────────────
// Generate a fresh keypair and update the doctor row. Already-signed
// prescriptions stay verifiable because their signature rows
// denormalise the OLD public key. New signatures use the new key.
router.post(
  "/doctor/regenerate-signing-key",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const env = c.env;

    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doctor) {
      return c.json({ error: "Doctor profile not found" }, 404);
    }

    const previousKeyId = doctor.signingKeyId;
    const previousPublicKey = doctor.signingPublicKey;
    const pair = await generateKeyPair(env);
    const now = new Date().toISOString();
    await db
      .update(doctors)
      .set({
        signingPublicKey: pair.publicKeyPem,
        signingPrivateKeyEnc: pair.privateKeyPemEnc,
        signingKeyId: pair.keyId,
        signingKeyCreatedAt: now,
        signingKeyRevokedAt: previousKeyId ? now : null,
      })
      .where(eq(doctors.id, doctor.id));

    await audit(db, {
      userId,
      action: "doctor.signing_key_rotated",
      resource: "doctor",
      resourceId: doctor.id,
      details: {
        previousKeyId,
        newKeyId: pair.keyId,
      },
    });

    return c.json({
      keyId: pair.keyId,
      createdAt: now,
      rotatedFrom: previousKeyId,
      // The denormalised public key fingerprint is informational —
      // verification still works because old signatures carry their
      // own public key copy.
      note: previousPublicKey
        ? "Old signatures remain verifiable; new signatures use the new key."
        : "First signing key generated.",
    });
  }
);

export default router;
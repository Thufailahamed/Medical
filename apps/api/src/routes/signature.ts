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
import { txWrite } from "../lib/tx";
import { withStatusGuard } from "../lib/status-guard";
import { notify } from "../lib/notifications";
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

    // P2 atomicity: the previous version did INSERT signature + UPDATE
    // prescription as two independent writes. Two concurrent sign
    // requests both observed status='draft' and both inserted
    // signature rows — the verification path picked the "latest" via
    // ORDER BY signedAt DESC, but both signatures existed with no
    // way to dedupe. Now:
    //   1. Insert signature row.
    //   2. Use withStatusGuard to flip status from ['draft'] → 'signed'
    //      atomically. If another request already flipped, the
    //      conditional UPDATE matches zero rows and we return 409.
    //   3. Wrap the whole batch in a single tx so the signature and
    //      status flip either both commit or both roll back.
    //
    // The (prescription_id) UNIQUE index added in migration 0025
    // makes the INSERT the second-line defence: even if withStatusGuard
    // somehow lost the race, the second signature insert will fail
    // with a unique-constraint violation and the route returns 409.
    const signedAt = new Date().toISOString();
    // Migration 0059: bind this Rx to one dispense event. Minted inside
    // the same tx as the signature INSERT so the row never exists in a
    // `signed` state with a missing token. Atomic with withStatusGuard's
    // patch — retry-on-409 cycles all mint a fresh value.
    const dispenseToken = mintDispenseToken();

    let sig: any;
    let statusFlipped = false;
    try {
      const result = await txWrite(db, async (tx) => {
        const [s] = await tx
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

        const guard = await withStatusGuard(
          tx,
          prescriptions,
          prescriptionId,
          ["draft"],
          {
            status: "signed",
            signedAt,
            signedPayloadHash: payloadHash,
            signatureId: s?.id ?? null,
            dispenseToken,
          }
        );
        return { sig: s, flipped: guard.changed };
      });
      sig = result.sig;
      statusFlipped = result.flipped;
    } catch (err: any) {
      const m = String(err?.message || "").toLowerCase();
      if (m.includes("unique") || m.includes("constraint")) {
        // Concurrent sign request beat us — the row is already signed.
        return c.json(
          { error: "Already signed", prescriptionId },
          409
        );
      }
      throw err;
    }

    if (!statusFlipped) {
      // Signature row inserted but status didn't flip — another
      // request already flipped it. Roll forward the cache / return 409.
      return c.json(
        { error: "Already signed", prescriptionId },
        409
      );
    }

    await audit(db, {
      userId,
      action: "prescription.signed",
      resource: "prescription",
      resourceId: prescriptionId,
      details: {
        keyId: signingKeyId,
        payloadHash,
        signatureId: sig?.id,
        dispenseTokenTail: tokenTail(dispenseToken),
      },
    });

    const [patient] = await db
      .select({ userId: patients.userId })
      .from(patients)
      .where(eq(patients.id, snap.rx.patientId))
      .limit(1);
    if (patient?.userId) {
      await notify({
        db,
        userId: patient.userId,
        type: "prescription",
        title: "New e-prescription ready",
        body: "Your doctor has signed a new e-prescription.",
        data: {
          kind: "prescription_signed",
          prescriptionId,
          doctorId: doctor.id,
        },
      });
    }

    return c.json({
      prescriptionId,
      signedAt,
      payloadHash,
      signatureId: sig?.id,
      signingKeyId,
      // Migration 0059: one-time-use redemption token. Embed in the
      // signed PDF's QR (`?t=...`) and hand to the pharmacy operator
      // who scans it. The dispense route consumes this exact string.
      dispenseToken,
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

// ─── helpers: one-time-use redemption token (migration 0059) ────
//
// 32 random bytes → base64url (43 chars). Lives on the prescription
// row, embedded in the QR URL the PDF renders, and consumed by the
// pharmacy/doctor dispense route. The string format intentionally
// stays out of the signed payload — the token is a redemption
// control, not a content attestation; signing it would couple key
// rotation to token rotation for no benefit.
function b64urlencode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function mintDispenseToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64urlencode(bytes); // → 43 chars
}

function tokenTail(t: string): string {
  return t.length >= 10 ? `${t.slice(0, 6)}…${t.slice(-4)}` : "***";
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

  // Migration 0059: redemption state. Only join users when the row
  // has actually been dispensed — keeps the by-id verify path
  // (99% of calls) to a single round-trip.
  const tx = c.req.query("t") || null;
  let dispensedBy: { pharmacyName: string | null; userName: string | null } | null = null;
  if (snap.rx.status === "dispensed" && snap.rx.dispensedByUserId) {
    const [op] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, snap.rx.dispensedByUserId))
      .limit(1);
    dispensedBy = {
      pharmacyName: snap.rx.dispensedByPharmacyName ?? null,
      userName: op?.name ?? null,
    };
  }

  return c.json(
    {
      valid: ok,
      reason: ok ? undefined : "payload_mismatch",
      prescriptionId,
      // E-Rx Phase 8: lifecycle. `'draft'` shouldn't reach this branch
      // because there's no signature row, but include defensively.
      status: snap.rx.status,
      dispenseTokenConsumed: !!snap.rx.dispenseTokenConsumedAt,
      // Informational echo of the supplied token (if any). The verify
      // surface never *authenticates* the token — anyone with the URL
      // sees the same shape — but echoing `t` lets the marketing-side
      // render a "this token you scanned matches the prescription"
      // affirmation without exposing full equality tables.
      tokenMatches: tx ? tx === snap.rx.dispenseToken : null,
      dispensedAt: snap.rx.dispensedAt ?? null,
      cancelledAt: snap.rx.cancelledAt ?? null,
      dispensedBy,
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
// @ts-nocheck

import { Hono } from "hono";
import { eq, or, like, desc, and } from "drizzle-orm";
import { doctors, patients, users, medicalRecords, appointments, medicines, prescriptions, hospitals, doctorAvailability, doctorTimeOff, prescriptionSignatures } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import { topSeverity } from "../lib/safety-engine";
import { runSafetyCheck } from "../lib/safety-runner";
import type { AppEnvironment } from "../types";

const doctorRouter = new Hono<AppEnvironment>();

// ─── Doctor dashboard ────────────────────────────────────
doctorRouter.get("/dashboard", authMiddleware, requireRole("doctor"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor profile not found" }, 404);
  }

  const today = new Date().toISOString().split("T")[0];

  const todaysAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctor.id),
        eq(appointments.date, today)
      )
    )
    .orderBy(appointments.queueNumber);

  const totalPatients = await db
    .select()
    .from(patients)
    .innerJoin(medicalRecords, eq(patients.id, medicalRecords.patientId))
    .where(eq(medicalRecords.doctorId, doctor.id));

  const uniquePatients = new Set(totalPatients.map((r) => r.patients.id));

  return c.json({
    doctor,
    stats: {
      todayAppointments: todaysAppointments.length,
      totalPatients: uniquePatients.size,
    },
    todaysAppointments,
  });
});

// ─── Search patients ─────────────────────────────────────
doctorRouter.get("/search-patients", authMiddleware, requireRole("doctor"), async (c) => {
  const query = c.req.query("q");
  const db = c.get("db");

  if (!query || query.length < 2) {
    return c.json({ patients: [] });
  }

  // Sanitize query to prevent injection
  const safeQuery = query.replace(/[%_]/g, "\\$&");

  const results = await db
    .select()
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(
      or(
        like(users.name, `%${safeQuery}%`),
        like(users.nic, `%${safeQuery}%`),
        like(users.phone, `%${safeQuery}%`)
      )
    )
    .limit(20);

  return c.json({ patients: results });
});

// ─── Create prescription ─────────────────────────────────
doctorRouter.post("/prescriptions", authMiddleware, requireRole("doctor"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  // Phase E-Rx 3: safety pre-flight. Mirrors the pattern in
  // `medicines.ts POST /` so doctors see the same 409 confirmation
  // when a candidate Rx would hit a critical allergy, severe
  // interaction, or duplicate-therapy wall. X-Confirm-Warning carries
  // the explicit override after the doctor acknowledges in the UI.
  const candidateMeds: Array<{
    name: string;
    dosage?: string;
    masterMedicineId?: string | null;
  }> = Array.isArray(body.medicines) ? body.medicines : [];
  const safetyWarnings = await runSafetyCheck(db, body.patientId, candidateMeds);
  const safetyTop = topSeverity(safetyWarnings);
  const override = c.req.header("X-Confirm-Warning") === "true";
  const BLOCKING = (w: { severity: string }) =>
    w.severity === "severe" || w.severity === "critical";
  if (safetyTop && BLOCKING({ severity: safetyTop }) && !override) {
    return c.json(
      {
        error: "Safety warning",
        requiresConfirmation: true,
        warnings: safetyWarnings,
        severity: safetyTop,
        message: `Severe safety warning detected (${safetyTop}). Confirm to proceed.`,
      },
      409
    );
  }

  // Create prescription record in prescriptions table
  const [prescription] = await db
    .insert(prescriptions)
    .values({
      doctorId: doctor.id,
      patientId: body.patientId,
      hospitalId: body.hospitalId,
      diagnosis: body.diagnosis,
      notes: body.notes,
      date: new Date().toISOString().split("T")[0],
      // Phase E-Rx 6: lifecycle default. The route always writes
      // "draft" — only POST /sign can flip to "signed". zod .strict()
      // on the body rejects any client-supplied `status`.
    })
    .returning();

  // Phase E-Rx 3: audit when the doctor overrode safety warnings.
  // Captures the full warning set in `details` so reviewers can audit
  // overrides without re-running the engine against stale state.
  if (override && safetyWarnings.length) {
    await audit(db, {
      userId,
      action: "prescription.create_with_warnings",
      resource: "prescription",
      resourceId: prescription?.prescriptions?.id,
      details: {
        severity: safetyTop,
        warnings: safetyWarnings,
      },
    });
  }

  // Create medical record (prescription type) linked to the patient
  const [record] = await db
    .insert(medicalRecords)
    .values({
      patientId: body.patientId,
      hospitalId: body.hospitalId,
      doctorId: doctor.id,
      recordType: "prescription",
      title: `Prescription - ${body.diagnosis || "General"}`,
      diagnosis: body.diagnosis,
      notes: body.notes,
      date: new Date().toISOString().split("T")[0],
    })
    .returning();

  // Create medicines linked to the prescription
  if (body.medicines?.length > 0) {
    await db.insert(medicines).values(
      body.medicines.map((med: any) => ({
        patientId: body.patientId,
        prescriptionId: prescription.id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        timing: med.timing,
        startDate: med.startDate || new Date().toISOString().split("T")[0],
        endDate: med.endDate,
        // Phase E-Rx 1: optional master FK. Doctors picking from the
        // autocomplete carry this; free-text entries stay NULL.
        masterMedicineId: med.masterMedicineId ?? null,
      }))
    );
  }

  return c.json({ prescription }, 201);
});

// ─── Get doctor's prescriptions ──────────────────────────
doctorRouter.get("/prescriptions", authMiddleware, requireRole("doctor"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  const records = await db
    .select({
      id: medicalRecords.id,
      patientId: medicalRecords.patientId,
      doctorId: medicalRecords.doctorId,
      title: medicalRecords.title,
      diagnosis: medicalRecords.diagnosis,
      summary: medicalRecords.summary,
      notes: medicalRecords.notes,
      date: medicalRecords.date,
      followUpDate: medicalRecords.followUpDate,
      createdAt: medicalRecords.createdAt,
    })
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.doctorId, doctor.id),
        eq(medicalRecords.recordType, "prescription")
      )
    )
    .orderBy(desc(medicalRecords.date));

  // Enrich with patient name + medicine count in one pass.
  const patientIds = [...new Set(records.map((r) => r.patientId).filter(Boolean))];
  const rxIds = records.map((r) => r.id);

  let patientMap = new Map<string, { id: string; name: string }>();
  if (patientIds.length) {
    const rows = await db
      .select({
        id: patients.id,
        patientId: patients.userId,
        name: users.name,
      })
      .from(patients)
      .innerJoin(users, eq(users.id, patients.userId))
      .where(
        or(...patientIds.map((id) => eq(patients.id, id))) as any
      );
    for (const r of rows) {
      patientMap.set(r.id, { id: r.id, name: r.name });
    }
  }

  let medCountMap = new Map<string, number>();
  if (rxIds.length) {
    const medRows = await db
      .select({ prescriptionId: medicines.prescriptionId })
      .from(medicines);
    for (const m of medRows) {
      if (!m.prescriptionId) continue;
      medCountMap.set(m.prescriptionId, (medCountMap.get(m.prescriptionId) ?? 0) + 1);
    }
  }

  const enriched = records.map((r) => ({
    ...r,
    patient: patientMap.get(r.patientId) || null,
    medicineCount: medCountMap.get(r.id) ?? 0,
  }));

  return c.json({ prescriptions: enriched, count: enriched.length });
});

// ─── Single prescription detail (Phase 3.1 slice 2) ─────────
// Powers /doctor/prescription-detail on mobile. Mirrors the PDF route's
// joins so the screen sees the same doctor + patient + medicine shape
// as the rendered document. Ordered BEFORE the :id/pdf route so Hono
// matches the literal "/:id" before the longer "/:id/pdf" pattern.
doctorRouter.get(
  "/prescriptions/:id",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const id = c.req.param("id");

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
        doctorUserId: doctors.userId,
        doctorName: users.name,
        doctorSpecialization: doctors.specialization,
        doctorSlmcNo: doctors.slmcRegistrationNo,
        doctorSlmcVerifiedAt: doctors.slmcVerifiedAt,
      })
      .from(prescriptions)
      .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(eq(prescriptions.id, id))
      .limit(1);

    if (!row) {
      return c.json({ error: "Prescription not found" }, 404);
    }
    if (row.doctorUserId !== userId) {
      return c.json({ error: "Not your prescription" }, 403);
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
        medicines: medRows,
      },
    });
  }
);

// ─── Prescription PDF (Phase 3.1 slice 2) ─────────────────
// Server-rendered A4 PDF streamed back as application/pdf. Re-rendered
// per request — pdf-lib output is cheap and we have no retention use
// case yet. When the patient-side "view my prescriptions" flow lands in
// Phase 3.2 we'll add a "first-render" cache.
doctorRouter.get(
  "/prescriptions/:id/pdf",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const id = c.req.param("id");

    const [row] = await db
      .select({
        id: prescriptions.id,
        doctorId: prescriptions.doctorId,
        patientId: prescriptions.patientId,
        diagnosis: prescriptions.diagnosis,
        notes: prescriptions.notes,
        date: prescriptions.date,
        status: prescriptions.status,
        signedAt: prescriptions.signedAt,
        signedPayloadHash: prescriptions.signedPayloadHash,
        doctorName: users.name,
        doctorUserId: doctors.userId,
        doctorSpecialization: doctors.specialization,
        doctorSlmcNo: doctors.slmcRegistrationNo,
        doctorSlmcVerifiedAt: doctors.slmcVerifiedAt,
        patientDob: patients.dateOfBirth,
      })
      .from(prescriptions)
      .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .innerJoin(patients, eq(patients.id, prescriptions.patientId))
      .where(eq(prescriptions.id, id))
      .limit(1);

    if (!row) {
      return c.json({ error: "Prescription not found" }, 404);
    }
    if (row.doctorUserId !== userId) {
      return c.json({ error: "Not your prescription" }, 403);
    }

    // Phase E-Rx 7: PDF rendering requires a signed prescription. The
    // QR + signature block at the bottom is meaningless on a draft, and
    // exposing draft PDFs would let the doctor share something that
    // can't be verified. Sign first via POST /doctor/prescriptions/:id/sign
    // then re-download.
    if (row.status !== "signed") {
      return c.json(
        {
          error: "Prescription must be signed before downloading the PDF",
          status: row.status,
          prescriptionId: id,
        },
        409
      );
    }

    // Fetch the signature row so the footer can show the actual
    // payload hash + signed-at the verifier will see on /verify/:id.
    const [sig] = await db
      .select({
        signedAt: prescriptionSignatures.signedAt,
        payloadHash: prescriptionSignatures.payloadHash,
        signatureB64: prescriptionSignatures.signatureB64,
      })
      .from(prescriptionSignatures)
      .where(eq(prescriptionSignatures.prescriptionId, id))
      .limit(1);

    // Patient name + NIC live on `users` (joined through patients.userId).
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

    // Lazy-load pdf-lib so the module isn't pulled into the cold path
    // for non-PDF doctor routes.
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4 portrait (pt)
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 48;
    const pageW = 595;
    let y = 842 - margin;

    // ─── Header ──────────────────────────────────────────
    page.drawText("HealthHub Prescription", {
      x: margin,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.08, 0.09, 0.16),
    });
    y -= 22;
    page.drawText(row.doctorName, {
      x: margin,
      y,
      size: 11,
      font,
      color: rgb(0.25, 0.25, 0.32),
    });
    if (row.doctorSpecialization) {
      const offset = font.widthOfTextAtSize(row.doctorName, 11);
      page.drawText(`  ·  ${row.doctorSpecialization}`, {
        x: margin + offset,
        y,
        size: 11,
        font,
        color: rgb(0.45, 0.45, 0.52),
      });
    }
    y -= 14;
    if (row.doctorSlmcNo) {
      const slmcText = `SLMC Reg. No: ${row.doctorSlmcNo}${
        row.doctorSlmcVerifiedAt ? "" : "  (pending verification)"
      }`;
      page.drawText(slmcText, {
        x: margin,
        y,
        size: 9,
        font,
        color: row.doctorSlmcVerifiedAt
          ? rgb(0.25, 0.25, 0.32)
          : rgb(0.6, 0.45, 0.1),
      });
      y -= 14;
    }

    page.drawLine({
      start: { x: margin, y: y - 2 },
      end: { x: pageW - margin, y: y - 2 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.9),
    });
    y -= 18;

    // ─── Patient block ───────────────────────────────────
    const patientName = patientUser?.name ?? "Unknown patient";
    const patientNic = patientUser?.nic ?? "—";
    const age = computeAge(row.patientDob);

    page.drawText("PATIENT", {
      x: margin,
      y,
      size: 8,
      font: fontBold,
      color: rgb(0.45, 0.45, 0.52),
    });
    y -= 14;
    page.drawText(patientName, {
      x: margin,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.08, 0.09, 0.16),
    });
    const dateLabel = `Date: ${row.date}`;
    page.drawText(dateLabel, {
      x: pageW - margin - font.widthOfTextAtSize(dateLabel, 11),
      y,
      size: 11,
      font,
      color: rgb(0.25, 0.25, 0.32),
    });
    y -= 14;
    const meta = `NIC: ${patientNic}${age !== null ? `   ·   Age: ${age}` : ""}`;
    page.drawText(meta, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.42),
    });
    y -= 22;

    // ─── Diagnosis / notes ───────────────────────────────
    if (row.diagnosis) {
      page.drawText("DIAGNOSIS", {
        x: margin,
        y,
        size: 8,
        font: fontBold,
        color: rgb(0.45, 0.45, 0.52),
      });
      y -= 14;
      page.drawText(row.diagnosis, {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(0.08, 0.09, 0.16),
      });
      y -= 18;
    }

    if (row.notes) {
      page.drawText("NOTES", {
        x: margin,
        y,
        size: 8,
        font: fontBold,
        color: rgb(0.45, 0.45, 0.52),
      });
      y -= 14;
      page.drawText(row.notes, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.25, 0.25, 0.32),
      });
      y -= 16;
    }

    // ─── Medicines table ────────────────────────────────
    page.drawText("MEDICINES", {
      x: margin,
      y,
      size: 8,
      font: fontBold,
      color: rgb(0.45, 0.45, 0.52),
    });
    y -= 16;

    if (medRows.length === 0) {
      page.drawText("(no medicines on this prescription)", {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.55, 0.55, 0.62),
      });
      y -= 14;
    } else {
      const cols = [
        { label: "Name", x: margin, w: 180 },
        { label: "Dosage", x: margin + 180, w: 70 },
        { label: "Frequency", x: margin + 250, w: 110 },
        { label: "Timing", x: margin + 360, w: 80 },
        { label: "Duration", x: margin + 440, w: 60 },
      ];
      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: pageW - margin * 2,
        height: 16,
        color: rgb(0.95, 0.96, 0.98),
      });
      for (const col of cols) {
        page.drawText(col.label, {
          x: col.x,
          y,
          size: 9,
          font: fontBold,
          color: rgb(0.25, 0.25, 0.32),
        });
      }
      y -= 18;

      for (const med of medRows) {
        const duration = med.endDate
          ? `${med.startDate} - ${med.endDate}`
          : "ongoing";
        const cells = [
          med.name ?? "—",
          med.dosage ?? "—",
          med.frequency ?? "—",
          med.timing ?? "—",
          duration,
        ];
        cells.forEach((text, i) => {
          page.drawText(truncate(text, cols[i].w, font, 10), {
            x: cols[i].x,
            y,
            size: 10,
            font,
            color: rgb(0.08, 0.09, 0.16),
          });
        });
        y -= 16;
      }
    }

    // ─── Signature block + QR + footer ─────────────────
    // Phase E-Rx 7: signed prescriptions embed a scannable QR that
    // points at GET /verify/:id so anyone (pharmacy, patient, regulator)
    // can confirm authenticity from the printed PDF. The QR target is
    // the public base URL + prescription id, NOT a deep link into the
    // mobile app — verification works without the app installed.
    const sigY = Math.max(margin + 110, y + 20);
    const verifyUrl = `${(c.env.PUBLIC_URL || "https://app.healthhub.app").replace(/\/+$/, "")}/verify/${id}`;

    // Lazy-load qrcode (same pattern as pdf-lib — keep cold path lean).
    // `toBuffer` returns a PNG buffer we embed via pdf.embedPng.
    // The `browser` field in qrcode's package.json maps
    // `qrcode/lib/index.js` → `qrcode/lib/browser.js` (canvas-backed,
    // not available in Workers). The bundler additionally collapses
    // `qrcode` to the bare `core/qrcode.js` which lacks `toBuffer`.
    // Importing the server entry directly bypasses both mappings;
    // `server.js` uses pngjs (zero native deps).
    const qrServer = await import("qrcode/lib/server.js");
    const qrPngBytes: Buffer = await new Promise((resolve, reject) => {
      (qrServer as any).toBuffer(
        verifyUrl,
        {
          errorCorrectionLevel: "M",
          type: "png",
          margin: 1,
          width: 256,
        },
        (err: Error | null | undefined, buf: Buffer) =>
          err ? reject(err) : resolve(buf)
      );
    });
    const qrImg = await pdf.embedPng(qrPngBytes);

    // QR lives bottom-right; sized so a phone scanner reliably picks it
    // up at A4 print resolution. 80pt = ~28mm square.
    const qrSize = 80;
    const qrX = pageW - margin - qrSize;
    const qrY = margin;
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    page.drawText("Scan to verify", {
      x: qrX,
      y: qrY - 10,
      size: 7,
      font,
      color: rgb(0.45, 0.45, 0.52),
    });

    // Signed-on + payload hash + verify URL sit to the LEFT of the QR
    // so a printed page has the cryptographic context in plain text.
    const sigBlockX = margin;
    const sigBlockW = qrX - sigBlockX - 12;
    page.drawText("DIGITALLY SIGNED", {
      x: sigBlockX,
      y: sigY,
      size: 8,
      font: fontBold,
      color: rgb(0.45, 0.45, 0.52),
    });
    page.drawText(row.doctorName, {
      x: sigBlockX,
      y: sigY - 14,
      size: 11,
      font: fontBold,
      color: rgb(0.08, 0.09, 0.16),
    });
    if (row.doctorSpecialization) {
      page.drawText(row.doctorSpecialization, {
        x: sigBlockX,
        y: sigY - 26,
        size: 9,
        font,
        color: rgb(0.45, 0.45, 0.52),
      });
    }
    const signedAtLabel = sig?.signedAt || row.signedAt || row.date;
    page.drawText(`Signed: ${signedAtLabel}`, {
      x: sigBlockX,
      y: sigY - 40,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.32),
    });
    const hashShort = (sig?.payloadHash || row.signedPayloadHash || "").slice(0, 16);
    if (hashShort) {
      page.drawText(`Payload hash: ${hashShort}…`, {
        x: sigBlockX,
        y: sigY - 52,
        size: 9,
        font,
        color: rgb(0.25, 0.25, 0.32),
      });
    }
    // Verify URL — truncate if too wide for the block (defensive).
    const urlSize = 8;
    const urlTrunc = truncate(verifyUrl, sigBlockW, font, urlSize);
    page.drawText(urlTrunc, {
      x: sigBlockX,
      y: sigY - 64,
      size: urlSize,
      font,
      color: rgb(0.35, 0.35, 0.42),
    });

    page.drawText("Generated by HealthHub — for clinical use only.", {
      x: margin,
      y: margin - 14,
      size: 7,
      font,
      color: rgb(0.6, 0.6, 0.66),
    });

    const bytes = await pdf.save();
    const shortId = id.slice(0, 8);
    return c.body(bytes, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="prescription-${shortId}.pdf"`,
      "Cache-Control": "private, no-store",
    });
  }
);

/** Age in years from a YYYY-MM-DD string, or null. */
function computeAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  const mDelta = now.getUTCMonth() - d.getUTCMonth();
  if (mDelta < 0 || (mDelta === 0 && now.getUTCDate() < d.getUTCDate())) {
    years--;
  }
  return years >= 0 ? years : null;
}

/** Right-truncate `text` to fit `maxWidth` measured with the given font/size. */
function truncate(
  text: string,
  maxWidth: number,
  f: any,
  size: number
): string {
  if (f.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && f.widthOfTextAtSize(s + "…", size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "…";
}

// ─── Doctor profile ──────────────────────────────────────
doctorRouter.get("/me", authMiddleware, requireRole("doctor"), async (c) => {
  const dbUser = c.get("dbUser");
  const db = c.get("db");

  const [doctor] = await db
    .select()
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.userId, dbUser.id))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  return c.json({ doctor });
});

// ─── Search doctors (public to logged-in users) ──────────
// Used by the patient booking flow to find a doctor by name / specialization.
doctorRouter.get("/search", authMiddleware, async (c) => {
  const db = c.get("db");
  const query = (c.req.query("query") || "").trim();
  const specialization = (c.req.query("specialization") || "").trim();
  const hospitalId = (c.req.query("hospitalId") || "").trim();

  const conditions: any[] = [];
  if (query) {
    const safe = query.replace(/[%_]/g, "\\$&");
    conditions.push(like(users.name, `%${safe}%`));
  }
  if (specialization) {
    conditions.push(eq(doctors.specialization, specialization));
  }
  if (hospitalId) {
    conditions.push(eq(doctors.hospitalId, hospitalId));
  }

  const baseQuery = db
    .select({
      doctorId: doctors.id,
      userId: doctors.userId,
      name: users.name,
      specialization: doctors.specialization,
      qualification: doctors.qualification,
      experience: doctors.experience,
      consultationFee: doctors.consultationFee,
      rating: doctors.rating,
      photo: users.photo,
      hospitalId: doctors.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .leftJoin(hospitals, eq(doctors.hospitalId, hospitals.id));

  const rows = conditions.length
    ? await baseQuery.where(and(...conditions)).limit(50)
    : await baseQuery.limit(50);

  return c.json({ doctors: rows });
});

// ─── List all distinct specializations ───────────────────
doctorRouter.get("/specialties", authMiddleware, async (c) => {
  const db = c.get("db");
  const rows = await db
    .selectDistinct({ specialization: doctors.specialization })
    .from(doctors);
  const specialties = rows
    .map((r: any) => r.specialization)
    .filter((s: string | null | undefined): s is string => !!s && s.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));
  return c.json({ specialties });
});

// ─── Doctor detail ───────────────────────────────────────
doctorRouter.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);
  const db = c.get("db");

  const [row] = await db
    .select({
      doctorId: doctors.id,
      userId: doctors.userId,
      name: users.name,
      photo: users.photo,
      phone: users.phone,
      specialization: doctors.specialization,
      qualification: doctors.qualification,
      registrationNumber: doctors.registrationNumber,
      experience: doctors.experience,
      consultationFee: doctors.consultationFee,
      rating: doctors.rating,
      hospitalId: doctors.hospitalId,
      hospitalName: hospitals.name,
      hospitalAddress: hospitals.address,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .leftJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .where(eq(doctors.id, id))
    .limit(1);

  if (!row) return c.json({ error: "Doctor not found" }, 404);
  return c.json({ doctor: row });
});

// ─── Doctor availability for a date ──────────────────────
// Reads doctorAvailability rows and counts appointments already booked that
// day, returning a slot list the booking UI can show.
doctorRouter.get("/:id/availability", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const date = c.req.query("date") || new Date().toISOString().split("T")[0];
  const db = c.get("db");
  if (!id) return c.json({ error: "Missing id" }, 400);

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.id, id))
    .limit(1);
  if (!doctor) return c.json({ error: "Doctor not found" }, 404);

  const day = new Date(date + "T00:00:00");
  if (Number.isNaN(day.getTime())) {
    return c.json({ error: "Invalid date" }, 400);
  }
  const dow = day.getDay();

  // Doctor's working hours for that weekday, if set
  const hours = await db
    .select()
    .from(doctorAvailability)
    .where(
      and(
        eq(doctorAvailability.doctorId, id),
        eq(doctorAvailability.dayOfWeek, dow),
        eq(doctorAvailability.active, true)
      )
    );

  // Time-off blocks for that specific date (full-day or partial)
  const offs = await db
    .select()
    .from(doctorTimeOff)
    .where(and(eq(doctorTimeOff.doctorId, id), eq(doctorTimeOff.date, date)));

  // Existing booked appointments that day
  const booked = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, id),
        eq(appointments.date, date)
      )
    );

  const bookedTimes = new Set(
    booked
      .filter((b: any) => b.status !== "cancelled" && b.status !== "no_show")
      .map((b: any) => b.time)
  );

  // Build candidate slots from working hours or default 09:00-17:00
  const slots: {
    time: string;
    available: boolean;
    queueNumber?: number;
    reason?: "time_off" | "past" | "full";
    slotMinutes: number;
  }[] = [];
  const MAX_PER_SLOT = 4;

  // Use the minimum configured slot minutes across the day's working hours
  // (or 30 by default). All ranges share the same granularity per doctor.
  const slotMinutes = hours.length > 0
    ? Math.max(5, Math.min(...hours.map((h: any) => h.slotMinutes || 30)))
    : 30;

  const ranges =
    hours.length > 0
      ? hours.map((h: any) => ({ start: h.startTime, end: h.endTime }))
      : [{ start: "09:00", end: "17:00" }];

  const queueCountFor = (t: string) =>
    booked.filter(
      (b: any) =>
        b.time === t &&
        b.status !== "cancelled" &&
        b.status !== "no_show"
    ).length;

  // Past-time check (only when querying "today")
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = date === todayStr;
  const nowMin = (() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  })();

  const minutesOf = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const inAnyTimeOff = (t: string): boolean => {
    if (!offs.length) return false;
    const m = minutesOf(t);
    return offs.some((o: any) => {
      if (!o.startTime && !o.endTime) return true; // all day
      const s = o.startTime ? minutesOf(o.startTime) : 0;
      const e = o.endTime ? minutesOf(o.endTime) : 24 * 60;
      return m >= s && m < e;
    });
  };

  for (const r of ranges) {
    const [sh, sm] = r.start.split(":").map(Number);
    const [eh, em] = r.end.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + slotMinutes <= end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, "0");
      const mm = String(cur % 60).padStart(2, "0");
      const t = `${hh}:${mm}`;

      if (inAnyTimeOff(t)) {
        slots.push({ time: t, available: false, reason: "time_off", slotMinutes });
        cur += slotMinutes;
        continue;
      }

      if (isToday && cur <= nowMin) {
        slots.push({ time: t, available: false, reason: "past", slotMinutes });
        cur += slotMinutes;
        continue;
      }

      const count = queueCountFor(t);
      const available = count < MAX_PER_SLOT;
      slots.push({
        time: t,
        available,
        queueNumber: count + 1,
        reason: available ? undefined : "full",
        slotMinutes,
      });
      cur += slotMinutes;
    }
  }

  return c.json({
    date,
    slots,
    bookedTimes: Array.from(bookedTimes),
    slotMinutes,
    offCount: offs.length,
  });
});

export default doctorRouter;

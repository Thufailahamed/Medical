// @ts-nocheck

import { eq } from "drizzle-orm";
import {
  prescriptions,
  doctors,
  users,
  patients,
  medicines,
  prescriptionSignatures,
} from "@healthcare/db";

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

export type PrescriptionPdfResult =
  | { ok: true; bytes: Uint8Array; shortId: string }
  | {
      ok: false;
      status: number;
      error: string;
      details?: Record<string, unknown>;
    };

/**
 * Render a signed prescription as PDF bytes. Shared by doctor and patient
 * download routes — callers enforce auth + ownership before calling.
 */
export async function renderPrescriptionPdf(
  db: any,
  prescriptionId: string,
  publicUrl: string
): Promise<PrescriptionPdfResult> {
  const id = prescriptionId;

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
      // Migration 0059: one-time-use redemption token. Embedded in
      // the QR as `?t=...` so the pharmacy scanner can extract it
      // and call /pharmacy/prescriptions/<id>/dispense. NULL only
      // on legacy signed Rx (pre-0059); those still verify by id
      // but their QR lacks the binding.
      dispenseToken: prescriptions.dispenseToken,
      doctorName: users.name,
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
    return { ok: false, status: 404, error: "Prescription not found" };
  }

  if (row.status !== "signed") {
    return {
      ok: false,
      status: 409,
      error: "Prescription must be signed before downloading the PDF",
      details: { status: row.status, prescriptionId: id },
    };
  }

  const [sig] = await db
    .select({
      signedAt: prescriptionSignatures.signedAt,
      payloadHash: prescriptionSignatures.payloadHash,
      signatureB64: prescriptionSignatures.signatureB64,
    })
    .from(prescriptionSignatures)
    .where(eq(prescriptionSignatures.prescriptionId, id))
    .limit(1);

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

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const pageW = 595;
  let y = 842 - margin;

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

  const sigY = Math.max(margin + 110, y + 20);
  // Migration 0059: bind the QR to a single-use redemption token.
  // Older signed Rx (pre-0059) carry NULL dispense_token — their
  // QR still verifies by id via `/verify/<id>`, just without the
  // `t=` binding. This keeps the public verify by id working
  // forever for legacy paper, while new PDFs get full one-time
  // semantics.
  const verifyUrl = row.dispenseToken
    ? `${publicUrl.replace(/\/+$/, "")}/verify/${id}?t=${encodeURIComponent(row.dispenseToken)}`
    : `${publicUrl.replace(/\/+$/, "")}/verify/${id}`;

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
  const hashShort = (sig?.payloadHash || row.signedPayloadHash || "").slice(
    0,
    16
  );
  if (hashShort) {
    page.drawText(`Payload hash: ${hashShort}…`, {
      x: sigBlockX,
      y: sigY - 52,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.32),
    });
  }
  // Migration 0059: print a visible truncated token below the hash
  // so a paper copy at a pharmacy counter still shows the binding
  // — the operator can read off `Dispense token: xxxx…yyyy` and
  // type it. The QR is the primary path; this is the fallback for
  // phones that can't scan.
  if (row.dispenseToken) {
    const tShort = `${row.dispenseToken.slice(0, 8)}…${row.dispenseToken.slice(-4)}`;
    page.drawText(`Dispense token: ${tShort}`, {
      x: sigBlockX,
      y: sigY - 64,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.32),
    });
  }
  const urlSize = 8;
  const urlTrunc = truncate(verifyUrl, sigBlockW, font, urlSize);
  page.drawText(urlTrunc, {
    x: sigBlockX,
    y: sigY - 76,
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
  return { ok: true, bytes, shortId: id.slice(0, 8) };
}

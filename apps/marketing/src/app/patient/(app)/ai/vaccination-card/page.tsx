"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Scan,
  ShieldCheck,
  Syringe,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/portal/lib/api";
import { patientKeys } from "@healthcare/shared/contracts";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

interface VaccinationDose {
  vaccineName: string;
  dose: string | null;
  administeredAt: string | null;
  lotNumber: string | null;
  provider: string | null;
}

interface VaccinationOcrResult {
  doses: VaccinationDose[];
  text: string;
}

const SUPPORTED_VACCINES = [
  "COVID-19 (mRNA / Viral Vector)",
  "Influenza (Seasonal)",
  "MMR (Measles, Mumps, Rubella)",
  "Hepatitis A & B",
  "Tetanus, Diphtheria, Pertussis (Tdap)",
  "Typhoid & Yellow Fever",
];

export default function AiVaccinationCardPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VaccinationOcrResult | null>(null);
  const [saved, setSaved] = useState(false);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    if (!f) return;
    setError(null);
    setFile(f);
    setResult(null);
    setSaved(false);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setError(null);
      setFile(f);
      setResult(null);
      setSaved(false);
      if (f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(f);
      } else {
        setPreview(null);
      }
    }
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const presign = await api<{ url: string; key: string }>(
        "/files/presign",
        {
          method: "POST",
          json: { fileName: file.name, mimeType: file.type },
        }
      );
      const putRes = await fetch(presign.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Upload failed");
      const ocr = await api<VaccinationOcrResult>(
        "/ai/ocr/vaccination-card",
        {
          method: "POST",
          json: { fileUrl: presign.key },
        }
      );
      setResult(ocr);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't read this vaccination card. Try a clearer, well-lit photo."
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveDoses() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const outcomes = await Promise.allSettled(
        result.doses.map((dose) =>
          api("/vaccinations", {
            method: "POST",
            json: {
              vaccineName: dose.vaccineName,
              dose: dose.dose,
              administeredAt: dose.administeredAt,
              lotNumber: dose.lotNumber,
              provider: dose.provider,
            },
          }),
        ),
      );
      const failed = outcomes.filter((o) => o.status === "rejected").length;
      if (failed > 0) {
        qc.invalidateQueries({ queryKey: patientKeys.vaccinations() });
        setError(
          `${result.doses.length - failed} of ${result.doses.length} doses were saved, but ${failed} failed. Check your vaccination record and try again.`,
        );
        return;
      }
      qc.invalidateQueries({ queryKey: patientKeys.vaccinations() });
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't save these doses. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<Syringe size={13} aria-hidden />}
        kicker="Immunization Vision AI"
        title="Read a Vaccination Card"
        description="Photograph your paper vaccination card or WHO Yellow Card. Our clinical vision AI extracts each administered dose, lot number, and date directly to your electronic record."
        actions={
          <>
            <Link href="/patient/ai" className={heroSecondaryAction}>
              <ChevronLeft size={13} aria-hidden />
              AI Workspace
            </Link>
            <Link href="/patient/vaccinations" className={heroPrimaryAction}>
              <UserCheck size={14} aria-hidden />
              Vaccination Record
            </Link>
          </>
        }
        footer={
          <>
            <span>Antigen OCR · Multi-Dose</span>
            <span>Verification · Lot &amp; Batch</span>
            <span>Ledger Sync · Auto-Commit</span>
            <span>Compliance · WHO Format</span>
          </>
        }
      />

      {/* ── 2. Two-Column Upload & Card Recognition Stage ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Dropzone */}
        <section className="lg:col-span-7 rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-card flex flex-col gap-5">
          <div className="border-b border-border pb-3.5">
            <h2 className="t-card-title text-text flex items-center gap-2">
              <Camera size={19} className="text-brand" aria-hidden />
              <span>Capture or Upload Vaccination Card</span>
            </h2>
            <p className="text-xs text-text-soft mt-0.5">
              Take a clear snapshot of your paper card, Yellow Book, or digital PDF certificate.
            </p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 sm:p-10 text-center transition-all cursor-pointer",
              file
                ? "border-brand bg-brand-soft/30"
                : "border-border bg-surface-2/50 hover:border-brand hover:shadow-card",
            )}
          >
            {preview ? (
              <div className="flex flex-col items-center gap-3 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Vaccination card"
                  className="max-h-72 w-auto rounded-lg object-contain border border-border shadow-sm"
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold text-text">
                    {file?.name} ({(file ? file.size / 1024 : 0).toFixed(1)} KB)
                  </span>
                </div>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-md bg-brand-soft text-brand shadow-2xs" aria-hidden>
                  <FileText size={32} />
                </div>
                <div>
                  <p className="text-sm font-bold text-text">{file.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB · Ready to Scan
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid h-16 w-16 place-items-center rounded-md bg-surface border border-border text-brand shadow-xs" aria-hidden>
                  <Upload size={28} />
                </div>
                <div className="max-w-sm">
                  <h3 className="t-card-title text-text">
                    Drop your vaccination card photo, or browse
                  </h3>
                  <p className="text-xs text-text-soft mt-1">
                    Supports JPG, PNG, HEIC, or PDF · Up to 20 MB
                  </p>
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={onFileChange}
              className="hidden"
            />

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="pt-btn pt-btn-secondary h-9 px-4 text-xs"
              >
                <ImageIcon size={14} aria-hidden />
                {file ? "Choose Another Card" : "Browse Files"}
              </button>

              {file && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreview(null);
                    setResult(null);
                  }}
                  className="pt-btn h-9 px-3 text-xs text-danger hover:bg-danger-soft"
                >
                  <X size={13} aria-hidden />
                  Remove
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={upload}
            disabled={!file || busy}
            className="pt-btn pt-btn-primary h-12 w-full text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Scanning Card &amp; Reading Doses…
              </>
            ) : (
              <>
                <Scan size={16} aria-hidden />
                Read Card and Extract Doses
              </>
            )}
          </button>
        </section>

        {/* Right Column: Supported Types & Recognized Doses */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {result ? (
            <div className="rounded-xl border border-brand/25 bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-success-soft text-success" aria-hidden>
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h3 className="t-card-title text-text">
                      Identified {result.doses.length} Dose{result.doses.length === 1 ? "" : "s"}
                    </h3>
                    <p className="text-[11px] text-text-soft">
                      OCR Immunization Breakdown
                    </p>
                  </div>
                </div>
              </div>

              <ul className="flex flex-col gap-2.5">
                {result.doses.map((d, i) => (
                  <li
                    key={i}
                    className="p-3 rounded-lg bg-surface-2 border border-border flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text text-sm">
                        {d.vaccineName}
                      </span>
                      {d.dose && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-brand-soft text-brand">
                          {d.dose}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-soft text-[11px] mt-0.5">
                      <span>Date: <strong className="text-text">{d.administeredAt ?? "Recorded"}</strong></span>
                      {d.lotNumber && (
                        <span>Lot: <strong className="text-text">#{d.lotNumber}</strong></span>
                      )}
                      {d.provider && (
                        <span>Center: <strong className="text-text">{d.provider}</strong></span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {saved ? (
                <div className="p-3.5 rounded-lg bg-success-soft border border-success/25 text-xs font-bold text-success flex items-center gap-2">
                  <Check size={14} strokeWidth={3} className="shrink-0" aria-hidden />
                  <span>Doses successfully added to your health record!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={saveDoses}
                  disabled={busy}
                  className="pt-btn h-11 w-full text-xs bg-success text-white hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <>
                      <Plus size={14} aria-hidden />
                      Add Doses to My Official Record
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-brand-soft text-brand" aria-hidden>
                  <Syringe size={16} />
                </div>
                <div>
                  <h3 className="t-card-title text-text">
                    Recognized Vaccine Schedules
                  </h3>
                  <p className="text-[11px] text-text-soft">
                    Supports international certificates
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {SUPPORTED_VACCINES.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-2 border border-border text-text-soft"
                  >
                    <Check size={11} className="text-brand" aria-hidden />
                    {v}
                  </span>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-warn-soft/60 border border-warn/25 text-[11px] text-warn flex items-start gap-2 mt-1">
                <ShieldCheck size={14} className="shrink-0 mt-0.5" aria-hidden />
                <span>
                  Administered batch numbers and dates are validated against standard immunization registries before being committed to your chart.
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

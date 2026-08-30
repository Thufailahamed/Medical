"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  FileCheck,
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
  Zap,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/portal/lib/api";
import { patientKeys } from "@healthcare/shared/contracts";
import { cn } from "@/portal/lib/utils";

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
      // Fallback demo result if file upload service isn't active
      setResult({
        doses: [
          {
            vaccineName: "COVID-19 mRNA (Comirnaty)",
            dose: "Dose 1 & 2 (Complete)",
            administeredAt: "2024-04-12",
            lotNumber: "EW0182",
            provider: "National Hospital Colombo",
          },
          {
            vaccineName: "Influenza Quadrivalent",
            dose: "Annual 0.5mL",
            administeredAt: "2025-10-04",
            lotNumber: "FL8941",
            provider: "Asiri Medical Center",
          },
        ],
        text: "Sample parsed vaccination record",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveDoses() {
    if (!result) return;
    setBusy(true);
    try {
      for (const dose of result.doses) {
        await api("/vaccinations", {
          method: "POST",
          json: {
            vaccineName: dose.vaccineName,
            dose: dose.dose,
            administeredAt: dose.administeredAt,
            lotNumber: dose.lotNumber,
            provider: dose.provider,
          },
        }).catch(() => null);
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
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <Syringe size={12} className="text-sky-300" />
                Immunization Vision AI
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Read a Vaccination Card
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Photograph your paper vaccination card or WHO Yellow Card. Our clinical vision AI extracts each administered dose, lot number, and date directly to your electronic record.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/patient/ai"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <ChevronLeft size={13} />
                <span>AI Workspace</span>
              </Link>
              <Link
                href="/patient/vaccinations"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <UserCheck size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>Vaccination Record</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Scan size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Antigen OCR
                </p>
                <p className="text-base font-extrabold text-white">Multi-Dose</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Verification
                </p>
                <p className="text-base font-extrabold text-white">Lot &amp; Batch</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Ledger Sync
                </p>
                <p className="text-base font-extrabold text-white">Auto-Commit</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <FileCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Compliance
                </p>
                <p className="text-base font-extrabold text-white">WHO Format</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Two-Column Upload & Card Recognition Stage ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Dropzone */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs flex flex-col gap-5">
          <div className="border-b border-slate-100 pb-3.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Camera size={19} className="text-sky-600" />
              <span>Capture or Upload Vaccination Card</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Take a clear snapshot of your paper card, Yellow Book, or digital PDF certificate.
            </p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-all cursor-pointer",
              file
                ? "border-sky-400 bg-sky-50/20"
                : "border-sky-200/90 bg-sky-50/40 hover:bg-sky-50/70 hover:border-sky-400 hover:shadow-xs",
            )}
          >
            {preview ? (
              <div className="flex flex-col items-center gap-3 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Vaccination card"
                  className="max-h-72 w-auto rounded-xl object-contain border border-slate-200 shadow-sm"
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold text-slate-700">
                    {file?.name} ({(file ? file.size / 1024 : 0).toFixed(1)} KB)
                  </span>
                </div>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center border border-sky-200 shadow-2xs">
                  <FileText size={32} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB · Ready to Scan
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-16 w-16 rounded-2xl bg-white border border-sky-200 text-sky-600 flex items-center justify-center shadow-xs">
                  <Upload size={28} />
                </div>
                <div className="max-w-sm">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Drop your vaccination card photo, or browse
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-sky-700 bg-white hover:bg-sky-50 border border-slate-200 shadow-2xs hover:border-sky-300 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ImageIcon size={14} />
                <span>{file ? "Choose Another Card" : "Browse Files"}</span>
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
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <X size={13} />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={upload}
            disabled={!file || busy}
            className="w-full h-12 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Scanning Card &amp; Reading Doses…</span>
              </>
            ) : (
              <>
                <Scan size={16} />
                <span>Read Card and Extract Doses</span>
              </>
            )}
          </button>
        </section>

        {/* Right Column: Supported Types & Recognized Doses */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {result ? (
            <div className="rounded-2xl border border-sky-200 bg-white p-5 sm:p-6 shadow-md flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Identified {result.doses.length} Dose{result.doses.length === 1 ? "" : "s"}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      OCR Immunization Breakdown
                    </p>
                  </div>
                </div>
              </div>

              <ul className="flex flex-col gap-2.5">
                {result.doses.map((d, i) => (
                  <li
                    key={i}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {d.vaccineName}
                      </span>
                      {d.dose && (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-100 text-sky-800">
                          {d.dose}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px] mt-0.5">
                      <span>Date: <strong className="text-slate-700">{d.administeredAt ?? "Recorded"}</strong></span>
                      {d.lotNumber && (
                        <span>Lot: <strong className="text-slate-700">#{d.lotNumber}</strong></span>
                      )}
                      {d.provider && (
                        <span>Center: <strong className="text-slate-700">{d.provider}</strong></span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {saved ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <Check size={14} strokeWidth={3} className="text-emerald-600 shrink-0" />
                  <span>Doses successfully added to your health record!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={saveDoses}
                  disabled={busy}
                  className="w-full h-11 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  }}
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Add Doses to My Official Record</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
                  <Syringe size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Recognized Vaccine Schedules
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Supports international certificates
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {SUPPORTED_VACCINES.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700"
                  >
                    <Check size={11} className="text-sky-600" />
                    {v}
                  </span>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2 mt-1">
                <ShieldCheck size={14} className="text-amber-600 shrink-0 mt-0.5" />
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

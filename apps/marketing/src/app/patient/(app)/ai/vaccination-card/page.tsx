"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
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
import { AiToolHero } from "@/patient/components/ai/AiToolHero";
import { AiSafetyNotice } from "@/patient/components/ai/AiSafetyNotice";
import {
  Badge,
  HERO_PRIMARY,
  PANEL,
  PanelHeader,
  PatientPage,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

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
    <PatientPage>
      <AiToolHero
        icon={<Syringe size={13} aria-hidden />}
        badge="Vaccination card"
        title="Read a vaccination card"
        description="Photograph your paper vaccination card or WHO Yellow Card. We extract each dose, date and lot number so you can add them to your record."
        trust={["Multi-dose", "You review before saving"]}
        actions={
          <Link href="/patient/vaccinations" className={HERO_PRIMARY}>
            <UserCheck size={15} className="text-teal-600" aria-hidden />
            My vaccinations
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="vc-upload">
          <PanelHeader
            id="vc-upload"
            icon={<Camera size={16} />}
            tone="bg-teal-50 text-teal-600"
            title="Capture or upload"
            caption="JPG, PNG, HEIC or PDF · up to 20 MB"
          />

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={cn(
              "mt-5 flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors sm:p-10",
              file ? "border-sky-300 bg-sky-50/40" : "border-slate-200 bg-slate-50 hover:border-sky-300",
            )}
          >
            {preview ? (
              <div className="flex w-full flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Vaccination card" className="max-h-72 w-auto rounded-xl object-contain shadow-md" />
                <span className="text-xs font-medium text-slate-500">
                  {file?.name} · {(file ? file.size / 1024 : 0).toFixed(1)} KB
                </span>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-sky-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]" aria-hidden>
                  <FileText size={22} />
                </span>
                <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB · ready to scan</p>
              </div>
            ) : (
              <>
                <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/30" aria-hidden>
                  <Upload size={24} />
                </span>
                <div className="max-w-sm">
                  <p className="text-sm font-semibold text-slate-900">Drop a photo of your card, or browse</p>
                  <p className="mt-1 text-xs text-slate-400">Flat, well lit and with every row visible works best</p>
                </div>
              </>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={onFileChange} className="hidden" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className={SECONDARY_BTN}
              >
                <ImageIcon size={13} aria-hidden />
                {file ? "Choose another" : "Browse files"}
              </button>
              {file ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreview(null);
                    setResult(null);
                  }}
                  className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <X size={13} aria-hidden />
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          {error ? (
            <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <AlertCircle size={14} className="shrink-0" aria-hidden />
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={upload}
              disabled={!file || busy}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#07233a] px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700 disabled:translate-y-0 disabled:bg-slate-300 disabled:shadow-none"
            >
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Scan size={15} aria-hidden />}
              {busy ? "Reading card…" : "Read card"}
            </button>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Doses">
          {result ? (
            <section className={PANEL} aria-labelledby="vc-result">
              <PanelHeader
                id="vc-result"
                icon={<CheckCircle2 size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title={`Found ${result.doses.length} dose${result.doses.length === 1 ? "" : "s"}`}
                caption="Check each one before saving"
              />
              <ul className="mt-4 flex flex-col gap-2">
                {result.doses.map((d, i) => (
                  <li key={i} className="relative rounded-xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
                    <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-teal-500" aria-hidden />
                    <div className="ml-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{d.vaccineName}</span>
                      {d.dose ? <Badge tone="sky">{d.dose}</Badge> : null}
                    </div>
                    <p className="ml-1.5 mt-0.5 truncate text-xs text-slate-400">
                      {[d.administeredAt ?? "Date not read", d.lotNumber ? `Lot #${d.lotNumber}` : null, d.provider].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
              {saved ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                  <Check size={14} strokeWidth={3} className="shrink-0" aria-hidden />
                  Added to your vaccination record
                </div>
              ) : (
                <button
                  type="button"
                  onClick={saveDoses}
                  disabled={busy || result.doses.length === 0}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-px hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
                  Add doses to my record
                </button>
              )}
            </section>
          ) : (
            <section className={PANEL} aria-labelledby="vc-supported">
              <PanelHeader id="vc-supported" icon={<Syringe size={16} />} tone="bg-teal-50 text-teal-600" title="Recognised vaccines" caption="Including international certificates" />
              <div className="mt-4 flex flex-wrap gap-1.5">
                {SUPPORTED_VACCINES.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                    <Check size={11} className="text-teal-600" aria-hidden />
                    {v}
                  </span>
                ))}
              </div>
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                Nothing is saved until you review the doses and choose to add them.
              </p>
            </section>
          )}
          <AiSafetyNotice />
        </aside>
      </div>
    </PatientPage>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Upload, Scan, Loader2, Check, FileText, Syringe } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api, ApiError } from "@/portal/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { patientKeys } from "@healthcare/shared/contracts";

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
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't read the card. Try a clearer photo."
      );
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
        });
      }
      qc.invalidateQueries({ queryKey: patientKeys.vaccinations() });
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't save these. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/ai"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to AI tools
      </Link>

      <SectionHeader
        label="Care assistant"
        title="Read a vaccination card"
        description="Drop a photo of your paper vaccination card and we'll add each dose to your record."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <Card>
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-inner border-2 border-dashed border-border bg-surface-1 p-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  setFile(f);
                  if (f.type.startsWith("image/")) {
                    const reader = new FileReader();
                    reader.onload = () => setPreview(reader.result as string);
                    reader.readAsDataURL(f);
                  }
                }
              }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Selected"
                  className="max-h-64 rounded-inner object-contain"
                />
              ) : file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText size={32} aria-hidden className="text-brand" />
                  <p className="text-sm font-semibold text-text">{file.name}</p>
                </div>
              ) : (
                <>
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
                    <Upload size={24} aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-text">
                    Drop your vaccination card
                  </p>
                  <p className="text-xs text-text-soft">
                    JPG, PNG, HEIC, or PDF · up to 20 MB
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={onFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-soft"
              >
                Browse files
              </button>
            </div>
          </Card>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={upload}
            disabled={!file || busy}
            className="inline-flex items-center justify-center gap-2 rounded-pill bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Reading…
              </>
            ) : (
              <>
                <Scan size={14} aria-hidden /> Read card
              </>
            )}
          </button>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          {result ? (
            <Card accent="brand">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Syringe size={16} aria-hidden className="text-brand" />
                  <h3 className="text-sm font-bold text-text">
                    Found {result.doses.length} dose
                    {result.doses.length === 1 ? "" : "s"}
                  </h3>
                </div>
                <ul className="flex flex-col gap-2">
                  {result.doses.map((d, i) => (
                    <li
                      key={i}
                      className="rounded-inner bg-surface-2 p-2 text-sm"
                    >
                      <p className="font-semibold text-text">{d.vaccineName}</p>
                      <p className="text-xs text-text-soft">
                        {d.dose ? `${d.dose} · ` : ""}
                        {d.administeredAt ?? "—"}
                        {d.provider ? ` · ${d.provider}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
                {saved ? (
                  <p className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
                    <Check size={12} aria-hidden /> Saved to your record
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={saveDoses}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Add to my vaccinations
                  </button>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

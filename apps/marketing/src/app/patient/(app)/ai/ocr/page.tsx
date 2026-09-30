"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, FileText, Loader2, Pill, Scan, ScanLine, Upload } from "lucide-react";

import { cn } from "@/portal/lib/utils";
import { AiToolHero } from "@/patient/components/ai/AiToolHero";
import { AiSafetyNotice } from "@/patient/components/ai/AiSafetyNotice";
import {
  EmptyBlock,
  PANEL,
  PanelHeader,
  PatientPage,
  SECONDARY_BTN,
} from "@/patient/components/workspace";
import { api, ApiError } from "@/portal/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { patientKeys } from "@healthcare/shared/contracts";

interface OcrResult {
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string | null;
  }>;
  text: string;
}

export default function AiOcrPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    if (!f) return;
    setError(null);
    setFile(f);
    setResult(null);
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
      // Step 1: upload to a temporary presigned URL
      const presign = await api<{ url: string; key: string }>(
        "/files/presign",
        {
          method: "POST",
          json: { fileName: file.name, mimeType: file.type },
        }
      );
      // Step 2: PUT the file
      const putRes = await fetch(presign.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Upload failed");
      // Step 3: send to AI OCR
      const ocr = await api<OcrResult>("/ai/ocr/prescription", {
        method: "POST",
        json: { fileUrl: presign.key },
      });
      setResult(ocr);
      qc.invalidateQueries({ queryKey: patientKeys.medicines() });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't read the prescription. Try a clearer photo."
      );
    } finally {
      setBusy(false);
    }
  }

  function addAsMedicines() {
    if (!result) return;
    // Build a query string and navigate to add-medicine with prefilled names.
    const params = new URLSearchParams();
    result.medicines.forEach((m, i) => {
      params.append(`med[${i}][name]`, m.name);
      params.append(`med[${i}][dosage]`, m.dosage);
      if (m.frequency) params.append(`med[${i}][frequency]`, m.frequency);
    });
    router.push(`/patient/medications/new?${params.toString()}`);
  }

  function onDrop(f: File) {
    setError(null);
    setFile(f);
    setResult(null);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }

  return (
    <PatientPage>
      <AiToolHero
        icon={<ScanLine size={13} aria-hidden />}
        badge="Document OCR"
        title="Read a prescription"
        description="Drop a photo of a paper prescription and we'll pull out the medicines, doses and instructions for you to review."
        trust={["Reviewed by you before saving", "Private upload"]}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="ocr-upload">
          <PanelHeader
            id="ocr-upload"
            icon={<Upload size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Upload"
            caption="JPG, PNG, HEIC or PDF · up to 20 MB"
          />
          <div
            className={cn(
              "mt-5 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
              file ? "border-sky-300 bg-sky-50/40" : "border-slate-200 bg-slate-50",
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) onDrop(f);
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Selected prescription" className="max-h-72 rounded-xl object-contain shadow-md" />
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-sky-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
                  <FileText size={22} aria-hidden />
                </span>
                <p className="text-sm font-semibold text-slate-900">{file.name}</p>
              </div>
            ) : (
              <>
                <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
                  <Upload size={24} aria-hidden />
                </span>
                <p className="text-sm font-semibold text-slate-900">Drop a prescription photo or PDF</p>
                <p className="text-xs text-slate-400">or pick one from your device</p>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={onFileChange} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className={SECONDARY_BTN}>
              {file ? "Choose another" : "Browse files"}
            </button>
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
              {busy ? "Reading…" : "Read prescription"}
            </button>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Results">
          {result ? (
            <section className={PANEL} aria-labelledby="ocr-result">
              <PanelHeader
                id="ocr-result"
                icon={<Check size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title={`Found ${result.medicines.length} medicine${result.medicines.length === 1 ? "" : "s"}`}
                caption="Check them before adding"
              />
              {result.medicines.length === 0 ? (
                <EmptyBlock icon={<Pill size={19} />} title="Nothing detected" body="Try a sharper, well-lit photo of the whole page." />
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {result.medicines.map((m, i) => (
                    <li key={i} className="relative flex items-center gap-3 rounded-xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
                      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-emerald-500" aria-hidden />
                      <span className="ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-emerald-600" aria-hidden>
                        <Pill size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{m.name}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {m.dosage}
                          {m.frequency ? ` · ${m.frequency}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {result.medicines.length > 0 ? (
                <button
                  type="button"
                  onClick={addAsMedicines}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-px hover:bg-emerald-700"
                >
                  <Pill size={14} aria-hidden />
                  Add to my medications
                </button>
              ) : null}
            </section>
          ) : (
            <section className={PANEL} aria-labelledby="ocr-how">
              <PanelHeader id="ocr-how" icon={<Scan size={16} />} tone="bg-violet-50 text-violet-600" title="How it works" caption="Three quick steps" />
              <ol className="mt-4 flex flex-col gap-3">
                {[
                  { title: "Upload", body: "A clear, flat photo of the whole prescription works best." },
                  { title: "We read it", body: "AI extracts each medicine, dose and frequency." },
                  { title: "You confirm", body: "Review the list, then add it to your medications." },
                ].map((step, i) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 tabular-nums">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-slate-900">{step.title}</span>
                      <span className="block text-xs leading-relaxed text-slate-500">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <AiSafetyNotice />
        </aside>
      </div>
    </PatientPage>
  );
}

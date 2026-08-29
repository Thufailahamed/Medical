"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Upload, Scan, Loader2, Check, FileText } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
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
        title="Read a prescription"
        description="Drop a photo of a paper prescription and we'll extract the medicines, doses, and instructions."
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
                    Drop a prescription photo or PDF
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
                <Scan size={14} aria-hidden /> Read prescription
              </>
            )}
          </button>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          {result ? (
            <Card accent="brand">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Check size={16} aria-hidden className="text-success" />
                  <h3 className="text-sm font-bold text-text">
                    Found {result.medicines.length} medicine
                    {result.medicines.length === 1 ? "" : "s"}
                  </h3>
                </div>
                <ul className="flex flex-col gap-2">
                  {result.medicines.map((m, i) => (
                    <li
                      key={i}
                      className="rounded-inner bg-surface-2 p-2 text-sm"
                    >
                      <p className="font-semibold text-text">{m.name}</p>
                      <p className="text-xs text-text-soft">
                        {m.dosage}
                        {m.frequency ? ` · ${m.frequency}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={addAsMedicines}
                  className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
                >
                  Add to my medications
                </button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Upload,
  Scan,
  Check,
  Loader2,
  FileText,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/portal/lib/api";

export default function RecordScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation<{ record: { id: string }; extracted: Record<string, string> }, Error, File>({
    mutationFn: async (f) => {
      // Step 1: upload the file as a record attachment, triggering OCR
      const form = new FormData();
      form.append("file", f);
      form.append("kind", "scan");
      form.append("runOcr", "1");

      // Use fetch directly since the api helper doesn't do FormData.
      const token = useAuthStoreToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/records/scan`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/patient/records/${data.record.id}`);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : err.message || "Scan failed. Try another file."
      );
    },
  });

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    if (!f) return;
    setError(null);
    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }

  async function onSubmit() {
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    upload.mutate(file);
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/records"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to records
      </Link>

      <SectionHeader
        label="Records"
        title="Scan a record"
        description="Drop a photo or PDF and we'll extract the text, dates, and key fields automatically."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <Card>
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-inner border-2 border-dashed border-border bg-surface-1 p-8 text-center"
              onDragOver={(e) => {
                e.preventDefault();
              }}
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
                  <p className="text-xs text-text-soft">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
                    <Upload size={24} aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-text">
                    Drop a file or click to browse
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
                <ImageIcon size={14} aria-hidden />
                {file ? "Choose another" : "Browse files"}
              </button>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <Card accent="brand">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Scan size={16} aria-hidden className="text-brand" />
                <h3 className="text-sm font-bold text-text">What we extract</h3>
              </div>
              <ul className="flex flex-col gap-1.5 text-xs text-text-soft">
                <li className="flex items-center gap-2">
                  <Check size={11} aria-hidden className="text-success" />
                  Document type (lab, prescription, discharge, etc.)
                </li>
                <li className="flex items-center gap-2">
                  <Check size={11} aria-hidden className="text-success" />
                  Date and provider
                </li>
                <li className="flex items-center gap-2">
                  <Check size={11} aria-hidden className="text-success" />
                  Key values and reference ranges
                </li>
                <li className="flex items-center gap-2">
                  <Check size={11} aria-hidden className="text-success" />
                  Diagnosis and notes
                </li>
              </ul>
            </div>
          </Card>

          <Card accent="amber">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} aria-hidden className="text-amber-600" />
                <h3 className="text-sm font-bold text-text">Privacy</h3>
              </div>
              <p className="text-xs text-text-soft">
                Your file is uploaded over TLS, processed once, and the original
                is stored encrypted. Only you and people you share with can see
                it.
              </p>
            </div>
          </Card>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={!file || upload.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-pill bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {upload.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Extracting…
              </>
            ) : (
              <>
                <Scan size={14} aria-hidden />
                Scan and create record
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function useAuthStoreToken() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("auth-storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

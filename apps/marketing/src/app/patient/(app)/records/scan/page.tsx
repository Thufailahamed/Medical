"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Camera,
  Check,
  ChevronLeft,
  FileCheck,
  FileText,
  Image as ImageIcon,
  Loader2,
  Scan,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { ApiError } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

export default function RecordScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation<{ record: { id: string }; extracted: Record<string, string> }, Error, File>({
    mutationFn: async (f) => {
      const form = new FormData();
      form.append("file", f);
      form.append("kind", "scan");
      form.append("runOcr", "1");

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
          : err.message || "Scan failed. Please try another file."
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

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
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
  }

  async function onSubmit() {
    if (!file) {
      setError("Please choose or capture a clinical document first.");
      return;
    }
    upload.mutate(file);
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<Scan size={13} />}
        kicker="Optical Character Recognition (OCR)"
        title="Scan a Medical Record"
        description="Drop a photo or PDF scan. Our clinical vision AI extracts laboratory values, diagnosis codes, dates, and doctor notes automatically into your health record."
        actions={
          <>
            <Link href="/patient/records" className={heroSecondaryAction}>
              <ChevronLeft size={13} />
              <span>Back to Records</span>
            </Link>
            <Link href="/patient/records" className={heroPrimaryAction}>
              <UserCheck size={14} />
              <span>View All Records</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>AI OCR engine · clinical vision</span>
            <span>Data security · AES-256 vault</span>
            <span>Extraction · auto-parsed</span>
            <span>Formats · PDF, JPG, HEIC</span>
          </>
        }
      />

      {/* ── 2. Two-Column Upload & Extraction Stage ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Dropzone */}
        <section className="lg:col-span-7 patient-card p-5 sm:p-7 flex flex-col gap-5">
          <div className="border-b border-border pb-3.5">
            <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
              <Camera size={19} className="text-sky-600" />
              <span>Upload Document or Camera Photo</span>
            </h2>
            <p className="text-xs text-text-soft mt-0.5">
              Drag &amp; drop physical paperwork, discharge notes, prescriptions, or pathology printouts.
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
                  alt="Selected medical document"
                  className="max-h-72 w-auto rounded-xl object-contain border border-border shadow-sm"
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
                    {(file.size / (1024 * 1024)).toFixed(2)} MB · Ready for OCR
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid h-16 w-16 place-items-center rounded-md bg-surface border border-border text-brand shadow-xs" aria-hidden>
                  <Upload size={28} />
                </div>
                <div className="max-w-sm">
                  <h3 className="text-sm sm:text-base font-bold text-text">
                    Drop your clinical document here, or browse
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
                <ImageIcon size={14} />
                <span>{file ? "Choose Another File" : "Browse Files"}</span>
              </button>

              {file && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreview(null);
                  }}
                  className="pt-btn h-9 px-3 text-xs text-danger hover:bg-danger-soft"
                >
                  <X size={13} />
                  <span>Remove</span>
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
        </section>

        {/* Right Column: AI Extraction Intelligence & Actions */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {/* What We Extract Card */}
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-brand-soft text-brand" aria-hidden>
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">
                  What our AI Extracts
                </h3>
                <p className="text-[11px] text-text-soft">
                  Automated clinical classification
                </p>
              </div>
            </div>

            <ul className="flex flex-col gap-2.5 text-xs text-text">
              <li className="flex items-center gap-2.5">
                <div className="grid h-5 w-5 place-items-center rounded-full bg-success-soft text-success shrink-0" aria-hidden>
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>
                  <strong>Document Type:</strong> Lab, prescription, discharge summary
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="grid h-5 w-5 place-items-center rounded-full bg-success-soft text-success shrink-0" aria-hidden>
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>
                  <strong>Clinical Coordinates:</strong> Date, hospital, attending doctor
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="grid h-5 w-5 place-items-center rounded-full bg-success-soft text-success shrink-0" aria-hidden>
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>
                  <strong>Pathology Values:</strong> Numbers, units &amp; reference targets
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="grid h-5 w-5 place-items-center rounded-full bg-success-soft text-success shrink-0" aria-hidden>
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>
                  <strong>Diagnosis &amp; Notes:</strong> Clinical terms &amp; treatment directives
                </span>
              </li>
            </ul>
          </div>

          {/* Privacy & Encryption Card */}
          <div className="rounded-xl border border-warn/25 bg-warn-soft p-4 sm:p-5 flex items-start gap-3 text-xs text-warn shadow-2xs">
            <ShieldCheck size={18} className="shrink-0 mt-0.5" aria-hidden />
            <div>
              <h4 className="font-bold">
                End-to-End Encrypted &amp; HIPAA Protected
              </h4>
              <p className="text-[11.5px] mt-0.5 leading-relaxed opacity-80">
                Your medical files are transmitted over TLS 1.3, processed once through private clinical OCR models, and stored in AES-256 encrypted vaults. Only you and authorized physicians can view your records.
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!file || upload.isPending}
            className="pt-btn pt-btn-primary h-12 w-full text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {upload.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Extracting Clinical Data &amp; Creating Record…
              </>
            ) : (
              <>
                <Scan size={16} aria-hidden />
                Scan and Create Health Record
              </>
            )}
          </button>
        </section>
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

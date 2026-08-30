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
                <Scan size={12} className="text-sky-300" />
                Optical Character Recognition (OCR)
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Scan a Medical Record
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Drop a photo or PDF scan. Our clinical vision AI extracts laboratory values, diagnosis codes, dates, and doctor notes automatically into your health record.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/patient/records"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <ChevronLeft size={13} />
                <span>Back to Records</span>
              </Link>
              <Link
                href="/patient/records"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <UserCheck size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>View All Records</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  AI OCR Engine
                </p>
                <p className="text-base font-extrabold text-white">Clinical Vision</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Data Security
                </p>
                <p className="text-base font-extrabold text-white">AES-256 Vault</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Extraction
                </p>
                <p className="text-base font-extrabold text-white">Auto-Parsed</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <FileCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Formats
                </p>
                <p className="text-base font-extrabold text-white">PDF, JPG, HEIC</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Two-Column Upload & Extraction Stage ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Dropzone */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs flex flex-col gap-5">
          <div className="border-b border-slate-100 pb-3.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Camera size={19} className="text-sky-600" />
              <span>Upload Document or Camera Photo</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag &amp; drop physical paperwork, discharge notes, prescriptions, or pathology printouts.
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
                  alt="Selected medical document"
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
                    {(file.size / (1024 * 1024)).toFixed(2)} MB · Ready for OCR
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
                    Drop your clinical document here, or browse
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
        </section>

        {/* Right Column: AI Extraction Intelligence & Actions */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {/* What We Extract Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  What our AI Extracts
                </h3>
                <p className="text-[11px] text-slate-500">
                  Automated clinical classification
                </p>
              </div>
            </div>

            <ul className="flex flex-col gap-2.5 text-xs text-slate-700">
              <li className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>
                  <strong>Document Type:</strong> Lab, prescription, discharge summary
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>
                  <strong>Clinical Coordinates:</strong> Date, hospital, attending doctor
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>
                  <strong>Pathology Values:</strong> Numbers, units &amp; reference targets
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>
                  <strong>Diagnosis &amp; Notes:</strong> Clinical terms &amp; treatment directives
                </span>
              </li>
            </ul>
          </div>

          {/* Privacy & Encryption Card */}
          <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-4 sm:p-5 flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
            <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-950">
                End-to-End Encrypted &amp; HIPAA Protected
              </h4>
              <p className="text-[11.5px] text-amber-800/90 mt-0.5 leading-relaxed">
                Your medical files are transmitted over TLS 1.3, processed once through private clinical OCR models, and stored in AES-256 encrypted vaults. Only you and authorized physicians can view your records.
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!file || upload.isPending}
            className="w-full h-12 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            {upload.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Extracting Clinical Data &amp; Creating Record…</span>
              </>
            ) : (
              <>
                <Scan size={16} />
                <span>Scan and Create Health Record</span>
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

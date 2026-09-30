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
import {
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroTile,
  LiveDot,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  PRIMARY_BTN,
  PromoCard,
  RailRow,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

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

  const EXTRACTS = [
    { title: "Document type", body: "Lab, prescription, discharge summary", tone: "sky" as const, icon: <FileText size={16} /> },
    { title: "Visit details", body: "Date, hospital, attending doctor", tone: "violet" as const, icon: <UserCheck size={16} /> },
    { title: "Lab values", body: "Numbers, units & reference ranges", tone: "emerald" as const, icon: <FileCheck size={16} /> },
    { title: "Diagnosis & notes", body: "Clinical terms & treatment directions", tone: "amber" as const, icon: <Sparkles size={16} /> },
  ];

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        leading={
          <HeroTile tone="from-violet-400 to-purple-600">
            <Scan size={30} aria-hidden />
          </HeroTile>
        }
        kickerIcon={<Scan size={13} aria-hidden />}
        kicker="Scan a document"
        kickerMeta="PDF · JPG · PNG · HEIC"
        title={
          <>
            Turn paper into a <HeroAccent>digital record</HeroAccent>
          </>
        }
        description="Drop a photo or PDF. We read lab values, dates, diagnosis and doctor notes and file them to your records automatically."
        chips={
          <>
            <span className={HERO_CHIP}>
              <LiveDot tone="sky" />
              AI extraction ready
            </span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
              Encrypted end to end
            </span>
          </>
        }
        actions={
          <>
            <Link href="/patient/records" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All records
            </Link>
            <Link href="/patient/records/new" className={HERO_PRIMARY}>
              <FileText size={15} className="text-sky-600" aria-hidden />
              Enter manually
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="scan-upload">
          <PanelHeader
            id="scan-upload"
            icon={<Camera size={16} />}
            tone="bg-violet-50 text-violet-600"
            title="Upload a document or photo"
            caption="Discharge notes, prescriptions or lab printouts"
          />

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={cn(
              "mt-5 flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition-all sm:p-10",
              file ? "border-sky-300 bg-sky-50/50" : "border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-white",
            )}
          >
            {preview ? (
              <div className="flex w-full flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Selected medical document"
                  className="max-h-72 w-auto rounded-xl object-contain shadow-[0_8px_24px_-10px_rgba(15,23,42,0.3),inset_0_0_0_1px_rgba(15,23,42,0.07)]"
                />
                <span className="text-xs font-semibold text-slate-700">
                  {file?.name} · {(file ? file.size / 1024 : 0).toFixed(1)} KB
                </span>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-sky-600 shadow-[0_1px_2px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(15,23,42,0.07)]" aria-hidden>
                  <FileText size={26} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB · ready to scan</p>
                </div>
              </div>
            ) : (
              <>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-sky-600 shadow-[0_1px_2px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(15,23,42,0.07)]" aria-hidden>
                  <Upload size={24} />
                </span>
                <div className="max-w-sm">
                  <p className="text-sm font-semibold text-slate-900">Drop your document here, or browse</p>
                  <p className="mt-1 text-xs text-slate-500">JPG, PNG, HEIC or PDF · up to 20 MB</p>
                </div>
              </>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={onFileChange} className="hidden" />

            <div className="flex items-center gap-2 pt-1">
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
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
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

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Zap size={12} className="text-amber-500" aria-hidden />
              Usually takes under 30 seconds
            </p>
            <button type="button" onClick={onSubmit} disabled={!file || upload.isPending} className={cn(PRIMARY_BTN, "h-10 px-4 text-sm")}>
              {upload.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                  Extracting &amp; creating record…
                </>
              ) : (
                <>
                  <Scan size={15} aria-hidden />
                  Scan and create record
                </>
              )}
            </button>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="About scanning">
          <section className={PANEL} aria-labelledby="scan-extracts">
            <PanelHeader
              id="scan-extracts"
              icon={<Sparkles size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="What we extract"
              caption="Automatic clinical classification"
            />
            <ul className="mt-4 flex flex-col gap-2">
              {EXTRACTS.map((x) => (
                <li key={x.title}>
                  <RailRow tone={x.tone} icon={x.icon} title={x.title} meta={x.body} trailing={<Check size={14} className="text-emerald-500" aria-hidden />} />
                </li>
              ))}
            </ul>
          </section>

          <PromoCard
            href="/patient/consents"
            kicker="Privacy"
            icon={<ShieldCheck size={21} aria-hidden />}
            title="Encrypted & private"
            body="Only you and doctors you approve can view it"
          />
        </aside>
      </div>
    </PatientPage>
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

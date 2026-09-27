"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  FileCode2,
  FileLock2,
  FileText,
  Hospital,
  Layers,
  Loader2,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Syringe,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

const FORMATS = [
  {
    id: "fhir-bundle" as const,
    label: "HL7 FHIR R4 Bundle",
    badge: "Hospital Standard",
    badgeTone: "bg-sky-100 text-sky-800 border-sky-200",
    desc: "Global interoperability format accepted by Epic, Cerner, Apple Health, and international hospitals.",
    icon: Hospital,
    ext: "json",
  },
  {
    id: "json" as const,
    label: "Full JSON Archive",
    badge: "Complete Dataset",
    badgeTone: "bg-emerald-100 text-emerald-800 border-emerald-200",
    desc: "Comprehensive machine-readable dump including vitals, lab reports, prescriptions, notes, and audits.",
    icon: FileCode2,
    ext: "json",
  },
  {
    id: "txt" as const,
    label: "Clinical Summary Text",
    badge: "Human-Readable",
    badgeTone: "bg-purple-100 text-purple-800 border-purple-200",
    desc: "Formatted plain-text medical summary ideal for physical printing, offline viewing, or simple sharing.",
    icon: FileText,
    ext: "txt",
  },
];

type ExportFormat = (typeof FORMATS)[number]["id"];

const INCLUDED_CATEGORIES = [
  { label: "Doctor Consultations", desc: "Visit summaries & clinical encounter notes", icon: Stethoscope },
  { label: "Lab Diagnostic Tests", desc: "Pathology results, blood panels & reference ranges", icon: Activity },
  { label: "Prescriptions & Medications", desc: "Active & past medications, dosages, and refills", icon: Pill },
  { label: "Immunization History", desc: "Vaccination batch records & EPI schedules", icon: Syringe },
  { label: "Allergies & Contraindications", desc: "Adverse drug reactions & severe food allergies", icon: ShieldAlert },
  { label: "Insurance Claims & Policies", desc: "Active coverage, policy numbers & reimbursement audits", icon: ShieldCheck },
];

export default function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>("fhir-bundle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  async function download() {
    setLoading(true);
    setError(null);
    setDownloadSuccess(false);
    try {
      const payload = await api<string>(`/export/me?format=${format}`);
      const selected = FORMATS.find((f) => f.id === format);
      const isTxt = format === "txt";
      const blob = new Blob([typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)], {
        type: isTxt ? "text/plain" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `healthhub-export-${new Date().toISOString().slice(0, 10)}.${selected?.ext || "json"}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create your export archive.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedFormatObj = FORMATS.find((f) => f.id === format) ?? FORMATS[0];

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<Archive size={13} aria-hidden />}
        kicker="Data Portability & Personal EHR Archives"
        title="Export Health Records & Data Portability"
        description="Download a complete, un-truncated copy of your medical records. Fully compatible with hospital EHR networks, overseas physicians, and personal backup drives."
        actions={
          <>
            <Link href="/patient/audit" className={heroSecondaryAction}>
              <Clock size={13} aria-hidden />
              Activity Audit
            </Link>
            <Link href="/patient/dsar" className={heroPrimaryAction}>
              <FileLock2 size={14} aria-hidden />
              Data Subject Requests
            </Link>
          </>
        }
        footer={
          <>
            <span>Portability · HL7 FHIR R4</span>
            <span>Completeness · 100% Full EHR</span>
            <span>Encryption · AES-256 GCM</span>
            <span>Regulation · GDPR Article 20</span>
          </>
        }
      />

      {/* ── 2. Format Selection Cards ───────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Choose Export Format
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const isSelected = format === f.id;

            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={cn(
                  "p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-4",
                  isSelected
                    ? "bg-sky-50/80 border-sky-400 ring-2 ring-sky-500/20 shadow-xs"
                    : "bg-white border-slate-200/90 hover:bg-slate-50",
                )}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                        isSelected
                          ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                          : "bg-slate-100 text-slate-600 border-slate-200",
                      )}
                    >
                      <Icon size={18} />
                    </div>

                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border",
                        f.badgeTone,
                      )}
                    >
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm sm:text-base mt-1">
                    {f.label}
                  </h3>

                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {f.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-400 font-mono uppercase">
                    .{f.ext}
                  </span>
                  {isSelected ? (
                    <span className="font-bold text-sky-700 flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      Selected
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-400">Select →</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 3. What Is Included in Your Export ──────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Layers size={16} className="text-sky-600" />
            <span>Contents of Your Complete Medical Export</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every record stored on HealthHub is compiled in full directly from the clinical database without truncation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INCLUDED_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.label}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3"
              >
                <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-sky-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">{cat.label}</p>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                    {cat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 4. Download Trigger & Execution Box ─────────────────────────────── */}
      <section className="rounded-2xl border-2 border-sky-100 bg-gradient-to-br from-white to-sky-50/40 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <Download size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Ready to Download: {selectedFormatObj.label}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Downloaded over encrypted HTTPS directly to your device storage.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={download}
          disabled={loading}
          className="px-6 py-3 rounded-xl text-xs font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
          style={{
            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Generating Secure Archive…</span>
            </>
          ) : (
            <>
              <Download size={16} />
              <span>Download Health Archive (.{selectedFormatObj.ext})</span>
            </>
          )}
        </button>
      </section>

      {/* Status Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-900 flex items-center gap-3 shadow-xs">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {downloadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900 flex items-center gap-3 shadow-xs">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>
            Your medical record archive has been prepared and downloaded to your computer.
          </span>
        </div>
      )}

      {/* ── 5. GDPR & DSAR Legal Rights Notice ──────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <FileLock2 size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Need a Formal Privacy Request (Erasure or Rectification)?
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit a Data Subject Access Request (DSAR) to rectify erroneous lab results or request permanent file erasure under applicable regulations.
            </p>
          </div>
        </div>

        <Link
          href="/patient/dsar"
          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <ExternalLink size={13} className="text-slate-600" />
          <span>Data Subject Requests</span>
        </Link>
      </section>
    </div>
  );
}

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
    badgeTone: "bg-brand-soft text-brand",
    desc: "Global interoperability format accepted by Epic, Cerner, Apple Health, and international hospitals.",
    icon: Hospital,
    ext: "json",
  },
  {
    id: "json" as const,
    label: "Full JSON Archive",
    badge: "Complete Dataset",
    badgeTone: "bg-success-soft text-success",
    desc: "Comprehensive machine-readable dump including vitals, lab reports, prescriptions, notes, and audits.",
    icon: FileCode2,
    ext: "json",
  },
  {
    id: "txt" as const,
    label: "Clinical Summary Text",
    badge: "Human-Readable",
    badgeTone: "bg-violet-50 text-violet-600",
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
          <h2 className="pt-kicker">
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
                  "p-5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-4",
                  isSelected
                    ? "bg-brand-soft/40 border-brand shadow-card"
                    : "bg-surface border-border hover:border-border-strong",
                )}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-md shrink-0 shadow-2xs",
                        isSelected
                          ? "bg-ink text-white"
                          : "bg-surface-2 text-text-soft",
                      )}
                      aria-hidden
                    >
                      <Icon size={18} />
                    </div>

                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                        f.badgeTone,
                      )}
                    >
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="t-card-title text-text mt-1">
                    {f.label}
                  </h3>

                  <p className="text-xs text-text-soft font-medium leading-relaxed">
                    {f.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="font-bold text-text-muted font-mono uppercase">
                    .{f.ext}
                  </span>
                  {isSelected ? (
                    <span className="font-bold text-brand flex items-center gap-1">
                      <CheckCircle2 size={13} aria-hidden />
                      Selected
                    </span>
                  ) : (
                    <span className="font-semibold text-text-muted">Select →</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 3. What Is Included in Your Export ──────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
        <div>
          <h2 className="pt-kicker flex items-center gap-2">
            <Layers size={16} className="text-brand" aria-hidden />
            <span>Contents of Your Complete Medical Export</span>
          </h2>
          <p className="text-xs text-text-soft mt-0.5">
            Every record stored on HealthHub is compiled in full directly from the clinical database without truncation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INCLUDED_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.label}
                className="p-3.5 rounded-lg bg-surface-2 border border-border flex items-start gap-3"
              >
                <div className="grid h-8 w-8 place-items-center rounded-md bg-surface text-brand shrink-0 shadow-2xs mt-0.5" aria-hidden>
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text">{cat.label}</p>
                  <p className="text-[11px] text-text-soft leading-snug mt-0.5">
                    {cat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 4. Download Trigger & Execution Box ─────────────────────────────── */}
      <section className="rounded-xl border border-brand/25 bg-brand-soft/30 p-6 shadow-card flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-ink text-white shrink-0 shadow-md" aria-hidden>
            <Download size={24} />
          </div>
          <div>
            <h3 className="t-card-title text-text">
              Ready to Download: {selectedFormatObj.label}
            </h3>
            <p className="text-xs text-text-soft mt-0.5">
              Downloaded over encrypted HTTPS directly to your device storage.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={download}
          disabled={loading}
          className="pt-btn pt-btn-primary h-11 px-6 text-xs disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Generating Secure Archive…
            </>
          ) : (
            <>
              <Download size={16} aria-hidden />
              Download Health Archive (.{selectedFormatObj.ext})
            </>
          )}
        </button>
      </section>

      {/* Status Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-danger-soft border border-danger/25 text-xs font-bold text-danger flex items-center gap-3 shadow-xs">
          <AlertCircle size={18} className="shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {downloadSuccess && (
        <div className="p-4 rounded-xl bg-success-soft border border-success/25 text-xs font-bold text-success flex items-center gap-3 shadow-xs">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden />
          <span>
            Your medical record archive has been prepared and downloaded to your computer.
          </span>
        </div>
      )}

      {/* ── 5. GDPR & DSAR Legal Rights Notice ──────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-surface-2 text-text-soft shrink-0" aria-hidden>
            <FileLock2 size={22} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              Need a Formal Privacy Request (Erasure or Rectification)?
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              Submit a Data Subject Access Request (DSAR) to rectify erroneous lab results or request permanent file erasure under applicable regulations.
            </p>
          </div>
        </div>

        <Link
          href="/patient/dsar"
          className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
        >
          <ExternalLink size={13} aria-hidden />
          Data Subject Requests
        </Link>
      </section>
    </div>
  );
}

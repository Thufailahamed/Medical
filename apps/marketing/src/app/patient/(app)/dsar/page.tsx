"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  FileCheck,
  History,
  Loader2,
  Scale,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  useDsarErasure,
  useDsarExport,
  useDsarJobs,
  useDsarRectification,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

const REQUEST_TYPES = [
  {
    id: "export" as const,
    title: "Certified DSAR Export",
    desc: "Comprehensive evidentiary copy of all stored personal & clinical records",
    badge: "GDPR Art. 15",
    icon: Download,
  },
  {
    id: "rectification" as const,
    title: "Record Rectification",
    desc: "Correct inaccurate medical records, dosages, or personal demographics",
    badge: "GDPR Art. 16",
    icon: Edit3,
  },
  {
    id: "erasure" as const,
    title: "Data Erasure Request",
    desc: "Formal request to permanently expunge non-mandated personal data",
    badge: "GDPR Art. 17",
    icon: Trash2,
  },
];

type RequestType = (typeof REQUEST_TYPES)[number]["id"];

export default function DsarPage() {
  const jobs = useDsarJobs();
  const exportJob = useDsarExport();
  const erasure = useDsarErasure();
  const rectification = useDsarRectification();

  const [activeTab, setActiveTab] = useState<RequestType>("export");
  const [notes, setNotes] = useState("");

  // Rectification fields
  const [rectRecordId, setRectRecordId] = useState("");
  const [rectField, setRectField] = useState("diagnosis");
  const [rectValue, setRectValue] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const jobsList = jobs.data?.items ?? [];

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setError(null);
    setStatus(null);
    try {
      await action();
      setStatus(okMessage);
      setNotes("");
      setRectRecordId("");
      setRectValue("");
      setTimeout(() => setStatus(null), 5000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed.");
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<Scale size={13} aria-hidden />}
        kicker="Statutory Privacy Rights"
        title="Data Subject Requests (DSAR)"
        description="Exercise your legal rights under healthcare privacy legislation. Submit formal requests for certified export, clinical rectification, or permanent erasure."
        actions={
          <>
            <Link href="/patient/audit" className={heroSecondaryAction}>
              <Clock size={13} aria-hidden />
              Activity Audit
            </Link>
            <Link href="/patient/export" className={heroPrimaryAction}>
              <Download size={14} aria-hidden />
              Instant Quick Export
            </Link>
          </>
        }
        footer={
          <>
            <span>Compliance · GDPR &amp; HIPAA</span>
            <span>DSAR History · {jobsList.length} Requests</span>
            <span>Processing SLA · 72 Hours</span>
            <span>Oversight · DPO Supervised</span>
          </>
        }
      />

      {/* ── 2. Select Request Type Strip ────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <h2 className="pt-kicker">
          Select Type of Statutory Privacy Request
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {REQUEST_TYPES.map((t) => {
            const Icon = t.icon;
            const isSelected = activeTab === t.id;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "p-4 sm:p-5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3",
                  isSelected
                    ? "bg-brand-soft/40 border-brand shadow-card"
                    : "bg-surface border-border hover:border-border-strong",
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-md shrink-0 shadow-2xs",
                      isSelected
                        ? "bg-ink text-white"
                        : "bg-surface-2 text-text-soft",
                    )}
                    aria-hidden
                  >
                    <Icon size={16} />
                  </div>

                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-surface-2 text-text-soft">
                    {t.badge}
                  </span>
                </div>

                <div>
                  <h3 className="t-card-title text-text">
                    {t.title}
                  </h3>
                  <p className="text-xs text-text-soft font-medium mt-0.5 leading-relaxed">
                    {t.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 3. Active Request Form Card ─────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
        {activeTab === "export" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="pt-kicker flex items-center gap-2">
                <Download size={16} className="text-brand" aria-hidden />
                <span>Submit Certified DSAR Export Request</span>
              </h3>
              <p className="text-xs text-text-soft mt-0.5">
                Generates a cryptographically signed evidentiary legal archive including consultation audits, billing, consents, and telemetry.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                Request Justification / Specific Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="pt-input h-auto py-3 text-xs sm:text-sm leading-relaxed"
                placeholder="Specify if you require specific date ranges or judicial evidentiary certification..."
              />
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-border">
              <button
                type="button"
                disabled={exportJob.isPending}
                onClick={() =>
                  run(() => exportJob.mutateAsync(), "Certified DSAR export requested successfully.")
                }
                className="pt-btn pt-btn-primary h-10 px-5 text-xs disabled:opacity-50"
              >
                {exportJob.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                    Processing…
                  </>
                ) : (
                  <>
                    <Download size={14} aria-hidden />
                    Request Certified DSAR Export
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === "rectification" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  rectification.mutateAsync({
                    fields: [
                      {
                        recordId: rectRecordId.trim(),
                        field: rectField.trim(),
                        proposedValue: rectValue.trim(),
                      },
                    ],
                    notes: notes || undefined,
                  }),
                "Rectification request submitted for clinical review.",
              );
            }}
          >
            <div>
              <h3 className="pt-kicker flex items-center gap-2">
                <Edit3 size={16} className="text-brand" aria-hidden />
                <span>Submit Clinical Record Rectification</span>
              </h3>
              <p className="text-xs text-text-soft mt-0.5">
                Request correction of incorrect medical notes, dosage amounts, diagnosis dates, or personal demographic details.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                  Target Record Reference / ID
                </label>
                <input
                  required
                  value={rectRecordId}
                  onChange={(e) => setRectRecordId(e.target.value)}
                  placeholder="e.g. REC-2026-0881 or Visit Title"
                  className="pt-input text-xs sm:text-sm"
                />
              </div>

              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                  Target Field Name
                </label>
                <select
                  value={rectField}
                  onChange={(e) => setRectField(e.target.value)}
                  className="pt-input text-xs sm:text-sm"
                >
                  <option value="diagnosis">Diagnosis / Condition Name</option>
                  <option value="dosage">Medication Dosage / Frequency</option>
                  <option value="recordDate">Consultation Date</option>
                  <option value="doctorName">Attending Physician Name</option>
                  <option value="clinicalNotes">Encounter Notes / Narrative</option>
                </select>
              </div>

              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                  Proposed Corrected Value
                </label>
                <input
                  required
                  value={rectValue}
                  onChange={(e) => setRectValue(e.target.value)}
                  placeholder="e.g. 50mg twice daily with food"
                  className="pt-input text-xs sm:text-sm"
                />
              </div>

              <div className="sm:col-span-12 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                  Clinical Evidence / Physician Context (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="pt-input h-auto py-3 text-xs sm:text-sm leading-relaxed"
                  placeholder="Mention hospital discharge letter or reason for discrepancy..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-border">
              <button
                type="submit"
                disabled={rectification.isPending}
                className="pt-btn pt-btn-primary h-10 px-5 text-xs disabled:opacity-50"
              >
                {rectification.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Edit3 size={14} aria-hidden />
                    Submit Rectification Request
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {activeTab === "erasure" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-danger flex items-center gap-2">
                <Trash2 size={16} aria-hidden />
                <span>Submit Data Erasure Request (Right to be Forgotten)</span>
              </h3>
              <p className="text-xs text-text-soft mt-0.5">
                Formally requests permanent purge of non-mandated personal profile data and identity records.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-warn-soft border border-warn/25 text-xs text-warn flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden />
              <div className="leading-relaxed">
                <p className="font-bold">Medical Retention Notice</p>
                <p className="mt-0.5 opacity-80">
                  Under National Medical Council regulations, certain diagnostic lab reports, operative surgical notes, and prescription audits are legally mandated to be retained for 7 years for patient safety and clinical liability. Personal account identifiers and marketing preferences will be deleted immediately upon review.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                Reason for Erasure Request (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="pt-input h-auto py-3 text-xs sm:text-sm leading-relaxed"
                placeholder="Reason for requesting account and profile expungement..."
              />
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-border">
              <button
                type="button"
                disabled={erasure.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Are you sure you want to submit a formal Data Erasure Request? This initiates a formal legal compliance review.",
                    )
                  ) {
                    return;
                  }
                  run(
                    () => erasure.mutateAsync(notes || undefined),
                    "Erasure request submitted to Data Protection Officer.",
                  );
                }}
                className="pt-btn h-10 px-5 text-xs bg-danger text-white hover:brightness-110 disabled:opacity-50"
              >
                {erasure.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                    Submitting Request…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} aria-hidden />
                    Submit Formal Erasure Request
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {status && (
          <div className="p-3 rounded-lg bg-success-soft border border-success/25 text-xs font-semibold text-success flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" aria-hidden />
            <span>{status}</span>
          </div>
        )}
      </section>

      {/* ── 4. Request History Feed ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="pt-kicker flex items-center gap-2">
            <History size={16} className="text-brand" aria-hidden />
            <span>Submitted DSAR Jobs &amp; Status</span>
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-brand">
              {jobsList.length}
            </span>
          </h2>
        </div>

        {jobs.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : jobsList.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-xl bg-surface border border-border shadow-card flex flex-col items-center text-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-soft text-brand shadow-2xs" aria-hidden>
              <FileCheck size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="t-card-title text-text">
                No Data Subject Requests Active
              </h3>
              <p className="text-xs sm:text-sm text-text-soft mt-1 leading-relaxed">
                When you submit a statutory request for certified data export, record rectification, or erasure, the job ticket and compliance review status will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {jobsList.map((job) => {
              const isCompleted = job.status === "completed";
              const isFailed = job.status === "failed";

              return (
                <article
                  key={job.id}
                  className="p-4 sm:p-5 rounded-xl bg-surface border border-border shadow-card flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-md shrink-0",
                        isCompleted
                          ? "bg-success-soft text-success"
                          : isFailed
                            ? "bg-danger-soft text-danger"
                            : "bg-brand-soft text-brand",
                      )}
                      aria-hidden
                    >
                      <FileCheck size={18} />
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-text text-sm capitalize truncate">
                        {job.type} Request
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        Submitted: {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider capitalize shrink-0",
                      isCompleted
                        ? "bg-success-soft text-success"
                        : isFailed
                          ? "bg-danger-soft text-danger"
                          : "bg-brand-soft text-brand",
                    )}
                  >
                    {job.status}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 5. Data Protection Officer (DPO) Callout ────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-soft text-brand shrink-0" aria-hidden>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              Supervised by Data Protection Officer (DPO)
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              All data subject requests are audited by certified healthcare privacy officers. Requests are processed within the statutory 72-hour regulatory window.
            </p>
          </div>
        </div>

        <Link
          href="/patient/audit"
          className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
        >
          <ExternalLink size={13} aria-hidden />
          View Access Audit
        </Link>
      </section>
    </div>
  );
}

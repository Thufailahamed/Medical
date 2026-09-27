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
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
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
                  "p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3",
                  isSelected
                    ? "bg-sky-50/90 border-sky-400 ring-2 ring-sky-500/20 shadow-xs"
                    : "bg-white border-slate-200/90 hover:bg-slate-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                      isSelected
                        ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                        : "bg-slate-100 text-slate-600 border-slate-200",
                    )}
                  >
                    <Icon size={16} />
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    {t.badge}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {t.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                    {t.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 3. Active Request Form Card ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        {activeTab === "export" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Download size={16} className="text-sky-600" />
                <span>Submit Certified DSAR Export Request</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Generates a cryptographically signed evidentiary legal archive including consultation audits, billing, consents, and telemetry.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Request Justification / Specific Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
                placeholder="Specify if you require specific date ranges or judicial evidentiary certification..."
              />
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={exportJob.isPending}
                onClick={() =>
                  run(() => exportJob.mutateAsync(), "Certified DSAR export requested successfully.")
                }
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                {exportJob.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Request Certified DSAR Export</span>
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
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Edit3 size={16} className="text-sky-600" />
                <span>Submit Clinical Record Rectification</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Request correction of incorrect medical notes, dosage amounts, diagnosis dates, or personal demographic details.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Target Record Reference / ID
                </label>
                <input
                  required
                  value={rectRecordId}
                  onChange={(e) => setRectRecordId(e.target.value)}
                  placeholder="e.g. REC-2026-0881 or Visit Title"
                  className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Target Field Name
                </label>
                <select
                  value={rectField}
                  onChange={(e) => setRectField(e.target.value)}
                  className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
                >
                  <option value="diagnosis">Diagnosis / Condition Name</option>
                  <option value="dosage">Medication Dosage / Frequency</option>
                  <option value="recordDate">Consultation Date</option>
                  <option value="doctorName">Attending Physician Name</option>
                  <option value="clinicalNotes">Encounter Notes / Narrative</option>
                </select>
              </div>

              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Proposed Corrected Value
                </label>
                <input
                  required
                  value={rectValue}
                  onChange={(e) => setRectValue(e.target.value)}
                  placeholder="e.g. 50mg twice daily with food"
                  className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div className="sm:col-span-12 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Clinical Evidence / Physician Context (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
                  placeholder="Mention hospital discharge letter or reason for discrepancy..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={rectification.isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                {rectification.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  <>
                    <Edit3 size={14} />
                    <span>Submit Rectification Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {activeTab === "erasure" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-800 flex items-center gap-2">
                <Trash2 size={16} className="text-rose-600" />
                <span>Submit Data Erasure Request (Right to be Forgotten)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Formally requests permanent purge of non-mandated personal profile data and identity records.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <p className="font-bold">Medical Retention Notice</p>
                <p className="text-amber-800 mt-0.5">
                  Under National Medical Council regulations, certain diagnostic lab reports, operative surgical notes, and prescription audits are legally mandated to be retained for 7 years for patient safety and clinical liability. Personal account identifiers and marketing preferences will be deleted immediately upon review.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Reason for Erasure Request (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all leading-relaxed"
                placeholder="Reason for requesting account and profile expungement..."
              />
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
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
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {erasure.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Submitting Request…</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Submit Formal Erasure Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {status && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{status}</span>
          </div>
        )}
      </section>

      {/* ── 4. Request History Feed ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <History size={16} className="text-sky-600" />
            <span>Submitted DSAR Jobs &amp; Status</span>
            <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/60">
              {jobsList.length}
            </span>
          </h2>
        </div>

        {jobs.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : jobsList.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-2xs">
              <FileCheck size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">
                No Data Subject Requests Active
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
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
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                        isCompleted
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : isFailed
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-sky-50 text-sky-700 border-sky-200",
                      )}
                    >
                      <FileCheck size={18} />
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm capitalize truncate">
                        {job.type} Request
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Submitted: {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold capitalize shrink-0 border",
                      isCompleted
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : isFailed
                          ? "bg-rose-100 text-rose-800 border-rose-200"
                          : "bg-sky-100 text-sky-800 border-sky-200",
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
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Supervised by Data Protection Officer (DPO)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              All data subject requests are audited by certified healthcare privacy officers. Requests are processed within the statutory 72-hour regulatory window.
            </p>
          </div>
        </div>

        <Link
          href="/patient/audit"
          className="px-4 py-2 rounded-xl text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <ExternalLink size={13} className="text-sky-700" />
          <span>View Access Audit</span>
        </Link>
      </section>
    </div>
  );
}

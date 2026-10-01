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
import {
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";

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

  const jobsList = useMemo(() => jobs.data?.items ?? [], [jobs.data?.items]);
  const completedCount = jobsList.filter((j) => j.status === "completed").length;
  const pendingCount = jobsList.filter(
    (j) => j.status !== "completed" && j.status !== "failed",
  ).length;

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
    <PatientPage>
      <PatientHero
        kickerIcon={<Scale size={13} aria-hidden />}
        kicker="Privacy"
        kickerMeta="Statutory rights"
        title={
          <>
            Data subject <HeroAccent>requests</HeroAccent>
          </>
        }
        description="Exercise your legal rights under healthcare privacy legislation — certified export, clinical rectification, or permanent erasure."
        chips={
          <>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              GDPR &amp; HIPAA
            </span>
            <span className={HERO_CHIP}>{jobsList.length} requests</span>
            <span className={HERO_CHIP}>72h SLA · DPO supervised</span>
          </>
        }
        actions={
          <>
            <Link href="/patient/audit" className={HERO_GHOST}>
              <Clock size={13} /> Activity audit
            </Link>
            <Link href="/patient/export" className={HERO_PRIMARY}>
              <Download size={14} className="text-sky-600" /> Instant export
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<FileCheck size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Requests"
          value={String(jobsList.length)}
          sub="Submitted to date"
        />
        <StatTile
          icon={<Loader2 size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="In review"
          value={String(pendingCount)}
          sub="Within 72h window"
          pulse={pendingCount > 0}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Completed"
          value={String(completedCount)}
          sub="Processed by DPO"
        />
        <StatTile
          icon={<Download size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Quick export"
          value="EHR"
          sub="Instant download"
          href="/patient/export"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {/* Request type picker */}
          <section className={PANEL}>
            <PanelHeader
              icon={<Scale size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Select request type"
              caption="Three statutory actions under privacy legislation."
            />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {REQUEST_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex cursor-pointer flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all sm:p-5",
                      isSelected
                        ? "border-sky-300 bg-sky-50/60 shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-md",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                          isSelected
                            ? "bg-[#07233a] text-white"
                            : "bg-slate-100 text-slate-500",
                        )}
                        aria-hidden
                      >
                        <Icon size={16} />
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {t.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{t.title}</h3>
                      <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">
                        {t.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Active request form */}
          <section className={PANEL}>
            {activeTab === "export" ? (
              <>
                <PanelHeader
                  icon={<Download size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="Certified DSAR export"
                  caption="Cryptographically signed evidentiary archive: consultations, billing, consents, telemetry."
                />
                <div className="mt-4">
                  <label className={FIELD_LABEL}>
                    Request justification / specific notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className={FIELD_TEXTAREA}
                    placeholder="Specify if you require specific date ranges or judicial evidentiary certification..."
                  />
                </div>
                <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    disabled={exportJob.isPending}
                    onClick={() =>
                      run(
                        () => exportJob.mutateAsync(),
                        "Certified DSAR export requested successfully.",
                      )
                    }
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-5 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {exportJob.isPending ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                    ) : (
                      <Download size={14} aria-hidden />
                    )}
                    {exportJob.isPending ? "Processing…" : "Request certified export"}
                  </button>
                </div>
              </>
            ) : null}

            {activeTab === "rectification" ? (
              <form
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
                <PanelHeader
                  icon={<Edit3 size={16} />}
                  tone="bg-amber-50 text-amber-600"
                  title="Clinical record rectification"
                  caption="Correct medical notes, dosage amounts, diagnosis dates, or demographics."
                />
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <label className={FIELD_LABEL}>Target record reference / ID</label>
                    <input
                      required
                      value={rectRecordId}
                      onChange={(e) => setRectRecordId(e.target.value)}
                      placeholder="e.g. REC-2026-0881 or visit title"
                      className={FIELD_INPUT}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className={FIELD_LABEL}>Target field name</label>
                    <select
                      value={rectField}
                      onChange={(e) => setRectField(e.target.value)}
                      className={FIELD_INPUT}
                    >
                      <option value="diagnosis">Diagnosis / condition name</option>
                      <option value="dosage">Medication dosage / frequency</option>
                      <option value="recordDate">Consultation date</option>
                      <option value="doctorName">Attending physician name</option>
                      <option value="clinicalNotes">Encounter notes / narrative</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className={FIELD_LABEL}>Proposed corrected value</label>
                    <input
                      required
                      value={rectValue}
                      onChange={(e) => setRectValue(e.target.value)}
                      placeholder="e.g. 50mg twice daily with food"
                      className={FIELD_INPUT}
                    />
                  </div>
                  <div className="sm:col-span-12">
                    <label className={FIELD_LABEL}>
                      Clinical evidence / physician context (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className={FIELD_TEXTAREA}
                      placeholder="Mention hospital discharge letter or reason for discrepancy..."
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    disabled={rectification.isPending}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-5 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {rectification.isPending ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                    ) : (
                      <Edit3 size={14} aria-hidden />
                    )}
                    {rectification.isPending ? "Submitting…" : "Submit rectification"}
                  </button>
                </div>
              </form>
            ) : null}

            {activeTab === "erasure" ? (
              <>
                <PanelHeader
                  icon={<Trash2 size={16} />}
                  tone="bg-rose-50 text-rose-600"
                  title="Data erasure request"
                  caption="Right to be forgotten — permanent purge of non-mandated personal data."
                />
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <div className="leading-relaxed">
                    <p className="font-bold">Medical retention notice</p>
                    <p className="mt-0.5 opacity-80">
                      Under National Medical Council regulations, certain diagnostic lab
                      reports, operative surgical notes, and prescription audits are
                      legally mandated to be retained for 7 years for patient safety
                      and clinical liability. Personal account identifiers and
                      marketing preferences will be deleted immediately upon review.
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className={FIELD_LABEL}>Reason for erasure request (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className={FIELD_TEXTAREA}
                    placeholder="Reason for requesting account and profile expungement..."
                  />
                </div>
                <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-4">
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
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-5 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-50"
                  >
                    {erasure.isPending ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                    ) : (
                      <Trash2 size={14} aria-hidden />
                    )}
                    {erasure.isPending ? "Submitting…" : "Submit formal erasure"}
                  </button>
                </div>
              </>
            ) : null}

            {error ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <AlertCircle size={14} className="shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}

            {status ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={14} className="shrink-0" aria-hidden />
                <span>{status}</span>
              </div>
            ) : null}
          </section>

          {/* Request history */}
          <section className={PANEL}>
            <PanelHeader
              icon={<History size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Submitted requests"
              caption={`${jobsList.length} jobs · compliance review status`}
            />
            {jobs.isLoading ? (
              <PanelSkeleton rows={2} />
            ) : jobsList.length === 0 ? (
              <EmptyBlock
                icon={<FileCheck size={19} />}
                title="No data subject requests"
                body="When you submit a statutory request for certified export, rectification, or erasure, the job ticket and review status appear here."
              />
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {jobsList.map((job) => {
                  const isCompleted = job.status === "completed";
                  const isFailed = job.status === "failed";
                  return (
                    <article
                      key={job.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                            isCompleted
                              ? "bg-emerald-50 text-emerald-600"
                              : isFailed
                                ? "bg-rose-50 text-rose-600"
                                : "bg-sky-50 text-sky-600",
                          )}
                          aria-hidden
                        >
                          <FileCheck size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold capitalize text-slate-900">
                            {job.type} request
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Submitted {new Date(job.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider capitalize",
                          isCompleted
                            ? "bg-emerald-50 text-emerald-700"
                            : isFailed
                              ? "bg-rose-50 text-rose-700"
                              : "bg-sky-50 text-sky-700",
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
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<ShieldCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="DPO supervised"
              caption="72-hour statutory window."
            />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              All data subject requests are audited by certified healthcare privacy
              officers and processed within the statutory 72-hour regulatory window.
            </p>
            <Link
              href="/patient/audit"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <History size={13} /> View access audit
            </Link>
          </section>

          <QuickToolsPanel
            id="dsar-tools"
            title="Tools"
            tools={[
              {
                icon: Download,
                label: "Export",
                hint: "Archive",
                href: "/patient/export",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: ShieldCheck,
                label: "Consents",
                hint: "Grants",
                href: "/patient/consents",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: History,
                label: "Audit",
                hint: "Activity",
                href: "/patient/audit",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}

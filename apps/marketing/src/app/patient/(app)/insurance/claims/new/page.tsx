"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Hospital,
  Loader2,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
} from "@/patient/components/workspace";

interface Enrollment {
  id: string;
  policyNumber: string | null;
  status: string;
  planName?: string;
  providerName?: string;
}

const TREATMENTS = [
  { value: "hospitalization", label: "Hospitalization", icon: Hospital },
  { value: "day_care", label: "Day Care Surgery", icon: Clock },
  { value: "opd", label: "Outpatient (OPD)", icon: Stethoscope },
  { value: "diagnostic", label: "Diagnostic Scans", icon: Activity },
  { value: "dental", label: "Dental Care", icon: FileCheck },
  { value: "maternity", label: "Maternity", icon: Sparkles },
] as const;

const DOC_KINDS = [
  { value: "bill", label: "Hospital Bill / Invoice" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "prescription", label: "Doctor Prescription" },
  { value: "lab_report", label: "Laboratory / Scan Report" },
  { value: "id_proof", label: "National ID / Passport" },
] as const;

const COST_PRESETS = [50000, 100000, 250000, 500000];

interface UploadedDoc {
  kind: string;
  fileKey: string;
  fileName?: string;
}

export default function NewClaimPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [enrollmentId, setEnrollmentId] = useState<string>("");
  const [treatmentType, setTreatmentType] = useState<string>("hospitalization");
  const [facility, setFacility] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [pendingDocKind, setPendingDocKind] = useState<string>("bill");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const enrollQ = useQuery({
    queryKey: ["insurance", "enrollments", "me"],
    queryFn: () =>
      api<{ enrollments: Enrollment[] }>(
        "/insurance-marketplace/enrollments/me",
      ),
  });

  const allEnrollments = enrollQ.data?.enrollments ?? [];
  const activeEnrollments = allEnrollments.filter((e) => e.status === "active");

  // Auto-pick first active enrollment (derived — avoids setState-in-render).
  const effectiveEnrollmentId =
    enrollmentId || activeEnrollments[0]?.id || allEnrollments[0]?.id || "";

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api<{ file: { r2Key: string } }>("/files/upload", {
        method: "POST",
        body: formData,
      });
      return res.file.r2Key;
    },
  });

  const createMut = useMutation({
    mutationFn: () =>
      api<{ claim: { id: string } }>(
        "/insurance-marketplace/claims",
        {
          method: "POST",
          json: {
            enrollmentId: effectiveEnrollmentId,
            treatmentType,
            incurringFacility: facility || undefined,
            admissionDate: admissionDate || undefined,
            dischargeDate: dischargeDate || undefined,
            diagnosis: diagnosis || undefined,
            amountRequestedLkr: Number(amount) || 0,
            patientRemarks: remarks || undefined,
            documents: docs.map((d) => ({
              kind: d.kind,
              fileKey: d.fileKey,
              fileName: d.fileName,
            })),
          },
        },
      ),
  });

  const submitMut = useMutation({
    mutationFn: (claimId: string) =>
      api(`/insurance-marketplace/claims/${claimId}/submit`, {
        method: "POST",
      }),
  });

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const r2Key = await uploadMut.mutateAsync(file);
      setDocs((prev) => [
        ...prev,
        { kind: pendingDocKind, fileKey: r2Key, fileName: file.name },
      ]);
    } catch {
      setUploadError("Document upload failed. File size must be under 15MB.");
    }
    e.target.value = "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveEnrollmentId || !amount || docs.length === 0) return;
    try {
      const created = await createMut.mutateAsync();
      await submitMut.mutateAsync(created.claim.id);
      qc.invalidateQueries({ queryKey: ["insurance"] });
      router.push(`/patient/insurance/claims/${created.claim.id}`);
    } catch (err) {
      console.error("Submission failed", err);
    }
  };

  const submitting = createMut.isPending || submitMut.isPending;
  const hasActivePolicy = activeEnrollments.length > 0;
  const canSubmit = Boolean(effectiveEnrollmentId && amount && docs.length > 0 && !submitting);
  const costNum = Number(amount) || 0;
  const treatment = TREATMENTS.find((t) => t.value === treatmentType);

  return (
    <PatientPage>
      <div className="-mb-1">
        <Link
          href="/patient/insurance/claims"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Claims
        </Link>
      </div>

      <PatientHero
        overlap={false}
        kickerIcon={<FileText size={13} aria-hidden />}
        kicker="Insurance"
        kickerMeta="Reimbursement filing"
        title={
          <>
            File a <HeroAccent>new claim</HeroAccent>
          </>
        }
        description="Submit out-of-pocket medical bills for underwriter assessment and direct-to-bank reimbursement."
        chips={
          <>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              {activeEnrollments.length} active {activeEnrollments.length === 1 ? "policy" : "policies"}
            </span>
            <span className={HERO_CHIP}>Review · 48–72h</span>
            <span className={HERO_CHIP}>Direct bank settlement</span>
          </>
        }
        actions={
          <Link href="/patient/insurance/claims" className={HERO_GHOST}>
            <Receipt size={13} /> All claims
          </Link>
        }
      />

      {enrollQ.isLoading ? (
        <section className={PANEL}>
          <PanelSkeleton rows={4} />
        </section>
      ) : allEnrollments.length === 0 ? (
        <section className={PANEL}>
          <EmptyBlock
            icon={<ShieldCheck size={19} />}
            title="No insurance policy found"
            body="You need an active policy before filing a claim. Compare plans on the marketplace and enrol in minutes."
            actions={
              <Link
                href="/patient/insurance/marketplace"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500"
              >
                Browse plans <ArrowRight size={13} />
              </Link>
            }
          />
        </section>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="grid gap-5 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
              {!hasActivePolicy ? (
                <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-amber-900">No active policy</div>
                    <div className="mt-0.5 text-sm text-amber-800">
                      Your policies aren&apos;t active — the insurer may decline this claim.{" "}
                      <Link
                        href="/patient/insurance"
                        className="font-bold underline underline-offset-2"
                      >
                        View policies
                      </Link>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className={PANEL}>
                <PanelHeader
                  icon={<ShieldCheck size={16} />}
                  tone="bg-emerald-50 text-emerald-600"
                  title="1 · Select policy"
                  caption="Which policy is this claim against?"
                />
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {allEnrollments.map((e) => {
                    const active = e.id === effectiveEnrollmentId;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEnrollmentId(e.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                          active
                            ? "border-sky-500 bg-sky-50/60 shadow-[0_0_0_3px_rgba(14,165,233,0.12)]"
                            : "border-slate-100 bg-white hover:border-slate-200",
                        )}
                      >
                        <div
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                            active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {active ? <Check size={16} /> : <ShieldCheck size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-slate-900">
                            {e.planName ?? e.policyNumber ?? "Policy"}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="truncate">{e.providerName}</span>
                            <Badge tone={e.status === "active" ? "emerald" : "slate"}>
                              {e.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={PANEL}>
                <PanelHeader
                  icon={<Stethoscope size={16} />}
                  tone="bg-violet-50 text-violet-600"
                  title="2 · Treatment type"
                  caption="What kind of care are you claiming for?"
                />
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TREATMENTS.map((t) => {
                    const active = treatmentType === t.value;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTreatmentType(t.value)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                          active
                            ? "border-sky-500 bg-sky-50/60 shadow-[0_0_0_3px_rgba(14,165,233,0.12)]"
                            : "border-slate-100 bg-white hover:border-slate-200",
                        )}
                      >
                        <div
                          className={cn(
                            "grid h-9 w-9 place-items-center rounded-lg",
                            active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500",
                          )}
                        >
                          <Icon size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={PANEL}>
                <PanelHeader
                  icon={<Hospital size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="3 · Treatment details"
                  caption="Facility, dates, diagnosis and billed amount."
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={FIELD_LABEL}>Facility / hospital</label>
                    <input
                      className={FIELD_INPUT}
                      value={facility}
                      onChange={(e) => setFacility(e.target.value)}
                      placeholder="e.g. Asiri Surgical Hospital"
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Admission date</label>
                    <input
                      type="date"
                      className={FIELD_INPUT}
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Discharge date</label>
                    <input
                      type="date"
                      className={FIELD_INPUT}
                      value={dischargeDate}
                      onChange={(e) => setDischargeDate(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={FIELD_LABEL}>Diagnosis / procedure</label>
                    <input
                      className={FIELD_INPUT}
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="e.g. Laparoscopic appendectomy"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={FIELD_LABEL}>Claimed amount (LKR)</label>
                    <input
                      type="number"
                      min={0}
                      className={FIELD_INPUT}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COST_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmount(String(preset))}
                          className={cn(
                            "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                            costNum === preset
                              ? "border-sky-500 bg-sky-50 text-sky-700"
                              : "border-slate-200 text-slate-500 hover:border-slate-300",
                          )}
                        >
                          {formatLkr(preset)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={FIELD_LABEL}>Notes for the underwriter (optional)</label>
                    <textarea
                      className={FIELD_TEXTAREA}
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Anything else the insurer should know…"
                    />
                  </div>
                </div>
              </section>

              <section className={PANEL}>
                <PanelHeader
                  icon={<Upload size={16} />}
                  tone="bg-amber-50 text-amber-600"
                  title="4 · Supporting documents"
                  caption="Bills, summaries and reports — at least one required."
                  action={
                    docs.length > 0 ? (
                      <Badge tone="emerald">{docs.length} attached</Badge>
                    ) : undefined
                  }
                />
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={pendingDocKind}
                    onChange={(e) => setPendingDocKind(e.target.value)}
                    className={cn(FIELD_INPUT, "mt-0 sm:max-w-xs")}
                  >
                    {DOC_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMut.isPending}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                  >
                    {uploadMut.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    Upload file
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={onFileChange}
                  />
                </div>

                {uploadError ? (
                  <p className="mt-2 text-xs font-semibold text-rose-600">{uploadError}</p>
                ) : null}

                {docs.length > 0 ? (
                  <ul className="mt-4 space-y-1.5">
                    {docs.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                          <CheckCircle2 size={14} />
                        </div>
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
                          {d.fileName ?? "Document"}
                        </span>
                        <Badge tone="slate">
                          {DOC_KINDS.find((k) => k.value === d.kind)?.label ?? d.kind}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => setDocs(docs.filter((_, j) => j !== i))}
                          className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50"
                          aria-label="Remove document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                    <Upload size={20} className="text-slate-300" />
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      No documents attached yet
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      PDF or photo, under 15MB each
                    </p>
                  </div>
                )}
              </section>
            </div>

            <aside className="flex flex-col gap-5 xl:col-span-4">
              <section className={cn(PANEL, "border-2 border-sky-100")}>
                <PanelHeader
                  icon={<Wallet size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="Claim summary"
                  caption="Review before submitting."
                />
                <div className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Treatment</span>
                    <span className="text-right font-medium text-slate-900">
                      {treatment?.label ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Facility</span>
                    <span className="max-w-[55%] truncate text-right font-medium text-slate-900">
                      {facility || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Documents</span>
                    <span className="font-medium text-slate-900">{docs.length}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-2.5">
                    <span className="text-slate-500">Claimed amount</span>
                    <span className="text-base font-bold text-slate-900">
                      {costNum > 0 ? formatLkr(costNum) : "—"}
                    </span>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      Submit claim <ArrowRight size={15} />
                    </>
                  )}
                </button>
                {docs.length === 0 ? (
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    Attach at least one document to submit
                  </p>
                ) : null}
              </section>

              <section className={PANEL}>
                <PanelHeader
                  icon={<FileCheck size={16} />}
                  tone="bg-emerald-50 text-emerald-600"
                  title="Faster approval"
                  caption="What underwriters look for."
                />
                <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-500">
                  {[
                    "Itemized hospital invoice with pharmacy breakdown",
                    "Discharge summary covering admission & diagnosis",
                    "Prescriptions matching billed medications",
                    "Clear, uncropped photos or PDFs under 15MB",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </section>

              <QuickToolsPanel
                id="new-claim-tools"
                title="Insurance"
                tools={[
                  {
                    icon: Receipt,
                    label: "My claims",
                    hint: "History",
                    href: "/patient/insurance/claims",
                    tone: "from-amber-500 to-orange-500 shadow-amber-500/30",
                  },
                  {
                    icon: ShieldCheck,
                    label: "Policies",
                    hint: "My cover",
                    href: "/patient/insurance",
                    tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
                  },
                  {
                    icon: Activity,
                    label: "Coverage check",
                    hint: "Eligibility",
                    href: "/patient/insurance/coverage-check",
                    tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
                  },
                ]}
              />
            </aside>
          </div>
        </form>
      )}
    </PatientPage>
  );
}

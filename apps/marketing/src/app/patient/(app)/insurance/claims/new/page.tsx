"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Hospital,
  Info,
  Loader2,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

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
  const [facility, setFacility] = useState("Asiri Surgical Hospital");
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

  // Auto-pick first active enrollment or any enrollment
  if (
    !enrollmentId &&
    allEnrollments.length > 0 &&
    allEnrollments[0]
  ) {
    const chosen = activeEnrollments[0] || allEnrollments[0];
    setEnrollmentId(chosen.id);
  }

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
            enrollmentId,
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

  const onPickFile = () => {
    fileInputRef.current?.click();
  };

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
    if (!enrollmentId || !amount || docs.length === 0) return;
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
  const canSubmit = Boolean(enrollmentId && amount && docs.length > 0 && !submitting);
  const costNum = Number(amount) || 0;

  return (
    <div className="flex flex-col gap-6 pb-16 max-w-4xl mx-auto">
      {/* ── 1. Back Link ───────────────────────────────────────────────────── */}
      <Link
        href="/patient/insurance/claims"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-sky-700 transition-colors self-start"
      >
        <ArrowLeft size={14} />
        <span>Back to Claims</span>
      </Link>

      {/* ── 2. Oceanic Signature Hero Header ───────────────────────────────── */}
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
                <Receipt size={12} className="text-sky-300" />
                Digital Claims Portal
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Submit Reimbursement Claim
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                File out-of-pocket medical expenses, attach itemized hospital invoices and discharge summaries, and track underwriter approval.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/insurance/coverage-check"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Activity size={13} />
                <span>Coverage Check</span>
              </Link>
              <Link
                href="/patient/insurance/marketplace"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <ShieldCheck size={14} className="text-sky-700" />
                <span>Marketplace</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Turnaround
                </p>
                <p className="text-base font-extrabold text-white">48 - 72 Hours</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <FileCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Acceptance
                </p>
                <p className="text-base font-extrabold text-white">PDF / Scans</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Wallet size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Settlement
                </p>
                <p className="text-base font-extrabold text-white">Direct Wire</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Security
                </p>
                <p className="text-base font-extrabold text-white">Encrypted</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 3. Policy Status Check ─────────────────────────────────────────── */}
      {!hasActivePolicy ? (
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50/80 via-white to-sky-50/40 p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 uppercase tracking-wider mb-1">
                <Sparkles size={12} className="text-sky-600" />
                Insurance Policy Required
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                You need an active insurance policy to file a claim
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-lg leading-relaxed">
                Underwriter regulations require reimbursement claims to be anchored to a certified health plan with a verified sum insured limit. Browse top insurance plans and get covered in 3 minutes.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-600 font-medium">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Instant Cashless Coverage
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-sky-700">
                  <CheckCircle2 size={13} className="text-sky-600" />
                  Direct Hospital Settlement
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/patient/insurance/marketplace"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all shrink-0 flex items-center gap-1.5"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            <span>Explore Plans</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      ) : null}

      {/* ── 4. Claim Filing Form ───────────────────────────────────────────── */}
      <form
        onSubmit={onSubmit}
        className={cn(
          "rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs flex flex-col gap-6",
          !hasActivePolicy ? "opacity-60 pointer-events-none" : "",
        )}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Claim Filing &amp; Treatment Details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Please enter the medical event details and attach official invoices.
            </p>
          </div>
          <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full">
            Underwriter Form
          </span>
        </div>

        {/* 1. Policy Picker */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Select Active Policy
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeEnrollments.map((e) => {
              const isSelected = enrollmentId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEnrollmentId(e.id)}
                  className={cn(
                    "text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer",
                    isSelected
                      ? "bg-sky-50 border-sky-300 ring-2 ring-sky-500/20 shadow-xs"
                      : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70",
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      isSelected
                        ? "bg-sky-600 text-white"
                        : "bg-slate-200 text-slate-600",
                    )}
                  >
                    <ShieldCheck size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {e.planName || "Comprehensive Health Plan"}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {e.providerName} · {e.policyNumber ?? `Policy #${e.id.slice(0, 8)}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Treatment Type Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Treatment Category
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TREATMENTS.map((t) => {
              const Icon = t.icon;
              const isSelected = treatmentType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTreatmentType(t.value)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                    isSelected
                      ? "bg-sky-50 border-sky-300 text-sky-900 ring-2 ring-sky-500/20 shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/70",
                  )}
                >
                  <Icon
                    size={15}
                    className={isSelected ? "text-sky-600" : "text-slate-400"}
                  />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Hospital / Facility Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Building2 size={13} className="text-sky-600" />
            Hospital / Incurring Medical Facility
          </label>
          <input
            type="text"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            placeholder="e.g. Asiri Surgical Hospital, Lanka Hospitals..."
            className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            required
          />
        </div>

        {/* 4. Admission and Discharge Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Calendar size={13} className="text-sky-600" />
              Admission Date
            </label>
            <input
              type="date"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Calendar size={13} className="text-sky-600" />
              Discharge Date
            </label>
            <input
              type="date"
              value={dischargeDate}
              onChange={(e) => setDischargeDate(e.target.value)}
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        {/* 5. Diagnosis / Procedure Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Stethoscope size={13} className="text-sky-600" />
            Diagnosis &amp; Clinical Summary
          </label>
          <textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={2}
            placeholder="Brief description of illness, diagnosis, or surgical procedure..."
            className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            required
          />
        </div>

        {/* 6. Amount Requested (LKR) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Receipt size={13} className="text-sky-600" />
              Total Reimbursement Amount (LKR)
            </label>
            <span className="text-xs font-bold text-sky-800">
              {formatLkr(costNum)}
            </span>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              LKR
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="150000"
              className="w-full h-11 pl-12 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              required
            />
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">
              Presets:
            </span>
            {COST_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  Number(amount) === preset
                    ? "bg-sky-600 text-white font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {formatLkr(preset)}
              </button>
            ))}
          </div>
        </div>

        {/* 7. Documents Upload Section */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                Required Claim Documents
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Attach at least 1 document (Hospital bill, discharge summary, or doctor prescription).
              </p>
            </div>
            <span className="text-[11px] font-bold text-sky-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
              {docs.length} Attached
            </span>
          </div>

          {/* Document Type Selector */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {DOC_KINDS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setPendingDocKind(d.value)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer",
                  pendingDocKind === d.value
                    ? "bg-sky-600 text-white font-bold shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*,application/dicom"
            className="hidden"
            onChange={onFileChange}
          />

          <button
            type="button"
            onClick={onPickFile}
            disabled={uploadMut.isPending}
            className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-sky-800 bg-white border border-sky-300 hover:bg-sky-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
          >
            {uploadMut.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Uploading Document…</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Choose &amp; Upload Document</span>
              </>
            )}
          </button>

          {uploadError ? (
            <p className="text-xs text-rose-600 font-semibold">{uploadError}</p>
          ) : null}

          {/* Attached Files List */}
          {docs.length > 0 ? (
            <ul className="space-y-2 pt-2 border-t border-slate-200">
              {docs.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-2xs text-xs"
                >
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <span className="flex-1 truncate font-semibold text-slate-800">
                    {d.fileName ?? d.fileKey.slice(0, 24)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 capitalize">
                    {d.kind.replace(/_/g, " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDocs(docs.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Remove file"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* 8. Notes for Reviewer */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Notes for the Underwriting Reviewer (Optional)
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            placeholder="Any extra context (e.g. emergency admission details, surgeon recommendations)..."
            className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
        </div>

        {/* Error State */}
        {(createMut.isError || submitMut.isError) && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
            <span>
              Claim submission failed. Please verify your document uploads and try again.
            </span>
          </div>
        )}

        {/* Submit Bar */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Info size={13} />
            Documents are verified under bank-grade encryption
          </span>

          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Transmitting Claim to Insurer…</span>
              </>
            ) : (
              <>
                <Receipt size={14} />
                <span>Submit Reimbursement Claim</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
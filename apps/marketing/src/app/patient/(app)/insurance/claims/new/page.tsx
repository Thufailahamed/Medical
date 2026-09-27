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
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

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
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-soft hover:text-brand transition-colors self-start"
      >
        <ArrowLeft size={14} />
        <span>Back to Claims</span>
      </Link>

      {/* ── 2. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<FileText size={13} />}
        kicker="New Claim Filing"
        title="File a New Claim"
        description="Submit out-of-pocket medical bills for underwriter assessment and direct-to-bank reimbursement."
        actions={<Link href="/patient/insurance/claims" className={heroSecondaryAction}><ChevronLeft size={13} /><span>Back to Claims</span></Link>}
        footer={
          <>
            <span>Attach bills & prescriptions</span>
            <span>Underwriter review · 48-72h</span>
            <span>Direct bank settlement</span>
          </>
        }
      />


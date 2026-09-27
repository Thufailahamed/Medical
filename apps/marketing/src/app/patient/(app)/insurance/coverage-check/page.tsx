"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calculator,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck,
  FileText,
  Hospital,
  Info,
  Loader2,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Wallet,
  Zap,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

interface CoverageResult {
  enrolled: boolean;
  planName: string | null;
  coverageType: string | null;
  covered: boolean;
  copayPct: number;
  estimatedOutOfPocketLkr: number;
  deductibleLkr: number;
  notes: string[];
  providerName?: string | null;
  remainingAnnualLimitLkr?: number | null;
  waitingPeriods?: Array<{ condition: string; remainingDays: number }>;
  exclusions?: string[];
}

const TREATMENTS = [
  { value: "hospitalization", label: "Hospitalization", icon: Hospital },
  { value: "day_care", label: "Day Care Surgery", icon: Clock },
  { value: "opd", label: "Outpatient (OPD)", icon: Stethoscope },
  { value: "diagnostic", label: "Diagnostic Scans", icon: Activity },
  { value: "dental", label: "Dental Care", icon: FileCheck },
  { value: "maternity", label: "Maternity", icon: Sparkles },
] as const;

const COST_PRESETS = [50000, 100000, 250000, 500000, 1000000];

export default function CoverageCheckPage() {
  const [enrollmentId, setEnrollmentId] = useState("");
  const [treatmentType, setTreatmentType] = useState("hospitalization");
  const [facility, setFacility] = useState("Asiri Surgical Hospital");
  const [diagnosis, setDiagnosis] = useState("Laparoscopic Appendectomy");
  const [estimatedCost, setEstimatedCost] = useState("250000");

  const enrollmentsQ = useQuery({
    queryKey: ["insurance-marketplace", "enrollments", "me"],
    queryFn: () =>
      api<{
        enrollments: Array<{
          id: string;
          policyNumber: string | null;
          status: string;
          planName?: string;
          providerName?: string;
        }>;
      }>("/insurance-marketplace/enrollments/me"),
  });

  const activeEnrollments =
    enrollmentsQ.data?.enrollments?.filter((e) => e.status === "active") ?? [];

  useEffect(() => {
    if (activeEnrollments.length > 0 && !enrollmentId) {
      setEnrollmentId(activeEnrollments[0].id);
    }
  }, [activeEnrollments, enrollmentId]);

  const checkMut = useMutation({
    mutationFn: () =>
      api<CoverageResult>("/insurance-marketplace/coverage-check", {
        method: "POST",
        json: {
          enrollmentId,
          treatmentType,
          estimatedAmountLkr: Number(estimatedCost) || 0,
          hospitalName: facility.trim() || undefined,
        },
      }),
  });

  const runCheck = (e: React.FormEvent) => {
    e.preventDefault();
    checkMut.mutate();
  };

  const result = checkMut.data;
  const costNum = Number(estimatedCost) || 0;
  const isEligible = !!result && result.enrolled && result.covered;
  const coveredAmount = result ? Math.max(0, costNum - result.estimatedOutOfPocketLkr) : 0;
  const patientOop = result?.estimatedOutOfPocketLkr ?? 0;

  return (
    <div className="flex flex-col gap-6 pb-16 max-w-4xl mx-auto">
      {/* ── 1. Back Link ───────────────────────────────────────────────────── */}
      <Link
        href="/patient/insurance"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-soft hover:text-brand transition-colors self-start"
      >
        <ArrowLeft size={14} />
        <span>Back to Insurance Hub</span>
      </Link>

      {/* ── 2. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<Activity size={13} />}
        kicker="Coverage Eligibility Check"
        title="Check My Coverage"
        description="Verify what your current policy covers — treatments, procedures, and cashless eligibility — before you book."
        actions={<Link href="/patient/insurance" className={heroSecondaryAction}><ChevronLeft size={13} /><span>Insurance Home</span></Link>}
        footer={
          <>
            <span>Instant payer lookup</span>
            <span>Cashless eligibility</span>
            <span>Treatment-level detail</span>
          </>
        }
      />


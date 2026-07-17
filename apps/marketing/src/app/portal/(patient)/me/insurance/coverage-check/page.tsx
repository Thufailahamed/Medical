"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Field, Input, Textarea } from "@/portal/components/ui/Form";
import { formatLkr } from "@/portal/lib/format";

interface CoverageResult {
  coverage: {
    eligible: boolean;
    coveredAmountLkr: number;
    patientResponsibilityLkr: number;
    notes: string[];
    policyId?: string;
    planName?: string;
    providerName?: string;
    remainingAnnualLimitLkr?: number;
    waitingPeriods?: Array<{ condition: string; remainingDays: number }>;
    exclusions?: string[];
  };
}

const TREATMENTS = [
  { value: "hospitalization", label: "Hospitalization" },
  { value: "day_care", label: "Day care" },
  { value: "opd", label: "OPD" },
  { value: "dental", label: "Dental" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "maternity", label: "Maternity" },
] as const;

export default function CoverageCheckPage() {
  const [enrollmentId, setEnrollmentId] = useState("");
  const [treatmentType, setTreatmentType] = useState("hospitalization");
  const [facility, setFacility] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");

  const enrollQ = useMutation({
    mutationFn: () =>
      api<{ enrollments: Array<{ id: string; policyNumber: string | null; status: string; planName?: string; providerName?: string }> }>(
        "/insurance-marketplace/enrollments/me",
        { method: "GET" },
      ),
    onSuccess: (d) => {
      const active = d.enrollments?.filter((e) => e.status === "active")?.[0];
      if (active) setEnrollmentId(active.id);
    },
  });

  const checkMut = useMutation({
    mutationFn: () =>
      api<CoverageResult>("/insurance-marketplace/coverage-check", {
        method: "POST",
        json: {
          enrollmentId,
          treatmentType,
          incurringFacility: facility || undefined,
          diagnosis: diagnosis || undefined,
          estimatedCostLkr: Number(estimatedCost) || undefined,
        },
      }),
  });

  const runCheck = () => {
    if (!enrollmentId) {
      enrollQ.mutate();
    } else {
      checkMut.mutate();
    }
  };

  const result = checkMut.data?.coverage;

  return (
    <div className="space-y-5 max-w-3xl">
      <Link
        href="/portal/me/insurance"
        className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back to insurance
      </Link>

      <header>
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-brand-soft text-brand-strong flex items-center justify-center">
            <Calculator size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Coverage check</h1>
            <p className="text-sm text-text-soft">
              Estimate what your policy covers before you commit.
            </p>
          </div>
        </div>
      </header>

      <Card className="space-y-4">
        <h2 className="font-bold text-text">Your details</h2>

        {enrollQ.data ? (
          <Field label="Choose policy">
            <div className="flex flex-wrap gap-2">
              {enrollQ.data.enrollments
                ?.filter((e) => e.status === "active")
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEnrollmentId(e.id)}
                    className={`text-sm px-3 py-2 rounded-md border ${
                      enrollmentId === e.id
                        ? "bg-brand-soft border-brand text-brand-strong font-semibold"
                        : "border-border text-text-soft"
                    }`}
                  >
                    {e.policyNumber ?? e.id.slice(0, 8)}
                    {e.planName ? (
                      <span className="ml-1.5 text-[11px] text-text-muted">
                        {e.planName}
                      </span>
                    ) : null}
                  </button>
                ))}
            </div>
          </Field>
        ) : null}

        <Field label="Treatment type">
          <div className="flex flex-wrap gap-2">
            {TREATMENTS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTreatmentType(t.value)}
                className={`text-xs px-3 py-1.5 rounded-md border ${
                  treatmentType === t.value
                    ? "bg-brand-soft border-brand text-brand-strong font-semibold"
                    : "border-border text-text-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Hospital / facility">
          <Input
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            placeholder="Asiri Surgical Hospital"
          />
        </Field>

        <Field label="Diagnosis / procedure">
          <Textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={2}
            placeholder="e.g. Appendectomy, Maternity delivery"
          />
        </Field>

        <Field label="Estimated cost (LKR)">
          <Input
            type="number"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            placeholder="250000"
          />
        </Field>

        <div className="flex justify-end">
          <Button
            onClick={runCheck}
            loading={enrollQ.isPending || checkMut.isPending}
            disabled={enrollQ.isPending ? false : !enrollmentId}
            size="lg"
          >
            <Sparkles size={14} />
            {enrollQ.isPending
              ? "Loading policies…"
              : enrollmentId
                ? "Check coverage"
                : "Find my policies"}
          </Button>
        </div>
      </Card>

      {enrollQ.isError ? (
        <Card className="border-red-200 bg-red-50/40">
          <p className="text-sm text-red-700">Could not load your policies.</p>
        </Card>
      ) : null}

      {enrollQ.data?.enrollments?.filter((e) => e.status === "active").length === 0 ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <p className="text-sm text-amber-800">
            No active policies found. Enrol in a plan to check coverage.
          </p>
          <div className="mt-3">
            <Link href="/portal/me/insurance/marketplace">
              <Button size="sm">Browse plans</Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {checkMut.isError ? (
        <Card className="border-red-200 bg-red-50/40">
          <p className="text-sm text-red-700">
            Coverage check failed. Retry or contact support.
          </p>
        </Card>
      ) : null}

      {result ? (
        <>
          <Card
            className={
              result.eligible
                ? "border-emerald-200 bg-emerald-50/40"
                : "border-amber-200 bg-amber-50/40"
            }
          >
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  result.eligible
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {result.eligible ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
              </div>
              <div className="flex-1">
                <div
                  className={`font-bold ${
                    result.eligible ? "text-emerald-900" : "text-amber-900"
                  }`}
                >
                  {result.eligible ? "Likely covered" : "Limited or no coverage"}
                </div>
                <div
                  className={`text-sm mt-0.5 ${
                    result.eligible ? "text-emerald-800" : "text-amber-800"
                  }`}
                >
                  {result.planName ? `${result.planName} · ` : ""}
                  {result.providerName ?? ""}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="text-[11px] uppercase tracking-wide text-text-muted">
                Estimated covered
              </div>
              <div className="text-2xl font-bold text-text mt-1">
                {formatLkr(result.coveredAmountLkr)}
              </div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-wide text-text-muted">
                Your responsibility
              </div>
              <div className="text-2xl font-bold text-text mt-1">
                {formatLkr(result.patientResponsibilityLkr)}
              </div>
            </Card>
          </div>

          {result.remainingAnnualLimitLkr != null ? (
            <Card>
              <div className="text-sm text-text-soft">
                Remaining annual limit
              </div>
              <div className="text-lg font-bold text-text mt-0.5">
                {formatLkr(result.remainingAnnualLimitLkr)}
              </div>
            </Card>
          ) : null}

          {result.waitingPeriods && result.waitingPeriods.length > 0 ? (
            <Card>
              <h3 className="font-bold text-text mb-2">Waiting periods</h3>
              <ul className="space-y-1.5 text-sm">
                {result.waitingPeriods.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-text-soft capitalize">
                      {w.condition.replace(/_/g, " ")}
                    </span>
                    <Pill tone={w.remainingDays > 0 ? "warn" : "success"}>
                      {w.remainingDays > 0
                        ? `${w.remainingDays} days remaining`
                        : "Cleared"}
                    </Pill>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {result.exclusions && result.exclusions.length > 0 ? (
            <Card className="border-rose-200 bg-rose-50/40">
              <h3 className="font-bold text-rose-900 mb-2">Exclusions</h3>
              <ul className="space-y-1 text-sm text-rose-800">
                {result.exclusions.map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          {result.notes && result.notes.length > 0 ? (
            <Card>
              <h3 className="font-bold text-text mb-2">Notes</h3>
              <ul className="space-y-1 text-sm text-text-soft">
                {result.notes.map((n, i) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
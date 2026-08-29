"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Building2,
  Wallet,
  Calendar,
  Users,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  CreditCard,
  X,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { formatDate, formatLkr } from "@/portal/lib/format";

interface EnrollmentDetail {
  enrollment: {
    id: string;
    policyNumber: string | null;
    status: string;
    billingCycle: string;
    premiumAmountLkr: number;
    coverageAmountLkr: number;
    startDate: string | null;
    endDate: string | null;
    nextPremiumDueAt: string | null;
    lastPremiumPaidAt: string | null;
    kycStatus: string;
    nomineeName: string | null;
    nomineeRelation: string | null;
    nomineeDob: string | null;
    dependents: Array<{ id: string; name: string; relation: string; dob: string | null }>;
    planName?: string;
    planType?: string;
    providerName?: string;
  };
}

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  active: "success",
  payment_pending: "warn",
  grace: "warn",
  lapsed: "danger",
  cancelled: "neutral",
  expired: "neutral",
};

export default function PolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["insurance", "enrollment", id],
    queryFn: () =>
      api<EnrollmentDetail>(`/insurance-marketplace/enrollments/${id}`),
  });

  const renewMut = useMutation({
    mutationFn: () =>
      api<{ checkoutUrl?: string }>(
        `/insurance-marketplace/enrollments/${id}/renew`,
        { method: "POST", json: {} },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance"] }),
  });

  const cancelMut = useMutation({
    mutationFn: () =>
      api(`/insurance-marketplace/enrollments/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance"] });
      window.location.href = "/portal/me/insurance";
    },
  });

  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  const e = q.data?.enrollment;
  if (!e) {
    return (
      <Card className="text-center py-12">
        <p className="text-sm text-text-soft">Policy not found.</p>
      </Card>
    );
  }

  const dueIn = e.nextPremiumDueAt
    ? Math.ceil(
        (new Date(e.nextPremiumDueAt).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const isOverdue = dueIn !== null && dueIn < 0;
  const isDueSoon = dueIn !== null && dueIn >= 0 && dueIn <= 7;

  return (
    <div className="space-y-5 max-w-4xl">
      <Link
        href="/portal/me/insurance"
        className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back to insurance
      </Link>

      {(isDueSoon || isOverdue) && e.status === "active" ? (
        <Card className="border-2 border-amber-300 bg-amber-50/60">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-amber-900">
                {isOverdue ? "Payment overdue" : "Premium due soon"}
              </div>
              <div className="text-sm text-amber-800 mt-0.5">
                {formatLkr(e.premiumAmountLkr)} due{" "}
                {e.nextPremiumDueAt
                  ? formatDate(e.nextPremiumDueAt)
                  : "soon"}
                {dueIn !== null
                  ? ` (${isOverdue ? `${-dueIn} days overdue` : `in ${dueIn} days`})`
                  : ""}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => renewMut.mutate()}
              loading={renewMut.isPending}
            >
              <CreditCard size={14} />
              Pay now
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-brand-soft text-brand-strong flex items-center justify-center shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text">
                {e.planName ?? "Policy"}
              </h1>
              <Pill tone={STATUS_TONE[e.status] ?? "neutral"}>
                {e.status.replace(/_/g, " ")}
              </Pill>
            </div>
            <p className="text-sm text-text-soft mt-0.5">
              {e.providerName} · Policy {e.policyNumber ?? e.id.slice(0, 8)}
            </p>
          </div>
          <Link href={`/portal/me/insurance/ecard/${e.id}`}>
            <Button variant="secondary" size="sm">
              <ExternalLink size={14} />
              View E-card
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/60">
          <Metric label="Coverage" value={formatLkr(e.coverageAmountLkr)} />
          <Metric label="Premium" value={formatLkr(e.premiumAmountLkr)} />
          <Metric label="Cycle" value={e.billingCycle} />
          <Metric label="Status" value={e.status.replace(/_/g, " ")} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-base font-bold text-text mb-3">Schedule</h2>
          <div className="space-y-2.5 text-sm">
            <Detail
              icon={<Calendar size={14} />}
              label="Start date"
              value={e.startDate ? formatDate(e.startDate) : "—"}
            />
            <Detail
              icon={<Calendar size={14} />}
              label="End date"
              value={e.endDate ? formatDate(e.endDate) : "—"}
            />
            <Detail
              icon={<Wallet size={14} />}
              label="Last premium paid"
              value={
                e.lastPremiumPaidAt ? formatDate(e.lastPremiumPaidAt) : "—"
              }
            />
            <Detail
              icon={<Wallet size={14} />}
              label="Next premium due"
              value={
                e.nextPremiumDueAt ? formatDate(e.nextPremiumDueAt) : "—"
              }
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-bold text-text mb-3">Nominee</h2>
          {e.nomineeName ? (
            <div className="text-sm space-y-1.5">
              <div>
                <span className="text-text-soft">Name: </span>
                <span className="text-text font-medium">
                  {e.nomineeName}
                </span>
              </div>
              <div>
                <span className="text-text-soft">Relation: </span>
                <span className="text-text">{e.nomineeRelation}</span>
              </div>
              {e.nomineeDob ? (
                <div>
                  <span className="text-text-soft">DOB: </span>
                  <span className="text-text">{formatDate(e.nomineeDob)}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No nominee on file.</p>
          )}
        </Card>
      </div>

      {e.dependents && e.dependents.length > 0 ? (
        <Card>
          <h2 className="text-base font-bold text-text mb-3">
            Covered members
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {e.dependents.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-md text-sm"
              >
                <Users size={14} className="text-text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text truncate">
                    {d.name}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {d.relation}
                    {d.dob ? ` · ${formatDate(d.dob)}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {renewMut.data?.checkoutUrl ? (
        <Card className="border-2 border-amber-300 bg-amber-50/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-amber-900">Renewal checkout ready</div>
              <div className="text-xs text-amber-800 mt-0.5">
                Open PayHere to complete renewal.
              </div>
            </div>
            <a href={renewMut.data.checkoutUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <ExternalLink size={14} />
                Open checkout
              </Button>
            </a>
          </div>
        </Card>
      ) : null}

      {e.status === "active" ? (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (confirm("Cancel this policy? This action cannot be undone.")) {
                cancelMut.mutate();
              }
            }}
            className="text-xs text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-1"
          >
            <X size={12} />
            Cancel policy
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-text-muted uppercase tracking-wide">
        {label}
      </div>
      <div className="text-base font-semibold text-text mt-0.5">{value}</div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-md bg-surface-2 flex items-center justify-center text-text-muted shrink-0">
        {icon}
      </div>
      <div className="text-text-soft">{label}:</div>
      <div className="text-text font-medium">{value}</div>
    </div>
  );
}
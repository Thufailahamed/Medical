"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { Receipt } from "lucide-react";

type Claim = {
  id: string;
  patientName: string;
  providerName: string;
  policyNumber: string;
  treatmentType: string;
  amountRequestedLkr: number;
  amountApprovedLkr?: number | null;
  status: string;
  submittedAt?: string | null;
};

const STATUS_TABS = [
  undefined,
  "submitted",
  "under_review",
  "more_info_needed",
  "approved",
  "rejected",
  "paid",
] as const;

const TONE: Record<string, "warn" | "info" | "success" | "danger" | "neutral"> = {
  submitted: "warn",
  under_review: "info",
  more_info_needed: "warn",
  approved: "success",
  rejected: "danger",
  paid: "success",
  draft: "neutral",
};

export default function AdminInsuranceMarketplaceClaimsPage() {
  const [status, setStatus] = useState<string | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: adminQk.insuranceMarketplaceClaims(status),
    queryFn: () =>
      adminApi<{ claims: Claim[]; total: number }>(
        `/admin/insurance-mkt-claims${status ? `?status=${status}` : ""}`,
      ),
  });

  const rows = data?.claims ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        icon={<Receipt size={20} className="text-blue-600" />}
        title="Marketplace claims"
        subtitle={`${data?.total ?? 0} total`}
      />
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((s) => (
          <button
            key={s ?? "all"}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${
              (s ?? "") === (status ?? "")
                ? "bg-primary text-white border-primary"
                : "bg-surface text-text-soft border-border"
            }`}
          >
            {s ? s.replace(/_/g, " ") : "All"}
          </button>
        ))}
      </div>
      {isLoading || !data ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-surface p-5 shadow-sm" role="status" aria-label="Loading">
          <div className="h-4 w-1/4 admin-shimmer rounded-md" />
          <div className="h-4 w-full admin-shimmer rounded-md" />
          <div className="h-4 w-5/6 admin-shimmer rounded-md" />
          <div className="h-4 w-2/3 admin-shimmer rounded-md" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-surface p-10 text-center text-sm font-medium text-text-soft shadow-2xs">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-muted ring-1 ring-inset ring-border">
            <Receipt size={18} aria-hidden />
          </div>
          No claims.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Policyholder</TH>
              <TH>Provider</TH>
              <TH>Policy</TH>
              <TH>Treatment</TH>
              <TH className="text-right">Requested</TH>
              <TH className="text-right">Approved</TH>
              <TH>Status</TH>
              <TH>Submitted</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((c) => (
              <TR key={c.id} className="hover:bg-surface-2">
                <TD className="font-semibold">
                  <Link
                    href={`/admin/insurance-mkt/claims/${c.id}`}
                    className="hover:underline"
                  >
                    {c.patientName}
                  </Link>
                </TD>
                <TD className="text-xs">{c.providerName}</TD>
                <TD className="text-xs font-mono">{c.policyNumber}</TD>
                <TD className="text-xs capitalize">
                  {c.treatmentType.replace(/_/g, " ")}
                </TD>
                <TD className="text-xs text-right">
                  {c.amountRequestedLkr.toLocaleString()}
                </TD>
                <TD className="text-xs text-right">
                  {typeof c.amountApprovedLkr === "number"
                    ? c.amountApprovedLkr.toLocaleString()
                    : "—"}
                </TD>
                <TD>
                  <Pill tone={TONE[c.status] ?? "neutral"}>
                    {c.status.replace(/_/g, " ")}
                  </Pill>
                </TD>
                <TD className="text-xs">
                  {c.submittedAt
                    ? new Date(c.submittedAt).toLocaleDateString()
                    : "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
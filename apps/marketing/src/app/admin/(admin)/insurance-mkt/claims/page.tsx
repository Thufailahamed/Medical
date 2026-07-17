"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

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
        `/admin/insurance-claims${status ? `?status=${status}` : ""}`,
      ),
  });

  const rows = data?.claims ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
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
        <p className="text-text-soft text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
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
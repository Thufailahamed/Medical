"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

type Enrollment = {
  id: string;
  userId: string;
  userName: string;
  planName: string;
  providerName: string;
  policyNumber: string;
  status: string;
  billingCycle: string;
  premiumAmountLkr: number;
  coverageAmountLkr: number;
  startDate: string;
  nextPremiumDueAt?: string | null;
};

const STATUS_TABS = [
  undefined,
  "payment_pending",
  "active",
  "grace",
  "lapsed",
  "cancelled",
] as const;

export default function AdminInsuranceEnrollmentsPage() {
  const [status, setStatus] = useState<string | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: adminQk.insuranceEnrollments(status),
    queryFn: () =>
      adminApi<{ enrollments: Enrollment[]; total: number }>(
        `/admin/insurance-enrollments${status ? `?status=${status}` : ""}`,
      ),
  });

  const rows = data?.enrollments ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        title="Insurance enrollments"
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
            {s ?? "All"}
          </button>
        ))}
      </div>
      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
          No enrollments.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Policyholder</TH>
              <TH>Provider</TH>
              <TH>Plan</TH>
              <TH>Policy #</TH>
              <TH>Status</TH>
              <TH className="text-right">Premium</TH>
              <TH className="text-right">Coverage</TH>
              <TH>Started</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((e) => (
              <TR key={e.id} className="hover:bg-surface-2">
                <TD className="font-semibold">{e.userName}</TD>
                <TD className="text-xs">{e.providerName}</TD>
                <TD className="text-xs">{e.planName}</TD>
                <TD className="text-xs font-mono">{e.policyNumber}</TD>
                <TD>
                  <Pill tone={e.status === "active" ? "success" : "warn"}>
                    {e.status.replace(/_/g, " ")}
                  </Pill>
                </TD>
                <TD className="text-xs text-right">
                  {e.premiumAmountLkr.toLocaleString()} / {e.billingCycle}
                </TD>
                <TD className="text-xs text-right">
                  {e.coverageAmountLkr.toLocaleString()}
                </TD>
                <TD className="text-xs">
                  {new Date(e.startDate).toLocaleDateString()}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
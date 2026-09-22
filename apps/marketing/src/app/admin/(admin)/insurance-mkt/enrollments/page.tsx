"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { ClipboardList } from "lucide-react";

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
        icon={<ClipboardList size={20} className="text-blue-600" />}
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
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-surface p-5 shadow-sm" role="status" aria-label="Loading">
          <div className="h-4 w-1/4 admin-shimmer rounded-md" />
          <div className="h-4 w-full admin-shimmer rounded-md" />
          <div className="h-4 w-5/6 admin-shimmer rounded-md" />
          <div className="h-4 w-2/3 admin-shimmer rounded-md" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-surface p-10 text-center text-sm font-medium text-text-soft shadow-2xs">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-muted ring-1 ring-inset ring-border">
            <ClipboardList size={18} aria-hidden />
          </div>
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
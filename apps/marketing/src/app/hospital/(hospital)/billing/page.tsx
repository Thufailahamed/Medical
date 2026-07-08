"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { formatLkr, formatDate } from "@/hospital/lib/format";

const STATUS_TONES: Record<string, any> = {
  draft: "muted",
  issued: "info",
  partially_paid: "warning",
  paid: "success",
  cancelled: "muted",
};

export default function BillingPage() {
  const locale = useAuthStore((s) => s.locale);
  const [status, setStatus] = useState("");

  const list = useQuery({
    queryKey: ["invoices", status],
    queryFn: () =>
      api<{ invoices: any[] }>(
        `/hospital-portal/billing/invoices${status ? `?status=${status}` : ""}`
      ),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.billing")}
        subtitle={tr(locale, "billing.subtitle")}
        actions={
          <div className="flex gap-2">
            <Link
              href="/hospital/billing/outstanding"
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            >
              {tr(locale, "nav.billingOutstanding")}
            </Link>
            <Link
              href="/hospital/billing/new"
              className="rounded-lg bg-[var(--accent-600)] px-4 py-2 text-sm font-medium text-white"
            >
              + {tr(locale, "billing.newInvoice")}
            </Link>
          </div>
        }
      />

      <div className="flex gap-2">
        {["", "draft", "issued", "partially_paid", "paid", "cancelled"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              status === s
                ? "bg-[var(--accent-600)] text-white"
                : "bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            {s || tr(locale, "common.all")}
          </button>
        ))}
      </div>

      <Card>
        {list.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
        ) : !list.data?.invoices?.length ? (
          <Empty title={tr(locale, "billing.empty")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{tr(locale, "billing.number")}</TH>
                <TH>{tr(locale, "common.name")}</TH>
                <TH>{tr(locale, "billing.total")}</TH>
                <TH>{tr(locale, "common.status")}</TH>
                <TH>{tr(locale, "common.date")}</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {list.data.invoices.map((i: any) => (
                <TR key={i.id}>
                  <TD className="font-mono text-xs">{i.invoiceNumber}</TD>
                  <TD>{i.patientName}</TD>
                  <TD>{formatLkr(i.totalLkr, locale)}</TD>
                  <TD>
                    <Pill tone={STATUS_TONES[i.status] ?? "muted"}>{i.status}</Pill>
                  </TD>
                  <TD>{formatDate(i.createdAt, locale)}</TD>
                  <TD>
                    <Link
                      href={`/hospital/billing/${i.id}`}
                      className="text-sm text-[var(--accent-600)] hover:underline"
                    >
                      {tr(locale, "common.view")}
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
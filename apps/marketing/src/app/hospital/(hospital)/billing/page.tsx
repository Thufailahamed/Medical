"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, Plus, Receipt } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatLkr, formatDate } from "@/hospital/lib/format";
import { cn } from "@/portal/lib/utils";

const STATUS_TONES: Record<string, any> = {
  draft: "neutral",
  issued: "info",
  partially_paid: "warn",
  paid: "success",
  cancelled: "neutral",
};

export default function BillingPage() {
  const locale = useAuthStore((s) => s.locale);
  const t = useT();
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
        title={t("nav.billing")}
        subtitle={t("billing.subtitle")}
        actions={
          <div className="flex gap-2">
            <Link
              href="/hospital/billing/outstanding"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2 transition-colors"
            >
              <Receipt size={14} />
              {t("nav.billingOutstanding")}
            </Link>
            <Link
              href="/hospital/billing/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong shadow-sm transition-colors"
            >
              <Plus size={14} />
              {t("billing.newInvoice")}
            </Link>
          </div>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {["", "draft", "issued", "partially_paid", "paid", "cancelled"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              status === s
                ? "bg-brand text-white shadow-sm"
                : "bg-surface text-text-muted border border-border hover:bg-surface-2"
            )}
          >
            {s || t("common.all")}
          </button>
        ))}
      </div>

      <Card padding={false}>
        {list.isLoading ? (
          <p className="p-5 text-sm text-text-muted">{t("common.loading")}</p>
        ) : !list.data?.invoices?.length ? (
          <div className="p-5">
            <Empty title={t("billing.empty")} icon={<FileText size={28} className="text-text-muted opacity-40" />} />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("billing.number")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("billing.total")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("common.date")}</TH>
                <TH> </TH>
              </TR>
            </THead>
            <TBody>
              {list.data.invoices.map((i: any) => (
                <TR key={i.id}>
                  <TD className="font-mono text-xs">{i.invoiceNumber}</TD>
                  <TD>{i.patientName}</TD>
                  <TD className="font-semibold">{formatLkr(i.totalLkr, locale)}</TD>
                  <TD>
                    <Pill tone={STATUS_TONES[i.status] ?? "neutral"}>{i.status}</Pill>
                  </TD>
                  <TD className="text-text-muted">{formatDate(i.createdAt, locale)}</TD>
                  <TD>
                    <Link
                      href={`/hospital/billing/${i.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-strong"
                    >
                      {t("common.view")} <ArrowRight size={12} />
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
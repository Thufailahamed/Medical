"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { formatLkr } from "@/hospital/lib/format";

export default function OutstandingPage() {
  const locale = useAuthStore((s) => s.locale);
  const q = useQuery({
    queryKey: ["outstanding"],
    queryFn: () => api<{ rows: any[] }>("/hospital-portal/billing/outstanding"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.billingOutstanding")}
        subtitle={tr(locale, "billing.outstandingSubtitle")}
      />
      <Card>
        {q.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
        ) : !q.data?.rows?.length ? (
          <Empty title={tr(locale, "billing.noOutstanding")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{tr(locale, "common.name")}</TH>
                <TH>{tr(locale, "billing.outstandingAmount")}</TH>
                <TH>{tr(locale, "billing.invoiceCount")}</TH>
              </TR>
            </THead>
            <TBody>
              {q.data.rows.map((r: any, i: number) => (
                <TR key={i}>
                  <TD>{r.patientName}</TD>
                  <TD>{formatLkr(r.outstanding, locale)}</TD>
                  <TD>{r.invoiceCount}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
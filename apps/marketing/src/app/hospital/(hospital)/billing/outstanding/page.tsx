"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDollarSign, FileText } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatLkr } from "@/hospital/lib/format";

export default function OutstandingPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const q = useQuery({
    queryKey: ["outstanding"],
    queryFn: () => api<{ rows: any[] }>("/hospital-portal/billing/outstanding"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.billingOutstanding")}
        subtitle={t("billing.outstandingSubtitle")}
      />
      <Card padding={false}>
        {q.isLoading ? (
          <p className="p-5 text-sm text-text-muted">{t("common.loading")}</p>
        ) : !q.data?.rows?.length ? (
          <div className="p-5">
            <Empty
              title={t("billing.noOutstanding")}
              icon={<CheckCircle2 size={28} className="text-emerald-500 opacity-70" />}
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.name")}</TH>
                <TH>{t("billing.outstandingAmount")}</TH>
                <TH>{t("billing.invoiceCount")}</TH>
              </TR>
            </THead>
            <TBody>
              {q.data.rows.map((r: any, i: number) => (
                <TR key={i}>
                  <TD className="font-semibold">{r.patientName}</TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 font-bold text-red-700">
                      <CircleDollarSign size={13} />
                      {formatLkr(r.outstanding, locale)}
                    </span>
                  </TD>
                  <TD className="text-text-muted">{r.invoiceCount}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
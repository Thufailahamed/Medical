"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatLkr, formatDate, formatTime } from "@/hospital/lib/format";

export default function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const locale = useAuthStore((s) => s.locale);
  const t = useT();

  const q = useQuery({
    queryKey: ["receipt", id],
    queryFn: () =>
      api<{ invoice: any; lines: any[]; payments: any[]; patient: any; totalPaid: number }>(
        `/hospital-portal/billing/invoices/${id}/receipt`
      ),
  });

  if (q.isLoading) {
    return <p className="text-sm text-text-muted">{t("common.loading")}</p>;
  }
  if (!q.data) {
    return <p>—</p>;
  }

  const { invoice, lines, payments, patient, totalPaid } = q.data;
  const balance = (invoice?.totalLkr ?? 0) - (totalPaid ?? 0);

  function printReceipt() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print flex justify-end gap-2">
        <Button variant="ghost" onClick={() => history.back()}>
          {t("common.back")}
        </Button>
        <Button onClick={printReceipt}>
          {t("common.print")}
        </Button>
      </div>

      <Card className="hospital-print">
        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-bold">{t("billing.receiptTitle")}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {invoice.invoiceNumber} · {formatDate(invoice.createdAt, locale)}
          </p>
        </div>

        <div className="my-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold">{t("billing.billTo")}</p>
            <p>{patient?.name ?? "—"}</p>
            <p className="text-text-muted">{patient?.phone ?? ""}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{t("common.status")}</p>
            <Pill tone={invoice.status === "paid" ? "success" : "warn"}>
              {invoice.status}
            </Pill>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2">{t("billing.description")}</th>
              <th className="py-2 text-right">{t("billing.qty")}</th>
              <th className="py-2 text-right">{t("billing.unitPrice")}</th>
              <th className="py-2 text-right">{t("billing.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((li: any) => (
              <tr key={li.id} className="border-b border-border">
                <td className="py-2">{li.description}</td>
                <td className="py-2 text-right">{li.quantity}</td>
                <td className="py-2 text-right">{formatLkr(li.unitPriceLkr, locale)}</td>
                <td className="py-2 text-right">{formatLkr(li.amountLkr, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{t("billing.subtotal")}</span>
              <span>{formatLkr(invoice.subtotalLkr, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("billing.tax")}</span>
              <span>{formatLkr(invoice.taxLkr, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("billing.discount")}</span>
              <span>-{formatLkr(invoice.discountLkr, locale)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold">
              <span>{t("billing.total")}</span>
              <span>{formatLkr(invoice.totalLkr, locale)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>{t("billing.paid")}</span>
              <span>{formatLkr(totalPaid, locale)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{t("billing.balance")}</span>
              <span>{formatLkr(balance, locale)}</span>
            </div>
          </div>
        </div>

        {payments.length > 0 && (
          <div className="mt-6 border-t border-border pt-3">
            <h3 className="mb-2 text-sm font-semibold">{t("billing.payments")}</h3>
            <ul className="space-y-1 text-xs">
              {payments.map((p: any) => (
                <li key={p.id} className="flex justify-between">
                  <span>
                    {formatDate(p.paidAt, locale)} · {formatTime(p.paidAt, locale)} · {p.method}
                  </span>
                  <span>{formatLkr(p.amountLkr, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-text-muted">
          {t("billing.thankYou")}
        </p>
      </Card>
    </div>
  );
}
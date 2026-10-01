"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Receipt } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { PanelSkeleton } from "@/patient/components/workspace";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatLkr, formatDate, formatTime } from "@/hospital/lib/format";
import { cn } from "@/portal/lib/utils";

interface Invoice {
  invoiceNumber: string;
  status: string;
  totalLkr: number;
  subtotalLkr?: number;
  taxLkr?: number;
  discountLkr?: number;
  createdAt: string;
}
interface ReceiptLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceLkr: number;
  amountLkr: number;
}
interface ReceiptPayment {
  id: string;
  paidAt: string;
  amountLkr: number;
  method: string;
}
interface ReceiptPatient {
  name?: string;
  phone?: string;
}

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
      api<{ invoice: Invoice; lines: ReceiptLine[]; payments: ReceiptPayment[]; patient: ReceiptPatient; totalPaid: number }>(
        `/hospital-portal/billing/invoices/${id}/receipt`
      ),
  });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <PanelSkeleton rows={5} />
      </div>
    );
  }
  if (!q.data) {
    return <p className="text-sm text-slate-500">—</p>;
  }

  const { invoice, lines, payments, patient, totalPaid } = q.data;
  const balance = (invoice?.totalLkr ?? 0) - (totalPaid ?? 0);

  function printReceipt() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print flex items-center justify-between">
        <button
          onClick={() => history.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--ink-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft size={15} />
          {t("common.back")}
        </button>
        <button
          onClick={printReceipt}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <Printer size={15} />
          {t("billing.print")}
        </button>
      </div>

      <div className="hospital-print overflow-hidden rounded-2xl border border-[color:var(--ink-border)] bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)]">
        <div className="relative overflow-hidden bg-[#0c1b2e] px-6 py-6 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_85%_10%,rgba(16,185,129,0.28),transparent_60%)]"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                  <Receipt size={16} />
                </span>
                <h1 className="text-xl font-bold tracking-tight">{t("billing.receiptTitle")}</h1>
              </div>
              <p className="mt-2 font-mono text-xs text-white/60">
                {invoice.invoiceNumber} · {formatDate(invoice.createdAt, locale)}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
                invoice.status === "paid"
                  ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
                  : "border-amber-300/40 bg-amber-400/15 text-amber-200"
              )}
            >
              {invoice.status.replace("_", " ")}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("billing.billTo")}</p>
              <p className="mt-1 font-semibold text-slate-900">{patient?.name ?? "—"}</p>
              <p className="text-xs text-slate-500">{patient?.phone ?? ""}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("billing.total")}</p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">{formatLkr(invoice.totalLkr, locale)}</p>
            </div>
          </div>

          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--ink-border)] text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="py-2">{t("billing.description")}</th>
                <th className="py-2 text-right">{t("billing.qty")}</th>
                <th className="py-2 text-right">{t("billing.unitPrice")}</th>
                <th className="py-2 text-right">{t("billing.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((li) => (
                <tr key={li.id} className="border-b border-[color:var(--ink-border)] last:border-0">
                  <td className="py-2.5 font-medium text-slate-800">{li.description}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600">{li.quantity}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600">{formatLkr(li.unitPriceLkr, locale)}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-slate-900">{formatLkr(li.amountLkr, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>{t("billing.subtotal")}</span>
                <span className="tabular-nums">{formatLkr(invoice.subtotalLkr ?? 0, locale)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t("billing.tax")}</span>
                <span className="tabular-nums">{formatLkr(invoice.taxLkr ?? 0, locale)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t("billing.discount")}</span>
                <span className="tabular-nums">-{formatLkr(invoice.discountLkr ?? 0, locale)}</span>
              </div>
              <div className="flex justify-between border-t border-[color:var(--ink-border)] pt-1.5 font-bold text-slate-900">
                <span>{t("billing.total")}</span>
                <span className="tabular-nums">{formatLkr(invoice.totalLkr, locale)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>{t("billing.paid")}</span>
                <span className="tabular-nums">{formatLkr(totalPaid, locale)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>{t("billing.balance")}</span>
                <span className={cn("tabular-nums", balance > 0 ? "text-amber-700" : "text-emerald-700")}>{formatLkr(balance, locale)}</span>
              </div>
            </div>
          </div>

          {payments.length > 0 && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("billing.payments")}</h3>
              <ul className="space-y-1.5 text-xs">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="text-slate-600">
                      {formatDate(p.paidAt, locale)} · {formatTime(p.paidAt, locale)} · {p.method}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">{formatLkr(p.amountLkr, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-slate-400">
            {t("billing.thankYou")}
          </p>
        </div>
      </div>
    </div>
  );
}

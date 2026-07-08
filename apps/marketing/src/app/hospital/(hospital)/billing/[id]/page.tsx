"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import Link from "next/link";
import { ArrowRight, CircleDollarSign, Eye, FileText, Receipt, Send } from "lucide-react";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatLkr, formatDate } from "@/hospital/lib/format";

const STATUS_TONES: Record<string, any> = {
  draft: "neutral",
  issued: "info",
  partially_paid: "warn",
  paid: "success",
  cancelled: "neutral",
};

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useT();
  const { id } = use(params);
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amountLkr: 0, method: "cash", reference: "" });

  const inv = useQuery({
    queryKey: ["invoice", id],
    queryFn: () =>
      api<{ invoice: any; lineItems: any[]; payments: any[]; patient: any }>(
        `/hospital-portal/billing/invoices/${id}`
      ),
  });

  const issue = useMutation({
    mutationFn: () => api(`/hospital-portal/billing/invoices/${id}/issue`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Invoice issued");
    },
  });

  const pay = useMutation({
    mutationFn: (body: any) =>
      api(`/hospital-portal/billing/invoices/${id}/payments`, {
        method: "POST",
        json: body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      setPayOpen(false);
      toast.success("Payment recorded");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const data = inv.data;
  const totalPaid = data?.payments?.reduce((a: number, p: any) => a + p.amountLkr, 0) ?? 0;
  const balance = (data?.invoice?.totalLkr ?? 0) - totalPaid;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data?.invoice?.invoiceNumber ?? t("billing.invoice")}`}
        subtitle={data?.patient?.name ?? ""}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/hospital/billing/${id}/receipt`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2 transition-colors"
            >
              <Eye size={14} />
              {t("billing.viewReceipt")}
            </Link>
            {data?.invoice?.status === "draft" ? (
              <Button onClick={() => issue.mutate()}>
                <Send size={14} className="mr-1.5" />
                {t("billing.issue")}
              </Button>
            ) : data?.invoice?.status !== "paid" && data?.invoice?.status !== "cancelled" ? (
              <Button onClick={() => setPayOpen(true)} disabled={balance <= 0}>
                <CircleDollarSign size={14} className="mr-1.5" />
                {t("billing.recordPayment")}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader title={t("common.status")} icon={<FileText size={15} className="text-brand" />} />
          <div className="mt-3">
            <Pill tone={STATUS_TONES[data?.invoice?.status] ?? "neutral"} className="text-xs">
              {data?.invoice?.status}
            </Pill>
          </div>
        </Card>
        <Card>
          <CardHeader title={t("billing.total")} icon={<Receipt size={15} className="text-brand" />} />
          <p className="mt-3 text-2xl font-extrabold tracking-tight text-text">
            {formatLkr(data?.invoice?.totalLkr ?? 0, locale)}
          </p>
        </Card>
        <Card>
          <CardHeader title={t("billing.balance")} icon={<CircleDollarSign size={15} className="text-brand" />} />
          <p className="mt-3 text-2xl font-extrabold tracking-tight text-text">
            {formatLkr(balance, locale)}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {formatLkr(totalPaid, locale)} {t("billing.paid")}
          </p>
        </Card>
      </div>

      <Card padding={false}>
        <div className="p-4 md:p-5">
          <CardHeader title={t("billing.lineItems")} icon={<FileText size={15} className="text-brand" />} />
        </div>
        <Table>
          <THead>
            <TR>
              <TH>{t("billing.description")}</TH>
              <TH>{t("billing.qty")}</TH>
              <TH>{t("billing.unitPrice")}</TH>
              <TH>{t("billing.amount")}</TH>
            </TR>
          </THead>
          <TBody>
            {data?.lineItems?.map((li: any) => (
              <TR key={li.id}>
                <TD>{li.description}</TD>
                <TD>{li.quantity}</TD>
                <TD>{formatLkr(li.unitPriceLkr, locale)}</TD>
                <TD className="font-semibold">{formatLkr(li.amountLkr, locale)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card padding={false}>
        <div className="p-4 md:p-5">
          <CardHeader title={t("billing.payments")} icon={<CircleDollarSign size={15} className="text-brand" />} />
        </div>
        {!data?.payments?.length ? (
          <p className="px-5 pb-5 text-sm text-text-muted">—</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.date")}</TH>
                <TH>{t("billing.amount")}</TH>
                <TH>{t("billing.method")}</TH>
                <TH>{t("billing.reference")}</TH>
              </TR>
            </THead>
            <TBody>
              {data.payments.map((p: any) => (
                <TR key={p.id}>
                  <TD className="text-text-muted">{formatDate(p.paidAt, locale)}</TD>
                  <TD className="font-semibold">{formatLkr(p.amountLkr, locale)}</TD>
                  <TD>
                    <Pill tone="neutral">{p.method}</Pill>
                  </TD>
                  <TD className="text-text-muted">{p.reference ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={t("billing.recordPayment")}
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            pay.mutate(payForm);
          }}
        >
          <FormField label={t("billing.amount")} required>
            <input
              required
              type="number"
              min={0}
              max={balance}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={payForm.amountLkr}
              onChange={(e) =>
                setPayForm({ ...payForm, amountLkr: Number(e.target.value) })
              }
            />
          </FormField>
          <FormField label={t("billing.method")}>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={payForm.method}
              onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank">Bank</option>
              <option value="mobile">Mobile</option>
            </select>
          </FormField>
          <FormField label={t("billing.reference")}>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={payForm.reference}
              onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPayOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.submit")}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
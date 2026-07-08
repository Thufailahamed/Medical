"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/portal/components/ui/Form";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatLkr, formatDate } from "@/hospital/lib/format";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
        title={`${data?.invoice?.invoiceNumber ?? tr(locale, "billing.invoice")}`}
        subtitle={data?.patient?.name ?? ""}
        actions={
          data?.invoice?.status === "draft" ? (
            <Button onClick={() => issue.mutate()}>
              {tr(locale, "billing.issue")}
            </Button>
          ) : data?.invoice?.status !== "paid" && data?.invoice?.status !== "cancelled" ? (
            <Button onClick={() => setPayOpen(true)} disabled={balance <= 0}>
              {tr(locale, "billing.recordPayment")}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            {tr(locale, "common.status")}
          </h3>
          <p className="mt-2 text-2xl font-semibold">{data?.invoice?.status}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            {tr(locale, "billing.total")}
          </h3>
          <p className="mt-2 text-2xl font-semibold">
            {formatLkr(data?.invoice?.totalLkr ?? 0, locale)}
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            {tr(locale, "billing.balance")}
          </h3>
          <p className="mt-2 text-2xl font-semibold">
            {formatLkr(balance, locale)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {formatLkr(totalPaid, locale)} {tr(locale, "billing.paid")}
          </p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-lg font-semibold">{tr(locale, "billing.lineItems")}</h3>
        <Table>
          <THead>
            <TR>
              <TH>{tr(locale, "billing.description")}</TH>
              <TH>{tr(locale, "billing.qty")}</TH>
              <TH>{tr(locale, "billing.unitPrice")}</TH>
              <TH>{tr(locale, "billing.amount")}</TH>
            </TR>
          </THead>
          <TBody>
            {data?.lineItems?.map((li: any) => (
              <TR key={li.id}>
                <TD>{li.description}</TD>
                <TD>{li.quantity}</TD>
                <TD>{formatLkr(li.unitPriceLkr, locale)}</TD>
                <TD>{formatLkr(li.amountLkr, locale)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg font-semibold">{tr(locale, "billing.payments")}</h3>
        {!data?.payments?.length ? (
          <p className="text-sm text-[var(--text-muted)]">—</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{tr(locale, "common.date")}</TH>
                <TH>{tr(locale, "billing.amount")}</TH>
                <TH>{tr(locale, "billing.method")}</TH>
                <TH>{tr(locale, "billing.reference")}</TH>
              </TR>
            </THead>
            <TBody>
              {data.payments.map((p: any) => (
                <TR key={p.id}>
                  <TD>{formatDate(p.paidAt, locale)}</TD>
                  <TD>{formatLkr(p.amountLkr, locale)}</TD>
                  <TD>
                    <Pill tone="muted">{p.method}</Pill>
                  </TD>
                  <TD>{p.reference ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={tr(locale, "billing.recordPayment")}
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            pay.mutate(payForm);
          }}
        >
          <FormField label={tr(locale, "billing.amount")} required>
            <input
              required
              type="number"
              min={0}
              max={balance}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={payForm.amountLkr}
              onChange={(e) =>
                setPayForm({ ...payForm, amountLkr: Number(e.target.value) })
              }
            />
          </FormField>
          <FormField label={tr(locale, "billing.method")}>
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={payForm.method}
              onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank">Bank</option>
              <option value="mobile">Mobile</option>
            </select>
          </FormField>
          <FormField label={tr(locale, "billing.reference")}>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={payForm.reference}
              onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPayOpen(false)}>
              {tr(locale, "common.cancel")}
            </Button>
            <Button type="submit">{tr(locale, "common.submit")}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
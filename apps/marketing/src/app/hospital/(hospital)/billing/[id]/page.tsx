"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CircleDollarSign,
  CreditCard,
  Eye,
  FileText,
  Plus,
  Receipt,
  Send,
  User,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatLkr, formatDate } from "@/hospital/lib/format";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_INPUT,
  HeroPulse,
  InfoField,
  PanelSkeleton,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalLkr: number;
  visitType?: string;
  createdAt: string;
}
interface LineItemRow {
  id: string;
  description: string;
  quantity: number;
  unitPriceLkr: number;
  amountLkr: number;
}
interface PaymentRow {
  id: string;
  paidAt: string;
  amountLkr: number;
  method: string;
  reference?: string | null;
}
interface PatientBrief {
  id?: string;
  name?: string;
  phone?: string;
}

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
      api<{ invoice: Invoice; lineItems: LineItemRow[]; payments: PaymentRow[]; patient: PatientBrief }>(
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
    mutationFn: (body: Record<string, unknown>) =>
      api(`/hospital-portal/billing/invoices/${id}/payments`, {
        method: "POST",
        json: body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      setPayOpen(false);
      toast.success("Payment recorded");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const payOnline = useMutation({
    mutationFn: () =>
      api<{ redirectUrl: string; merchantOrderId: string }>(`/payments/checkout`, {
        method: "POST",
        json: {
          invoiceId: id,
          returnUrl: `${window.location.origin}/hospital/billing/${id}/receipt`,
        },
      }),
    onSuccess: (res) => {
      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast.error("No redirect URL returned");
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to start checkout"),
  });

  const data = inv.data;
  const totalPaid = data?.payments?.reduce((a, p) => a + p.amountLkr, 0) ?? 0;
  const balance = (data?.invoice?.totalLkr ?? 0) - totalPaid;

  if (inv.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
        <PanelSkeleton rows={5} />
      </div>
    );
  }

  const hero = (
    <DoctorHero
      kickerIcon={<Receipt size={13} aria-hidden />}
      kicker={t("nav.billing")}
      kickerMeta={data?.invoice?.status?.replace("_", " ") ?? ""}
      title={
        <>
          <span className="font-mono">{data?.invoice?.invoiceNumber ?? t("billing.invoice")}</span>{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · {data?.patient?.name ?? ""}
          </span>
        </>
      }
      description={data?.patient?.name ?? t("billing.invoice")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <FileText size={12} className="text-emerald-300" />
            {data?.invoice?.status?.replace("_", " ")}
          </span>
          <span className={HERO_CHIP}>
            <CircleDollarSign size={12} className="text-amber-300" />
            {formatLkr(balance, locale)} {t("billing.balance").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<CircleDollarSign size={18} />}
          label={t("billing.balance")}
          value={formatLkr(balance, locale)}
          sub={`${formatLkr(totalPaid, locale)} ${t("billing.paid").toLowerCase()}`}
        />
      }
      actions={
        <>
          <Link href="/hospital/billing" className={HERO_GHOST}>
            <ArrowLeft size={14} />
            {t("common.back")}
          </Link>
          <Link href={`/hospital/billing/${id}/receipt`} className={HERO_GHOST}>
            <Eye size={14} />
            {t("billing.viewReceipt")}
          </Link>
          {data?.invoice?.status === "draft" ? (
            <button onClick={() => issue.mutate()} disabled={issue.isPending} className={HERO_PRIMARY}>
              <Send size={14} className="text-emerald-600" />
              {t("billing.issue")}
            </button>
          ) : data?.invoice?.status !== "paid" && data?.invoice?.status !== "cancelled" ? (
            <>
              <button
                onClick={() => payOnline.mutate()}
                disabled={balance <= 0 || payOnline.isPending}
                className={HERO_GHOST}
              >
                <CreditCard size={14} />
                {payOnline.isPending ? "…" : t("billing.payOnline")}
              </button>
              <button onClick={() => setPayOpen(true)} disabled={balance <= 0} className={HERO_PRIMARY}>
                <CircleDollarSign size={14} className="text-emerald-600" />
                {t("billing.recordPayment")}
              </button>
            </>
          ) : null}
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<FileText size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("common.status")}
          value={data?.invoice?.status?.replace("_", " ") ?? "—"}
          sub={t("billing.invoice")}
        />
        <StatTile
          icon={<Receipt size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("billing.total")}
          value={formatLkr(data?.invoice?.totalLkr ?? 0, locale)}
          sub={`${data?.lineItems?.length ?? 0} ${t("billing.lineItems").toLowerCase()}`}
        />
        <StatTile
          icon={<CircleDollarSign size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("billing.paid")}
          value={formatLkr(totalPaid, locale)}
          sub={`${data?.payments?.length ?? 0} ${t("billing.payments").toLowerCase()}`}
        />
        <StatTile
          icon={<CircleDollarSign size={16} />}
          tone={balance > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}
          label={t("billing.balance")}
          value={formatLkr(balance, locale)}
          sub={balance > 0 ? "Awaiting payment" : t("billing.paid")}
          pulse={balance > 0}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<FileText size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={t("billing.lineItems")}
              caption={String(data?.lineItems?.length ?? 0)}
            />
            {!data?.lineItems?.length ? (
              <EmptyBlock icon={<FileText size={19} />} title={t("billing.lineItems")} body="—" />
            ) : (
              <>
                <ul className="mt-4 flex flex-col gap-2">
                  {data.lineItems.map((li) => (
                    <li key={li.id}>
                      <RailRow
                        tone="emerald"
                        icon={<Receipt size={16} />}
                        title={li.description}
                        meta={`${li.quantity} × ${formatLkr(li.unitPriceLkr, locale)}`}
                        trailing={
                          <span className="text-sm font-bold tabular-nums text-slate-900">
                            {formatLkr(li.amountLkr, locale)}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-600">{t("billing.total")}</span>
                  <span className="text-lg font-extrabold tabular-nums text-slate-900">
                    {formatLkr(data.invoice?.totalLkr ?? 0, locale)}
                  </span>
                </div>
              </>
            )}
          </section>

          <section className={PANEL}>
            <PanelHeader
              icon={<CircleDollarSign size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={t("billing.payments")}
              caption={String(data?.payments?.length ?? 0)}
            />
            {!data?.payments?.length ? (
              <EmptyBlock icon={<CircleDollarSign size={19} />} title={t("billing.payments")} body="—" />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {data.payments.map((p) => (
                  <li key={p.id}>
                    <RailRow
                      tone="emerald"
                      icon={<CircleDollarSign size={16} />}
                      title={formatLkr(p.amountLkr, locale)}
                      meta={`${formatDate(p.paidAt, locale)} · ${p.method}${p.reference ? ` · ${p.reference}` : ""}`}
                      trailing={
                        <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", TONE_BADGE.emerald)}>
                          {p.method}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<User size={16} />}
              tone="bg-sky-50 text-sky-600"
              title={t("billing.billTo")}
            />
            <div className="mt-4 flex flex-col gap-2.5">
              <InfoField icon={<User size={14} />} label={t("common.name")}>
                {data?.patient?.name ?? "—"}
              </InfoField>
              <InfoField icon={<FileText size={14} />} label={t("patients.overview.phone")}>
                {data?.patient?.phone ?? "—"}
              </InfoField>
              {data?.patient?.id ? (
                <Link
                  href={`/hospital/reception/patients/${data.patient.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  {t("patients.actions.view")} <ArrowRight size={12} />
                </Link>
              ) : null}
            </div>
          </section>
          <QuickToolsPanel
            id="invoice-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: Receipt, label: t("nav.billing"), hint: t("dashboard.viewAll"), href: "/hospital/billing", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: CircleDollarSign, label: t("nav.billingOutstanding"), hint: "Balances", href: "/hospital/billing/outstanding", tone: "from-amber-500 to-orange-600 shadow-amber-500/30" },
              { icon: Eye, label: t("billing.viewReceipt"), hint: t("billing.print"), href: `/hospital/billing/${id}/receipt`, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { icon: Plus, label: t("billing.newInvoice"), hint: t("billing.invoice"), href: "/hospital/billing/new", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
            ]}
          />
        </aside>
      </div>

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
              className={FIELD_INPUT}
              value={payForm.amountLkr}
              onChange={(e) =>
                setPayForm({ ...payForm, amountLkr: Number(e.target.value) })
              }
            />
          </FormField>
          <FormField label={t("billing.method")}>
            <select
              className={FIELD_INPUT}
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
              className={FIELD_INPUT}
              value={payForm.reference}
              onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPayOpen(false)}
              className="rounded-xl border border-[color:var(--ink-border)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={pay.isPending}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {t("common.submit")}
            </button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

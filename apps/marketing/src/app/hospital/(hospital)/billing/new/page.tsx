"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, FileText, ListChecks, Plus, Receipt, Send, Trash2 } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { FormField } from "@/hospital/components/ui/LocalForm";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatLkr } from "@/hospital/lib/format";
import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { FIELD_INPUT, FIELD_TEXTAREA } from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type LineItem = {
  description: string;
  quantity: number;
  unitPriceLkr: number;
  kind: string;
};

export default function NewInvoicePage() {
  const t = useT();
  const router = useRouter();
  const locale = useAuthStore((s) => s.locale);
  const [form, setForm] = useState({
    patientId: "",
    visitType: "opd",
    notes: "",
  });
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPriceLkr: 0, kind: "consultation" },
  ]);

  const subtotal = items.reduce(
    (acc, li) => acc + (li.quantity || 0) * (li.unitPriceLkr || 0),
    0
  );

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ invoice: { id: string } }>("/hospital-portal/billing/invoices", { method: "POST", json: body }),
    onSuccess: (data) => {
      toast.success("Invoice created");
      router.push(`/hospital/billing/${data.invoice.id}`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const filled = [form.patientId, form.visitType, items.some((i) => i.description) ? "items" : ""].filter(Boolean).length;

  const hero = (
    <DoctorHero
      kickerIcon={<Receipt size={13} aria-hidden />}
      kicker={t("nav.billing")}
      kickerMeta={t("billing.newInvoice")}
      title={
        <>
          {t("billing.newInvoice")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · draft
          </span>
        </>
      }
      description={t("billing.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <ListChecks size={12} className="text-emerald-300" />
            {items.length} {t("billing.lineItems").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <Receipt size={12} className="text-amber-300" />
            {formatLkr(subtotal, locale)}
          </span>
        </>
      }
      actions={
        <>
          <button type="button" onClick={() => router.back()} className={HERO_GHOST}>
            <ArrowLeft size={14} />
            {t("common.back")}
          </button>
          <button type="submit" form="new-invoice-form" disabled={create.isPending} className={HERO_PRIMARY}>
            <Send size={14} className="text-emerald-600" />
            {t("common.create")}
          </button>
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
          tone={form.patientId ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}
          label={t("billing.patientId")}
          value={form.patientId ? "✓" : "—"}
          sub={form.patientId || t("billing.patientId")}
          pulse={!form.patientId}
        />
        <StatTile
          icon={<ListChecks size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("billing.lineItems")}
          value={String(items.length)}
          sub={`${filled}/3`}
        />
        <StatTile
          icon={<Receipt size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("billing.visitType")}
          value={form.visitType.toUpperCase()}
          sub={t("billing.visitType")}
        />
        <StatTile
          icon={<Receipt size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("billing.subtotal")}
          value={formatLkr(subtotal, locale)}
          sub={t("billing.total")}
        />
      </HeroOverlap>

      <form
        id="new-invoice-form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ ...form, lineItems: items });
        }}
      >
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
            <section className={PANEL}>
              <PanelHeader
                icon={<FileText size={16} />}
                tone="bg-sky-50 text-sky-600"
                title={t("billing.invoice")}
                caption={t("billing.visitType")}
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormField label={t("billing.patientId")} required>
                  <input
                    required
                    className={FIELD_INPUT}
                    value={form.patientId}
                    onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                  />
                </FormField>
                <FormField label={t("billing.visitType")}>
                  <select
                    className={FIELD_INPUT}
                    value={form.visitType}
                    onChange={(e) => setForm({ ...form, visitType: e.target.value })}
                  >
                    <option value="opd">OPD</option>
                    <option value="ipd">IPD</option>
                    <option value="emergency">Emergency</option>
                    <option value="lab">Lab</option>
                  </select>
                </FormField>
                <FormField label={t("common.notes")} className="md:col-span-2">
                  <textarea
                    className={FIELD_TEXTAREA}
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </FormField>
              </div>
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<ListChecks size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title={t("billing.lineItems")}
                caption={String(items.length)}
                action={
                  <button
                    type="button"
                    onClick={() =>
                      setItems([...items, { description: "", quantity: 1, unitPriceLkr: 0, kind: "other" }])
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <Plus size={13} /> {t("billing.addLine")}
                  </button>
                }
              />
              <div className="mt-4 space-y-3">
                {items.map((li, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 items-center gap-2 rounded-2xl border border-[color:var(--ink-border)] bg-slate-50/60 p-3"
                  >
                    <input
                      placeholder={t("billing.description")}
                      className={cn(FIELD_INPUT, "col-span-12 sm:col-span-5")}
                      value={li.description}
                      onChange={(e) =>
                        setItems(items.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                      }
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder={t("billing.qty")}
                      className={cn(FIELD_INPUT, "col-span-4 sm:col-span-2")}
                      value={li.quantity}
                      onChange={(e) =>
                        setItems(items.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder={t("billing.unitPrice")}
                      className={cn(FIELD_INPUT, "col-span-5 sm:col-span-3")}
                      value={li.unitPriceLkr}
                      onChange={(e) =>
                        setItems(items.map((x, i) => (i === idx ? { ...x, unitPriceLkr: Number(e.target.value) } : x)))
                      }
                    />
                    <button
                      type="button"
                      aria-label={t("common.delete")}
                      className="col-span-3 grid h-9 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 sm:col-span-2"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-5 xl:col-span-4">
            <section className={PANEL}>
              <PanelHeader
                icon={<Receipt size={16} />}
                tone="bg-amber-50 text-amber-600"
                title={t("billing.subtotal")}
                caption={`${items.length} ${t("billing.lineItems").toLowerCase()}`}
              />
              <div className="mt-4">
                <p className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                  {formatLkr(subtotal, locale)}
                </p>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {create.isPending ? "…" : t("common.create")}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="mt-2 w-full rounded-xl border border-[color:var(--ink-border)] px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </section>
            <Link
              href="/hospital/billing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <ArrowLeft size={13} /> {t("nav.billing")}
            </Link>
          </aside>
        </div>
      </form>
    </div>
  );
}

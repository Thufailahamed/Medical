"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CircleDollarSign,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
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
  PanelSearch,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  PanelSkeleton,
  PromoCard,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  draft: TONE_BADGE.slate,
  issued: TONE_BADGE.sky,
  partially_paid: TONE_BADGE.amber,
  paid: TONE_BADGE.emerald,
  cancelled: TONE_BADGE.slate,
};

const STATUS_RAIL: Record<string, "slate" | "sky" | "amber" | "emerald"> = {
  draft: "slate",
  issued: "sky",
  partially_paid: "amber",
  paid: "emerald",
  cancelled: "slate",
};

type StatusFilter = "" | "draft" | "issued" | "partially_paid" | "paid" | "cancelled";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  patientName?: string;
  totalLkr: number;
  status: string;
  createdAt: string;
}

export default function BillingPage() {
  const locale = useAuthStore((s) => s.locale);
  const t = useT();
  const [status, setStatus] = useState<StatusFilter>("");
  const [search, setSearch] = useState("");

  const list = useQuery({
    queryKey: ["invoices", status],
    queryFn: () =>
      api<{ invoices: InvoiceRow[] }>(
        `/hospital-portal/billing/invoices${status ? `?status=${status}` : ""}`
      ),
  });

  const countsQuery = useQuery({
    queryKey: ["invoices", "counts"],
    queryFn: () => api<{ invoices: InvoiceRow[] }>("/hospital-portal/billing/invoices"),
  });

  const countBy = useMemo(() => {
    const m: Record<string, number> = {};
    (countsQuery.data?.invoices ?? []).forEach((i) => {
      m[i.status] = (m[i.status] ?? 0) + 1;
    });
    return m;
  }, [countsQuery.data]);

  const all = countsQuery.data?.invoices ?? [];
  const openValue = all
    .filter((i) => i.status === "issued" || i.status === "partially_paid")
    .reduce((a, i) => a + i.totalLkr, 0);

  const filtered = (list.data?.invoices ?? []).filter(
    (i) =>
      !search ||
      i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.patientName?.toLowerCase().includes(search.toLowerCase())
  );

  const hero = (
    <DoctorHero
      kickerIcon={<Receipt size={13} aria-hidden />}
      kicker={t("nav.reports")}
      kickerMeta={t("nav.billing")}
      title={
        <>
          {t("nav.billing")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · invoices
          </span>
        </>
      }
      description={t("billing.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <FileText size={12} className="text-emerald-300" />
            {all.length} {t("nav.billing").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <CircleDollarSign size={12} className="text-amber-300" />
            {formatLkr(openValue, locale)} open
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<CircleDollarSign size={18} />}
          label={t("nav.billingOutstanding")}
          value={countsQuery.isLoading ? "…" : formatLkr(openValue, locale)}
          sub={`${countBy.issued ?? 0} issued · ${countBy.partially_paid ?? 0} partial`}
        />
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => {
              list.refetch();
              countsQuery.refetch();
            }}
            className={HERO_GHOST}
          >
            <RefreshCw
              size={13}
              className={list.isFetching || countsQuery.isFetching ? "animate-spin" : ""}
            />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/billing/outstanding" className={HERO_GHOST}>
            <CircleDollarSign size={14} />
            {t("nav.billingOutstanding")}
          </Link>
          <Link href="/hospital/billing/new" className={HERO_PRIMARY}>
            <Plus size={14} className="text-emerald-600" />
            {t("billing.newInvoice")}
          </Link>
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
          label={t("common.all")}
          value={countsQuery.isLoading ? "…" : String(all.length)}
          sub={t("nav.billing")}
          active={status === ""}
          onClick={() => setStatus("")}
        />
        <StatTile
          icon={<Receipt size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Issued"
          value={countsQuery.isLoading ? "…" : String(countBy.issued ?? 0)}
          sub="Awaiting payment"
          active={status === "issued"}
          onClick={() => setStatus("issued")}
          pulse={(countBy.issued ?? 0) > 0}
        />
        <StatTile
          icon={<CircleDollarSign size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Partially paid"
          value={countsQuery.isLoading ? "…" : String(countBy.partially_paid ?? 0)}
          sub="Balance remains"
          active={status === "partially_paid"}
          onClick={() => setStatus("partially_paid")}
        />
        <StatTile
          icon={<CircleDollarSign size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("billing.paid")}
          value={countsQuery.isLoading ? "…" : String(countBy.paid ?? 0)}
          sub="Settled invoices"
          active={status === "paid"}
          onClick={() => setStatus("paid")}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<FileText size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            title={t("nav.billing")}
            caption={
              list.isLoading
                ? t("common.loading")
                : `${filtered.length} ${status ? status.replace("_", " ") : t("common.all").toLowerCase()}`
            }
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Segmented<StatusFilter>
              ariaLabel="Filter invoices"
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: t("common.all"), count: all.length },
                { value: "draft", label: "Draft", count: countBy.draft ?? 0 },
                { value: "issued", label: "Issued", count: countBy.issued ?? 0 },
                { value: "partially_paid", label: "Partial", count: countBy.partially_paid ?? 0 },
                { value: "paid", label: t("billing.paid"), count: countBy.paid ?? 0 },
                { value: "cancelled", label: "Cancelled", count: countBy.cancelled ?? 0 },
              ]}
            />
            <div className="ml-auto w-full sm:w-56">
              <PanelSearch value={search} onChange={setSearch} placeholder={t("common.search")} />
            </div>
          </div>

          {list.isLoading ? (
            <PanelSkeleton rows={5} className="mt-4" />
          ) : !filtered.length ? (
            <EmptyBlock
              icon={<FileText size={19} />}
              title={t("billing.empty")}
              body="Invoices matching this filter will appear here."
              actions={
                <Link href="/hospital/billing/new" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                  <Plus size={13} /> {t("billing.newInvoice")}
                </Link>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {filtered.map((i) => (
                <li key={i.id}>
                  <RailRow
                    tone={STATUS_RAIL[i.status] ?? "slate"}
                    active={i.status === "issued" || i.status === "partially_paid"}
                    icon={<Receipt size={16} />}
                    title={
                      <>
                        {i.patientName ?? "—"}{" "}
                        <span className="font-mono text-xs font-medium text-slate-400">{i.invoiceNumber}</span>
                      </>
                    }
                    meta={formatDate(i.createdAt, locale)}
                    trailing={
                      <>
                        <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_BADGE[i.status] ?? TONE_BADGE.slate)}>
                          {i.status.replace("_", " ")}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-slate-900">
                          {formatLkr(i.totalLkr, locale)}
                        </span>
                        <Link
                          href={`/hospital/billing/${i.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                        >
                          {t("patients.actions.view")}
                          <ArrowRight size={13} aria-hidden />
                        </Link>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="billing-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: Plus, label: t("billing.newInvoice"), hint: t("billing.invoice"), href: "/hospital/billing/new", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
              { icon: CircleDollarSign, label: t("nav.billingOutstanding"), hint: "Balances", href: "/hospital/billing/outstanding", tone: "from-amber-500 to-orange-600 shadow-amber-500/30" },
              { icon: ArrowRight, label: t("nav.reportsOverview"), hint: "Analytics", href: "/hospital/reports", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
            ]}
          />
          <PromoCard
            icon={<CircleDollarSign size={18} />}
            kicker={t("nav.billing")}
            title={t("nav.billingOutstanding")}
            body={t("billing.outstandingSubtitle")}
            href="/hospital/billing/outstanding"
          />
        </aside>
      </div>
    </div>
  );
}

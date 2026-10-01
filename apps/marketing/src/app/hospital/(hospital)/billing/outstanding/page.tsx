"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatLkr } from "@/hospital/lib/format";
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
  HeroPulse,
  PanelSkeleton,
  QuickToolsPanel,
  RailRow,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

interface OutstandingRow {
  patientName: string;
  outstanding: number;
  invoiceCount: number;
}

export default function OutstandingPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const q = useQuery({
    queryKey: ["outstanding"],
    queryFn: () => api<{ rows: OutstandingRow[] }>("/hospital-portal/billing/outstanding"),
  });

  const rows = q.data?.rows ?? [];
  const totalOutstanding = rows.reduce((a, r) => a + r.outstanding, 0);
  const totalInvoices = rows.reduce((a, r) => a + r.invoiceCount, 0);

  const hero = (
    <DoctorHero
      kickerIcon={<CircleDollarSign size={13} aria-hidden />}
      kicker={t("nav.billing")}
      kickerMeta={t("nav.billingOutstanding")}
      title={
        <>
          {t("nav.billingOutstanding")}{" "}
          <span className="bg-gradient-to-r from-amber-200 via-white to-emerald-200 bg-clip-text text-transparent">
            · balances
          </span>
        </>
      }
      description={t("billing.outstandingSubtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <FileText size={12} className="text-amber-300" />
            {rows.length} {t("nav.patients").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <CircleDollarSign size={12} className="text-emerald-300" />
            {formatLkr(totalOutstanding, locale)} {t("billing.balance").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<CircleDollarSign size={18} />}
          label={t("billing.outstandingAmount")}
          value={q.isLoading ? "…" : formatLkr(totalOutstanding, locale)}
          sub={`${rows.length} ${t("nav.patients").toLowerCase()}`}
        />
      }
      actions={
        <>
          <button type="button" onClick={() => q.refetch()} className={HERO_GHOST}>
            <RefreshCw size={13} className={q.isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/billing" className={HERO_GHOST}>
            <ArrowLeft size={14} />
            {t("nav.billing")}
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
          icon={<CircleDollarSign size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("billing.outstandingAmount")}
          value={q.isLoading ? "…" : formatLkr(totalOutstanding, locale)}
          sub={t("nav.billingOutstanding")}
          pulse={totalOutstanding > 0}
        />
        <StatTile
          icon={<FileText size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("nav.patients")}
          value={q.isLoading ? "…" : String(rows.length)}
          sub={t("billing.outstandingSubtitle")}
        />
        <StatTile
          icon={<Receipt size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("billing.invoiceCount")}
          value={q.isLoading ? "…" : String(totalInvoices)}
          sub={t("nav.billing")}
        />
        <StatTile
          icon={<ArrowRight size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("nav.billing")}
          value="→"
          sub={t("dashboard.viewAll")}
          href="/hospital/billing"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<CircleDollarSign size={16} />}
            tone="bg-amber-50 text-amber-600"
            title={t("nav.billingOutstanding")}
            caption={q.isLoading ? t("common.loading") : `${rows.length}`}
          />
          {q.isLoading ? (
            <PanelSkeleton rows={5} className="mt-4" />
          ) : !rows.length ? (
            <EmptyBlock
              icon={<CheckCircle2 size={19} />}
              title={t("billing.noOutstanding")}
              body="All invoices are settled."
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {rows.map((r, i) => (
                <li key={i}>
                  <RailRow
                    tone="amber"
                    icon={<CircleDollarSign size={16} />}
                    title={r.patientName}
                    meta={`${r.invoiceCount} ${t("billing.invoiceCount").toLowerCase()}`}
                    trailing={
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-rose-700">
                        {formatLkr(r.outstanding, locale)}
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="outstanding-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: Receipt, label: t("nav.billing"), hint: t("dashboard.viewAll"), href: "/hospital/billing", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Plus, label: t("billing.newInvoice"), hint: t("billing.invoice"), href: "/hospital/billing/new", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
              { icon: BarChart3, label: t("nav.reportsOverview"), hint: "Analytics", href: "/hospital/reports", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}

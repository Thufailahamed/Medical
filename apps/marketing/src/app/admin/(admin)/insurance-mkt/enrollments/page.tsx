"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Hash,
  Package,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Pill } from "@/portal/components/ui/Pill";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  AdminDirectory,
  humanize,
  type DirectoryRow,
} from "@/portal/components/admin/AdminDirectory";
import {
  ENROLLMENT_STATUSES,
  enrollmentTone,
  lkrCompact,
  useMktEnrollments,
} from "@/portal/components/admin/insurance-mkt";

type Filter = "all" | (typeof ENROLLMENT_STATUSES)[number];

export default function AdminInsuranceEnrollmentsPage() {
  const [status, setStatus] = useState<Filter>("all");
  const [now] = useState(() => Date.now());
  const { data, isLoading } = useMktEnrollments();

  const all = useMemo(() => data?.enrollments ?? [], [data]);
  const count = (s: string) => all.filter((e) => e.status === s).length;
  const active = all.filter((e) => e.status === "active");
  // Annualised premium book for active policies.
  const annualBook = active.reduce((a, e) => a + e.premiumAmountLkr * (e.billingCycle === "monthly" ? 12 : 1), 0);
  const coverInForce = active.reduce((a, e) => a + e.coverageAmountLkr, 0);
  const atRisk = count("grace") + count("lapsed");
  const dueSoon = all.filter(
    (e) => e.nextPremiumDueAt && Date.parse(e.nextPremiumDueAt) - now < 7 * 86_400_000 && Date.parse(e.nextPremiumDueAt) >= now - 86_400_000,
  ).length;

  const byProvider = useMemo(() => {
    const m = new Map<string, { name: string; count: number; premium: number }>();
    for (const e of all) {
      const cur = m.get(e.providerId) ?? { name: e.providerName, count: 0, premium: 0 };
      cur.count += 1;
      if (e.status === "active") cur.premium += e.premiumAmountLkr * (e.billingCycle === "monthly" ? 12 : 1);
      m.set(e.providerId, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [all]);

  const filtered = status === "all" ? all : all.filter((e) => e.status === status);

  const rows: DirectoryRow[] = filtered.map((e) => {
    const tone = enrollmentTone(e.status);
    const due = e.nextPremiumDueAt ? Date.parse(e.nextPremiumDueAt) : null;
    const dueDays = due != null ? Math.ceil((due - now) / 86_400_000) : null;
    return {
      id: e.id,
      name: e.userName,
      href: `/admin/users/${e.userId}`,
      linkLabel: "Policyholder",
      accent: tone.rail,
      badges: (
        <>
          <Pill tone={tone.pill}>{humanize(e.status)}</Pill>
          {e.status === "active" && dueDays != null && dueDays <= 7 ? (
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold", dueDays < 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700")}>
              {dueDays < 0 ? `${-dueDays}d overdue` : dueDays === 0 ? "Due today" : `Due in ${dueDays}d`}
            </span>
          ) : null}
        </>
      ),
      meta: [
        { icon: <Building2 size={11} />, text: `${e.providerName} · ${e.planName}` },
        ...(e.policyNumber ? [{ icon: <Hash size={11} />, text: e.policyNumber, mono: true }] : []),
        { icon: <Wallet size={11} />, text: `${formatLkr(e.premiumAmountLkr)} / ${e.billingCycle === "monthly" ? "mo" : "yr"}`, wide: true },
        { icon: <ShieldCheck size={11} />, text: `${lkrCompact(e.coverageAmountLkr)} cover`, wide: true },
        ...(e.startDate ? [{ icon: <CalendarClock size={11} />, text: `Since ${new Date(e.startDate).toLocaleDateString()}`, wide: true }] : []),
      ],
      searchText: [e.policyNumber, e.planName, e.providerName].filter(Boolean).join(" "),
    };
  });

  return (
    <AdminDirectory<Filter>
      hero={
        <DoctorHero
          kickerIcon={<ClipboardList size={13} aria-hidden />}
          kicker="Insurance marketplace"
          kickerMeta={`${all.length} polic${all.length === 1 ? "y" : "ies"}`}
          title={
            <>
              Policy{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                enrollments
              </span>
            </>
          }
          description="Every policy bought through the marketplace — who holds it, what it covers and whether premiums are up to date."
          chips={
            <>
              <span className={HERO_CHIP}>
                <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                {active.length} active
              </span>
              {dueSoon > 0 ? (
                <span className={HERO_CHIP}>
                  <Clock size={12} className="text-amber-300" aria-hidden />
                  {dueSoon} premium{dueSoon === 1 ? "" : "s"} due this week
                </span>
              ) : null}
              {atRisk > 0 ? (
                <button
                  type="button"
                  onClick={() => setStatus("grace")}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-400/15 px-3 py-1.5 text-xs font-semibold text-red-100 transition-colors hover:bg-red-400/25"
                >
                  <AlertTriangle size={12} aria-hidden />
                  {atRisk} at risk of lapsing
                </button>
              ) : null}
            </>
          }
          actions={
            <Link href="/admin/insurance-mkt/claims" className={HERO_GHOST}>
              <ClipboardList size={15} aria-hidden />
              Claims
            </Link>
          }
        />
      }
      stats={
        <>
          <StatTile label="Active policies" icon={<CheckCircle2 size={16} />} tone="bg-emerald-50 text-emerald-600" value={isLoading ? "…" : String(active.length)} sub={`${all.length} total enrollments`} progress={all.length ? Math.round((active.length / all.length) * 100) : null} active={status === "active"} onClick={() => setStatus("active")} />
          <StatTile label="Awaiting payment" icon={<Clock size={16} />} tone="bg-amber-50 text-amber-600" value={String(count("payment_pending"))} sub="First premium not received" pulse={count("payment_pending") > 0} active={status === "payment_pending"} onClick={() => setStatus("payment_pending")} />
          <StatTile label="Grace & lapsed" icon={<AlertTriangle size={16} />} tone="bg-red-50 text-red-600" value={String(atRisk)} sub={`${count("grace")} in grace · ${count("lapsed")} lapsed`} active={status === "grace" || status === "lapsed"} onClick={() => setStatus("grace")} />
          <StatTile label="Annual premium book" icon={<Wallet size={16} />} tone="bg-sky-50 text-sky-600" value={lkrCompact(annualBook)} sub={`${lkrCompact(coverInForce)} cover in force`} />
        </>
      }
      title="Enrollment ledger"
      icon={<ClipboardList size={16} />}
      tone="bg-sky-50 text-sky-600"
      rows={rows}
      total={all.length}
      loading={isLoading}
      searchPlaceholder="Search policyholder, policy no., plan or provider…"
      segmented={{
        value: status,
        onChange: setStatus,
        options: [
          { value: "all", label: "All", count: all.length },
          ...ENROLLMENT_STATUSES.map((s) => ({
            value: s,
            label: s === "payment_pending" ? "Pending" : humanize(s),
            count: count(s),
          })),
        ],
      }}
      empty={{
        icon: <ClipboardList size={19} />,
        title: "No enrollments",
        body: "Policies appear here once patients enrol in a published plan.",
      }}
      aside={
        <section className={PANEL} aria-labelledby="enr-providers">
          <PanelHeader
            id="enr-providers"
            icon={<Building2 size={16} />}
            tone="bg-amber-50 text-amber-600"
            title="By provider"
            caption="Policies and annual premium"
            href="/admin/insurance-mkt/providers"
            linkLabel="Providers"
          />
          {byProvider.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">No policies yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {byProvider.map(([id, p]) => (
                <li key={id}>
                  <Link href={`/admin/insurance-mkt/providers/${id}`} className="group block">
                    <span className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate font-medium text-slate-700 group-hover:text-sky-700">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">
                        <span className="font-semibold text-slate-700">{p.count}</span> · {lkrCompact(p.premium)}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
                        style={{ width: `${(p.count / Math.max(1, byProvider[0][1].count)) * 100}%` }}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/insurance-mkt/plans"
            className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-sky-50 hover:text-sky-700"
          >
            <Package size={14} />
            Browse the plan catalogue
          </Link>
        </section>
      }
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  IdCard,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  useInsuranceOperatorEnrollments,
  useKycDecision,
  type InsuranceOperatorEnrollment,
} from "../../hooks/useApi";
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
import { Badge, type Tone } from "@/patient/components/workspace";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import Link from "next/link";

const STATUS_TONE: Record<string, Tone> = {
  active: "emerald",
  pending: "amber",
  lapsed: "rose",
  cancelled: "rose",
  expired: "slate",
};

const KYC_TONE: Record<string, Tone> = {
  verified: "emerald",
  rejected: "rose",
  pending: "amber",
  not_submitted: "slate",
};

function statusLabel(s: string | null | undefined) {
  return (s ?? "unknown").replace(/_/g, " ");
}

const ENROLL_TABS = [
  { value: null as string | null, label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "lapsed", label: "Lapsed" },
  { value: "expired", label: "Expired" },
];

export default function OperatorEnrollmentsPage() {
  const { data, isLoading, refetch, isRefetching } = useInsuranceOperatorEnrollments();
  const rows = useMemo(() => data?.enrollments ?? [], [data]);
  const kyc = useKycDecision();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(
      (e: InsuranceOperatorEnrollment) =>
        (!status || e.status === status) &&
        (!term ||
          [e.userName ?? "", e.planName ?? "", e.policyNumber ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [rows, search, status]);

  const activeCount = rows.filter((e) => e.status === "active").length;
  const kycPending = rows.filter((e) => e.kycStatus !== "verified").length;
  const premiumBook = rows
    .filter((e) => e.status === "active")
    .reduce((s, e) => s + (e.premiumAmountLkr ?? 0), 0);
  const coverageBook = rows
    .filter((e) => e.status === "active")
    .reduce((s, e) => s + (e.coverageAmountLkr ?? 0), 0);

  const hero = (
    <DoctorHero
      kicker="Policy book"
      kickerIcon={<ShieldCheck size={12} />}
      kickerMeta={`${rows.length} enrollments on record`}
      title="Enrollments"
      description="Every active and historical policy issued under your plans — premiums, coverage, and renewal dates."
      chips={
        <>
          <span className={HERO_CHIP}>
            <Users size={12} /> {activeCount} active policies
          </span>
          <span className={HERO_CHIP}>
            <IdCard size={12} /> {kycPending} awaiting KYC
          </span>
          <span className={HERO_CHIP}>
            <Banknote size={12} /> LKR {premiumBook.toLocaleString()} recurring premium
          </span>
        </>
      }
      actions={
        <>
          <button type="button" onClick={() => refetch()} className={HERO_GHOST}>
            <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} /> Refresh
          </button>
          <Link href="/insurance-operator/claims?status=submitted" className={HERO_PRIMARY}>
            Claims queue
            <ArrowRight size={14} />
          </Link>
        </>
      }
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {hero}

      {/* ── Floating stat strip ── */}
      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Enrollments"
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(rows.length)}
            sub="All-time policies"
          />
          <StatTile
            label="Active"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(activeCount)}
            sub="In-force coverage"
            pulse={activeCount > 0}
          />
          <StatTile
            label="Premium book"
            icon={<Banknote size={16} />}
            tone="bg-indigo-50 text-indigo-600"
            value={`LKR ${premiumBook.toLocaleString()}`}
            sub="Recurring premium value"
          />
          <StatTile
            label="Sum insured"
            icon={<ShieldCheck size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={`LKR ${coverageBook.toLocaleString()}`}
            sub="Active coverage exposure"
          />
        </div>
      </HeroOverlap>

      {/* ── Registry panel ── */}
      <section className={PANEL}>
        <PanelHeader
          icon={<ShieldCheck size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Policy registry"
          caption={
            isLoading
              ? "Loading registry…"
              : `${filtered.length} of ${rows.length} enrollments`
          }
          action={
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Search holder, plan, policy…"
              ariaLabel="Search enrollments"
            />
          }
        />

        <div className="mt-4 overflow-x-auto">
          <Segmented
            ariaLabel="Filter enrollments by status"
            value={status}
            onChange={setStatus}
            options={ENROLL_TABS}
          />
        </div>

        {isLoading ? (
          <ul className="mt-4 flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-50" />
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<ShieldCheck size={19} />}
            title={rows.length === 0 ? "No enrollments yet" : "No policies match"}
            body={
              rows.length === 0
                ? "Policies sold under your plans will appear in this registry."
                : "Try a different search term or status filter."
            }
            actions={
              status || search ? (
                <button
                  type="button"
                  onClick={() => {
                    setStatus(null);
                    setSearch("");
                  }}
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-100 lg:block">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <th className="px-5 py-3">Policyholder</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Members</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">KYC</th>
                    <th className="px-5 py-3 text-right">Premium</th>
                    <th className="px-5 py-3 text-right">Coverage</th>
                    <th className="px-5 py-3">Renewal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-sky-50/40">
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold",
                              e.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500",
                            )}
                          >
                            {(e.userName || "?").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900">{e.userName || "Unknown holder"}</span>
                            <span className="block font-mono text-[11px] text-slate-400">{e.policyNumber || "—"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{e.planName || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-slate-600">
                          {1 + (e.dependents?.length ?? 0)} covered
                        </span>
                        {e.dependents?.length ? (
                          <span className="block max-w-[180px] truncate text-[11px] text-slate-400" title={e.dependents.map((d) => `${d.name} (${d.relation})`).join(", ")}>
                            {e.dependents.map((d) => d.name).join(", ")}
                          </span>
                        ) : null}
                        {e.nomineeName ? (
                          <span className="block text-[11px] text-slate-400">Nominee: {e.nomineeName}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={STATUS_TONE[e.status] ?? "slate"}>{statusLabel(e.status)}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5">
                          <Badge tone={KYC_TONE[e.kycStatus ?? ""] ?? (e.kycStatus ? "sky" : "slate")}>
                            {e.kycStatus ? statusLabel(e.kycStatus) : "not submitted"}
                          </Badge>
                          {e.kycStatus !== "verified" ? (
                            <>
                              <button
                                type="button"
                                disabled={kyc.isPending}
                                onClick={() => kyc.mutate({ id: e.id, decision: "verified" })}
                                aria-label={`Verify KYC for ${e.userName || "holder"}`}
                                title="Verify KYC"
                                className="grid h-7 w-7 place-items-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-40"
                              >
                                <UserCheck size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={kyc.isPending}
                                onClick={() => kyc.mutate({ id: e.id, decision: "rejected" })}
                                aria-label={`Reject KYC for ${e.userName || "holder"}`}
                                title="Reject KYC"
                                className="grid h-7 w-7 place-items-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-40"
                              >
                                <UserX size={14} />
                              </button>
                            </>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                        LKR {(e.premiumAmountLkr ?? 0).toLocaleString()}
                        <span className="block text-[10.5px] font-normal text-slate-400">
                          per {e.billingCycle || "cycle"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm tabular-nums text-slate-600">
                        LKR {(e.coverageAmountLkr ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <CalendarClock size={12} className="text-slate-300" />
                          {e.nextPremiumDueAt ? formatDate(e.nextPremiumDueAt) : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="mt-4 flex flex-col gap-2 lg:hidden">
              {filtered.map((e) => (
                <li
                  key={e.id}
                  className="relative overflow-hidden rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]"
                >
                  <span
                    className={cn(
                      "absolute inset-y-3 left-0 w-[3px] rounded-r-full",
                      e.status === "active" ? "bg-emerald-500" : "bg-slate-300",
                    )}
                    aria-hidden
                  />
                  <div className="ml-2 flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold",
                          e.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {(e.userName || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {e.userName || "Unknown holder"}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {e.planName || "—"} · {e.policyNumber || "—"}
                        </span>
                      </span>
                    </span>
                    <Badge tone={STATUS_TONE[e.status] ?? "slate"}>{statusLabel(e.status)}</Badge>
                  </div>
                  {e.dependents?.length || e.nomineeName ? (
                    <div className="ml-2 mt-2 text-[11px] text-slate-400">
                      {1 + (e.dependents?.length ?? 0)} covered
                      {e.dependents?.length ? ` — ${e.dependents.map((d) => d.name).join(", ")}` : ""}
                      {e.nomineeName ? ` · Nominee: ${e.nomineeName}` : ""}
                    </div>
                  ) : null}
                  <div className="ml-2 mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-semibold tabular-nums text-slate-900">
                      LKR {(e.premiumAmountLkr ?? 0).toLocaleString()}
                      <span className="font-normal text-slate-400"> / {e.billingCycle || "cycle"}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge tone={KYC_TONE[e.kycStatus ?? ""] ?? (e.kycStatus ? "sky" : "slate")}>
                        KYC {e.kycStatus ? statusLabel(e.kycStatus) : "pending"}
                      </Badge>
                      {e.kycStatus !== "verified" ? (
                        <>
                          <button
                            type="button"
                            disabled={kyc.isPending}
                            onClick={() => kyc.mutate({ id: e.id, decision: "verified" })}
                            aria-label="Verify KYC"
                            className="grid h-6 w-6 place-items-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                          >
                            <UserCheck size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={kyc.isPending}
                            onClick={() => kyc.mutate({ id: e.id, decision: "rejected" })}
                            aria-label="Reject KYC"
                            className="grid h-6 w-6 place-items-center rounded-md text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                          >
                            <UserX size={13} />
                          </button>
                        </>
                      ) : null}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

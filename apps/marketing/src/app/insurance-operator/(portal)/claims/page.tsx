"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  RefreshCw,
} from "lucide-react";
import {
  useInsuranceOperatorClaims,
  useInsuranceOperatorEnrollments,
  InsuranceOperatorClaim,
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
import { Badge, RailRow, type Tone } from "@/patient/components/workspace";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

const STATUS_TABS = [
  { value: undefined, label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "more_info_needed", label: "Needs Info" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

const STATUS_TONE: Record<string, Tone> = {
  submitted: "amber",
  under_review: "sky",
  more_info_needed: "violet",
  approved: "emerald",
  rejected: "rose",
  paid: "emerald",
};

function statusLabel(s: string | null | undefined) {
  return (s ?? "unknown").replace(/_/g, " ");
}

export default function ClaimsQueuePage() {
  const sp = useSearchParams();
  const router = useRouter();
  const status = sp.get("status") ?? undefined;
  const [search, setSearch] = useState(sp.get("q") ?? "");

  const { data, isLoading, refetch, isRefetching } = useInsuranceOperatorClaims(status);
  const claims: InsuranceOperatorClaim[] = useMemo(
    () => data?.claims ?? [],
    [data],
  );

  // The claim row carries enrollmentId but not the claimant's name or policy —
  // resolve them from the enrollments list (shares its query cache).
  const enrollmentsQuery = useInsuranceOperatorEnrollments();
  const enrollmentById = useMemo(() => {
    const m = new Map<string, { name: string; policy: string }>();
    for (const e of enrollmentsQuery.data?.enrollments ?? []) {
      m.set(e.id, { name: e.userName ?? "", policy: e.policyNumber ?? "" });
    }
    return m;
  }, [enrollmentsQuery.data]);

  const claimantName = (c: InsuranceOperatorClaim) =>
    enrollmentById.get(c.enrollmentId)?.name || "Unknown claimant";
  const policyNumber = (c: InsuranceOperatorClaim) =>
    enrollmentById.get(c.enrollmentId)?.policy || "—";
  const facilityOf = (c: InsuranceOperatorClaim) =>
    c.incurringFacility ?? c.facility ?? "";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return claims;
    return claims.filter((c) =>
      [claimantName(c), policyNumber(c), c.treatmentType, facilityOf(c)]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims, search, enrollmentById]);

  const requestedTotal = filtered.reduce((s, c) => s + (c.amountRequestedLkr ?? 0), 0);
  const openCount = claims.filter((c) =>
    ["submitted", "under_review", "more_info_needed"].includes(c.status),
  ).length;

  const setStatus = (v: string | null) => {
    const q = v ? `?status=${v}` : "";
    router.replace(`/insurance-operator/claims${q}`);
  };

  const hero = (
    <DoctorHero
      kicker="Adjudication queue"
      kickerIcon={<ClipboardCheck size={12} />}
      kickerMeta={`${claims.length} claim${claims.length === 1 ? "" : "s"} in this view`}
      title="Claims queue"
      description="Review reimbursement requests, decide payouts, and keep claimants informed at every step."
      chips={
        <>
          <span className={HERO_CHIP}>
            <ClipboardList size={12} /> {openCount} in progress
          </span>
          <span className={HERO_CHIP}>
            <Banknote size={12} /> LKR {requestedTotal.toLocaleString()} requested
          </span>
        </>
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => refetch()}
            className={HERO_GHOST}
          >
            <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} /> Refresh
          </button>
          <Link href="/insurance-operator/claims?status=submitted" className={HERO_PRIMARY}>
            Review pending
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile
            href="/insurance-operator/claims?status=submitted"
            label="Submitted"
            icon={<ClipboardList size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(claims.filter((c) => c.status === "submitted").length)}
            sub="Awaiting first review"
            active={status === "submitted"}
            pulse={claims.some((c) => c.status === "submitted")}
          />
          <StatTile
            label="In adjudication"
            icon={<ClipboardCheck size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(openCount)}
            sub="Open across all stages"
          />
          <StatTile
            href="/insurance-operator/claims?status=approved"
            label="Value in view"
            icon={<Banknote size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={`LKR ${requestedTotal.toLocaleString()}`}
            sub="Requested — filtered set"
          />
        </div>
      </HeroOverlap>

      {/* ── Queue panel ── */}
      <section className={PANEL}>
        <PanelHeader
          icon={<ClipboardCheck size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Reimbursement claims"
          caption={
            isLoading
              ? "Loading queue…"
              : `${filtered.length} of ${claims.length} claims${status ? ` · ${statusLabel(status)}` : ""}`
          }
          action={
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Search claimant, policy, treatment…"
              ariaLabel="Search claims"
            />
          }
        />

        <div className="mt-4 overflow-x-auto">
          <Segmented
            ariaLabel="Filter claims by status"
            value={status ?? null}
            onChange={setStatus}
            options={STATUS_TABS.map((t) => ({ value: t.value ?? null, label: t.label }))}
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
            icon={<ClipboardCheck size={19} />}
            title={claims.length === 0 ? "No claims in this queue" : "No claims match your search"}
            body={
              claims.length === 0
                ? "Nothing to decide here — claims filed by policyholders will appear in this queue."
                : `No results for “${search}”. Try a policy number or claimant name.`
            }
            actions={
              claims.length === 0 && status ? (
                <button
                  type="button"
                  onClick={() => setStatus(null)}
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  View all claims
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
                    <th className="px-5 py-3">Claimant</th>
                    <th className="px-5 py-3">Policy</th>
                    <th className="px-5 py-3">Treatment</th>
                    <th className="px-5 py-3">Filed</th>
                    <th className="px-5 py-3 text-right">Requested</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="group cursor-pointer transition-colors hover:bg-sky-50/40"
                      onClick={() => router.push(`/insurance-operator/claims/${c.id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-xs font-bold",
                              c.status === "submitted"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-sky-50 text-sky-700",
                            )}
                          >
                            {(claimantName(c) || "?").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                            {claimantName(c)}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{policyNumber(c)}</td>
                      <td className="px-5 py-3.5 text-sm capitalize text-slate-600">
                        {statusLabel(c.treatmentType)}
                      </td>
                      <td className="px-5 py-3.5 text-xs tabular-nums text-slate-400">
                        {c.createdAt ? formatDate(c.createdAt) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                        LKR {(c.amountRequestedLkr ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={STATUS_TONE[c.status] ?? "slate"}>{statusLabel(c.status)}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 opacity-0 transition-opacity group-hover:opacity-100">
                          Review <ChevronRight size={13} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile rail rows */}
            <ul className="mt-4 flex flex-col gap-2 lg:hidden">
              {filtered.map((c) => (
                <li key={c.id}>
                  <RailRow
                    tone={STATUS_TONE[c.status] ?? "slate"}
                    icon={<FileText size={15} />}
                    title={
                      <span className="flex items-center gap-2">
                        {claimantName(c)}
                        <Badge tone={STATUS_TONE[c.status] ?? "slate"}>{statusLabel(c.status)}</Badge>
                      </span>
                    }
                    meta={`${policyNumber(c)} · ${statusLabel(c.treatmentType)} · LKR ${(c.amountRequestedLkr ?? 0).toLocaleString()}`}
                    trailing={
                      <Link
                        href={`/insurance-operator/claims/${c.id}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        aria-label={`Review claim for ${claimantName(c)}`}
                      >
                        <ChevronRight size={15} />
                      </Link>
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

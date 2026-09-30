"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hash,
  Receipt,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { Pill } from "@/portal/components/ui/Pill";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { formatLkr } from "@/portal/lib/format";
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
  OrgTile,
  humanize,
  type DirectoryRow,
} from "@/portal/components/admin/AdminDirectory";
import {
  CLAIM_STATUSES,
  OPEN_CLAIM_STATUSES,
  claimTone,
  lkrCompact,
  useMktClaims,
  type MktClaim,
} from "@/portal/components/admin/insurance-mkt";

type Filter = "all" | (typeof CLAIM_STATUSES)[number];

export default function AdminInsuranceMarketplaceClaimsPage() {
  const [status, setStatus] = useState<Filter>("all");

  // Unfiltered list powers the stat strip + breakdown.
  const { data: allData, isLoading: allLoading } = useMktClaims();
  // The list itself is filtered server-side.
  const statusParam = status === "all" ? undefined : status;
  const { data, isLoading } = useQuery({
    queryKey: adminQk.insuranceMarketplaceClaims(statusParam),
    queryFn: () =>
      adminApi<{ claims: MktClaim[]; total: number }>(
        `/admin/insurance-mkt-claims${statusParam ? `?status=${statusParam}` : ""}`,
      ),
    enabled: status !== "all",
  });

  const all = useMemo(() => allData?.claims ?? [], [allData]);
  const list = status === "all" ? all : data?.claims ?? [];
  const count = (s: string) => all.filter((c) => c.status === s).length;
  const open = all.filter((c) => OPEN_CLAIM_STATUSES.has(c.status));
  const requestedOpen = open.reduce((a, c) => a + c.amountRequestedLkr, 0);
  const decided = all.filter((c) => ["approved", "paid", "rejected"].includes(c.status));
  const approvedCount = count("approved") + count("paid");
  const approvalRate = decided.length ? Math.round((approvedCount / decided.length) * 100) : null;
  const approvedTotal = all.reduce((a, c) => a + (c.amountApprovedLkr ?? 0), 0);
  const requestedDecided = all
    .filter((c) => c.amountApprovedLkr != null)
    .reduce((a, c) => a + c.amountRequestedLkr, 0);
  const payoutRatio = requestedDecided ? Math.round((approvedTotal / requestedDecided) * 100) : null;

  const pipeline = CLAIM_STATUSES.map((s) => ({ status: s, count: count(s) }));

  const rows: DirectoryRow[] = list.map((c) => {
    const tone = claimTone(c.status);
    return {
      id: c.id,
      name: c.patientName,
      href: `/admin/insurance-mkt/claims/${c.id}`,
      leading: <OrgTile icon={<Receipt size={17} />} tone="from-sky-500 to-blue-600 shadow-sky-500/30" />,
      accent: tone.rail,
      badges: <Pill tone={tone.pill}>{humanize(c.status)}</Pill>,
      meta: [
        { icon: <Building2 size={11} />, text: c.providerName },
        { icon: <Stethoscope size={11} />, text: humanize(c.treatmentType) },
        {
          icon: <Banknote size={11} />,
          text:
            c.amountApprovedLkr != null
              ? `${formatLkr(c.amountApprovedLkr)} of ${formatLkr(c.amountRequestedLkr)}`
              : `${formatLkr(c.amountRequestedLkr)} requested`,
        },
        ...(c.policyNumber ? [{ icon: <Hash size={11} />, text: c.policyNumber, mono: true, wide: true }] : []),
        ...(c.submittedAt ? [{ icon: <CalendarDays size={11} />, text: new Date(c.submittedAt).toLocaleDateString(), wide: true }] : []),
      ],
      searchText: [c.providerName, c.policyNumber, c.treatmentType].filter(Boolean).join(" "),
      linkLabel: "Details",
    };
  });

  return (
    <AdminDirectory<Filter>
      hero={
        <DoctorHero
          kickerIcon={<Receipt size={13} aria-hidden />}
          kicker="Insurance marketplace"
          kickerMeta={`${all.length} claim${all.length === 1 ? "" : "s"}`}
          title={
            <>
              Marketplace{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                claims
              </span>
            </>
          }
          description="Claims filed against marketplace policies. Insurers adjudicate them in their own portal — this view is for oversight."
          chips={
            <>
              <span className={HERO_CHIP}>
                <Clock size={12} className="text-amber-300" aria-hidden />
                {open.length} open · {lkrCompact(requestedOpen)} requested
              </span>
              {approvalRate != null ? (
                <span className={HERO_CHIP}>
                  <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                  {approvalRate}% approval rate
                </span>
              ) : null}
            </>
          }
          actions={
            <Link href="/admin/insurance-mkt/enrollments" className={HERO_GHOST}>
              <Receipt size={15} aria-hidden />
              Enrollments
            </Link>
          }
        />
      }
      stats={
        <>
          <StatTile label="Open claims" icon={<Clock size={16} />} tone="bg-amber-50 text-amber-600" value={allLoading ? "…" : String(open.length)} sub={`${count("more_info_needed")} need more info`} pulse={open.length > 0} active={status === "submitted"} onClick={() => setStatus("submitted")} />
          <StatTile label="Approved & paid" icon={<CheckCircle2 size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(approvedCount)} sub={`${count("paid")} paid out`} progress={approvalRate} active={status === "approved"} onClick={() => setStatus("approved")} />
          <StatTile label="Rejected" icon={<XCircle size={16} />} tone="bg-red-50 text-red-600" value={String(count("rejected"))} sub="Declined by insurer" active={status === "rejected"} onClick={() => setStatus("rejected")} />
          <StatTile label="Approved value" icon={<Banknote size={16} />} tone="bg-sky-50 text-sky-600" value={lkrCompact(approvedTotal)} sub={payoutRatio != null ? `${payoutRatio}% of amount requested` : "Nothing approved yet"} />
        </>
      }
      title="Claims ledger"
      icon={<Receipt size={16} />}
      rows={rows}
      total={status === "all" ? all.length : list.length}
      loading={status === "all" ? allLoading : isLoading}
      searchPlaceholder="Search policyholder, provider, policy or treatment…"
      segmented={{
        value: status,
        onChange: setStatus,
        options: [
          { value: "all", label: "All", count: all.length },
          ...CLAIM_STATUSES.map((s) => ({
            value: s,
            label: s === "more_info_needed" ? "More info" : s === "under_review" ? "Review" : humanize(s),
            count: count(s),
          })),
        ],
      }}
      empty={{
        icon: <Receipt size={19} />,
        title: "No claims",
        body: "Claims appear here when policyholders file them from the app.",
      }}
      aside={
        <section className={PANEL} aria-labelledby="clm-pipeline">
          <PanelHeader id="clm-pipeline" icon={<Receipt size={16} />} tone="bg-sky-50 text-sky-600" title="Claim pipeline" caption="Where every claim stands" />
          <ul className="mt-4 flex flex-col gap-0.5">
            {pipeline.map((p) => {
              const on = status === p.status;
              const tone = claimTone(p.status);
              return (
                <li key={p.status}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStatus(on ? "all" : p.status)}
                    className={
                      on
                        ? "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg bg-sky-50 px-2 py-2 text-left"
                        : "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50"
                    }
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.rail}`} aria-hidden />
                    <span className={on ? "min-w-0 flex-1 truncate text-[13px] font-semibold text-sky-800" : "min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700"}>
                      {humanize(p.status)}
                    </span>
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <span className={`block h-full rounded-full ${tone.rail}`} style={{ width: `${all.length ? (p.count / all.length) * 100 : 0}%` }} />
                    </span>
                    <span className="min-w-[24px] text-right text-[12px] font-semibold tabular-nums text-slate-600">{p.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      }
    />
  );
}

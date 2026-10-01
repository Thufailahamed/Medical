"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck,
  FileText,
  Plus,
  Receipt,
  ShieldCheck,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDate, formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  RowAccent,
  Segmented,
  StatTile,
  TONE_RAIL,
  type Tone,
} from "@/patient/components/workspace";

interface Claim {
  id: string;
  claimNumber: string | null;
  status: string;
  treatmentType: string;
  amountRequestedLkr: number;
  amountApprovedLkr?: number | null;
  providerName: string | null;
  createdAt: string;
}

const CLAIM_TONE: Record<string, Tone> = {
  submitted: "sky",
  under_review: "amber",
  more_info_needed: "amber",
  approved: "emerald",
  paid: "emerald",
  rejected: "rose",
};

const CLAIM_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  more_info_needed: "Action needed",
  approved: "Approved",
  paid: "Paid & settled",
  rejected: "Rejected",
};

const CLAIM_ICON: Record<string, React.ElementType> = {
  submitted: FileText,
  under_review: Clock,
  more_info_needed: AlertTriangle,
  approved: CheckCircle2,
  paid: CheckCircle2,
  rejected: AlertCircle,
};

export default function ClaimsListPage() {
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["insurance", "claims", "me"],
    queryFn: () => api<{ claims: Claim[] }>("/insurance-marketplace/claims/me"),
  });

  const rawClaims = useMemo(() => q.data?.claims ?? [], [q.data?.claims]);

  const { pendingCount, approvedCount, rejectedCount } = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const c of rawClaims) {
      if (["submitted", "under_review", "more_info_needed"].includes(c.status)) pending++;
      else if (["approved", "paid"].includes(c.status)) approved++;
      else if (c.status === "rejected") rejected++;
    }
    return { pendingCount: pending, approvedCount: approved, rejectedCount: rejected };
  }, [rawClaims]);

  const filteredClaims = useMemo(() => {
    let list = rawClaims;
    if (activeTab === "pending") {
      list = list.filter((c) => ["submitted", "under_review", "more_info_needed"].includes(c.status));
    } else if (activeTab === "approved") {
      list = list.filter((c) => ["approved", "paid"].includes(c.status));
    } else if (activeTab === "rejected") {
      list = list.filter((c) => c.status === "rejected");
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.claimNumber || "").toLowerCase().includes(term) ||
          (c.providerName || "").toLowerCase().includes(term) ||
          (c.treatmentType || "").toLowerCase().includes(term),
      );
    }
    return list;
  }, [rawClaims, activeTab, search]);

  const claimedTotal = useMemo(
    () => rawClaims.reduce((s, c) => s + (c.amountRequestedLkr || 0), 0),
    [rawClaims],
  );
  const paidTotal = useMemo(
    () =>
      rawClaims
        .filter((c) => ["approved", "paid"].includes(c.status))
        .reduce((s, c) => s + (c.amountApprovedLkr ?? c.amountRequestedLkr ?? 0), 0),
    [rawClaims],
  );

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<Receipt size={13} aria-hidden />}
        kicker="Insurance"
        kickerMeta="Reimbursements"
        title={
          <>
            Claims &amp; <HeroAccent>settlements</HeroAccent>
          </>
        }
        description="Submit out-of-pocket medical bills, track underwriter assessments, and receive direct bank reimbursements."
        chips={
          <>
            <span className={HERO_CHIP}>{rawClaims.length} claims</span>
            <span className={HERO_CHIP}>
              <Clock size={12} className="text-amber-300" />
              {pendingCount} pending
            </span>
            <span className={HERO_CHIP}>
              <CheckCircle2 size={12} className="text-emerald-300" />
              {formatLkr(paidTotal)} settled
            </span>
            <span className={HERO_CHIP}>Turnaround · 48–72h</span>
          </>
        }
        actions={
          <>
            <Link href="/patient/insurance/coverage-check" className={HERO_GHOST}>
              <Activity size={13} /> Coverage check
            </Link>
            <Link href="/patient/insurance/claims/new" className={HERO_PRIMARY}>
              <Plus size={14} className="text-sky-600" /> File new claim
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Receipt size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="All claims"
          value={String(rawClaims.length)}
          sub={formatLkr(claimedTotal)}
          active={activeTab === "all"}
          onClick={() => setActiveTab("all")}
        />
        <StatTile
          icon={<Clock size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Under review"
          value={String(pendingCount)}
          sub="Awaiting underwriter"
          pulse={pendingCount > 0}
          active={activeTab === "pending"}
          onClick={() => setActiveTab("pending")}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Approved"
          value={String(approvedCount)}
          sub={formatLkr(paidTotal)}
          active={activeTab === "approved"}
          onClick={() => setActiveTab("approved")}
        />
        <StatTile
          icon={<AlertCircle size={16} />}
          tone="bg-rose-50 text-rose-600"
          label="Declined"
          value={String(rejectedCount)}
          sub="Not covered"
          active={activeTab === "rejected"}
          onClick={() => setActiveTab("rejected")}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<Receipt size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Claim history"
              caption={`${filteredClaims.length} claim${filteredClaims.length === 1 ? "" : "s"}`}
              action={
                <Link
                  href="/patient/insurance/claims/new"
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white transition hover:bg-sky-500"
                >
                  <Plus size={13} /> New claim
                </Link>
              }
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Segmented
                ariaLabel="Claim status filter"
                options={[
                  { value: "all", label: `All (${rawClaims.length})` },
                  { value: "pending", label: `Review (${pendingCount})` },
                  { value: "approved", label: `Approved (${approvedCount})` },
                  ...(rejectedCount > 0
                    ? [{ value: "rejected", label: `Declined (${rejectedCount})` }]
                    : []),
                ]}
                value={activeTab}
                onChange={(v) => setActiveTab(v as typeof activeTab)}
              />
              <PanelSearch
                value={search}
                onChange={setSearch}
                placeholder="Search claim #, provider, or treatment…"
                className="flex-1 sm:max-w-xs"
              />
            </div>

            {q.isLoading ? (
              <div className="mt-4 flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : filteredClaims.length === 0 ? (
              <EmptyBlock
                icon={<Receipt size={19} />}
                title={search ? "No claims match your search" : "No claims submitted yet"}
                body={
                  search
                    ? `No claims found matching "${search}". Clear your search or filter.`
                    : "Paid out-of-pocket for hospitalization, scans, or medications? File a claim online in 3 steps."
                }
                actions={
                  !search ? (
                    <Link
                      href="/patient/insurance/claims/new"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500"
                    >
                      <Plus size={14} /> Submit claim
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {filteredClaims.map((c) => {
                  const tone = CLAIM_TONE[c.status] ?? "sky";
                  const StatusIcon = CLAIM_ICON[c.status] ?? FileText;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/patient/insurance/claims/${c.id}`}
                        className={cn(LIST_ROW, "group")}
                      >
                        <RowAccent className={TONE_RAIL[tone]} />
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 transition-transform group-hover:scale-105">
                          <Receipt size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-sky-700 sm:text-base">
                              {c.claimNumber ?? `Claim #${c.id.slice(0, 8)}`}
                            </h3>
                            <ClaimStatusBadge status={c.status} tone={tone} icon={StatusIcon} />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-medium text-slate-500">
                            {c.providerName ? (
                              <>
                                <span className="font-semibold text-slate-700">{c.providerName}</span>
                                <span>·</span>
                              </>
                            ) : null}
                            <span className="capitalize">{c.treatmentType.replace(/_/g, " ")}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <Calendar size={12} /> {formatDate(c.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <div className="text-left sm:text-right">
                            <div className="text-sm font-extrabold text-slate-900 sm:text-base">
                              {formatLkr(c.amountRequestedLkr)}
                            </div>
                            {c.amountApprovedLkr != null ? (
                              <div className="text-xs font-bold text-emerald-700">
                                {formatLkr(c.amountApprovedLkr)} approved
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400">Claimed amount</div>
                            )}
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600"
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<FileCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Settlement checklist"
              caption="Documents that speed up approval."
            />
            <ul className="mt-4 space-y-2.5">
              {[
                { t: "Original invoices", d: "Itemized hospital & pharmacy bills." },
                { t: "Discharge summary", d: "Admission, diagnosis & treatment record." },
                { t: "Doctor prescriptions", d: "Matching billed meds and tests." },
                { t: "Bank details", d: "Name, branch code & account for payout." },
              ].map((item) => (
                <li
                  key={item.t}
                  className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                >
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.t}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{item.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <QuickToolsPanel
            id="claims-tools"
            title="Insurance"
            tools={[
              {
                icon: ShieldCheck,
                label: "Policies",
                hint: "My cover",
                href: "/patient/insurance",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: Activity,
                label: "Coverage check",
                hint: "Eligibility",
                href: "/patient/insurance/coverage-check",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: Receipt,
                label: "Marketplace",
                hint: "More plans",
                href: "/patient/insurance/marketplace",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}

function ClaimStatusBadge({
  status,
  tone,
  icon: Icon,
}: {
  status: string;
  tone: Tone;
  icon: React.ElementType;
}) {
  const cls: Record<Tone, string> = {
    sky: "bg-sky-50 text-sky-700 border-sky-200/80",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    amber: "bg-amber-50 text-amber-800 border-amber-200/80",
    rose: "bg-rose-50 text-rose-700 border-rose-200/80",
    violet: "bg-violet-50 text-violet-700 border-violet-200/80",
    slate: "bg-slate-50 text-slate-700 border-slate-200/80",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
        cls[tone],
      )}
    >
      <Icon size={11} />
      <span>{CLAIM_LABEL[status] ?? status.replace(/_/g, " ")}</span>
    </span>
  );
}

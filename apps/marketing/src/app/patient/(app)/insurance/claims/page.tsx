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
  Search,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDate, formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

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

function claimStatusBadge(status: string) {
  switch (status) {
    case "paid":
    case "approved":
      return {
        label: status === "paid" ? "Paid & Settled" : "Approved",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
        icon: CheckCircle2,
      };
    case "under_review":
      return {
        label: "Under Review",
        className: "bg-amber-50 text-amber-800 border-amber-200/80",
        icon: Clock,
      };
    case "more_info_needed":
      return {
        label: "Action Needed",
        className: "bg-orange-50 text-orange-800 border-orange-200/80",
        icon: AlertTriangle,
      };
    case "rejected":
      return {
        label: "Rejected",
        className: "bg-rose-50 text-rose-700 border-rose-200/80",
        icon: AlertCircle,
      };
    case "submitted":
    default:
      return {
        label: "Submitted",
        className: "bg-brand-soft text-brand border-brand/25",
        icon: FileText,
      };
  }
}

export default function ClaimsListPage() {
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["insurance", "claims", "me"],
    queryFn: () =>
      api<{ claims: Claim[] }>("/insurance-marketplace/claims/me"),
  });

  const rawClaims = q.data?.claims ?? [];

  const { pendingCount, approvedCount, rejectedCount } = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const c of rawClaims) {
      if (["submitted", "under_review", "more_info_needed"].includes(c.status)) {
        pending++;
      } else if (["approved", "paid"].includes(c.status)) {
        approved++;
      } else if (c.status === "rejected") {
        rejected++;
      }
    }

    return { pendingCount: pending, approvedCount: approved, rejectedCount: rejected };
  }, [rawClaims]);

  const filteredClaims = useMemo(() => {
    let list = rawClaims;
    if (activeTab === "pending") {
      list = list.filter((c) =>
        ["submitted", "under_review", "more_info_needed"].includes(c.status),
      );
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

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<ShieldCheck size={13} />}
        kicker="Reimbursements & Claims Management"
        title="My Insurance Claims & Settlements"
        description="Submit out-of-pocket medical bills, track underwriter assessments, and receive direct bank reimbursement settlements in real time."
        actions={
          <>
            <Link href="/patient/insurance/coverage-check" className={heroSecondaryAction}>
              <Activity size={13} />
              <span>Coverage Check</span>
            </Link>
            <Link href="/patient/insurance/claims/new" className={heroPrimaryAction}>
              <Plus size={14} />
              <span>File New Claim</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>{rawClaims.length} total claims</span>
            <span>{pendingCount} pending</span>
            <span>{approvedCount} approved & paid</span>
            <span>Turnaround · 48-72 hours</span>
          </>
        }
      />

      {/* ── 2. Filter & Search Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-2xl border border-border shadow-xs">
        {/* Segmented Status Tabs */}
        <div className="inline-flex p-1 bg-surface-2 rounded-xl shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0",
              activeTab === "all"
                ? "bg-surface text-brand shadow-xs"
                : "text-text-soft hover:text-text",
            )}
          >
            All ({rawClaims.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0",
              activeTab === "pending"
                ? "bg-surface text-brand shadow-xs"
                : "text-text-soft hover:text-text",
            )}
          >
            Under Review ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0",
              activeTab === "approved"
                ? "bg-surface text-brand shadow-xs"
                : "text-text-soft hover:text-text",
            )}
          >
            Approved ({approvedCount})
          </button>
          {rejectedCount > 0 ? (
            <button
              type="button"
              onClick={() => setActiveTab("rejected")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0",
                activeTab === "rejected"
                  ? "bg-surface text-brand shadow-xs"
                  : "text-text-soft hover:text-text",
              )}
            >
              Declined ({rejectedCount})
            </button>
          ) : null}
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search claim #, provider, or treatment..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-surface-2 border border-border rounded-xl font-medium text-text placeholder:text-text-muted focus:bg-surface focus:outline-none focus:ring-1 focus:ring-brand transition-all"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-soft"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 3. Claims List or Zero-State Onboarding ───────────────────────── */}
      <section className="flex flex-col gap-4">
        {q.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-xs flex flex-col gap-6">
            {/* Header banner */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="h-14 w-14 rounded-2xl bg-brand-soft border-border flex items-center justify-center text-brand shrink-0 shadow-2xs">
                <Receipt size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-text">
                  {search
                    ? "No claims match your search query"
                    : "No Medical Reimbursement Claims Submitted Yet"}
                </h3>
                <p className="text-xs sm:text-sm text-text-soft mt-1 max-w-xl leading-relaxed">
                  {search
                    ? `No claims found matching "${search}". Clear your search or filter.`
                    : "Paid out-of-pocket for hospitalization, surgery, diagnostic scans, or medications? Claim your reimbursement online in 3 simple steps:"}
                </p>
              </div>

              {!search ? (
                <Link
                  href="/patient/insurance/claims/new"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all shrink-0 flex items-center gap-1.5"
                  style={{
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  }}
                >
                  <Plus size={14} />
                  <span>Submit Claim</span>
                </Link>
              ) : null}
            </div>

            {/* 3 Step Process Guide */}
            {!search ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
                <div className="p-4 rounded-xl bg-surface-2/80 border border-border flex flex-col gap-2">
                  <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center font-black text-xs">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-text">
                    Collect Receipts &amp; Reports
                  </h4>
                  <p className="text-[11px] text-text-soft leading-relaxed">
                    Have your itemized hospital invoice, pharmacy bill, doctor prescription, and discharge summary ready.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface-2/80 border border-border flex flex-col gap-2">
                  <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center font-black text-xs">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-text">
                    Upload &amp; File Online
                  </h4>
                  <p className="text-[11px] text-text-soft leading-relaxed">
                    Complete our fast 2-minute digital claim form. Snap photos or upload PDFs directly from your phone.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface-2/80 border border-border flex flex-col gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-text">
                    Direct Bank Reimbursement
                  </h4>
                  <p className="text-[11px] text-text-soft leading-relaxed">
                    Once underwriter reviews and approves the claim, approved funds are wired directly into your bank account.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredClaims.map((c) => {
              const badge = claimStatusBadge(c.status);
              const BadgeIcon = badge.icon;

              return (
                <Link
                  key={c.id}
                  href={`/patient/insurance/claims/${c.id}`}
                  className="group rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-border-strong transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-brand-soft border-border text-brand flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      <Receipt size={20} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-text text-sm sm:text-base group-hover:text-brand transition-colors truncate">
                          {c.claimNumber ?? `Claim #${c.id.slice(0, 8)}`}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                            badge.className,
                          )}
                        >
                          <BadgeIcon size={11} />
                          <span>{badge.label}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-xs text-text-soft font-medium">
                        {c.providerName ? (
                          <span className="text-text font-semibold">
                            {c.providerName}
                          </span>
                        ) : null}
                        {c.providerName ? <span>·</span> : null}
                        <span className="capitalize">
                          {c.treatmentType.replace(/_/g, " ")}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          <Calendar size={12} />
                          {formatDate(c.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Status Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-border shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-sm sm:text-base font-extrabold text-text">
                        {formatLkr(c.amountRequestedLkr)}
                      </div>
                      {c.amountApprovedLkr != null ? (
                        <div className="text-xs font-bold text-emerald-700">
                          {formatLkr(c.amountApprovedLkr)} approved
                        </div>
                      ) : (
                        <div className="text-[11px] text-text-muted">
                          Claimed amount
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-brand bg-brand-soft px-3 py-1.5 rounded-xl group-hover:bg-surface-3 transition-colors">
                      <span>Details</span>
                      <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Required Claim Documents Checklist ──────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs flex flex-col gap-3">
        <h3 className="text-sm font-bold text-text flex items-center gap-2">
          <FileCheck size={16} className="text-brand" />
          <span>Checklist for Fast Claim Settlement</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-text-soft">
          <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-text">Original Invoices</p>
              <p className="text-[11px] text-text-soft mt-0.5">
                Itemized bills showing hospital and pharmacy breakdown.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-text">Discharge Summary</p>
              <p className="text-[11px] text-text-soft mt-0.5">
                Clinical summary detailing admission, diagnosis &amp; treatment.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-text">Doctor Prescriptions</p>
              <p className="text-[11px] text-text-soft mt-0.5">
                Prescriptions matching medications and tests billed.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-text">Bank Details</p>
              <p className="text-[11px] text-text-soft mt-0.5">
                Bank name, branch code, and account number for direct wire.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
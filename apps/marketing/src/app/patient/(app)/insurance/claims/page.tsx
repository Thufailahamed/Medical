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
        className: "bg-sky-50 text-sky-700 border-sky-200/80",
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
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <ShieldCheck size={12} className="text-sky-300" />
                Reimbursements &amp; Claims Management
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                My Insurance Claims &amp; Settlements
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Submit out-of-pocket medical bills, track underwriter assessments, and receive direct bank reimbursement settlements in real time.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/insurance/coverage-check"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Activity size={13} />
                <span>Coverage Check</span>
              </Link>
              <Link
                href="/patient/insurance/claims/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <Plus size={14} className="text-sky-700" />
                <span>File New Claim</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "all"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Total Claims
                </p>
                <p className="text-base font-extrabold text-white">
                  {rawClaims.length}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "pending"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Under Review
                </p>
                <p className="text-base font-extrabold text-white">
                  {pendingCount}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("approved")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "approved"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-emerald-200 truncate">
                  Approved &amp; Paid
                </p>
                <p className="text-base font-extrabold text-white">
                  {approvedCount}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Turnaround
                </p>
                <p className="text-base font-extrabold text-white">48-72 Hours</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Filter & Search Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Segmented Status Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0",
              activeTab === "all"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
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
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
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
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
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
                  ? "bg-white text-sky-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900",
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
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search claim #, provider, or treatment..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className="h-24 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col gap-6">
            {/* Header banner */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="h-14 w-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0 shadow-2xs">
                <Receipt size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {search
                    ? "No claims match your search query"
                    : "No Medical Reimbursement Claims Submitted Yet"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col gap-2">
                  <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-black text-xs">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Collect Receipts &amp; Reports
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Have your itemized hospital invoice, pharmacy bill, doctor prescription, and discharge summary ready.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col gap-2">
                  <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-black text-xs">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Upload &amp; File Online
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Complete our fast 2-minute digital claim form. Snap photos or upload PDFs directly from your phone.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Direct Bank Reimbursement
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
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
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      <Receipt size={20} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-sky-700 transition-colors truncate">
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

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-xs text-slate-500 font-medium">
                        {c.providerName ? (
                          <span className="text-slate-800 font-semibold">
                            {c.providerName}
                          </span>
                        ) : null}
                        {c.providerName ? <span>·</span> : null}
                        <span className="capitalize">
                          {c.treatmentType.replace(/_/g, " ")}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Calendar size={12} />
                          {formatDate(c.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Status Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-sm sm:text-base font-extrabold text-slate-900">
                        {formatLkr(c.amountRequestedLkr)}
                      </div>
                      {c.amountApprovedLkr != null ? (
                        <div className="text-xs font-bold text-emerald-700">
                          {formatLkr(c.amountApprovedLkr)} approved
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400">
                          Claimed amount
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl group-hover:bg-sky-100 transition-colors">
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
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col gap-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FileCheck size={16} className="text-sky-600" />
          <span>Checklist for Fast Claim Settlement</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Original Invoices</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Itemized bills showing hospital and pharmacy breakdown.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Discharge Summary</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Clinical summary detailing admission, diagnosis &amp; treatment.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Doctor Prescriptions</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Prescriptions matching medications and tests billed.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Bank Details</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Bank name, branch code, and account number for direct wire.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
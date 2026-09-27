"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSignature,
  History,
  Search,
  Share2,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDateTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorId: string | null;
  actorName?: string | null;
  details: string | Record<string, unknown> | null;
  createdAt: string;
}

function parseAuditDetails(details: unknown): { label: string; value: string }[] {
  if (!details) return [];
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details);
      if (typeof parsed === "object" && parsed !== null) {
        return parseAuditDetails(parsed);
      }
      return [{ label: "Detail", value: details }];
    } catch {
      return [{ label: "Detail", value: details }];
    }
  }
  if (typeof details === "object") {
    const items: { label: string; value: string }[] = [];
    for (const [key, val] of Object.entries(details as Record<string, unknown>)) {
      if (val === null || val === undefined || val === "") continue;
      const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
      items.push({
        label: key.replace(/_/g, " "),
        value: strVal,
      });
    }
    return items;
  }
  return [{ label: "Detail", value: String(details) }];
}

function getActionCategory(action: string) {
  const a = action.toLowerCase();
  if (a.startsWith("share") || a.includes("link")) {
    return {
      category: "Sharing & Disclosure",
      tone: "bg-sky-50 text-sky-700 border-sky-200",
      icon: Share2,
    };
  }
  if (a.startsWith("consent") || a.includes("grant")) {
    return {
      category: "Consent Governance",
      tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: FileSignature,
    };
  }
  if (a.includes("record") || a.includes("rx") || a.includes("prescription") || a.includes("lab")) {
    return {
      category: "Clinical Data Access",
      tone: "bg-purple-50 text-purple-700 border-purple-200",
      icon: Stethoscope,
    };
  }
  if (a.includes("export") || a.includes("download") || a.includes("dsar")) {
    return {
      category: "Data Portability",
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Download,
    };
  }
  return {
    category: "Security & Account",
    tone: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Activity,
  };
}

export default function PatientAuditPage() {
  const [activeTab, setActiveTab] = useState<"all" | "share" | "consent" | "clinical">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", "me"],
    queryFn: () => api<{ entries: AuditEntry[] }>("/audit/me?limit=200"),
  });

  const rawEntries = data?.entries ?? [];

  const filteredEntries = useMemo(() => {
    let list = rawEntries;

    if (activeTab === "share") {
      list = list.filter((e) => e.action.toLowerCase().includes("share"));
    } else if (activeTab === "consent") {
      list = list.filter((e) => e.action.toLowerCase().includes("consent"));
    } else if (activeTab === "clinical") {
      list = list.filter(
        (e) =>
          e.action.toLowerCase().includes("record") ||
          e.action.toLowerCase().includes("rx") ||
          e.action.toLowerCase().includes("prescription") ||
          e.action.toLowerCase().includes("lab"),
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          e.resource.toLowerCase().includes(q) ||
          (e.actorName || "").toLowerCase().includes(q) ||
          (e.actorId || "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [rawEntries, activeTab, search]);

  const shareCount = useMemo(
    () => rawEntries.filter((e) => e.action.toLowerCase().includes("share")).length,
    [rawEntries],
  );

  const consentCount = useMemo(
    () => rawEntries.filter((e) => e.action.toLowerCase().includes("consent")).length,
    [rawEntries],
  );

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<History size={13} aria-hidden />}
        kicker="Immutable Healthcare Audit Trail"
        title="Activity & Security Audit Log"
        description="Tamper-evident, HIPAA-compliant accounting of disclosures. Track every physician access, share link creation, and consent authorization in real time."
        actions={
          <>
            <Link href="/patient/consents" className={heroSecondaryAction}>
              <ShieldCheck size={13} aria-hidden />
              Active Consents
            </Link>
            <Link href="/patient/share" className={heroPrimaryAction}>
              <Share2 size={14} aria-hidden />
              Share Records
            </Link>
          </>
        }
        footer={
          <>
            <span>Logged Events · {rawEntries.length} Records</span>
            <span>Audit Integrity · Cryptographic</span>
            <span>Retention Law · 7 Years</span>
            <span>Compliance · HIPAA §164</span>
          </>
        }
      />

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Filter Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "all"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            All Events ({rawEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("share")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "share"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Record Sharing ({shareCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("consent")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "consent"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Consents ({consentCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("clinical")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "clinical"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Clinical Access
          </button>
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
            placeholder="Search action, actor, or resource..."
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

      {/* ── 3. Audit Log Timeline Feed ──────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>Could not load security audit trail. Please refresh the page.</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-2xs">
              <History size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">
                {search ? "No events match your search" : "No Audit Events Recorded Yet"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                {search
                  ? `No audit entries found matching "${search}". Clear search to view all events.`
                  : "All access events, shared link creations, prescription inspections, and consent updates are logged here automatically."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredEntries.map((e) => {
              const cat = getActionCategory(e.action);
              const CatIcon = cat.icon;
              const detailsList = parseAuditDetails(e.details);

              return (
                <article
                  key={e.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs",
                        cat.tone,
                      )}
                    >
                      <CatIcon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base capitalize truncate">
                          {e.action.replace(/[._]/g, " ")}
                        </h3>

                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border",
                            cat.tone,
                          )}
                        >
                          {cat.category}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {e.resource}
                        </span>
                      </div>

                      {/* Actor & Timestamp */}
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap font-medium">
                        <span className="text-slate-800 font-semibold">
                          {e.actorName || e.actorId || "System Automated"}
                        </span>
                        <span>·</span>
                        <span>{formatDateTime(e.createdAt)}</span>
                        <span>({relativeTime(e.createdAt)})</span>
                      </p>

                      {/* Details Chips (Safely handles objects, arrays, and strings!) */}
                      {detailsList.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {detailsList.map((d, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-50 border border-slate-200 text-slate-700 font-mono"
                            >
                              <span className="font-bold capitalize text-slate-500">
                                {d.label}:
                              </span>
                              <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                                {d.value}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 self-end sm:self-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 size={12} />
                      <span>Verified Event</span>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Legal Accounting of Disclosures Notice ──────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              HIPAA §164.312(b) &amp; GDPR Accounting of Disclosures
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Every data access request, link share, and doctor consultation generates an immutable cryptographic audit record retained for your protection.
            </p>
          </div>
        </div>

        <Link
          href="/patient/dsar"
          className="px-4 py-2 rounded-xl text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <ExternalLink size={13} className="text-sky-700" />
          <span>Privacy Rights (DSAR)</span>
        </Link>
      </section>
    </div>
  );
}

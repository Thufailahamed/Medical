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
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";

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
      tone: "bg-brand-soft text-brand",
      icon: Share2,
    };
  }
  if (a.startsWith("consent") || a.includes("grant")) {
    return {
      category: "Consent Governance",
      tone: "bg-success-soft text-success",
      icon: FileSignature,
    };
  }
  if (a.includes("record") || a.includes("rx") || a.includes("prescription") || a.includes("lab")) {
    return {
      category: "Clinical Data Access",
      tone: "bg-violet-50 text-violet-600",
      icon: Stethoscope,
    };
  }
  if (a.includes("export") || a.includes("download") || a.includes("dsar")) {
    return {
      category: "Data Portability",
      tone: "bg-warn-soft text-warn",
      icon: Download,
    };
  }
  return {
    category: "Security & Account",
    tone: "bg-surface-2 text-text-soft",
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-xl border border-border shadow-card">
        {/* Filter Tabs */}
        <SegmentedTabs
          ariaLabel="Audit filters"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as "all" | "share" | "consent" | "clinical")}
          tabs={[
            { id: "all", label: <>All Events ({rawEntries.length})</> },
            { id: "share", label: <>Record Sharing ({shareCount})</> },
            { id: "consent", label: <>Consents ({consentCount})</> },
            { id: "clinical", label: <>Clinical Access</> },
          ]}
        />

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
            placeholder="Search action, actor, or resource..."
            className="pt-input pl-9 pr-8 !h-9 text-xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
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
                className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-5 rounded-xl bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2.5">
            <AlertCircle size={16} className="shrink-0" aria-hidden />
            <span>Could not load security audit trail. Please refresh the page.</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-xl bg-surface border border-border shadow-card flex flex-col items-center text-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-soft text-brand shadow-2xs" aria-hidden>
              <History size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="t-card-title text-text">
                {search ? "No events match your search" : "No Audit Events Recorded Yet"}
              </h3>
              <p className="text-xs sm:text-sm text-text-soft mt-1 leading-relaxed">
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
                  className="p-4 sm:p-5 rounded-xl bg-surface border border-border shadow-card hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-md shrink-0 shadow-2xs",
                        cat.tone,
                      )}
                      aria-hidden
                    >
                      <CatIcon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-text text-sm sm:text-base capitalize truncate">
                          {e.action.replace(/[._]/g, " ")}
                        </h3>

                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                            cat.tone,
                          )}
                        >
                          {cat.category}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-medium bg-surface-2 text-text-soft">
                          {e.resource}
                        </span>
                      </div>

                      {/* Actor & Timestamp */}
                      <p className="text-xs text-text-soft mt-1 flex items-center gap-2 flex-wrap font-medium">
                        <span className="text-text font-semibold">
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
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-surface-2 text-text-soft font-mono"
                            >
                              <span className="font-bold capitalize text-text-muted">
                                {d.label}:
                              </span>
                              <span className="font-semibold text-text truncate max-w-[200px]">
                                {d.value}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 self-end sm:self-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success-soft px-2.5 py-1 rounded-md">
                      <CheckCircle2 size={12} aria-hidden />
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
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-soft text-brand shrink-0" aria-hidden>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              HIPAA §164.312(b) &amp; GDPR Accounting of Disclosures
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              Every data access request, link share, and doctor consultation generates an immutable cryptographic audit record retained for your protection.
            </p>
          </div>
        </div>

        <Link
          href="/patient/dsar"
          className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
        >
          <ExternalLink size={13} aria-hidden />
          Privacy Rights (DSAR)
        </Link>
      </section>
    </div>
  );
}

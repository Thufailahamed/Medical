"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Download,
  FileSignature,
  History,
  Scale,
  Share2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDateTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

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
    return { category: "Sharing & Disclosure", tone: "bg-sky-50 text-sky-700", icon: Share2 };
  }
  if (a.startsWith("consent") || a.includes("grant")) {
    return { category: "Consent Governance", tone: "bg-emerald-50 text-emerald-700", icon: FileSignature };
  }
  if (a.includes("record") || a.includes("rx") || a.includes("prescription") || a.includes("lab")) {
    return { category: "Clinical Data Access", tone: "bg-violet-50 text-violet-700", icon: Stethoscope };
  }
  if (a.includes("export") || a.includes("download") || a.includes("dsar")) {
    return { category: "Data Portability", tone: "bg-amber-50 text-amber-700", icon: Download };
  }
  return { category: "Security & Account", tone: "bg-slate-100 text-slate-500", icon: Activity };
}

type AuditTab = "all" | "share" | "consent" | "clinical";

export default function PatientAuditPage() {
  const [activeTab, setActiveTab] = useState<AuditTab>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit", "me"],
    queryFn: () => api<{ entries: AuditEntry[] }>("/audit/me?limit=200"),
  });

  const rawEntries = useMemo(() => data?.entries ?? [], [data?.entries]);

  const filteredEntries = useMemo(() => {
    let list = rawEntries;

    if (activeTab === "share") {
      list = list.filter((e) => e.action.toLowerCase().includes("share"));
    } else if (activeTab === "consent") {
      list = list.filter((e) => e.action.toLowerCase().includes("consent"));
    } else if (activeTab === "clinical") {
      list = list.filter((e) => {
        const a = e.action.toLowerCase();
        return (
          a.includes("record") ||
          a.includes("rx") ||
          a.includes("prescription") ||
          a.includes("lab")
        );
      });
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
  const clinicalCount = useMemo(
    () =>
      rawEntries.filter((e) => {
        const a = e.action.toLowerCase();
        return (
          a.includes("record") ||
          a.includes("rx") ||
          a.includes("prescription") ||
          a.includes("lab")
        );
      }).length,
    [rawEntries],
  );

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<History size={13} aria-hidden />}
        kicker="Security"
        kickerMeta="Audit trail"
        title={
          <>
            Activity &amp; <HeroAccent>security audit</HeroAccent>
          </>
        }
        description="Tamper-evident, HIPAA-compliant accounting of disclosures — every physician access, share link creation, and consent authorization in real time."
        chips={
          <>
            <span className={HERO_CHIP}>
              <History size={12} className="text-sky-300" />
              {rawEntries.length} events
            </span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              Cryptographic integrity
            </span>
            <span className={HERO_CHIP}>HIPAA §164 · 7y retention</span>
          </>
        }
        actions={
          <>
            <Link href="/patient/consents" className={HERO_GHOST}>
              <ShieldCheck size={13} /> Consents
            </Link>
            <Link href="/patient/share" className={HERO_PRIMARY}>
              <Share2 size={14} className="text-sky-600" /> Share records
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<History size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Logged events"
          value={String(rawEntries.length)}
          sub="Immutable records"
        />
        <StatTile
          icon={<Share2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Sharing events"
          value={String(shareCount)}
          sub="Links created / viewed"
          onClick={() => setActiveTab("share")}
          active={activeTab === "share"}
        />
        <StatTile
          icon={<FileSignature size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Consent events"
          value={String(consentCount)}
          sub="Grants & revocations"
          onClick={() => setActiveTab("consent")}
          active={activeTab === "consent"}
        />
        <StatTile
          icon={<Stethoscope size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Clinical access"
          value={String(clinicalCount)}
          sub="Record inspections"
          onClick={() => setActiveTab("clinical")}
          active={activeTab === "clinical"}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<History size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Audit log"
              caption={`${filteredEntries.length} of ${rawEntries.length} events`}
              action={
                <Segmented<AuditTab>
                  ariaLabel="Audit filters"
                  options={[
                    { value: "all", label: "All", count: rawEntries.length },
                    { value: "share", label: "Sharing", count: shareCount },
                    { value: "consent", label: "Consents", count: consentCount },
                    { value: "clinical", label: "Clinical", count: clinicalCount },
                  ]}
                  value={activeTab}
                  onChange={setActiveTab}
                />
              }
            />
            <div className="mt-4">
              <PanelSearch
                value={search}
                onChange={setSearch}
                placeholder="Search action, actor, or resource…"
              />
            </div>

            {isLoading ? (
              <PanelSkeleton rows={3} />
            ) : error ? (
              <PanelError
                message="Could not load the security audit trail. Please try again."
                onRetry={() => refetch()}
              />
            ) : filteredEntries.length === 0 ? (
              <EmptyBlock
                icon={<History size={19} />}
                title={search ? "No events match your search" : "No audit events yet"}
                body={
                  search
                    ? `No audit entries found matching "${search}". Clear search to view all events.`
                    : "All access events, shared link creations, prescription inspections, and consent updates are logged here automatically."
                }
              />
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {filteredEntries.map((e) => {
                  const cat = getActionCategory(e.action);
                  const CatIcon = cat.icon;
                  const detailsList = parseAuditDetails(e.details);

                  return (
                    <article
                      key={e.id}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-slate-200 hover:shadow-md sm:flex-row sm:items-center sm:p-5"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        <div
                          className={cn(
                            "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                            cat.tone,
                          )}
                          aria-hidden
                        >
                          <CatIcon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-bold capitalize text-slate-900 sm:text-base">
                              {e.action.replace(/[._]/g, " ")}
                            </h3>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                cat.tone,
                              )}
                            >
                              {cat.category}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-medium text-slate-500">
                              {e.resource}
                            </span>
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                            <span className="font-semibold text-slate-900">
                              {e.actorName || e.actorId || "System automated"}
                            </span>
                            <span>·</span>
                            <span>{formatDateTime(e.createdAt)}</span>
                            <span>({relativeTime(e.createdAt)})</span>
                          </p>
                          {detailsList.length > 0 ? (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {detailsList.map((d, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-500"
                                >
                                  <span className="font-bold capitalize text-slate-400">
                                    {d.label}:
                                  </span>
                                  <span className="max-w-[200px] truncate font-semibold text-slate-700">
                                    {d.value}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="shrink-0 self-end sm:self-center">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 size={12} aria-hidden />
                          Verified
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<Scale size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Accounting of disclosures"
              caption="HIPAA §164.312(b) & GDPR."
            />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Every data access request, link share, and doctor consultation
              generates an immutable cryptographic audit record retained for your
              protection.
            </p>
            <Link
              href="/patient/dsar"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <ShieldCheck size={13} /> Privacy rights (DSAR)
            </Link>
          </section>

          <QuickToolsPanel
            id="audit-tools"
            title="Tools"
            tools={[
              {
                icon: Share2,
                label: "Share",
                hint: "Links",
                href: "/patient/share",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: ShieldCheck,
                label: "Consents",
                hint: "Grants",
                href: "/patient/consents",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: Download,
                label: "Export",
                hint: "Archive",
                href: "/patient/export",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}

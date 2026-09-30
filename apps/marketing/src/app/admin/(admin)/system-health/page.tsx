"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  HeartPulse,
  RefreshCw,
  Stethoscope,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";

interface HealthOverview {
  counts: {
    totalUsers: number;
    totalDoctors: number;
    totalRecords: number;
    pendingDsar: number;
    pendingApprovals: number;
    unreadNotifications: number;
    activeUsers: number;
  };
  storage: { d1Pages: number | null; d1Bytes: number | null };
  generatedAt: string;
}

type ErrorRow = {
  id: string;
  action: string;
  resourceId: string | null;
  createdAt: string;
};

const CRON_NAMES = ["booking", "dose", "refill", "reclassify", "vaccination"] as const;

export default function SystemHealthPage() {
  const qc = useQueryClient();
  const { data: overview, isLoading } = useQuery({
    queryKey: adminQk.healthOverview(),
    queryFn: () => adminApi<HealthOverview>("/admin/health/overview"),
    refetchInterval: 60_000,
  });

  const { data: errors, isLoading: errorsLoading } = useQuery({
    queryKey: adminQk.healthErrors(),
    queryFn: () => adminApi<{ items: ErrorRow[] }>("/admin/health/errors"),
    refetchInterval: 60_000,
  });

  const errorCount = errors?.items?.length ?? 0;
  const attentionCount = (overview?.counts.pendingDsar ?? 0) + (overview?.counts.pendingApprovals ?? 0);

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["admin", "health"] });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<HeartPulse size={13} aria-hidden />}
          kicker="System"
          kickerMeta="Live · refreshes every 60s"
          title={
            <>
              System{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                health
              </span>
            </>
          }
          description={
            errorCount > 0
              ? `${errorCount} recent failure${errorCount === 1 ? "" : "s"} logged — check the error tail below.`
              : "Live platform counters, scheduled-job liveness and the latest error tail."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Metrics live
              </span>
              {errorCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-rose-300/30 bg-rose-400/15 px-3 py-1.5 text-xs font-semibold text-rose-100">
                  <AlertTriangle size={12} aria-hidden />
                  {errorCount} recent failure{errorCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {attentionCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <Clock size={12} aria-hidden />
                  {attentionCount} queue item{attentionCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </>
          }
          actions={
            <button type="button" onClick={refreshAll} className={HERO_GHOST}>
              <RefreshCw size={15} aria-hidden />
              Refresh
            </button>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            href="/admin/users"
            label="Total users"
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={overview ? overview.counts.totalUsers.toLocaleString() : "…"}
            sub={overview ? `${overview.counts.activeUsers.toLocaleString()} active` : "Loading…"}
          />
          <StatTile
            href="/admin/doctors"
            label="Doctors"
            icon={<Stethoscope size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={overview ? overview.counts.totalDoctors.toLocaleString() : "…"}
            sub="Registered providers"
          />
          <StatTile
            label="Records"
            icon={<FileText size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={overview ? overview.counts.totalRecords.toLocaleString() : "…"}
            sub="Clinical records stored"
          />
          <StatTile
            href="/admin/dashboard"
            label="Needs attention"
            icon={<AlertTriangle size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={overview ? String(attentionCount) : "…"}
            sub={overview ? `${overview.counts.pendingApprovals} approvals · ${overview.counts.pendingDsar} DSAR` : "Loading…"}
            badge={attentionCount > 0 ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            pulse={attentionCount > 0}
          />
        </HeroOverlap>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* Cron liveness */}
          <section className={PANEL} aria-labelledby="sys-cron">
            <PanelHeader
              id="sys-cron"
              icon={<Clock size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Cron liveness"
              caption="Last run per scheduled job · stale after 60m"
            />
            {isLoading ? (
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-[76px] animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {CRON_NAMES.map((name) => (
                  <CronTile key={name} name={name} />
                ))}
              </div>
            )}
          </section>

          {/* Error tail */}
          <section className={PANEL} aria-labelledby="sys-errors">
            <PanelHeader
              id="sys-errors"
              icon={<AlertTriangle size={16} />}
              tone="bg-rose-50 text-rose-600"
              title="Error tail"
              caption="Most recent platform failures"
              href="/admin/audit"
              linkLabel="Audit log"
            />
            {errorsLoading ? (
              <div className="mt-5 space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : errorCount === 0 ? (
              <EmptyBlock
                icon={<CheckCircle2 size={19} />}
                title="No recent failures"
                body="The platform has not logged an error recently. Failures will appear here with their action and resource."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {errors!.items.slice(0, 20).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-red-50 text-red-600">
                      <XCircle size={15} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] font-semibold text-slate-900">
                        {row.action}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {new Date(row.createdAt).toLocaleString()}
                        {row.resourceId ? ` · ${row.resourceId.slice(0, 8)}…` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Platform details">
          {/* Storage */}
          <section className={PANEL} aria-labelledby="sys-storage">
            <PanelHeader
              id="sys-storage"
              icon={<Database size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Storage"
              caption="D1 database estimate"
            />
            {isLoading || !overview ? (
              <div className="mt-5 h-16 animate-pulse rounded-xl bg-slate-100" />
            ) : overview.storage.d1Bytes != null ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <span className="block text-[24px] font-semibold leading-none tracking-[-0.03em] text-slate-900 tabular-nums">
                    {overview.storage.d1Pages?.toLocaleString() ?? "—"}
                  </span>
                  <span className="mt-1.5 block text-xs text-slate-400">Pages</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <span className="block text-[24px] font-semibold leading-none tracking-[-0.03em] text-slate-900 tabular-nums">
                    {(overview.storage.d1Bytes / 1024 / 1024).toFixed(1)}
                  </span>
                  <span className="mt-1.5 block text-xs text-slate-400">MB estimated</span>
                </div>
              </div>
            ) : (
              <EmptyBlock
                icon={<Database size={19} />}
                title="Estimate unavailable"
                body="Storage metrics are not exposed in this environment."
                className="py-6"
              />
            )}
          </section>

          {/* Platform counters */}
          <section className={PANEL} aria-labelledby="sys-counters">
            <PanelHeader
              id="sys-counters"
              icon={<Activity size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Platform counters"
              caption="Snapshot from the health probe"
            />
            {isLoading || !overview ? (
              <div className="mt-5 h-32 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <ul className="mt-4 flex flex-col gap-0.5">
                {[
                  { icon: <Users size={11} />, label: "Total users", value: overview.counts.totalUsers },
                  { icon: <CheckCircle2 size={11} />, label: "Active users", value: overview.counts.activeUsers },
                  { icon: <Stethoscope size={11} />, label: "Doctors", value: overview.counts.totalDoctors },
                  { icon: <FileText size={11} />, label: "Records", value: overview.counts.totalRecords },
                  { icon: <Bell size={11} />, label: "Unread notifications", value: overview.counts.unreadNotifications },
                ].map((c) => (
                  <li
                    key={c.label}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-slate-50"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500" aria-hidden>
                      {c.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{c.label}</span>
                    <span className="min-w-[28px] rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-700">
                      {c.value.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {overview ? (
            <p className="px-1 text-[11px] text-slate-400">
              Generated {new Date(overview.generatedAt).toLocaleTimeString()}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function CronTile({ name }: { name: string }) {
  // dataUpdatedAt is the timestamp of the last successful fetch — using it
  // instead of Date.now() keeps render pure and ages accurate after refetches.
  const { data, dataUpdatedAt } = useQuery({
    queryKey: adminQk.healthCron(name),
    queryFn: () => adminApi<{ name: string; items: { createdAt: string }[] }>(`/admin/health/cron/${name}`),
    refetchInterval: 60_000,
  });
  const last = data?.items?.[0];
  const lastTime = last?.createdAt ? new Date(last.createdAt).getTime() : null;
  const ageMin = lastTime != null && dataUpdatedAt ? Math.max(0, Math.floor((dataUpdatedAt - lastTime) / 60_000)) : null;
  const stale = ageMin != null && ageMin > 60;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl p-3.5 transition-all",
        stale
          ? "bg-red-50 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.25)]"
          : "bg-slate-50 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-[10px]",
          stale ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600",
        )}
        aria-hidden
      >
        {stale ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[12.5px] font-semibold text-slate-900">{name}</span>
        <span className={cn("block text-xs", stale ? "text-red-600" : "text-slate-400")}>
          {data ? (ageMin != null ? `${ageMin}m ago` : "no runs") : "checking…"}
        </span>
      </span>
      {stale ? (
        <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
          Stale
        </span>
      ) : null}
    </div>
  );
}

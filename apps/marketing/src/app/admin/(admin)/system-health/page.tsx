"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Database, Clock, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

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

const CRON_NAMES = ["booking", "dose", "refill", "reclassify", "vaccination"] as const;

export default function SystemHealthPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: adminQk.healthOverview(),
    queryFn: () => adminApi<HealthOverview>("/admin/health/overview"),
    refetchInterval: 60_000,
  });

  const { data: errors } = useQuery({
    queryKey: adminQk.healthErrors(),
    queryFn: () => adminApi<{ items: any[] }>("/admin/health/errors"),
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <PageHeader
        title="System health"
        subtitle="Live metrics. Auto-refreshes every 60s."
        icon={<Activity size={20} className="text-amber-600" />}
      />

      {isLoading || !overview ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Tile label="Total users" value={overview.counts.totalUsers} />
            <Tile label="Doctors" value={overview.counts.totalDoctors} />
            <Tile label="Records" value={overview.counts.totalRecords} />
            <Tile label="Pending DSAR" value={overview.counts.pendingDsar} highlight={overview.counts.pendingDsar > 0} />
            <Tile label="Pending approvals" value={overview.counts.pendingApprovals} highlight={overview.counts.pendingApprovals > 0} />
            <Tile label="Unread notifs" value={overview.counts.unreadNotifications} />
          </section>

          <section className="bg-surface border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Database size={14} className="text-amber-600" /> Storage
            </h3>
            <div className="text-sm">
              {overview.storage.d1Bytes != null ? (
                <p>D1 page count: <b>{overview.storage.d1Pages}</b> · <b>{(overview.storage.d1Bytes / 1024 / 1024).toFixed(2)} MB</b> estimated</p>
              ) : (
                <p className="text-text-soft">Storage estimate unavailable in this environment.</p>
              )}
              <p className="text-xs text-text-soft mt-1">Generated {new Date(overview.generatedAt).toLocaleTimeString()}</p>
            </div>
          </section>

          <section className="bg-surface border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Clock size={14} className="text-amber-600" /> Cron liveness
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {CRON_NAMES.map((name) => (
                <CronTile key={name} name={name} />
              ))}
            </div>
          </section>

          <section className="bg-surface border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-amber-600" /> Error tail
            </h3>
            {errors?.items?.length ? (
              <ul className="text-xs space-y-1 max-h-64 overflow-y-auto">
                {errors.items.slice(0, 20).map((row) => (
                  <li key={row.id} className="flex items-start gap-2 py-1 border-b border-border last:border-b-0">
                    <XCircle size={12} className="text-red-500 mt-0.5 shrink-0" />
                    <span className="font-mono text-text-soft">{row.createdAt}</span>
                    <span className="font-semibold">{row.action}</span>
                    {row.resourceId ? <span className="text-text-soft">· {row.resourceId}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-soft inline-flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-600" /> No recent failures
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-4 ${highlight ? "ring-2 ring-amber-300" : ""}`}>
      <div className="text-xs text-text-soft">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function CronTile({ name }: { name: string }) {
  const { data } = useQuery({
    queryKey: adminQk.healthCron(name),
    queryFn: () => adminApi<{ name: string; items: any[] }>(`/admin/health/cron/${name}`),
    refetchInterval: 60_000,
  });
  const last = data?.items?.[0];
  const lastTime = last?.createdAt ? new Date(last.createdAt) : null;
  const ageMin = lastTime ? Math.floor((Date.now() - lastTime.getTime()) / 60_000) : null;
  const stale = ageMin != null && ageMin > 60;

  return (
    <div className={`border rounded-lg p-3 ${stale ? "border-red-200 bg-red-50" : "border-border bg-bg"}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs">{name}</span>
        {stale ? <XCircle size={12} className="text-red-500" /> : <CheckCircle2 size={12} className="text-emerald-500" />}
      </div>
      <div className="text-xs text-text-soft mt-1">
        {lastTime ? `${ageMin}m ago` : "no runs"}
      </div>
    </div>
  );
}
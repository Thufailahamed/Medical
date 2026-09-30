"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Flag,
  Layers,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserPlus,
  Zap,
} from "lucide-react";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  PANEL,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { SettingRow, type SettingItem } from "@/portal/components/admin/SettingRow";
import { PasskeyManager } from "@/portal/components/admin/PasskeyManager";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

const CATEGORY_LABEL: Record<string, string> = {
  registration: "Registration",
  uploads: "Uploads",
  operations: "Operations",
  feature_flags: "Feature flags",
};

const CATEGORY_META: Record<string, { icon: React.ReactNode; tone: string }> = {
  registration: { icon: <UserPlus size={16} />, tone: "bg-sky-50 text-sky-600" },
  uploads: { icon: <Upload size={16} />, tone: "bg-violet-50 text-violet-600" },
  operations: { icon: <Activity size={16} />, tone: "bg-emerald-50 text-emerald-600" },
  feature_flags: { icon: <Flag size={16} />, tone: "bg-amber-50 text-amber-600" },
};

export default function AdminSettingsPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: adminQk.settings(),
    queryFn: () => adminApi<{ items: SettingItem[]; grouped: Record<string, SettingItem[]> }>("/admin/settings"),
  });

  // Collapse state per category — open by default.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const stats = useMemo(() => {
    const items = data?.items ?? [];
    const sensitive = items.filter((i) => i.isSensitive).length;
    const latest = items.reduce<string | null>(
      (m, i) => (i.updatedAt > (m ?? "") ? i.updatedAt : m),
      null,
    );
    return { total: items.length, groups: Object.keys(data?.grouped ?? {}).length, sensitive, latest };
  }, [data]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<SettingsIcon size={13} aria-hidden />}
          kicker="System"
          kickerMeta={data ? `${stats.total} settings · ${stats.groups} groups` : "Runtime configuration"}
          title={
            <>
              System{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                settings
              </span>
            </>
          }
          description="Runtime configuration for the whole platform. Changes take effect immediately — sensitive keys ask for confirmation first."
          chips={
            <>
              <span className={HERO_CHIP}>
                <Zap size={12} className="text-emerald-300" aria-hidden />
                Applies instantly
              </span>
              {stats.sensitive > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <AlertTriangle size={12} aria-hidden />
                  {stats.sensitive} sensitive setting{stats.sensitive === 1 ? "" : "s"}
                </span>
              ) : null}
            </>
          }
          actions={
            <button type="button" onClick={() => refetch()} disabled={isFetching} className={HERO_GHOST}>
              <RefreshCw size={15} className={cn(isFetching && "animate-spin")} aria-hidden />
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Settings"
            icon={<SlidersHorizontal size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={data ? String(stats.total) : "…"}
            sub="Runtime keys"
          />
          <StatTile
            label="Groups"
            icon={<Layers size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={data ? String(stats.groups) : "…"}
            sub="Configuration categories"
          />
          <StatTile
            label="Sensitive"
            icon={<AlertTriangle size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={data ? String(stats.sensitive) : "…"}
            sub="Confirm before saving"
            pulse={stats.sensitive > 0}
          />
          <StatTile
            label="Last change"
            icon={<Clock size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={stats.latest ? new Date(stats.latest).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}
            sub={stats.latest ? new Date(stats.latest).toLocaleDateString() : "No changes recorded"}
          />
        </HeroOverlap>
      </div>

      {/* ── Settings groups ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <section className={PANEL}>
          <EmptyBlock
            icon={<AlertTriangle size={19} />}
            title="Failed to load settings"
            body="The settings endpoint did not respond. Try refreshing the page."
            actions={
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700"
              >
                <RefreshCw size={13} aria-hidden />
                Retry
              </button>
            }
          />
        </section>
      ) : !data || data.items.length === 0 ? (
        <section className={PANEL}>
          <EmptyBlock
            icon={<SettingsIcon size={19} />}
            title="No settings found"
            body="Run the seed script to insert the default configuration keys."
            className="py-10"
          />
        </section>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
            {Object.entries(data.grouped).map(([category, items]) => {
              const isOpen = open[category] ?? true;
              const meta = CATEGORY_META[category] ?? {
                icon: <SlidersHorizontal size={16} />,
                tone: "bg-slate-100 text-slate-600",
              };
              const sensitiveInGroup = items.filter((i) => i.isSensitive).length;
              return (
                <section key={category} className={cn(PANEL, "p-0 sm:p-0")} aria-label={CATEGORY_LABEL[category] ?? category}>
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [category]: !isOpen }))}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 p-5 text-left sm:p-6"
                  >
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px]", meta.tone)} aria-hidden>
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold leading-tight tracking-[-0.01em] text-slate-900">
                        {CATEGORY_LABEL[category] ?? category}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {items.length} setting{items.length === 1 ? "" : "s"}
                        {sensitiveInGroup ? ` · ${sensitiveInGroup} sensitive` : ""}
                      </span>
                    </span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-hidden>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                  </button>
                  {isOpen ? <div className="px-5 pb-3 sm:px-6">{items.map((it) => <SettingRow key={it.key} item={it} />)}</div> : null}
                </section>
              );
            })}
          </div>

          {/* ── Security rail ─────────────────────────────────────────── */}
          <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Security">
            <section className={PANEL} aria-labelledby="set-security">
              <PasskeyManager />
            </section>

            <section className={PANEL} aria-labelledby="set-notes">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-emerald-600" aria-hidden>
                  <ShieldCheck size={16} />
                </span>
                <div className="min-w-0">
                  <h2 id="set-notes" className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900">
                    Good to know
                  </h2>
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {[
                  "Changes are applied immediately — there is no staging step.",
                  "Sensitive settings show a before/after diff and ask for confirmation.",
                  "Every change is written to the audit log with your admin ID.",
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500" aria-hidden>
                      <ShieldCheck size={13} />
                    </span>
                    <span className="text-xs leading-relaxed text-slate-500">{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

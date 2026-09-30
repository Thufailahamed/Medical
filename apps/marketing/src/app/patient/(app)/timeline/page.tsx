"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarDays,
  Clock3,
  FileText,
  FolderOpen,
  Heart,
  HeartPulse,
  Pill,
  Share2,
  StickyNote,
  Stethoscope,
} from "lucide-react";

import { useTimeline } from "@/patient/hooks";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  BreakdownBar,
  EmptyBlock,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  HeroPulse,
  LiveDot,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  Segmented,
  StatTile,
  TONE_TILE,
  type Tone,
} from "@/patient/components/workspace";

type Event = {
  id: string;
  kind: string;
  date: string;
  title: string;
  subtitle: string | null;
  meta: Record<string, unknown> | null;
};

type Group = "all" | "record" | "appointment" | "medicine" | "health";

const KIND_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  record: FileText,
  vital: Heart,
  symptom: Activity,
  medicine_start: Pill,
  medicine_stop: Pill,
  appointment: Stethoscope,
  note: StickyNote,
};

const KIND_TONE: Record<string, Tone> = {
  record: "sky",
  vital: "rose",
  symptom: "amber",
  medicine_start: "emerald",
  medicine_stop: "slate",
  appointment: "violet",
  note: "sky",
};

const KIND_COLOR: Record<string, string> = {
  record: "bg-sky-500",
  vital: "bg-rose-500",
  symptom: "bg-amber-400",
  medicine_start: "bg-emerald-500",
  medicine_stop: "bg-slate-400",
  appointment: "bg-violet-500",
  note: "bg-teal-500",
};

const KIND_LABEL: Record<string, string> = {
  record: "Records",
  vital: "Vitals",
  symptom: "Symptoms",
  medicine_start: "Medicine started",
  medicine_stop: "Medicine stopped",
  appointment: "Appointments",
  note: "Notes",
};

function groupOf(kind: string): Exclude<Group, "all"> {
  if (kind === "appointment") return "appointment";
  if (kind.startsWith("medicine")) return "medicine";
  if (kind === "vital" || kind === "symptom") return "health";
  return "record";
}

function monthKey(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Undated";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function TimelinePage() {
  const query = useTimeline({ limit: 100 });
  const [group, setGroup] = useState<Group>("all");

  const events: Event[] = (query.data as { events?: Event[] } | undefined)?.events ?? [];

  const counts = useMemo(() => {
    const c = { record: 0, appointment: 0, medicine: 0, health: 0 };
    for (const e of events) c[groupOf(e.kind)] += 1;
    return c;
  }, [events]);

  const byKind = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.kind, (m.get(e.kind) ?? 0) + 1);
    return [...m.entries()]
      .map(([key, count]) => ({ key, count, label: KIND_LABEL[key] ?? humanize(key), color: KIND_COLOR[key] ?? "bg-slate-300" }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const filtered = group === "all" ? events : events.filter((e) => groupOf(e.kind) === group);

  const months = useMemo(() => {
    const out: Array<{ label: string; items: Event[] }> = [];
    for (const e of filtered) {
      const label = monthKey(e.date);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [filtered]);

  const latest = events[0];
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const recent = events.filter((e) => new Date(e.date).getTime() >= thirtyDaysAgo).length;
  const pick = (g: Group) => setGroup(group === g ? "all" : g);

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<Clock3 size={13} aria-hidden />}
          kicker="Health timeline"
          kickerMeta={`${events.length} events`}
          title={
            <>
              Your health <HeroAccent>story</HeroAccent>
            </>
          }
          description="Appointments, records, medicines and vitals — every event in one place, newest first."
          chips={
            <>
              <span className={HERO_CHIP}>
                <LiveDot tone="sky" />
                {recent} event{recent === 1 ? "" : "s"} in the last 30 days
              </span>
              {latest ? (
                <span className={HERO_CHIP}>
                  <CalendarDays size={12} className="text-sky-300" aria-hidden />
                  Latest · {formatDayLabel(latest.date)}
                </span>
              ) : null}
            </>
          }
          aside={
            <HeroPulse
              icon={<Activity size={20} strokeWidth={2.3} aria-hidden />}
              label="Last 30 days"
              value={query.data ? recent : "—"}
              sub={`${events.length} events on your timeline`}
            />
          }
          actions={
            <>
              <Link href="/patient/share" className={HERO_GHOST}>
                <Share2 size={15} aria-hidden />
                Share
              </Link>
              <Link href="/patient/records" className={HERO_PRIMARY}>
                <FolderOpen size={15} className="text-sky-600" aria-hidden />
                Records
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Records"
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(counts.record)}
            sub="Documents & notes"
            active={group === "record"}
            onClick={() => pick("record")}
          />
          <StatTile
            label="Appointments"
            icon={<Stethoscope size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(counts.appointment)}
            sub="Visits & consults"
            active={group === "appointment"}
            onClick={() => pick("appointment")}
          />
          <StatTile
            label="Medicines"
            icon={<Pill size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(counts.medicine)}
            sub="Started & stopped"
            active={group === "medicine"}
            onClick={() => pick("medicine")}
          />
          <StatTile
            label="Vitals & symptoms"
            icon={<HeartPulse size={16} />}
            tone="bg-rose-50 text-rose-600"
            value={String(counts.health)}
            sub="Readings you logged"
            active={group === "health"}
            onClick={() => pick("health")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="tl-list">
          <PanelHeader
            id="tl-list"
            icon={<Clock3 size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Timeline"
            caption={query.isLoading ? "Loading…" : `${filtered.length} event${filtered.length === 1 ? "" : "s"} · newest first`}
          />
          <div className="mt-5">
            <Segmented<Group>
              ariaLabel="Timeline filters"
              value={group}
              onChange={setGroup}
              options={[
                { value: "all", label: "All", count: events.length },
                { value: "record", label: "Records", count: counts.record },
                { value: "appointment", label: "Visits", count: counts.appointment },
                { value: "medicine", label: "Medicines", count: counts.medicine },
                { value: "health", label: "Vitals", count: counts.health },
              ]}
            />
          </div>

          {query.isLoading ? (
            <PanelSkeleton rows={6} />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyBlock
              icon={<Clock3 size={19} />}
              title="Nothing to show yet"
              body="As you add records, take medicines, and book visits, they'll appear here."
            />
          ) : (
            <div className="mt-5 flex flex-col gap-6">
              {months.map((m) => (
                <div key={m.label}>
                  <div className="flex items-center gap-3">
                    <p className={GROUP_LABEL}>{m.label}</p>
                    <span className="h-px flex-1 bg-slate-100" aria-hidden />
                    <span className="text-[11px] tabular-nums text-slate-400">{m.items.length}</span>
                  </div>
                  <ol className="relative mt-3 flex flex-col gap-2 pl-6">
                    <span className="absolute bottom-3 left-[9px] top-3 w-px bg-slate-200" aria-hidden />
                    {m.items.map((e) => {
                      const Icon = KIND_ICONS[e.kind] ?? FileText;
                      const tone = KIND_TONE[e.kind] ?? "sky";
                      return (
                        <li key={e.id} className="relative">
                          <span
                            className={cn("absolute -left-6 top-1/2 h-[11px] w-[11px] -translate-y-1/2 translate-x-[4px] rounded-full ring-4 ring-white", KIND_COLOR[e.kind] ?? "bg-slate-300")}
                            aria-hidden
                          />
                          <div className="group flex items-center gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]">
                            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", TONE_TILE[tone])} aria-hidden>
                              <Icon size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span className="truncate text-sm font-semibold text-slate-900">{e.title}</span>
                                <Badge tone={tone}>{humanize(e.kind)}</Badge>
                              </span>
                              {e.subtitle ? <span className="mt-0.5 block truncate text-xs text-slate-400">{e.subtitle}</span> : null}
                            </span>
                            <span className="shrink-0 text-right text-[11px] font-medium tabular-nums text-slate-400">
                              {formatDayLabel(e.date)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Timeline overview">
          <section className={PANEL} aria-labelledby="tl-mix">
            <PanelHeader
              id="tl-mix"
              icon={<Activity size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="What's on it"
              caption={`${events.length} events`}
            />
            {query.isLoading ? (
              <div className="mt-5 h-32 animate-pulse rounded-xl bg-slate-100" />
            ) : events.length === 0 ? (
              <EmptyBlock icon={<Activity size={19} />} title="No events yet" body="Your breakdown fills in as care happens." />
            ) : (
              <BreakdownBar items={byKind} total={events.length} />
            )}
          </section>

          <QuickToolsPanel
            id="tl-tools"
            tools={[
              { href: "/patient/records/new", label: "Record", hint: "Add a document", icon: FileText, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/appointments/book", label: "Book", hint: "New visit", icon: Stethoscope, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { href: "/patient/health", label: "Vitals", hint: "Log a reading", icon: HeartPulse, tone: "from-rose-500 to-pink-600 shadow-rose-500/30" },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}

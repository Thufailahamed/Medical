"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Hash,
  RotateCcw,
  Stethoscope,
  Users,
  Video,
} from "lucide-react";

import { useAppointments } from "@/patient/hooks";
import { formatDayLabel, formatTime, humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { teleconsultApi } from "@/portal/lib/api";
import { countdownDays, type VisitBucket } from "@healthcare/shared/visit-lifecycle";
import {
  Badge,
  EmptyBlock,
  HERO_ATTENTION_CHIP,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  LiveDot,
  PANEL,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PrimaryLink,
  ROW_LINK,
  Segmented,
  StatTile,
  TONE_RAIL,
  type Tone,
} from "@/patient/components/workspace";

type TabFilter = "all" | "upcoming" | "completed" | "missed" | "cancelled";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmed", tone: "sky" },
  completed: { label: "Completed", tone: "emerald" },
  in_progress: { label: "In progress", tone: "violet" },
  scheduled: { label: "Scheduled", tone: "sky" },
  booked: { label: "Booked", tone: "sky" },
  no_show: { label: "Missed", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

function statusOf(status: string) {
  return STATUS[status] ?? { label: humanize(status), tone: "slate" as Tone };
}

function parseDate(date: string) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function AppointmentsPage() {
  const query = useAppointments();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  // Live teleconsult session (if the doctor already opened a room).
  // Polls so "Join call" picks the real roomId over the __pending__
  // waiting room as soon as the session exists. Plain effect+interval
  // (not react-query) — this page's tests render without a provider.
  const [activeSession, setActiveSession] = useState<{
    id: string;
    roomId: string;
    status: string;
    appointmentId: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await teleconsultApi.getActiveForMe();
        if (!cancelled) setActiveSession(res.session);
      } catch {}
    };
    load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const rawAppointments = query.data?.appointments ?? [];

  const { upcomingList, completedList, missedList, cancelledList } = useMemo(() => {
    const sorted = [...rawAppointments].sort((a, b) =>
      (b.date + b.time).localeCompare(a.date + a.time)
    );
    const byBucket = (b: VisitBucket) => sorted.filter((a) => a.bucket === b);
    return {
      upcomingList: [...byBucket("today"), ...byBucket("upcoming")].sort((a, b) => a.startsAt - b.startsAt),
      completedList: byBucket("completed"),
      missedList: byBucket("missed"),
      cancelledList: byBucket("cancelled"),
    };
  }, [rawAppointments]);

  const filteredAppointments = useMemo(() => {
    let list = rawAppointments;
    if (activeTab === "upcoming") list = upcomingList;
    else if (activeTab === "completed") list = completedList;
    else if (activeTab === "missed") list = missedList;
    else if (activeTab === "cancelled") list = cancelledList;
    else list = [...upcomingList, ...completedList, ...missedList, ...cancelledList];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          (a.doctorName || "").toLowerCase().includes(q) ||
          (a.doctorSpecialization || "").toLowerCase().includes(q) ||
          (a.hospitalName || "").toLowerCase().includes(q) ||
          (a.reason || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rawAppointments, activeTab, upcomingList, completedList, missedList, cancelledList, search]);

  const next = upcomingList[0] ?? null;
  const nextDays = next ? countdownDays(next.startsAt) : null;
  const liveAppt = activeSession
    ? rawAppointments.find((a) => a.id === activeSession.appointmentId && a.isLive) ?? null
    : null;
  const videoCount = rawAppointments.filter((a) => a.mode === "video").length;
  const inPersonCount = rawAppointments.length - videoCount;
  const total = rawAppointments.length;
  const doctors = new Set(rawAppointments.map((a) => a.doctorName).filter(Boolean)).size;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<CalendarDays size={13} aria-hidden />}
          kicker="Appointments"
          kickerMeta={`${total} visit${total === 1 ? "" : "s"} on record`}
          title={
            <>
              Your <HeroAccent>visits</HeroAccent>
            </>
          }
          description={
            query.isLoading
              ? "Loading your visits…"
              : next
                ? `Next up: ${next.doctorName ?? "your doctor"} on ${formatDayLabel(next.date)} at ${formatTime(next.time)}.`
                : "Nothing booked yet — schedule an in-person visit or a video consultation."
          }
          chips={
            <>
              {liveAppt && activeSession ? (
                <Link href={`/patient/teleconsult/${activeSession.roomId}`} className={HERO_ATTENTION_CHIP}>
                  <Video size={12} aria-hidden />
                  Your doctor is live — join call
                </Link>
              ) : null}
              {next ? (
                <span className={HERO_CHIP}>
                  <LiveDot tone={nextDays != null && nextDays <= 0 ? "emerald" : "sky"} />
                  {nextDays == null ? "" : nextDays <= 0 ? "Visit today" : nextDays === 1 ? "Visit tomorrow" : `Next visit in ${nextDays} days`}
                </span>
              ) : null}
              {missedList.length > 0 ? (
                <button type="button" onClick={() => setActiveTab("missed")} className={HERO_ATTENTION_CHIP}>
                  <AlertCircle size={12} aria-hidden />
                  {missedList.length} missed
                </button>
              ) : null}
            </>
          }
          actions={
            <>
              <Link href="/patient/care-team" className={HERO_GHOST}>
                <Users size={15} aria-hidden />
                My doctors
              </Link>
              <Link href="/patient/appointments/book" className={HERO_PRIMARY}>
                <CalendarPlus size={15} className="text-sky-600" aria-hidden />
                Book a visit
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Upcoming"
            icon={<CalendarCheck2 size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(upcomingList.length)}
            sub={next ? `Next ${formatDayLabel(next.date)}` : "Nothing scheduled"}
            active={activeTab === "upcoming"}
            onClick={() => setActiveTab(activeTab === "upcoming" ? "all" : "upcoming")}
          />
          <StatTile
            label="Completed"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(completedList.length)}
            sub={doctors > 0 ? `With ${doctors} doctor${doctors === 1 ? "" : "s"}` : "No visits yet"}
            progress={total > 0 ? Math.round((completedList.length / total) * 100) : null}
            active={activeTab === "completed"}
            onClick={() => setActiveTab(activeTab === "completed" ? "all" : "completed")}
          />
          <StatTile
            label="Missed"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(missedList.length)}
            sub={missedList.length > 0 ? "Rebook when you can" : "None missed"}
            badge={missedList.length > 0 ? { text: "Rebook", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={activeTab === "missed"}
            onClick={() => setActiveTab(activeTab === "missed" ? "all" : "missed")}
          />
          <StatTile
            label="Cancelled"
            icon={<CalendarX2 size={16} />}
            tone="bg-rose-50 text-rose-600"
            value={String(cancelledList.length)}
            sub="By you or the clinic"
            active={activeTab === "cancelled"}
            onClick={() => setActiveTab(activeTab === "cancelled" ? "all" : "cancelled")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Visit list ─────────────────────────────────────────────── */}
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="ap-list">
          <PanelHeader
            id="ap-list"
            icon={<CalendarDays size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={activeTab === "all" ? "All visits" : `${humanize(activeTab)} visits`}
            caption={query.isLoading ? "Loading…" : `${filteredAppointments.length} of ${total} shown`}
            action={
              activeTab !== "all" || search ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("all");
                    setSearch("");
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <RotateCcw size={12} aria-hidden />
                  Reset
                </button>
              ) : null
            }
          />

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Search doctor, hospital, reason…"
              ariaLabel="Search appointments"
            />
            <Segmented<TabFilter>
              ariaLabel="Appointment filters"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: "all", label: "All", count: total },
                { value: "upcoming", label: "Upcoming", count: upcomingList.length },
                { value: "completed", label: "Completed", count: completedList.length },
                { value: "missed", label: "Missed", count: missedList.length },
                { value: "cancelled", label: "Cancelled", count: cancelledList.length },
              ]}
            />
          </div>

          {query.isLoading ? (
            <PanelSkeleton rows={4} />
          ) : filteredAppointments.length === 0 ? (
            <EmptyBlock
              icon={<CalendarDays size={19} />}
              title="No appointments found"
              body={
                search
                  ? `No visits match "${search}". Try clearing your search.`
                  : activeTab === "upcoming"
                    ? "You have no upcoming consultations. Book an in-person visit or a video consultation."
                    : "No appointments match the selected filter."
              }
              actions={
                <PrimaryLink href="/patient/appointments/book" icon={<CalendarPlus size={13} />}>
                  Book a visit
                </PrimaryLink>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {filteredAppointments.map((a) => {
                const st = statusOf(a.status);
                const isVideo = a.mode === "video";
                const isUpcoming = a.bucket === "upcoming" || a.bucket === "today";
                const d = parseDate(a.date);
                const canJoin = isVideo && a.isLive && activeSession?.appointmentId === a.id;
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "group relative flex flex-col gap-3 rounded-xl p-3.5 transition-all sm:flex-row sm:items-center",
                      isUpcoming
                        ? "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                        : "bg-slate-50/70 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]",
                    )}
                  >
                    <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", TONE_RAIL[st.tone])} aria-hidden />
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <div
                        className={cn(
                          "ml-1.5 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl",
                          isUpcoming
                            ? "bg-gradient-to-br from-sky-600 to-cyan-600 text-white shadow-lg shadow-sky-600/20"
                            : "bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]",
                        )}
                      >
                        <span className={cn("text-[9.5px] font-semibold uppercase tracking-[0.14em]", isUpcoming ? "text-sky-100/80" : "text-slate-400")}>
                          {d ? d.toLocaleDateString("en-US", { month: "short" }) : "—"}
                        </span>
                        <span className="text-lg font-bold leading-none tabular-nums">{d ? d.getDate() : "—"}</span>
                        <span className={cn("text-[9.5px] font-medium", isUpcoming ? "text-sky-100/80" : "text-slate-400")}>
                          {d ? d.toLocaleDateString("en-US", { weekday: "short" }) : ""}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/patient/appointments/${a.id}`}
                            className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700"
                          >
                            {a.doctorName ?? "Consulting physician"}
                          </Link>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-600 tabular-nums">
                            <Clock size={12} aria-hidden />
                            {formatTime(a.time)}
                          </span>
                          {a.doctorSpecialization ? (
                            <span className="inline-flex items-center gap-1">
                              <Stethoscope size={12} aria-hidden />
                              {a.doctorSpecialization}
                            </span>
                          ) : null}
                          <span className={cn("inline-flex items-center gap-1", isVideo && "font-medium text-violet-600")}>
                            {isVideo ? <Video size={12} aria-hidden /> : <Building2 size={12} aria-hidden />}
                            {isVideo ? "Video consultation" : a.hospitalName ?? "In-person"}
                          </span>
                          {a.queueNumber ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 font-semibold text-sky-700">
                              <Hash size={10} aria-hidden />
                              {a.queueNumber}
                            </span>
                          ) : null}
                        </div>
                        {a.reason ? <p className="mt-1 truncate text-xs text-slate-500">{a.reason}</p> : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                      {canJoin && activeSession ? (
                        <Link
                          href={`/patient/teleconsult/${activeSession.roomId}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-xs font-semibold text-white shadow-md shadow-violet-600/25 transition hover:brightness-110"
                        >
                          <Video size={13} aria-hidden />
                          Join call
                        </Link>
                      ) : isVideo && (a.bucket === "today" || a.isLive) ? (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
                          {a.isLive ? "Waiting for doctor" : "Starts soon"}
                        </span>
                      ) : null}
                      {a.bucket === "missed" || a.bucket === "cancelled" || a.bucket === "completed" ? (
                        <Link href={`/patient/appointments/book?doctorId=${a.doctorId}`} className={ROW_LINK}>
                          <RotateCcw size={12} aria-hidden />
                          Book again
                        </Link>
                      ) : null}
                      <Link
                        href={`/patient/appointments/${a.id}`}
                        aria-label={`Details for ${a.doctorName ?? "appointment"}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-sky-50 hover:text-sky-600"
                      >
                        <ChevronRight size={16} aria-hidden />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Rail ───────────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Visit overview">
          <section className={PANEL} aria-labelledby="ap-mix">
            <PanelHeader
              id="ap-mix"
              icon={<Stethoscope size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="How you see doctors"
              caption={`${total} visit${total === 1 ? "" : "s"} · ${doctors} doctor${doctors === 1 ? "" : "s"}`}
            />
            {total === 0 ? (
              <EmptyBlock icon={<Stethoscope size={19} />} title="No visits yet" body="Your in-person and video visits are summarised here." />
            ) : (
              <>
                <div className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                  <span className="h-full rounded-l-full bg-sky-500" style={{ width: `${(inPersonCount / total) * 100}%` }} />
                  <span className="h-full rounded-r-full bg-violet-500" style={{ width: `${(videoCount / total) * 100}%` }} />
                </div>
                <ul className="mt-4 flex flex-col gap-0.5 text-[13px]">
                  {[
                    { label: "In-person", count: inPersonCount, dot: "bg-sky-500" },
                    { label: "Video", count: videoCount, dot: "bg-violet-500" },
                  ].map((r) => (
                    <li key={r.label} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", r.dot)} aria-hidden />
                      <span className="min-w-0 flex-1 text-slate-700">{r.label}</span>
                      <span className="text-[11px] tabular-nums text-slate-400">{Math.round((r.count / total) * 100)}%</span>
                      <span className="min-w-[28px] rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-700">
                        {r.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <Link
            href="/patient/appointments/book"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white transition-all hover:-translate-y-0.5"
            style={{
              background:
                "radial-gradient(420px 200px at 100% 0%, rgba(45,212,191,0.30), transparent 60%), linear-gradient(135deg, #07233a 0%, #0c4a6e 100%)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -18px rgba(7,35,58,0.6)",
            }}
          >
            <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden />
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-teal-200 ring-1 ring-inset ring-white/15">
              <CalendarPlus size={21} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-teal-200/80">
                Book
              </span>
              <span className="mt-1 block text-base font-semibold">Find a doctor & slot</span>
              <span className="block text-xs text-white/60">In-person or video, in a minute</span>
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </aside>
      </div>
    </PatientPage>
  );
}

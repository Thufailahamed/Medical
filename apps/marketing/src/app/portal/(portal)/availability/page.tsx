"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Save, Plus, Trash2, CalendarOff, CalendarDays, Clock, MoonStar,
  CalendarCheck, CheckCircle2, AlertTriangle, RotateCcw, BarChart3,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input, Select } from "@/portal/components/ui/Form";
import { toast } from "@/portal/components/ui/Toast";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  RowAccent,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

interface Slot {
  id?: string;
  dayOfWeek: number; // 0 = Sunday
  startTime: string; // "HH:mm"
  endTime: string;
  slotMinutes: number;
  active: boolean;
}

interface TimeOff {
  id: string;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // null = all day
  endTime?: string | null;
  reason?: string | null;
}

const DAYS = [
  { value: 1, key: "mon" },
  { value: 2, key: "tue" },
  { value: 3, key: "wed" },
  { value: 4, key: "thu" },
  { value: 5, key: "fri" },
  { value: 6, key: "sat" },
  { value: 0, key: "sun" },
];

// Server enforces 5–120; offering fixed choices keeps the form always-valid.
const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Order-agnostic fingerprint of the schedule for dirty tracking. */
const normalize = (arr: Slot[]) =>
  JSON.stringify(
    arr
      .map((s) => ({
        d: s.dayOfWeek, a: s.startTime, b: s.endTime, m: s.slotMinutes, x: !!s.active,
      }))
      .sort((a, b) => a.d - b.d || a.a.localeCompare(b.a) || a.b.localeCompare(b.b))
  );

const NO_SLOTS: Slot[] = [];

function fmtHours(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

type SlotErr = "order" | "overlap";

function slotErrors(slots: Slot[]): Map<number, SlotErr> {
  const errs = new Map<number, SlotErr>();
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (toMin(s.endTime) <= toMin(s.startTime)) { errs.set(i, "order"); continue; }
    for (let j = 0; j < slots.length; j++) {
      if (i === j) continue;
      const o = slots[j];
      if (o.dayOfWeek !== s.dayOfWeek) continue;
      if (toMin(o.endTime) <= toMin(o.startTime)) continue;
      if (toMin(s.startTime) < toMin(o.endTime) && toMin(o.startTime) < toMin(s.endTime)) {
        errs.set(i, "overlap");
        break;
      }
    }
  }
  return errs;
}

export default function AvailabilityPage() {
  const t = useT();
  const qc = useQueryClient();
  // Local edits overlay the server schedule; cleared when a save succeeds.
  const [draft, setDraft] = useState<Slot[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "availability"],
    queryFn: () => api<{ availability: Slot[] }>(`/doctor-portal/availability`),
  });

  const { data: timeOffData, isLoading: timeOffLoading } = useQuery({
    queryKey: ["doctor-portal", "time-off"],
    queryFn: () => api<{ timeOff: TimeOff[] }>(`/doctor-portal/time-off`),
  });

  const remote = data?.availability;
  const slots = draft ?? remote ?? NO_SLOTS;

  const save = useMutation({
    mutationFn: (schedule: Slot[]) =>
      api<{ availability: Slot[] }>(`/doctor-portal/availability`, {
        method: "PUT",
        json: { schedule },
      }),
    onSuccess: (res) => {
      toast.success(t("availability.saved"));
      setDraft(null);
      qc.setQueryData(["doctor-portal", "availability"], res);
    },
    onError: (err: unknown) =>
      toast.error(t("toast.error"), err instanceof Error ? err.message : undefined),
  });

  const errors = useMemo(() => slotErrors(slots), [slots]);
  const dirty = !!remote && normalize(slots) !== normalize(remote);

  function mutateSlots(fn: (arr: Slot[]) => Slot[]) {
    setDraft((cur) => fn(cur ?? remote ?? []));
  }

  function addSlot(dayOfWeek: number) {
    mutateSlots((arr) => [
      ...arr,
      { dayOfWeek, startTime: "09:00", endTime: "17:00", slotMinutes: 15, active: true },
    ]);
  }

  function updateSlot(i: number, patch: Partial<Slot>) {
    mutateSlots((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSlot(i: number) {
    mutateSlots((arr) => arr.filter((_, idx) => idx !== i));
  }

  // Weekly totals for the hero strip + glance panel (active, valid blocks only).
  const week = useMemo(() => {
    const perDay = new Map<number, { minutes: number; slots: number }>();
    for (const s of slots) {
      if (!s.active) continue;
      const span = toMin(s.endTime) - toMin(s.startTime);
      if (span <= 0) continue;
      const cur = perDay.get(s.dayOfWeek) ?? { minutes: 0, slots: 0 };
      cur.minutes += span;
      cur.slots += s.slotMinutes > 0 ? Math.floor(span / s.slotMinutes) : 0;
      perDay.set(s.dayOfWeek, cur);
    }
    let minutes = 0;
    let bookable = 0;
    for (const v of perDay.values()) {
      minutes += v.minutes;
      bookable += v.slots;
    }
    return { perDay, minutes, bookable, days: perDay.size };
  }, [slots]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingOff = (timeOffData?.timeOff ?? []).filter((x) => x.date >= todayIso);
  const nextOff = upcomingOff.slice().sort((a, b) => a.date.localeCompare(b.date))[0];
  const maxDayMin = Math.max(...[...week.perDay.values()].map((v) => v.minutes), 1);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<CalendarDays size={13} aria-hidden />}
          kicker="Booking hours"
          kickerMeta={`${week.days} working day${week.days === 1 ? "" : "s"}`}
          title={
            <>
              Weekly{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                availability
              </span>
            </>
          }
          description={t("availability.subtitle")}
          chips={
            <>
              {dirty ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" aria-hidden />
                  {t("availability.unsaved")}
                </span>
              ) : (
                <span className={HERO_CHIP}>
                  <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                  Schedule saved
                </span>
              )}
              {errors.size > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-400/15 px-3 py-1.5 text-xs font-semibold text-red-100">
                  <AlertTriangle size={12} aria-hidden />
                  {errors.size} block{errors.size === 1 ? "" : "s"} to fix
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              {dirty ? (
                <button type="button" onClick={() => setDraft(null)} className={HERO_GHOST}>
                  <RotateCcw size={15} aria-hidden />
                  Discard
                </button>
              ) : null}
              <button
                type="button"
                disabled={!dirty || errors.size > 0 || save.isPending}
                onClick={() => save.mutate(slots)}
                className={cn(HERO_PRIMARY, "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0")}
              >
                <Save size={15} className="text-sky-600" aria-hidden />
                {save.isPending ? "Saving…" : t("availability.save")}
              </button>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Hours per week"
            icon={<Clock size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : fmtHours(week.minutes)}
            sub="Active booking blocks"
            progress={Math.min(100, Math.round((week.minutes / (40 * 60)) * 100))}
          />
          <StatTile
            label="Bookable slots"
            icon={<CalendarCheck size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(week.bookable)}
            unit="/ week"
            sub="Patients can book these"
          />
          <StatTile
            label="Working days"
            icon={<CalendarDays size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={`${week.days}`}
            unit="/ 7"
            sub={week.days === 7 ? "Open every day" : `${7 - week.days} day${7 - week.days === 1 ? "" : "s"} off`}
          />
          <StatTile
            label="Upcoming time off"
            icon={<MoonStar size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={timeOffLoading ? "…" : String(upcomingOff.length)}
            sub={nextOff ? `Next: ${format(parseISO(nextOff.date), "EEE, MMM d")}` : "Nothing blocked"}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
      <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="av-weekly">
        <PanelHeader
          id="av-weekly"
          icon={<CalendarDays size={16} />}
          tone="bg-teal-50 text-teal-600"
          title={t("availability.weekly")}
          caption={t("availability.slotsCount", { count: slots.length })}
        />
        {isLoading ? (
          <div className="mt-2 flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                <Skeleton className="h-9 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="-mx-5 flex flex-col divide-y divide-slate-100 sm:-mx-6">
            {DAYS.map((d) => {
              const daySlots = slots
                .map((s, i) => ({ s, i }))
                .filter((x) => x.s.dayOfWeek === d.value)
                .sort((a, b) => a.s.startTime.localeCompare(b.s.startTime));

              return (
                <li key={d.value} className="px-5 py-3.5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-extrabold uppercase shrink-0",
                      daySlots.length ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-400"
                    )}>
                      {t(`availability.day.${d.key}`)}
                    </div>
                    {daySlots.length === 0 && (
                      <span className="text-xs text-text-muted italic">{t("availability.dayOff")}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => addSlot(d.value)}
                      className="ml-auto h-7 px-2.5 rounded-lg text-[11px] font-bold text-text-muted hover:text-brand hover:bg-brand-soft/60 transition-colors flex items-center gap-1"
                    >
                      <Plus size={12} />
                      {t("availability.addBlock")}
                    </button>
                  </div>

                  {daySlots.length > 0 && (
                    <div className="mt-2.5 ml-11 flex flex-col gap-1.5">
                      {daySlots.map(({ s, i }) => {
                        const err = errors.get(i);
                        const span = toMin(s.endTime) - toMin(s.startTime);
                        const approx = span > 0 && s.slotMinutes > 0 ? Math.floor(span / s.slotMinutes) : 0;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center gap-2 flex-wrap px-3 py-2 rounded-xl transition-colors",
                              err
                                ? "bg-red-50/60 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3)]"
                                : s.active
                                  ? "bg-slate-50 hover:bg-slate-100/70"
                                  : "bg-slate-50/60 opacity-70"
                            )}
                          >
                            <div className="w-28 shrink-0">
                              <Input
                                type="time"
                                aria-label={t("availability.from")}
                                className={cn(err === "order" && "border-red-300")}
                                value={s.startTime}
                                onChange={(e) => updateSlot(i, { startTime: e.target.value })}
                              />
                            </div>
                            <span className="text-text-muted text-xs">→</span>
                            <div className="w-28 shrink-0">
                              <Input
                                type="time"
                                aria-label={t("availability.to")}
                                className={cn(err === "order" && "border-red-300")}
                                value={s.endTime}
                                onChange={(e) => updateSlot(i, { endTime: e.target.value })}
                              />
                            </div>
                            <div className="w-28 shrink-0">
                              <Select
                                aria-label={t("availability.slotMinutes")}
                                value={String(s.slotMinutes)}
                                onChange={(e) => updateSlot(i, { slotMinutes: Number(e.target.value) })}
                                options={SLOT_LENGTHS.map((n) => ({
                                  value: String(n),
                                  label: `${n} ${t("availability.min")}`,
                                }))}
                              />
                            </div>
                            {approx > 0 && (
                              <span className="text-[11px] text-text-muted tabular-nums flex items-center gap-1">
                                <Clock size={11} />
                                ≈ {t("availability.slotsCount", { count: approx })}
                              </span>
                            )}
                            {err && (
                              <span className="text-[11px] font-bold text-red-600">
                                {t(err === "order" ? "availability.errTimeOrder" : "availability.errOverlap")}
                              </span>
                            )}
                            <div className="ml-auto flex items-center gap-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={s.active}
                                aria-label={t("availability.active")}
                                onClick={() => updateSlot(i, { active: !s.active })}
                                className={cn(
                                  "h-5 w-9 rounded-full relative transition-colors shrink-0",
                                  s.active ? "bg-emerald-500" : "bg-slate-300"
                                )}
                              >
                                <span className={cn(
                                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                                  s.active ? "left-[18px]" : "left-0.5"
                                )} />
                              </button>
                              <button
                                type="button"
                                aria-label={t("availability.remove")}
                                onClick={() => removeSlot(i)}
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Week at a glance">
        <section className={PANEL} aria-labelledby="av-glance">
          <PanelHeader
            id="av-glance"
            icon={<BarChart3 size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Week at a glance"
            caption={`${fmtHours(week.minutes)} across ${week.days} day${week.days === 1 ? "" : "s"}`}
          />
          <ul className="mt-5 flex flex-col gap-2.5">
            {DAYS.map((d) => {
              const v = week.perDay.get(d.value);
              return (
                <li key={d.value} className="flex items-center gap-3">
                  <span className="w-9 shrink-0 text-[11px] font-semibold uppercase text-slate-500">
                    {t(`availability.day.${d.key}`)}
                  </span>
                  <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    {v ? (
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
                        style={{ width: `${(v.minutes / maxDayMin) * 100}%` }}
                      />
                    ) : null}
                  </span>
                  <span className={cn("w-16 shrink-0 text-right text-[11px] tabular-nums", v ? "font-semibold text-slate-700" : "text-slate-300")}>
                    {v ? `${fmtHours(v.minutes)} · ${v.slots}` : "Off"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            Hours · bookable slots per day. Paused blocks aren&apos;t counted.
          </p>
        </section>
      </aside>
      </div>

      <TimeOffSection
        items={timeOffData?.timeOff ?? []}
        loading={timeOffLoading}
        onChanged={() => qc.invalidateQueries({ queryKey: ["doctor-portal", "time-off"] })}
      />
    </div>
  );
}

function TimeOffSection({
  items,
  loading,
  onChanged,
}: {
  items: TimeOff[];
  loading: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api(`/doctor-portal/time-off`, {
        method: "POST",
        json: {
          date,
          startTime: allDay ? undefined : startTime || undefined,
          endTime: allDay ? undefined : endTime || undefined,
          reason: reason.trim() ? reason.trim() : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("availability.timeOffAdded"));
      setDate(""); setAllDay(true); setStartTime(""); setEndTime(""); setReason(""); setFormErr(null);
      onChanged();
    },
    onError: (err: unknown) =>
      toast.error(t("toast.error"), err instanceof Error ? err.message : undefined),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/doctor-portal/time-off/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("availability.removed"));
      onChanged();
    },
    onError: (err: unknown) =>
      toast.error(t("toast.error"), err instanceof Error ? err.message : undefined),
  });

  function submit() {
    if (!date) { setFormErr(t("availability.dateRequired")); return; }
    if (!allDay) {
      if (!startTime || !endTime) { setFormErr(t("availability.errTimesIncomplete")); return; }
      if (toMin(endTime) <= toMin(startTime)) { setFormErr(t("availability.errTimeOrder")); return; }
    }
    const dupe = items.some(
      (it) =>
        it.date === date &&
        (it.startTime ?? null) === (allDay ? null : startTime) &&
        (it.endTime ?? null) === (allDay ? null : endTime)
    );
    if (dupe) { setFormErr(t("availability.duplicateTimeOff")); return; }
    setFormErr(null);
    create.mutate();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className={cn(PANEL, "overflow-hidden")} aria-labelledby="av-timeoff">
      <PanelHeader
        id="av-timeoff"
        icon={<MoonStar size={16} />}
        tone="bg-amber-50 text-amber-600"
        title={t("availability.timeOff")}
        caption="Block a full day or part of a day — bookings are paused automatically"
      />

      <div className="mt-5 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3.5">
        <Input
          type="date"
          label={t("availability.date")}
          wrapperClassName="w-40"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="flex items-center gap-2 pb-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={allDay}
            onClick={() => setAllDay((v) => !v)}
            className={cn("h-5 w-9 rounded-full relative transition-colors shrink-0", allDay ? "bg-emerald-500" : "bg-slate-300")}
          >
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all", allDay ? "left-[18px]" : "left-0.5")} />
          </button>
          <span className="text-xs font-semibold text-text-soft">{t("availability.allDay")}</span>
        </div>
        {!allDay && (
          <>
            <Input
              type="time"
              label={t("availability.from")}
              wrapperClassName="w-32"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              type="time"
              label={t("availability.to")}
              wrapperClassName="w-32"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </>
        )}
        <Input
          label={t("availability.reason")}
          placeholder={t("availability.reasonPlaceholder")}
          wrapperClassName="flex-1 min-w-[160px]"
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        />
        <Button
          type="button"
          leftIcon={<CalendarOff size={14} />}
          loading={create.isPending}
          onClick={submit}
          className="mb-px"
        >
          {t("availability.add")}
        </Button>
      </div>
      {formErr && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">
          {formErr}
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-5 w-20 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyBlock
          icon={<MoonStar size={19} />}
          title={t("availability.emptyTimeOff")}
          body="Add leave, conferences or half-days above so patients can't book over them."
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((it) => {
            const past = it.date < today;
            const partial = it.startTime && it.endTime;
            return (
              <li
                key={it.id}
                className={cn(LIST_ROW, "flex-row items-center", past && "opacity-55")}
              >
                <RowAccent className={partial ? "bg-sky-500" : "bg-amber-400"} />
                <div className={cn(
                  "ml-1.5 h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset",
                  partial ? "bg-sky-50 text-sky-600 ring-sky-600/15" : "bg-amber-50 text-amber-600 ring-amber-600/15"
                )}>
                  <CalendarOff size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-bold text-text">
                      {format(parseISO(it.date), "EEE, MMM d, yyyy")}
                    </span>
                    <Pill tone={partial ? "info" : "warn"}>
                      {partial ? `${it.startTime} – ${it.endTime}` : t("availability.allDay")}
                    </Pill>
                    {past && <Pill>{t("availability.past")}</Pill>}
                  </div>
                  {it.reason && (
                    <div className="text-[11px] text-text-muted mt-0.5 truncate">{it.reason}</div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={t("availability.remove")}
                  onClick={() => del.mutate(it.id)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

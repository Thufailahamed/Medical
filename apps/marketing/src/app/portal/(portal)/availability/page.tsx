"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, Trash2, CalendarOff, CalendarDays, Clock, MoonStar } from "lucide-react";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input, Select } from "@/portal/components/ui/Form";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader } from "@/portal/components/ui/PageHeader";
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("availability.title")}
        subtitle={t("availability.subtitle")}
        icon={<CalendarDays size={18} className="text-teal-600" />}
        badge={dirty ? (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
            {t("availability.unsaved")}
          </span>
        ) : undefined}
        actions={
          <Button
            leftIcon={<Save size={14} />}
            disabled={!dirty || errors.size > 0}
            loading={save.isPending}
            onClick={() => save.mutate(slots)}
          >
            {t("availability.save")}
          </Button>
        }
      />

      <Card padding={false} className="rounded-2xl overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-text">{t("availability.weekly")}</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {t("availability.slotsCount", { count: slots.length })}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="px-5 pb-5 flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                <Skeleton className="h-9 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border/50">
            {DAYS.map((d) => {
              const daySlots = slots
                .map((s, i) => ({ s, i }))
                .filter((x) => x.s.dayOfWeek === d.value)
                .sort((a, b) => a.s.startTime.localeCompare(b.s.startTime));

              return (
                <li key={d.value} className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-extrabold uppercase shrink-0",
                      daySlots.length ? "bg-brand-soft text-brand" : "bg-surface-2 text-text-muted"
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
                              "flex items-center gap-2 flex-wrap px-3 py-2 rounded-xl border transition-colors",
                              err
                                ? "border-red-200 bg-red-50/50"
                                : s.active
                                  ? "border-border/60 bg-surface-2/40 hover:bg-surface-2/60"
                                  : "border-border/40 bg-surface-2/20 opacity-70"
                            )}
                          >
                            <Input
                              type="time"
                              aria-label={t("availability.from")}
                              className={cn("w-28", err === "order" && "border-red-300")}
                              value={s.startTime}
                              onChange={(e) => updateSlot(i, { startTime: e.target.value })}
                            />
                            <span className="text-text-muted text-xs">→</span>
                            <Input
                              type="time"
                              aria-label={t("availability.to")}
                              className={cn("w-28", err === "order" && "border-red-300")}
                              value={s.endTime}
                              onChange={(e) => updateSlot(i, { endTime: e.target.value })}
                            />
                            <Select
                              aria-label={t("availability.slotMinutes")}
                              className="w-24"
                              value={String(s.slotMinutes)}
                              onChange={(e) => updateSlot(i, { slotMinutes: Number(e.target.value) })}
                              options={SLOT_LENGTHS.map((n) => ({
                                value: String(n),
                                label: `${n} ${t("availability.min")}`,
                              }))}
                            />
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
      </Card>

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
    <Card padding={false} className="rounded-2xl overflow-hidden">
      <CardHeader
        title={t("availability.timeOff")}
        right={<MoonStar size={15} className="text-text-muted" />}
      />

      <div className="px-4 sm:px-5 py-3.5 border-b border-border/50 bg-surface-2/30 flex items-end gap-2 flex-wrap">
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
        <div className="px-5 py-2 text-[11px] font-semibold text-red-600 bg-red-50/60 border-b border-red-100">
          {formErr}
        </div>
      )}

      {loading ? (
        <div className="p-4 sm:p-5 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-5 w-20 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty
          title={t("availability.emptyTimeOff")}
          icon={<MoonStar size={20} className="text-text-muted" />}
          className="py-10"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border/50">
          {items.map((it) => {
            const past = it.date < today;
            const partial = it.startTime && it.endTime;
            return (
              <li
                key={it.id}
                className={cn(
                  "group flex items-center gap-3 px-5 py-3 hover:bg-surface-2/40 transition-colors",
                  past && "opacity-55"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset",
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
    </Card>
  );
}

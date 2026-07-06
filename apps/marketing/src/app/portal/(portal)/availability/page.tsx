"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, Trash2, CalendarOff, CalendarDays } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input, Select } from "@/portal/components/ui/Form";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
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
  startDate: string;
  endDate: string;
  reason?: string | null;
}

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default function AvailabilityPage() {
  const t = useT();
  const qc = useQueryClient();
  const [slots, setSlots] = useState<Slot[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "availability"],
    queryFn: () => api<{ availability: Slot[] }>(`/doctor-portal/availability`),
  });

  const { data: timeOffData } = useQuery({
    queryKey: ["doctor-portal", "time-off"],
    queryFn: () => api<{ timeOff: TimeOff[] }>(`/doctor-portal/time-off`),
  });

  useEffect(() => {
    if (data?.availability) setSlots(data.availability);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/doctor-portal/availability`, {
        method: "PUT",
        json: { schedule: slots },
      }),
    onSuccess: () => {
      toast.success("Availability saved");
      qc.invalidateQueries({ queryKey: ["doctor-portal", "availability"] });
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  function addSlot() {
    setSlots((arr) => [
      ...arr,
      { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", slotMinutes: 15, active: true },
    ]);
  }

  function updateSlot(i: number, patch: Partial<Slot>) {
    setSlots((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSlot(i: number) {
    setSlots((arr) => arr.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("availability.title")}
        subtitle={t("availability.subtitle")}
        icon={<CalendarDays size={18} className="text-teal-600" />}
        actions={
          <Button
            leftIcon={<Save size={14} />}
            disabled={save.isPending}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {t("availability.save")}
          </Button>
        }
      />

      <Card className="rounded-2xl border-border/50">
        <CardHeader
          title="Weekly schedule"
          right={
            <Button size="sm" variant="secondary" leftIcon={<Plus size={12} />} onClick={addSlot}>
              Add slot
            </Button>
          }
        />
        {isLoading ? (
          <Skeleton className="h-10 w-full mt-3" />
        ) : slots.length === 0 ? (
          <Empty title="No availability set" />
        ) : (
          <ul className="flex flex-col gap-2 mt-3">
            {slots.map((s, i) => (
              <li key={i} className="flex items-center gap-2 p-2 rounded-xl bg-surface-2/40 transition-colors hover:bg-surface-2/60">
                <Select
                  className="w-24"
                  value={String(s.dayOfWeek)}
                  onChange={(e) => updateSlot(i, { dayOfWeek: Number(e.target.value) })}
                  options={DAYS.map((d) => ({ value: String(d.value), label: d.label }))}
                />
                <Input
                  type="time"
                  className="w-28"
                  value={s.startTime}
                  onChange={(e) => updateSlot(i, { startTime: e.target.value })}
                />
                <span className="text-text-muted text-xs">to</span>
                <Input
                  type="time"
                  className="w-28"
                  value={s.endTime}
                  onChange={(e) => updateSlot(i, { endTime: e.target.value })}
                />
                <Input
                  type="number"
                  className="w-20"
                  value={String(s.slotMinutes)}
                  onChange={(e) =>
                    updateSlot(i, { slotMinutes: Number(e.target.value) || 15 })
                  }
                />
                <span className="text-xs text-text-muted">min</span>
                <label className="flex items-center gap-1 ml-2 text-xs">
                  <input
                    type="checkbox"
                    checked={s.active}
                    onChange={(e) => updateSlot(i, { active: e.target.checked })}
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  className="ml-auto text-text-muted hover:text-danger transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <TimeOffSection
        items={timeOffData?.timeOff ?? []}
        onChanged={() => qc.invalidateQueries({ queryKey: ["doctor-portal", "time-off"] })}
      />
    </div>
  );
}

function TimeOffSection({
  items,
  onChanged,
}: {
  items: TimeOff[];
  onChanged: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api(`/doctor-portal/time-off`, {
        method: "POST",
        json: { startDate: start, endDate: end, reason: reason || undefined },
      }),
    onSuccess: () => {
      toast.success("Time off added");
      onChanged();
      setStart("");
      setEnd("");
      setReason("");
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/doctor-portal/time-off/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removed");
      onChanged();
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  return (
    <Card padding={false} className="rounded-2xl border-border/50">
      <CardHeader title="Time off" />
      <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-2 items-end border-b border-border/50">
        <Input
          type="date"
          label="Start"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <Input
          type="date"
          label="End"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
        <Input
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Leave / holiday"
        />
        <Button
          leftIcon={<CalendarOff size={14} />}
          disabled={!start || !end || create.isPending}
          loading={create.isPending}
          onClick={() => create.mutate()}
        >
          Add
        </Button>
      </div>
      {items.length === 0 ? (
        <Empty title="No time off scheduled" className="m-4" />
      ) : (
        <ul className="flex flex-col">
          {items.map((t) => (
            <li key={t.id} className="group flex items-center gap-2 px-4 py-2.5 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <CalendarOff size={18} />
              </div>
              <Pill tone="warn">
                {t.startDate} to {t.endDate}
              </Pill>
              <span className="text-sm text-text flex-1 truncate">
                {t.reason ?? "---"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Trash2 size={12} />}
                onClick={() => del.mutate(t.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

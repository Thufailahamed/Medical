"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, Trash2, CalendarOff, CalendarDays } from "lucide-react";
import { z } from "zod";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input, Select } from "@/portal/components/ui/Form";
import {
  RHFFormProvider,
  RHFInput,
} from "@/portal/components/ui/FormKit";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

const timeOffSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().max(200, "Reason must be 200 characters or fewer").optional().or(z.literal("")),
}).refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

type TimeOffValues = z.infer<typeof timeOffSchema>;

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
  { value: 1, key: "mon" },
  { value: 2, key: "tue" },
  { value: 3, key: "wed" },
  { value: 4, key: "thu" },
  { value: 5, key: "fri" },
  { value: 6, key: "sat" },
  { value: 0, key: "sun" },
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
      toast.success(t("availability.saved"));
      qc.invalidateQueries({ queryKey: ["doctor-portal", "availability"] });
    },
    onError: (err: any) => toast.error(t("toast.error"), err?.message),
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
          title={t("availability.weekly")}
          right={
            <Button size="sm" variant="secondary" leftIcon={<Plus size={12} />} onClick={addSlot}>
              {t("availability.addSlot")}
            </Button>
          }
        />
        {isLoading ? (
          <Skeleton className="h-10 w-full mt-3" />
        ) : slots.length === 0 ? (
          <Empty title={t("availability.empty")} />
        ) : (
          <ul className="flex flex-col gap-2 mt-3">
            {slots.map((s, i) => (
              <li key={i} className="flex items-center gap-2 p-2 rounded-xl bg-surface-2/40 transition-colors hover:bg-surface-2/60">
                <Select
                  className="w-24"
                  value={String(s.dayOfWeek)}
                  onChange={(e) => updateSlot(i, { dayOfWeek: Number(e.target.value) })}
                  options={DAYS.map((d) => ({ value: String(d.value), label: t(`availability.day.${d.key}`) }))}
                />
                <Input
                  type="time"
                  className="w-28"
                  value={s.startTime}
                  onChange={(e) => updateSlot(i, { startTime: e.target.value })}
                />
                <span className="text-text-muted text-xs">{t("availability.to")}</span>
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
                <span className="text-xs text-text-muted">{t("availability.min")}</span>
                <label className="flex items-center gap-1 ml-2 text-xs">
                  <input
                    type="checkbox"
                    checked={s.active}
                    onChange={(e) => updateSlot(i, { active: e.target.checked })}
                  />
                  {t("availability.active")}
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
  const t = useT();

  const create = useMutation({
    mutationFn: (values: TimeOffValues) =>
      api(`/doctor-portal/time-off`, {
        method: "POST",
        json: {
          startDate: values.startDate,
          endDate: values.endDate,
          reason: values.reason?.trim() ? values.reason.trim() : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("availability.timeOffAdded"));
      onChanged();
    },
    onError: (err: any) => toast.error(t("toast.error"), err?.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/doctor-portal/time-off/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("availability.removed"));
      onChanged();
    },
    onError: (err: any) => toast.error(t("toast.error"), err?.message),
  });

  return (
    <Card padding={false} className="rounded-2xl border-border/50">
      <CardHeader title={t("availability.timeOff")} />
      <RHFFormProvider
        schema={timeOffSchema}
        defaultValues={{ startDate: "", endDate: "", reason: "" }}
      >
        {(form) => (
          <form
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
            className="px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-2 items-end border-b border-border/50"
          >
            <RHFInput
              type="date"
              name="startDate"
              label={t("availability.start")}
              required
            />
            <RHFInput
              type="date"
              name="endDate"
              label={t("availability.end")}
              required
            />
            <RHFInput
              name="reason"
              label={t("availability.reason")}
              placeholder={t("availability.reasonPlaceholder")}
            />
            <Button
              type="submit"
              leftIcon={<CalendarOff size={14} />}
              loading={create.isPending}
            >
              {t("availability.add")}
            </Button>
          </form>
        )}
      </RHFFormProvider>
      {items.length === 0 ? (
        <Empty title={t("availability.emptyTimeOff")} className="m-4" />
      ) : (
        <ul className="flex flex-col">
          {items.map((it) => (
            <li key={it.id} className="group flex items-center gap-2 px-4 py-2.5 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <CalendarOff size={18} />
              </div>
              <Pill tone="warn">
                {it.startDate} {t("availability.to")} {it.endDate}
              </Pill>
              <span className="text-sm text-text flex-1 truncate">
                {it.reason ?? "---"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Trash2 size={12} />}
                onClick={() => del.mutate(it.id)}
              >
                {t("availability.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

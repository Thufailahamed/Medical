"use client";

import { AlertCircle, CalendarDays, Clock, Pill, Utensils } from "lucide-react";

import { cn } from "@/portal/lib/utils";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  GROUP_LABEL,
  PANEL,
  PanelHeader,
} from "@/patient/components/workspace";
import { formatDayLabel } from "@/patient/lib/format";

export const FREQUENCY_OPTIONS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "As needed",
];

export const TIMING_OPTIONS = [
  "Before food",
  "After food",
  "With food",
  "Any time",
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
];

export type MedicineDraft = {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  startDate: string;
  endDate: string;
  notes: string;
};

/** Pill-chip picker for a short fixed list (frequency / timing). */
function ChipPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  // Keep a legacy value (e.g. "3 times daily") selectable.
  const all = options.includes(value) || !value ? options : [value, ...options];
  return (
    <div role="radiogroup" aria-label={label}>
      <p className={FIELD_LABEL}>{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {all.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o)}
              className={cn(
                "h-9 rounded-lg px-3 text-xs font-semibold transition-all",
                on
                  ? "bg-[#07233a] text-white shadow-md shadow-slate-900/15"
                  : "bg-slate-50 text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:bg-white hover:text-slate-900",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Shared add / edit medicine form body — one white panel of fields. */
export function MedicineFormPanel({
  draft,
  onChange,
  error,
  nameSlot,
  title,
  caption,
}: {
  draft: MedicineDraft;
  onChange: (patch: Partial<MedicineDraft>) => void;
  error?: string | null;
  /** Rendered under the name input (e.g. suggestions). */
  nameSlot?: React.ReactNode;
  title: string;
  caption: string;
}) {
  return (
    <section className={PANEL} aria-labelledby="med-form">
      <PanelHeader id="med-form" icon={<Pill size={16} />} tone="bg-emerald-50 text-emerald-600" title={title} caption={caption} />

      <p className={cn(GROUP_LABEL, "mt-6")}>Medicine</p>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="medicine-name" className={FIELD_LABEL}>Name</label>
          <input
            id="medicine-name"
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Atorvastatin"
            required
            autoComplete="off"
            className={FIELD_INPUT}
          />
          {nameSlot}
        </div>
        <div>
          <label htmlFor="medicine-dosage" className={FIELD_LABEL}>Dosage</label>
          <input
            id="medicine-dosage"
            type="text"
            value={draft.dosage}
            onChange={(e) => onChange({ dosage: e.target.value })}
            placeholder="e.g. 10 mg, 1 tablet"
            required
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <p className={cn(GROUP_LABEL, "mt-6")}>Schedule</p>
      <div className="mt-2 flex flex-col gap-4">
        <ChipPicker label="How often" value={draft.frequency} options={FREQUENCY_OPTIONS} onChange={(v) => onChange({ frequency: v })} />
        <ChipPicker label="When" value={draft.timing} options={TIMING_OPTIONS} onChange={(v) => onChange({ timing: v })} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="start-date" className={FIELD_LABEL}>Start date</label>
            <input
              id="start-date"
              type="date"
              value={draft.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              required
              className={FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor="end-date" className={FIELD_LABEL}>
              End date <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="end-date"
              type="date"
              value={draft.endDate}
              min={draft.startDate || undefined}
              onChange={(e) => onChange({ endDate: e.target.value })}
              className={FIELD_INPUT}
            />
          </div>
        </div>
      </div>

      <p className={cn(GROUP_LABEL, "mt-6")}>Notes</p>
      <div className="mt-2">
        <label htmlFor="notes" className="sr-only">Notes</label>
        <textarea
          id="notes"
          value={draft.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Special instructions, side effects to watch for…"
          rows={3}
          className={cn(FIELD_TEXTAREA, "mt-0")}
        />
      </div>

      {error ? (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
          <AlertCircle size={14} className="shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}
    </section>
  );
}

/** Live preview of how the medicine will appear on the plan. */
export function MedicinePreview({ draft }: { draft: MedicineDraft }) {
  return (
    <section className={PANEL} aria-label="Preview">
      <p className={GROUP_LABEL}>Preview</p>
      <div className="relative mt-3 flex items-center gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
        <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-emerald-500" aria-hidden />
        <span className="ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-emerald-600" aria-hidden>
          <Pill size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-sm font-semibold", draft.name ? "text-slate-900" : "text-slate-300")}>
              {draft.name || "Medicine name"}
            </span>
            {draft.dosage ? (
              <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">{draft.dosage}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-400">
            {draft.frequency} · {draft.timing}
          </span>
        </span>
      </div>
      <ul className="mt-4 flex flex-col gap-0.5 text-[13px]">
        <li className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5">
          <Clock size={14} className="text-slate-400" aria-hidden />
          <span className="flex-1 text-slate-500">How often</span>
          <span className="font-semibold text-slate-800">{draft.frequency}</span>
        </li>
        <li className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5">
          <Utensils size={14} className="text-slate-400" aria-hidden />
          <span className="flex-1 text-slate-500">When</span>
          <span className="font-semibold text-slate-800">{draft.timing}</span>
        </li>
        <li className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5">
          <CalendarDays size={14} className="text-slate-400" aria-hidden />
          <span className="flex-1 text-slate-500">Course</span>
          <span className="truncate font-semibold text-slate-800">
            {draft.startDate ? formatDayLabel(draft.startDate) : "—"}
            {draft.endDate ? ` → ${formatDayLabel(draft.endDate)}` : " · ongoing"}
          </span>
        </li>
      </ul>
    </section>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import { VITAL_REGISTRY } from "@/patient/lib/vitals";
import type { VitalContext, VitalType } from "@/patient/types/patient";

const CONTEXTS: VitalContext[] = [
  "resting",
  "fasting",
  "post_meal",
  "pre_meal",
  "post_medication",
  "pre_medication",
  "exercise",
  "standing",
  "supine",
  "random",
];

const TYPES = Object.keys(VITAL_REGISTRY) as VitalType[];

export function AddVitalSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    type: VitalType;
    value: number;
    secondaryValue?: number | null;
    context?: VitalContext | null;
    notes?: string | null;
  }) => Promise<void>;
}) {
  const [type, setType] = useState<VitalType>("heart_rate");
  const [value, setValue] = useState("");
  const [secondary, setSecondary] = useState("");
  const [context, setContext] = useState<VitalContext | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (!Number.isFinite(num)) {
      setErr("Value must be a number");
      return;
    }
    if (type === "blood_pressure" && !secondary) {
      setErr("Diastolic value required for blood pressure");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        type,
        value: num,
        secondaryValue: secondary ? Number(secondary) : null,
        context: context || null,
        notes: notes.trim() || null,
      });
      setValue("");
      setSecondary("");
      setContext("");
      setNotes("");
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  const meta = VITAL_REGISTRY[type];

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Add vital reading">
      <div className="flex items-center justify-between">
        <h2 className="t-page text-text">Add vital reading</h2>
        <button
          aria-label="Close"
          onClick={onClose}
          className="text-text-muted hover:text-text"
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Type</span>
          <select
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={type}
            onChange={(e) => setType(e.target.value as VitalType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {VITAL_REGISTRY[t].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">
            Value ({meta.unit})
          </span>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </label>
        {type === "blood_pressure" && (
          <label className="block">
            <span className="text-sm font-medium">Diastolic (mmHg)</span>
            <input
              type="number"
              inputMode="decimal"
              className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              required
            />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-medium">Context (optional)</span>
          <select
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={context}
            onChange={(e) => setContext(e.target.value as VitalContext | "")}
          >
            <option value="">—</option>
            {CONTEXTS.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>
        {err && <p className="text-sm text-danger">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-brand py-2 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Sheet>
  );
}

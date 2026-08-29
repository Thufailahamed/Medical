"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import type { SymptomRow } from "@/patient/types/patient";

const SEVERITIES: NonNullable<SymptomRow["severity"]>[] = [
  "mild",
  "moderate",
  "severe",
];

export function AddSymptomSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    symptom: string;
    severity: SymptomRow["severity"];
    startedAt: string;
    notes: string | null;
  }) => Promise<void>;
}) {
  const [symptom, setSymptom] = useState("");
  const [severity, setSeverity] = useState<SymptomRow["severity"]>("mild");
  const [startedAt, setStartedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!symptom.trim()) {
      setErr("Symptom name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        symptom: symptom.trim(),
        severity,
        startedAt,
        notes: notes.trim() || null,
      });
      setSymptom("");
      setNotes("");
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Log symptom">
      <div className="flex items-center justify-between">
        <h2 className="t-page text-text">Log symptom</h2>
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
          <span className="text-sm font-medium">Symptom</span>
          <input
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Severity</span>
          <select
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={severity ?? "mild"}
            onChange={(e) => setSeverity(e.target.value as SymptomRow["severity"])}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Started</span>
          <input
            type="date"
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
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

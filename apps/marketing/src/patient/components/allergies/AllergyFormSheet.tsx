"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import type { AllergyRow } from "@/patient/types/patient";

const SEVERITIES: NonNullable<AllergyRow["severity"]>[] = [
  "mild",
  "moderate",
  "severe",
  "critical",
];

export function AllergyFormSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    substance: string;
    severity: AllergyRow["severity"];
    reaction: string | null;
    notes: string | null;
  }) => Promise<void>;
}) {
  const [substance, setSubstance] = useState("");
  const [severity, setSeverity] = useState<AllergyRow["severity"]>("moderate");
  const [reaction, setReaction] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!substance.trim()) {
      setErr("Substance is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        substance: substance.trim(),
        severity,
        reaction: reaction.trim() || null,
        notes: notes.trim() || null,
      });
      setSubstance("");
      setReaction("");
      setNotes("");
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Add allergy">
      <div className="flex items-center justify-between">
        <h2 className="t-page text-text">Add allergy</h2>
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
          <span className="text-sm font-medium">Substance</span>
          <input
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={substance}
            onChange={(e) => setSubstance(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Severity</span>
          <select
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={severity ?? "mild"}
            onChange={(e) =>
              setSeverity(e.target.value as AllergyRow["severity"])
            }
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Reaction (optional)</span>
          <input
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={reaction}
            onChange={(e) => setReaction(e.target.value)}
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

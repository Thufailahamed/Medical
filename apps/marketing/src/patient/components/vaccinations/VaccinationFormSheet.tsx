"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";

export function VaccinationFormSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    vaccineName: string;
    dose?: string | null;
    administeredAt?: string;
    provider?: string | null;
    notes?: string | null;
  }) => Promise<void>;
}) {
  const [vaccineName, setVaccineName] = useState("");
  const [dose, setDose] = useState("");
  const [administeredAt, setAdministeredAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [provider, setProvider] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vaccineName.trim()) {
      setErr("Vaccine name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        vaccineName: vaccineName.trim(),
        dose: dose.trim() || null,
        administeredAt,
        provider: provider.trim() || null,
        notes: notes.trim() || null,
      });
      setVaccineName("");
      setDose("");
      setProvider("");
      setNotes("");
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Record vaccination">
      <div className="flex items-center justify-between">
        <h2 className="t-page text-text">Record vaccination</h2>
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
          <span className="text-sm font-medium">Vaccine</span>
          <input
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={vaccineName}
            onChange={(e) => setVaccineName(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Dose (optional)</span>
          <input
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Date administered</span>
          <input
            type="date"
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={administeredAt}
            onChange={(e) => setAdministeredAt(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Provider (optional)</span>
          <input
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
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

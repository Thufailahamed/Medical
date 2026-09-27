"use client";

import { useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  FileText,
  Loader2,
  Syringe,
  X,
} from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import { cn } from "@/portal/lib/utils";

const COMMON_VACCINES = [
  "COVID-19 Booster",
  "Influenza (Flu)",
  "Hepatitis B",
  "Tetanus (Tdap)",
  "MMR",
  "Varicella",
  "HPV",
  "BCG",
  "Polio (IPV)",
];

const COMMON_DOSES = ["Dose 1", "Dose 2", "Dose 3", "Booster", "Annual Dose"];

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
    new Date().toISOString().slice(0, 10),
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
      setErr(e instanceof Error ? e.message : "Failed to record vaccination");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Record vaccination">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-soft text-brand shrink-0 shadow-2xs" aria-hidden>
              <Syringe size={20} />
            </div>
            <div>
              <h2 className="t-card-title text-text">
                Record Vaccination
              </h2>
              <p className="text-xs text-text-soft mt-0.5">
                Add an administered immunization to your clinical profile.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-5">
          {/* Vaccine Name */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
              <Syringe size={13} className="text-brand" aria-hidden />
              Vaccine Name
            </label>
            <input
              type="text"
              className="pt-input text-xs sm:text-sm"
              value={vaccineName}
              onChange={(e) => setVaccineName(e.target.value)}
              placeholder="e.g. COVID-19 Booster, Hepatitis B, MMR..."
              required
            />

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_VACCINES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVaccineName(v)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                    vaccineName === v
                      ? "bg-ink text-white font-bold shadow-2xs"
                      : "bg-surface-2 text-text-soft hover:text-text",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Dose (optional) */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft">
              Dose / Stage (Optional)
            </label>
            <input
              type="text"
              className="pt-input text-xs sm:text-sm"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="e.g. Dose 1, Booster, Annual..."
            />

            <div className="flex flex-wrap gap-1.5">
              {COMMON_DOSES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDose(d)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                    dose === d
                      ? "bg-ink text-white font-bold shadow-2xs"
                      : "bg-surface-2 text-text-soft hover:text-text",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Date Administered */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
              <Calendar size={13} className="text-brand" aria-hidden />
              Date Administered
            </label>
            <input
              type="date"
              className="pt-input text-xs sm:text-sm"
              value={administeredAt}
              onChange={(e) => setAdministeredAt(e.target.value)}
              required
            />
          </div>

          {/* Provider / Clinic (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
              <Building2 size={13} className="text-brand" aria-hidden />
              Administering Clinic / Provider (Optional)
            </label>
            <input
              type="text"
              className="pt-input text-xs sm:text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. Asiri Central Hospital, MOH Clinic..."
            />
          </div>

          {/* Clinical Notes / Batch (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
              <FileText size={13} className="text-brand" aria-hidden />
              Notes / Lot &amp; Batch Number (Optional)
            </label>
            <textarea
              className="pt-input h-auto py-3 text-xs sm:text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Batch #PF-88219, administered left deltoid..."
            />
          </div>

          {err && (
            <div className="p-3 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" aria-hidden />
              <span>{err}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="pt-btn pt-btn-ghost h-10 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="pt-btn pt-btn-primary h-10 px-6 text-xs disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Saving Record…
                </>
              ) : (
                <>
                  <Check size={14} aria-hidden />
                  Save Immunisation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}

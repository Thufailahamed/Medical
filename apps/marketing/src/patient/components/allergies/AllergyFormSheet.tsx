"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import type { AllergyRow } from "@/patient/types/patient";
import { cn } from "@/portal/lib/utils";

const SEVERITIES: Array<{
  value: NonNullable<AllergyRow["severity"]>;
  label: string;
  desc: string;
  color: string;
}> = [
  {
    value: "mild",
    label: "Mild",
    desc: "Localized rash, mild itching, sneezing",
    color: "border-brand/30 hover:border-brand text-brand",
  },
  {
    value: "moderate",
    label: "Moderate",
    desc: "Hives, swelling, GI distress",
    color: "border-warn/30 hover:border-warn text-warn",
  },
  {
    value: "severe",
    label: "Severe",
    desc: "Wheezing, throat tightness, dizziness",
    color: "border-warn/40 hover:border-warn text-warn",
  },
  {
    value: "critical",
    label: "Critical (Anaphylactic)",
    desc: "Airway obstruction, shock, life-threatening",
    color: "border-danger/40 hover:border-danger text-danger",
  },
];

const COMMON_ALLERGENS = [
  "Penicillin",
  "Amoxicillin",
  "Sulfa Antibiotics",
  "Aspirin / NSAIDs",
  "Codeine",
  "Peanuts",
  "Shellfish",
  "Latex",
  "Contrast Dye",
];

const COMMON_REACTIONS = [
  "Anaphylaxis",
  "Hives & Rash",
  "Shortness of Breath",
  "Facial Swelling (Angioedema)",
  "Severe Nausea",
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
      setErr("Substance name is required");
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
      setSeverity("moderate");
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save allergy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Add allergy">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-danger-soft text-danger shrink-0 shadow-2xs" aria-hidden>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="t-card-title text-text">
                Add Known Allergy
              </h2>
              <p className="text-xs text-text-soft mt-0.5">
                Flag drug, food, or contact reactions to protect your clinical care.
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
          {/* Substance / Allergen Name */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-danger" aria-hidden />
              Allergen / Substance Name
            </label>
            <input
              type="text"
              className="pt-input text-xs sm:text-sm"
              value={substance}
              onChange={(e) => setSubstance(e.target.value)}
              placeholder="e.g. Penicillin, Peanuts, Latex..."
              required
            />

            {/* Quick Allergen Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_ALLERGENS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setSubstance(a)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                    substance === a
                      ? "bg-danger text-white font-bold shadow-2xs"
                      : "bg-surface-2 text-text-soft hover:text-text",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-warn" aria-hidden />
              Severity Level
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SEVERITIES.map((s) => {
                const isSelected = severity === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-0.5",
                      isSelected
                        ? "bg-danger-soft/40 border-danger shadow-card"
                        : "bg-surface-2 border-border hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text">
                        {s.label}
                      </span>
                      {isSelected ? (
                        <Check size={14} className="text-danger" aria-hidden />
                      ) : null}
                    </div>
                    <span className="text-[10.5px] text-text-soft line-clamp-1">
                      {s.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reaction */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft">
              Reaction (Optional)
            </label>
            <input
              type="text"
              className="pt-input text-xs sm:text-sm"
              value={reaction}
              onChange={(e) => setReaction(e.target.value)}
              placeholder="e.g. Anaphylaxis, hives, swelling..."
            />

            <div className="flex flex-wrap gap-1.5">
              {COMMON_REACTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReaction(r)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                    reaction === r
                      ? "bg-ink text-white font-bold shadow-2xs"
                      : "bg-surface-2 text-text-soft hover:text-text",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
              <FileText size={13} className="text-text-muted" aria-hidden />
              Clinical Notes / Trigger History (Optional)
            </label>
            <textarea
              className="pt-input h-auto py-3 text-xs sm:text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. First diagnosed in 2018 during hospital admission, carries EpiPen..."
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
              className="pt-btn h-10 px-6 text-xs bg-danger text-white hover:brightness-110 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Saving Allergen…
                </>
              ) : (
                <>
                  <ShieldAlert size={14} aria-hidden />
                  Save Known Allergy
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}

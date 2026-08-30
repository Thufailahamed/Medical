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
    color: "border-sky-200 hover:border-sky-300 text-sky-800",
  },
  {
    value: "moderate",
    label: "Moderate",
    desc: "Hives, swelling, GI distress",
    color: "border-amber-200 hover:border-amber-300 text-amber-800",
  },
  {
    value: "severe",
    label: "Severe",
    desc: "Wheezing, throat tightness, dizziness",
    color: "border-orange-200 hover:border-orange-300 text-orange-800",
  },
  {
    value: "critical",
    label: "Critical (Anaphylactic)",
    desc: "Airway obstruction, shock, life-threatening",
    color: "border-rose-300 hover:border-rose-400 text-rose-800",
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
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-100 shadow-2xs">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Add Known Allergy
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Flag drug, food, or contact reactions to protect your clinical care.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-5">
          {/* Substance / Allergen Name */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-rose-600" />
              Allergen / Substance Name
            </label>
            <input
              type="text"
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
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
                      ? "bg-rose-600 text-white font-bold shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-amber-600" />
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
                      "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5",
                      isSelected
                        ? "bg-rose-50/50 border-rose-400 ring-2 ring-rose-500/20 shadow-2xs"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100/70",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {s.label}
                      </span>
                      {isSelected ? (
                        <Check size={14} className="text-rose-600" />
                      ) : null}
                    </div>
                    <span className="text-[10.5px] text-slate-500 line-clamp-1">
                      {s.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reaction */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Reaction (Optional)
            </label>
            <input
              type="text"
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
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
                      ? "bg-slate-800 text-white font-bold shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-400" />
              Clinical Notes / Trigger History (Optional)
            </label>
            <textarea
              className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. First diagnosed in 2018 during hospital admission, carries EpiPen..."
            />
          </div>

          {err && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #E11D48 0%, #BE123C 100%)",
              }}
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Allergen…</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={14} />
                  <span>Save Known Allergy</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}

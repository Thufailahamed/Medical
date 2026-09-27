"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  FileEdit,
  Loader2,
  Pin,
  X,
} from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import type { NoteRow } from "@/patient/types/patient";

const TEMPLATES = [
  {
    title: "Questions for Doctor Visit",
    body: "1. Should I adjust my current medication dosage?\n2. Are these mild morning headaches related to my blood pressure?\n3. When should I schedule my next diagnostic scan?",
  },
  {
    title: "Symptom & Vitals Log",
    body: "Date: \nMorning Blood Pressure: \nResting Heart Rate: \nSymptoms / Fatigue: ",
  },
  {
    title: "Medication Side Effect Watch",
    body: "Medicine name: \nNoticed effect: \nTime occurred after dose: \nDuration: ",
  },
];

export function NoteFormSheet({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string | null;
    body: string;
    pinned: boolean;
  }) => Promise<void>;
  initial?: NoteRow;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setTitle(initial.title ?? "");
      setBody(initial.body ?? "");
      setPinned(initial.pinned ?? false);
    } else {
      setTitle("");
      setBody("");
      setPinned(false);
    }
  }, [initial, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setErr("Note content is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        title: title.trim() || null,
        body: body.trim(),
        pinned,
      });
      setTitle("");
      setBody("");
      setPinned(false);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setBusy(false);
    }
  }

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setTitle(t.title);
    setBody(t.body);
  };

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={initial ? "Edit note" : "New note"}>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-soft text-brand shrink-0 shadow-2xs" aria-hidden>
              <FileEdit size={20} />
            </div>
            <div>
              <h2 className="t-card-title text-text">
                {initial ? "Edit Personal Note" : "New Health Note"}
              </h2>
              <p className="text-xs text-text-soft mt-0.5">
                Private health memos, questions for your doctor, or daily journals.
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

        {/* Quick Templates (only when creating new) */}
        {!initial && (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Quick Templates
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft">
              Title (Optional)
            </label>
            <input
              type="text"
              className="pt-input text-xs sm:text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Questions for Dr. Dev"
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft">
              Note Content
            </label>
            <textarea
              className="pt-input h-auto py-3.5 text-xs sm:text-sm leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              placeholder="Write your observations, questions, or symptom notes here..."
              required
            />
          </div>

          {/* Pin Checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-surface-2 border border-border cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
            />
            <div className="flex items-center gap-1.5 text-xs font-bold text-text">
              <Pin size={13} className={pinned ? "text-warn fill-warn" : "text-text-muted"} aria-hidden />
              <span>Pin to top of notes dashboard</span>
            </div>
          </label>

          {err && (
            <div className="p-3 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" aria-hidden />
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
                  Saving Note…
                </>
              ) : (
                <>
                  <Check size={14} aria-hidden />
                  Save Note
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}

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
import { cn } from "@/portal/lib/utils";

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
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100 shadow-2xs">
              <FileEdit size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {initial ? "Edit Personal Note" : "New Health Note"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Private health memos, questions for your doctor, or daily journals.
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

        {/* Quick Templates (only when creating new) */}
        {!initial && (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Title (Optional)
            </label>
            <input
              type="text"
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Questions for Dr. Dev"
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Note Content
            </label>
            <textarea
              className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              placeholder="Write your observations, questions, or symptom notes here..."
              required
            />
          </div>

          {/* Pin Checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
            />
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Pin size={13} className={pinned ? "text-amber-500 fill-amber-500" : "text-slate-400"} />
              <span>Pin to top of notes dashboard</span>
            </div>
          </label>

          {err && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle size={14} className="text-rose-600 shrink-0" />
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
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Note…</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save Note</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}

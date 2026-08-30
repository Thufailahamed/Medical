"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  Save,
  Tag,
  User,
} from "lucide-react";

import { useCreateRecord, useFamilyMembers, useUpdateRecord } from "@/patient/hooks";
import { RECORD_KINDS } from "@healthcare/shared/records";
import { formatRecordType } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

const MAX_TAG_LEN = 40;

function normaliseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase().slice(0, MAX_TAG_LEN);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function kindLabel(kind: string): string {
  return formatRecordType(kind);
}

export interface RecordFormInitial {
  kind?: string;
  title?: string;
  date?: string;
  diagnosis?: string;
  summary?: string;
  notes?: string;
  tags?: string[];
  familyMemberId?: string | null;
}

export function RecordForm({
  mode,
  recordId,
  initial,
  onSuccess,
}: {
  mode: "create" | "edit";
  recordId?: string;
  initial?: RecordFormInitial;
  onSuccess: (id: string) => void;
}) {
  const create = useCreateRecord();
  const update = useUpdateRecord();
  const family = useFamilyMembers();

  const [kind, setKind] = useState(initial?.kind ?? RECORD_KINDS[0]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "));
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(
    initial?.familyMemberId ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const tags = normaliseTags(tagsRaw);
    try {
      if (mode === "create") {
        const out = await create.mutateAsync({
          kind,
          title: title.trim(),
          diagnosis: diagnosis.trim() || undefined,
          summary: summary.trim() || undefined,
          notes: notes.trim() || undefined,
          tags: tags.length ? tags : undefined,
          familyMemberId,
        });
        onSuccess(out.id);
      } else {
        await update.mutateAsync({
          id: recordId!,
          title: title.trim(),
          diagnosis: diagnosis.trim() || undefined,
          summary: summary.trim() || undefined,
          notes: notes.trim() || undefined,
          tags: tags.length ? tags : undefined,
          familyMemberId,
        });
        onSuccess(recordId!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* ── 1. Document Category / Kind Selection ────────────────────────── */}
      <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          Document Classification / Record Type *
        </label>
        <div className="flex flex-wrap gap-2" data-testid="kind-chips">
          {RECORD_KINDS.map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                disabled={mode === "edit"}
                aria-pressed={active}
                onClick={() => setKind(k)}
                style={{
                  backgroundColor: active ? "#0284c7" : "#ffffff",
                  borderColor: active ? "#0284c7" : "#cbd5e1",
                  color: active ? "#ffffff" : "#334155",
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs hover:scale-105",
                  active ? "shadow-xs font-bold" : "hover:border-sky-300",
                  mode === "edit" && !active ? "opacity-50 cursor-not-allowed" : "",
                )}
              >
                {active && <Check size={11} strokeWidth={3} className="text-white" />}
                <span>{kindLabel(k)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Primary Record Title & Date ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Record Title *
          </label>
          <div className="relative">
            <FileText
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Complete Blood Count (CBC), Cardiac Consultation Note…"
              className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Date of Service *
          </label>
          <div className="relative">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ── 3. Clinical Diagnosis & Findings ─────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          Primary Clinical Diagnosis (Optional)
        </label>
        <input
          type="text"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="e.g. Essential Hypertension (I10), Acute Sinusitis, Post-Op Care…"
          className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
        />
      </div>

      {/* ── 4. Summary & Detailed Clinical Notes ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Clinical Summary (Optional)
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Key findings, treatment decisions, and physician takeaways…"
            className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Physician Notes &amp; Observations (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Specific directives, dosage regimens, or clinical follow-up dates…"
            className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
          />
        </div>
      </div>

      {/* ── 5. Tags & Family Member Association ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span>Tags &amp; Keywords</span>
            <span className="text-[10px] text-slate-400 font-normal lowercase">Comma-separated, ≤40 chars</span>
          </label>
          <div className="relative">
            <Tag
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="e.g. annual, fasting, cardiology, hospital-admission"
              className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Patient / Family Member Scope
          </label>
          <div className="relative">
            <User
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <select
              value={familyMemberId ?? ""}
              onChange={(e) => setFamilyMemberId(e.target.value || null)}
              className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="">Myself (Primary Patient)</option>
              {(family.data?.family ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                  {member.relationship ? ` (${member.relationship})` : ""}
                  {member.isLocked ? " — Locked" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertCircle size={15} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 6. Form Submission Footer ────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <Link
          href="/patient/records"
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
          }}
        >
          {isPending ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Saving Health Record…</span>
            </>
          ) : (
            <>
              <Save size={15} />
              <span>{mode === "create" ? "Save Medical Record" : "Update Record"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
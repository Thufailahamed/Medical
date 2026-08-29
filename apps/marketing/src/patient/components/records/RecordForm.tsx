"use client";

import { useState } from "react";

import { Pill } from "@/patient/components/primitives/Pill";
import { useCreateRecord, useUpdateRecord } from "@/patient/hooks";
import { RECORD_KINDS, RECORD_REGISTRY } from "@healthcare/shared/records";

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
  // Display the kind's registry key directly — the labelKey is an i18n
  // lookup the portal doesn't translate yet. Keep it stable + greppable.
  return kind;
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
  const [kind, setKind] = useState(initial?.kind ?? RECORD_KINDS[0]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "));
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(initial?.familyMemberId ?? null);
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

  const inputCls = "rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <p className="t-label">Kind</p>
        <div className="mt-2 flex flex-wrap gap-1.5" data-testid="kind-chips">
          {RECORD_KINDS.map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                disabled={mode === "edit"}
                aria-pressed={active}
                onClick={() => setKind(k)}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-surface-2 text-text-muted hover:bg-surface-3",
                  mode === "edit" && !active ? "opacity-60" : "",
                ].join(" ")}
              >
                {kindLabel(k)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="t-label">Title</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="CBC 2026-08-15"
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Diagnosis</span>
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          rows={2}
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Summary</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Tags</span>
        <input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="annual, fasting"
          className={inputCls}
        />
        <span className="t-micro">Lowercase, comma-separated, ≤40 chars each.</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Family member</span>
        <select
          value={familyMemberId ?? ""}
          onChange={(e) => setFamilyMemberId(e.target.value || null)}
          className={inputCls}
        >
          <option value="">Myself</option>
          {/* family picker wiring lives in SP8; SP2a leaves a single Myself option */}
        </select>
      </label>

      {error ? (
        <div role="alert">
          <Pill tone="danger">{error}</Pill>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={create.isPending || update.isPending}
        className="self-start rounded-inner bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Save
      </button>
    </form>
  );
}
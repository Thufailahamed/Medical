"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import type { NoteRow } from "@/patient/types/patient";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setErr("Body is required");
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
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={initial ? "Edit note" : "New note"}>
      <div className="flex items-center justify-between">
        <h2 className="t-page text-text">
          {initial ? "Edit note" : "New note"}
        </h2>
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
          <span className="text-sm font-medium">Title (optional)</span>
          <input
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Body</span>
          <textarea
            className="mt-1 w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-2"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            required
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          <span className="text-sm">Pin this note</span>
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

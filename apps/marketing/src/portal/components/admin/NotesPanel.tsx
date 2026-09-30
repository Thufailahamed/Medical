"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Edit3, Send, Loader2, MessageSquare } from "lucide-react";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { relativeTime } from "@/portal/lib/format";
import { PANEL, PanelHeader } from "@/portal/components/doctor/Workspace";
import { useAuthStore } from "@/portal/stores/auth";

export interface AdminNote {
  id: string;
  userId: string;
  adminUserId: string;
  adminName: string | null;
  body: string;
  createdAt: string;
  updatedAt: string | null;
}

export function NotesPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const notes = useQuery({
    queryKey: adminQk.userNotes(userId),
    queryFn: () => adminApi<{ items: AdminNote[] }>(`/admin/users/${userId}/notes`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: adminQk.userNotes(userId) });
  };

  const createMut = useMutation({
    mutationFn: async (text: string) => {
      return adminApi(`/admin/users/${userId}/notes`, { method: "POST", json: { body: text } });
    },
    onSuccess: () => {
      setBody("");
      invalidate();
    },
  });

  const editMut = useMutation({
    mutationFn: async (vars: { noteId: string; text: string }) => {
      return adminApi(`/admin/notes/${vars.noteId}`, { method: "PATCH", json: { body: vars.text } });
    },
    onSuccess: () => {
      setEditingId(null);
      setEditBody("");
      invalidate();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (noteId: string) => {
      return adminApi(`/admin/notes/${noteId}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  const items = notes.data?.items ?? [];

  return (
    <section className={PANEL} aria-labelledby="admin-notes">
      <PanelHeader
        id="admin-notes"
        icon={<MessageSquare size={16} />}
        tone="bg-violet-50 text-violet-600"
        title="Internal notes"
        caption="Admin-only · visible to every super admin"
        action={
          items.length ? (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">{items.length}</span>
          ) : undefined
        }
      />

      <div className="mt-5 rounded-xl bg-slate-50 p-1.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] transition-shadow focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_#0284c7,0_0_0_4px_rgba(14,165,233,0.12)]">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) createMut.mutate(body.trim());
          }}
          placeholder="Add a note — e.g. 'Called patient, awaiting SLMC docs.'"
          aria-label="New note"
          className="h-20 w-full resize-none bg-transparent px-2.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          maxLength={2000}
        />
        <div className="flex items-center justify-between gap-2 px-1.5 pb-0.5">
          <span className="text-[11px] tabular-nums text-slate-400">
            {body.length}/2000 · <kbd className="font-sans">⌘</kbd>↵ to add
          </span>
          <button
            type="button"
            onClick={() => createMut.mutate(body.trim())}
            disabled={!body.trim() || createMut.isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#07233a] px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {createMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Add note
          </button>
        </div>
      </div>

      {notes.isLoading ? (
        <div className="mt-4 space-y-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
          No notes yet. Leave context for the next admin who opens this record.
        </p>
      ) : (
        <ol className="relative mt-5 flex flex-col gap-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-slate-100">
          {items.map((n) => {
            const isOwn = me?.id === n.adminUserId;
            const isEditing = editingId === n.id;
            return (
              <li key={n.id} className="group/n relative flex gap-3">
                <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-[11px] font-semibold text-white ring-4 ring-white">
                  {(n.adminName ?? "A").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs text-slate-400">
                      <span className="font-semibold text-slate-900">{n.adminName ?? "Admin"}</span>
                      {isOwn ? <span className="ml-1 text-sky-600">(you)</span> : null}
                      <span className="ml-2" title={new Date(n.createdAt).toLocaleString()}>{relativeTime(n.createdAt)}</span>
                      {n.updatedAt ? <span className="ml-1.5 italic">· edited</span> : null}
                    </p>
                    {isOwn && !isEditing ? (
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/n:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditBody(n.body);
                          }}
                          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-sky-700"
                          title="Edit"
                          aria-label="Edit note"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Delete this note?")) deleteMut.mutate(n.id);
                          }}
                          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-red-600"
                          title="Delete"
                          aria-label="Delete note"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {isEditing ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="h-20 w-full resize-none rounded-lg bg-white px-2.5 py-2 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] outline-none focus:shadow-[inset_0_0_0_1.5px_#0284c7]"
                        maxLength={2000}
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-slate-500 hover:bg-white hover:text-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => editMut.mutate({ noteId: n.id, text: editBody.trim() })}
                          disabled={!editBody.trim() || editMut.isPending}
                          className="inline-flex h-8 items-center rounded-lg bg-[#07233a] px-3 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{n.body}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

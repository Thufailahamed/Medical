"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Edit3, Send, Loader2, MessageSquare } from "lucide-react";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { Button } from "@/portal/components/ui/Button";
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
    <section className="bg-surface border border-border rounded-2xl p-5">
      <header className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-amber-600" />
        <h3 className="text-sm font-semibold">Internal notes</h3>
        <span className="text-xs text-text-muted">(admin-only, visible to all super_admins)</span>
      </header>

      <div className="flex flex-col gap-2 mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note — e.g. 'Called patient, awaiting SLMC docs.'"
          className="w-full h-20 px-3 py-2 rounded-lg border border-border bg-surface text-sm resize-none"
          maxLength={2000}
        />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-text-muted">{body.length}/2000</span>
          <Button
            size="sm"
            onClick={() => createMut.mutate(body.trim())}
            disabled={!body.trim() || createMut.isPending}
            className="gap-1"
          >
            {createMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Add note
          </Button>
        </div>
      </div>

      {notes.isLoading ? (
        <p className="text-xs text-text-soft">Loading notes…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted py-3 text-center">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((n) => {
            const isOwn = me?.id === n.adminUserId;
            const isEditing = editingId === n.id;
            return (
              <li key={n.id} className="border border-border rounded-lg p-3 bg-bg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-text-soft">
                    <span className="font-semibold text-text">{n.adminName ?? "Admin"}</span>
                    <span className="ml-2 text-text-muted">{new Date(n.createdAt).toLocaleString()}</span>
                    {n.updatedAt ? (
                      <span className="ml-2 text-text-muted italic">(edited)</span>
                    ) : null}
                  </div>
                  {isOwn ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(n.id);
                          setEditBody(n.body);
                        }}
                        className="p-1 text-text-muted hover:text-amber-700"
                        title="Edit"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Delete this note?")) deleteMut.mutate(n.id);
                        }}
                        className="p-1 text-text-muted hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : null}
                </div>
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full h-20 px-2 py-1.5 rounded border border-border bg-surface text-sm resize-none"
                      maxLength={2000}
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => editMut.mutate({ noteId: n.id, text: editBody.trim() })}
                        disabled={!editBody.trim() || editMut.isPending}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
"use client";

import { useState } from "react";

import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import { useAddNote, useDeleteNote, useEditNote, useNotes } from "@/patient/hooks";

import { NoteRowItem } from "./NoteRow";
import { NoteFormSheet } from "./NoteFormSheet";
import { PinnedHeader } from "./PinnedHeader";

export function NotesList() {
  const notes = useNotes();
  const add = useAddNote();
  const edit = useEditNote();
  const del = useDeleteNote();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Notes"
        action={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            New note
          </button>
        }
      />
      <QueryBoundary
        query={notes}
        emptyTitle="No notes yet"
        isEmpty={(d) => d.notes.length === 0}
      >
        {(data) => {
          const pinned = data.notes.filter((n) => n.pinned);
          const unpinned = data.notes.filter((n) => !n.pinned);
          return (
            <div className="space-y-6">
              {pinned.length > 0 && (
                <div className="space-y-2">
                  <PinnedHeader count={pinned.length} />
                  {pinned.map((row) => (
                    <NoteRowItem
                      key={row.id}
                      row={row}
                      onTogglePin={() =>
                        edit.mutate({ id: row.id, pinned: !row.pinned })
                      }
                      onDelete={(id) => del.mutate(id)}
                    />
                  ))}
                </div>
              )}
              {unpinned.length > 0 && (
                <div className="space-y-2">
                  {unpinned.map((row) => (
                    <NoteRowItem
                      key={row.id}
                      row={row}
                      onTogglePin={() =>
                        edit.mutate({ id: row.id, pinned: !row.pinned })
                      }
                      onDelete={(id) => del.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }}
      </QueryBoundary>
      <NoteFormSheet
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}

"use client";

import { Pin, Trash2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import type { NoteRow as Row } from "@/patient/types/patient";

export function NoteRowItem({
  row,
  onTogglePin,
  onDelete,
}: {
  row: Row;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{row.title ?? "Untitled"}</p>
            {row.pinned && <Pin size={14} className="text-brand" />}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">
            {row.body}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {row.updatedAt.slice(0, 10)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            aria-label="Toggle pin"
            onClick={() => onTogglePin(row.id)}
            className="text-text-muted hover:text-brand"
          >
            <Pin size={18} />
          </button>
          <button
            aria-label="Delete note"
            onClick={() => onDelete(row.id)}
            className="text-text-muted hover:text-danger"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </Card>
  );
}

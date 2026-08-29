"use client";

import { Trash2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import type { AllergyRow as Row } from "@/patient/types/patient";

import { SeverityPill } from "./SeverityPill";

export function AllergyRowItem({
  row,
  onDelete,
}: {
  row: Row;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{row.substance}</p>
            <SeverityPill severity={row.severity} />
          </div>
          {row.reaction && (
            <p className="text-sm text-text-muted">Reaction: {row.reaction}</p>
          )}
          {row.notes && <p className="text-sm text-text-muted">{row.notes}</p>}
        </div>
        <button
          aria-label="Delete allergy"
          onClick={() => onDelete(row.id)}
          className="text-text-muted hover:text-danger"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </Card>
  );
}

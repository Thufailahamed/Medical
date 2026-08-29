"use client";

import { Trash2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill, type PillTone } from "@/patient/components/primitives/Pill";
import type { SymptomRow as Row } from "@/patient/types/patient";

const TONE: Record<NonNullable<Row["severity"]>, PillTone> = {
  mild: "neutral",
  moderate: "info",
  severe: "warn",
};

export function SymptomRowItem({
  row,
  onDelete,
}: {
  row: Row;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{row.symptom}</p>
            {row.severity && <Pill tone={TONE[row.severity]}>{row.severity}</Pill>}
          </div>
          <p className="text-xs text-text-muted">
            Started {row.startedAt.slice(0, 10)}
          </p>
          {row.notes && <p className="text-sm text-text-muted">{row.notes}</p>}
        </div>
        <button
          aria-label="Delete symptom"
          onClick={() => onDelete(row.id)}
          className="text-text-muted hover:text-danger"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </Card>
  );
}

"use client";

import { cn } from "@/portal/lib/utils";

export type ClinicalStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "missed"
  | "pending"
  | "disputed";

const PALETTE: Record<ClinicalStatus, { dot: string; label: string; text: string }> = {
  scheduled: { dot: "bg-text-muted", label: "Scheduled", text: "text-text-soft" },
  confirmed: { dot: "bg-brand", label: "Confirmed", text: "text-text" },
  in_progress: { dot: "bg-warn", label: "In progress", text: "text-text" },
  completed: { dot: "bg-success", label: "Completed", text: "text-text" },
  cancelled: { dot: "bg-text-muted", label: "Cancelled", text: "text-text-muted" },
  missed: { dot: "bg-danger", label: "Missed", text: "text-text" },
  pending: { dot: "bg-warn", label: "Pending", text: "text-text" },
  disputed: { dot: "bg-danger", label: "Needs review", text: "text-text" },
};

export function StatusDots({ status, label }: { status: ClinicalStatus; label?: string }) {
  const s = PALETTE[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", s.text)}>
      <span aria-hidden="true" className={cn("pt-dot", s.dot)} />
      {label ?? s.label}
    </span>
  );
}

"use client";

import { AlertTriangle, ShieldCheck, XCircle } from "lucide-react";
import { cn } from "@/portal/lib/utils";

export interface SafetyWarning {
  kind: string;
  severity: "info" | "minor" | "moderate" | "severe" | "critical";
  message: string;
  medicineName?: string;
  details?: Record<string, unknown>;
}

interface Props {
  warnings: SafetyWarning[];
  severity: SafetyWarning["severity"] | null;
  isLoading?: boolean;
}

const SEVERITY_TONE: Record<SafetyWarning["severity"], "neutral" | "warn" | "danger" | "brand"> = {
  info: "neutral",
  minor: "neutral",
  moderate: "warn",
  severe: "danger",
  critical: "danger",
};

export function SafetyCheckPanel({ warnings, severity, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-surface-2/40 p-3 text-xs text-text-soft">
        Checking safety…
      </div>
    );
  }

  if (!warnings.length) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
        <ShieldCheck size={14} />
        <span>No safety concerns detected.</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-warn/30 bg-warn-soft/40 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-warn/20">
        <AlertTriangle size={14} className="text-warn" />
        <span className="text-xs font-semibold text-text">
          {warnings.length} safety {warnings.length === 1 ? "warning" : "warnings"}
          {severity ? ` · top: ${severity}` : ""}
        </span>
      </div>
      <ul className="flex flex-col">
        {warnings.map((w, i) => (
          <li
            key={i}
            className={cn(
              "px-3 py-2 text-xs flex items-start gap-2 border-b border-warn/15 last:border-0",
              w.severity === "critical" || w.severity === "severe"
                ? "bg-danger-soft/40"
                : ""
            )}
          >
            <span
              className={cn(
                "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
                w.severity === "critical" || w.severity === "severe"
                  ? "bg-danger text-white"
                  : w.severity === "moderate"
                    ? "bg-warn text-white"
                    : "bg-surface-2 text-text-soft"
              )}
            >
              {w.severity}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-text">{w.message}</div>
              {w.medicineName ? (
                <div className="text-[10px] text-text-muted mt-0.5">
                  for: {w.medicineName}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
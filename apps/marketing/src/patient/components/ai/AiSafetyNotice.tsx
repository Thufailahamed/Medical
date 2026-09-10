"use client";

import { ShieldCheck } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export function AiSafetyNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-border bg-surface-2 p-4",
        className,
      )}
    >
      <ShieldCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-brand" />
      <p className="text-xs leading-relaxed text-text-soft">
        <strong className="font-bold text-text">Clinical safety notice.</strong>{" "}
        HealthHub AI helps you understand your health information and prepare for
        consultations. It does not replace emergency care or your physician&apos;s
        clinical judgment.
      </p>
    </div>
  );
}

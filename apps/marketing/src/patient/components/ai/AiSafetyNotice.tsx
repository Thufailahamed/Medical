"use client";

import { ShieldCheck } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export function AiSafetyNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-brand/15 bg-gradient-to-r from-brand-soft/50 to-surface p-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border bg-white text-brand shadow-2xs"
      >
        <ShieldCheck size={14} />
      </span>
      <p className="pt-1 text-xs leading-relaxed text-text-soft">
        <strong className="font-bold text-text">Clinical safety notice.</strong>{" "}
        HealthHub AI helps you understand your health information and prepare for
        consultations. It does not replace emergency care or your physician&apos;s
        clinical judgment.
      </p>
    </div>
  );
}

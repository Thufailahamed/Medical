"use client";

import { ShieldCheck } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export function AiSafetyNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex items-start gap-3.5 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)]",
        className,
      )}
    >
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-emerald-500" aria-hidden />
      <span
        aria-hidden
        className="ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-emerald-600"
      >
        <ShieldCheck size={16} />
      </span>
      <p className="pt-0.5 text-xs leading-relaxed text-slate-500">
        <strong className="font-semibold text-slate-900">Clinical safety notice.</strong>{" "}
        HealthHub AI helps you understand your health information and prepare for
        consultations. It does not replace emergency care or your physician&apos;s
        clinical judgment.
      </p>
    </div>
  );
}

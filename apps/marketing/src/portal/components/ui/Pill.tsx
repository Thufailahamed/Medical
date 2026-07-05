import type { ReactNode } from "react";
import { cn } from "@/portal/lib/utils";

type Tone = "neutral" | "brand" | "success" | "warn" | "danger" | "violet";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-soft border border-border",
  brand: "bg-brand-soft text-brand-strong border border-sky-200",
  success: "bg-success-soft text-emerald-700 border border-emerald-200",
  warn: "bg-warn-soft text-amber-700 border border-amber-200",
  danger: "bg-danger-soft text-red-700 border border-red-200",
  violet: "bg-violet-soft text-violet border border-violet-200",
};

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Standalone badge row often used in tables / cards. */
export function PillRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}
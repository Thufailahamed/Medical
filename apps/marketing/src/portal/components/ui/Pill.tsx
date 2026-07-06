import type { ReactNode } from "react";
import { cn } from "@/portal/lib/utils";

type Tone = "neutral" | "brand" | "success" | "warn" | "danger" | "info" | "accent" | "violet";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-soft border-border/50",
  brand: "bg-brand-soft text-brand-strong border-brand/20",
  success: "bg-success-soft text-emerald-700 border-emerald-200/50",
  warn: "bg-warn-soft text-amber-700 border-amber-200/50",
  danger: "bg-danger-soft text-red-700 border-red-200/50",
  info: "bg-info-soft text-sky-700 border-sky-200/50",
  accent: "bg-accent-soft text-emerald-700 border-emerald-200/50",
  violet: "bg-violet-50 text-violet-700 border-violet-200/50",
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
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
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

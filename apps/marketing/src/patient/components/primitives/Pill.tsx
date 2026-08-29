"use client";

import { cn } from "@/portal/lib/utils";

export type PillTone =
  | "neutral"
  | "brand"
  | "success"
  | "warn"
  | "danger"
  | "info";

/**
 * Compact status chip. Used for badge-style labels: "Confirmed",
 * "Allergies · Penicillin", "High" classification, etc.
 *
 * Tone drives both the chip background and the foreground text from
 * the same hue family so the chip never reads as dead UI.
 */
export function Pill({
  children,
  tone = "neutral",
  className,
  icon,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  className?: string;
  icon?: React.ReactNode;
}) {
  const palettes: Record<PillTone, string> = {
    neutral: "bg-surface-2 text-text-soft",
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    info: "bg-surface-3 text-text-soft",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        palettes[tone],
        className
      )}
      style={{ borderRadius: "var(--radius-pill)" }}
    >
      {icon}
      {children}
    </span>
  );
}

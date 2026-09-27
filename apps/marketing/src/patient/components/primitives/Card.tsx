"use client";

import { cn } from "@/portal/lib/utils";

export type CardAccent =
  | "brand"
  | "sky"
  | "violet"
  | "amber"
  | "green"
  | "rose"
  | "none";

const ACCENT: Record<
  Exclude<CardAccent, "none">,
  { blob: string; shine: string }
> = {
  brand: { blob: "bg-brand", shine: "bg-brand" },
  sky: { blob: "bg-sky-500", shine: "bg-sky-500" },
  violet: { blob: "bg-violet-500", shine: "bg-violet-500" },
  amber: { blob: "bg-amber-500", shine: "bg-amber-500" },
  green: { blob: "bg-emerald-500", shine: "bg-emerald-500" },
  rose: { blob: "bg-rose-500", shine: "bg-rose-500" },
};

/**
 * Doctor-portal-style white card: thin border, pastel corner blob,
 * soft hover lift. Keeps the patient blue theme via CSS tokens.
 */
export function Card({
  className,
  padded = true,
  as: As = "div",
  accent = "brand",
  children,
}: {
  className?: string;
  padded?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
  accent?: CardAccent;
  children?: React.ReactNode;
}) {
  const palette = accent === "none" ? null : ACCENT[accent];

  return (
    <As
      className={cn(
        "patient-card group",
        padded && "p-5 md:p-6",
        className
      )}
    >
      {palette ? (
        <>
          <div className={cn("patient-card-blob", palette.blob)} aria-hidden />
          <div className={cn("patient-card-shine", palette.shine)} aria-hidden />
        </>
      ) : null}
      <div className="relative z-10">{children}</div>
    </As>
  );
}

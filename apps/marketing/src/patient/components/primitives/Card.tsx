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
  brand: {
    blob: "bg-gradient-to-br from-blue-500 to-indigo-600",
    shine: "bg-gradient-to-r from-blue-500 to-indigo-600",
  },
  sky: {
    blob: "bg-gradient-to-br from-sky-400 to-blue-600",
    shine: "bg-gradient-to-r from-sky-400 to-blue-600",
  },
  violet: {
    blob: "bg-gradient-to-br from-violet-400 to-purple-600",
    shine: "bg-gradient-to-r from-violet-400 to-purple-600",
  },
  amber: {
    blob: "bg-gradient-to-br from-amber-400 to-orange-500",
    shine: "bg-gradient-to-r from-amber-400 to-orange-500",
  },
  green: {
    blob: "bg-gradient-to-br from-emerald-400 to-teal-600",
    shine: "bg-gradient-to-r from-emerald-400 to-teal-600",
  },
  rose: {
    blob: "bg-gradient-to-br from-rose-400 to-pink-600",
    shine: "bg-gradient-to-r from-rose-400 to-pink-600",
  },
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

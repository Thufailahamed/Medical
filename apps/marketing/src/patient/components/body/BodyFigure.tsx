"use client";

import { useId } from "react";

import { cn } from "@/portal/lib/utils";

import type { ReactNode } from "react";

export interface OrganHotspot {
  id: string;
  /** Center of the circle in SVG user space (0..100, 0..120 — front view). */
  cx: number;
  cy: number;
  /** Radius in SVG user space. */
  r?: number;
  /** Optional label rendered when hovered or active. */
  label?: string;
  /** Tone drives the active colour when the hotspot is selected. */
  tone?: "neutral" | "warn" | "danger" | "info";
}

/**
 * The static body figure used by the My Health page. Drawn entirely
 * as SVG so it stays tintable via CSS custom properties and renders
 * crisp at any density. Children render as hotspot overlays inside
 * the same 0..100 × 0..120 user space.
 *
 * `viewBox` is "0 0 100 120" — height taller than width so the head,
 * torso and legs fit without scaling distortion.
 */
export function BodyFigure({
  children,
  className,
  side = "front",
  ariaLabel = "Body diagram",
}: {
  children?: ReactNode;
  className?: string;
  side?: "front" | "back";
  ariaLabel?: string;
}) {
  const gradId = useId();

  return (
    <svg
      viewBox="0 0 100 120"
      role="img"
      aria-label={ariaLabel}
      className={cn("h-full w-full", className)}
    >
      <defs>
        <linearGradient id={`${gradId}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-surface-3)" />
          <stop offset="100%" stopColor="var(--color-surface-2)" />
        </linearGradient>
      </defs>

      {/* head */}
      <circle cx="50" cy="14" r="9" fill={`url(#${gradId}-body)`} />

      {/* torso */}
      <path
        d="M 30 30 Q 30 24 38 24 L 62 24 Q 70 24 70 30 L 70 70 Q 70 76 64 76 L 36 76 Q 30 76 30 70 Z"
        fill={`url(#${gradId}-body)`}
      />

      {/* arms */}
      {side === "front" ? (
        <>
          <path
            d="M 28 30 Q 22 32 22 38 L 22 64 Q 22 68 26 68 L 28 68 Z"
            fill={`url(#${gradId}-body)`}
          />
          <path
            d="M 72 30 Q 78 32 78 38 L 78 64 Q 78 68 74 68 L 72 68 Z"
            fill={`url(#${gradId}-body)`}
          />
        </>
      ) : (
        <>
          <rect x="20" y="30" width="8" height="38" rx="4" fill={`url(#${gradId}-body)`} />
          <rect x="72" y="30" width="8" height="38" rx="4" fill={`url(#${gradId}-body)`} />
        </>
      )}

      {/* legs */}
      <rect x="36" y="76" width="12" height="36" rx="6" fill={`url(#${gradId}-body)`} />
      <rect x="52" y="76" width="12" height="36" rx="6" fill={`url(#${gradId}-body)`} />

      {/* Hotspot overlay layer — render absolutely positioned circles */}
      <g>{children}</g>
    </svg>
  );
}

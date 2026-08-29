"use client";

import { Sheet } from "@/patient/components/primitives/Sheet";

export interface OrganDetail {
  id: string;
  title: string;
  /** Short status line ("Normal range", "Elevated", etc). */
  status: string;
  body: string;
  /** Optional metric pairs (e.g. "Last reading  72 bpm"). */
  metrics?: Array<{ label: string; value: string }>;
}

/**
 * Slide-out panel that opens when a hotspot is tapped. The body of
 * the panel is intentionally text-first — it surfaces only the
 * information the user already has a right to see (their own latest
 * reading, classification, and a friendly explanation) without
 * inventing clinical content.
 */
export function OrganDetailPanel({
  detail,
  open,
  onClose,
}: {
  detail: OrganDetail | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      ariaLabel={detail?.title ?? "Detail"}
    >
      {detail ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="t-label">Body map</p>
            <h2 className="t-card-title mt-1">{detail.title}</h2>
            <p className="mt-2 text-sm text-text-soft">{detail.status}</p>
          </div>

          {detail.metrics?.length ? (
            <ul className="divide-y divide-surface-2 rounded-inner">
              {detail.metrics.map((m) => (
                <li
                  key={m.label}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span className="text-text-soft">{m.label}</span>
                  <span className="font-medium text-text">{m.value}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-sm leading-relaxed text-text-soft">{detail.body}</p>
        </div>
      ) : null}
    </Sheet>
  );
}

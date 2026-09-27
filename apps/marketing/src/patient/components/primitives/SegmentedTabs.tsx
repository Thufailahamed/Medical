"use client";

import { cn } from "@/portal/lib/utils";

export interface SegmentedTabItem {
  id: string;
  /** Full tab content (label + inline count/badge), rendered verbatim. */
  label: React.ReactNode;
}

const TRACK =
  "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ink/5 p-1";

const TAB_BASE =
  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all";

const TAB_ACTIVE = "bg-ink text-white shadow-sm";
const TAB_IDLE = "text-text-soft hover:text-text";

/**
 * VYRO segmented pill tab bar — light rounded-full track, dark active pill.
 * Page keeps its state/handlers; only the bar chrome is shared so every
 * filter row looks identical. Labels (incl. counts) pass through verbatim.
 */
export function SegmentedTabs({
  tabs,
  activeId,
  onChange,
  ariaLabel = "Filter",
  className,
}: {
  tabs: SegmentedTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn(TRACK, className)}>
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.id)}
            className={cn(TAB_BASE, active ? TAB_ACTIVE : TAB_IDLE)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

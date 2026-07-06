"use client";

/**
 * SlotToggle — 4-square toggle row for the prescription composer's
 * morning/noon/evening/night frequency picker.
 *
 * Mirror of the mobile composer's slot grid. Each square is a small
 * button that flips its slot on/off. The frequency label is derived
 * via `slotsToFrequency(slots)` and shown next to the row.
 */

import { Sun, Sunrise, Moon, Sunset } from "lucide-react";

import { cn } from "@/portal/lib/utils";
import { SLOTS, slotsToFrequency, type Slots } from "@/portal/lib/rxSlots";

const SLOT_META: Record<
  (typeof SLOTS)[number],
  { label: string; Icon: typeof Sun }
> = {
  morning: { label: "M", Icon: Sunrise },
  noon: { label: "N", Icon: Sun },
  evening: { label: "E", Icon: Sunset },
  night: { label: "N", Icon: Moon },
};

interface Props {
  value: Slots;
  onChange: (next: Slots) => void;
  disabled?: boolean;
  /** Render the derived frequency label to the right. */
  showLabel?: boolean;
  className?: string;
}

export function SlotToggle({
  value,
  onChange,
  disabled,
  showLabel = true,
  className,
}: Props) {
  const freq = slotsToFrequency(value);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="group"
        aria-label="Frequency slots"
        className="inline-flex rounded-md border border-border bg-surface overflow-hidden"
      >
        {SLOTS.map((s) => {
          const { Icon } = SLOT_META[s];
          const active = value[s];
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange({ ...value, [s]: !active })}
              className={cn(
                "h-8 w-9 inline-flex items-center justify-center text-xs font-medium border-r border-border last:border-r-0 transition-colors",
                active
                  ? "bg-brand text-white"
                  : "bg-surface text-text-soft hover:bg-surface-2",
                disabled && "opacity-50 pointer-events-none"
              )}
              title={s}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>
      {showLabel ? (
        <span
          className={cn(
            "text-xs",
            freq ? "text-text font-medium" : "text-text-muted"
          )}
        >
          {freq ?? "—"}
        </span>
      ) : null}
    </div>
  );
}

"use client";

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
      <div role="group" aria-label="Frequency slots" className="portal-slot-toggle">
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
              className={cn("portal-slot-btn", active && "portal-slot-btn-active")}
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
            "text-xs font-semibold",
            freq ? "text-text" : "text-text-muted"
          )}
        >
          {freq ?? "—"}
        </span>
      ) : null}
    </div>
  );
}

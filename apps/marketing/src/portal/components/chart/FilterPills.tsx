"use client";

import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/portal/lib/utils";

export interface FilterOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional count shown next to the label. */
  count?: number;
}

export interface FilterPillsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Size of each button. Default "sm". */
  size?: "sm" | "md";
}

/**
 * Row of pill-shaped toggle buttons. Single-select. Used for status /
 * period filters on chart tabs.
 *
 * Uses div toggles + portal-filter-pill CSS (not <button>) because the
 * marketing site's global button reset strips Tailwind backgrounds/borders.
 */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "sm",
}: FilterPillsProps<T>) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, optValue: T) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(optValue);
    }
  };

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5",
        size === "md" && "[&_.portal-filter-pill]:h-8 [&_.portal-filter-pill]:px-3 [&_.portal-filter-pill]:text-sm",
        className
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <div
            key={opt.value}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-active={active ? "true" : "false"}
            className="portal-filter-pill"
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, opt.value)}
          >
            {opt.label}
            {typeof opt.count === "number" ? (
              <span className="portal-filter-pill-count">{opt.count}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

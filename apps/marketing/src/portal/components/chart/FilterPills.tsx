"use client";

import type { ReactNode } from "react";

import { Button } from "@/portal/components/ui/Button";
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
 */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "sm",
}: FilterPillsProps<T>) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 p-0.5 rounded-xl border border-border/70 bg-surface-2/40",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Button
            key={opt.value}
            size={size}
            variant={active ? "primary" : "ghost"}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg",
              !active && "text-text-soft hover:text-text"
            )}
          >
            {opt.label}
            {typeof opt.count === "number" ? (
              <span
                className={cn(
                  "ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold",
                  active
                    ? "bg-white/25 text-white"
                    : "bg-surface text-text-soft border border-border/60"
                )}
              >
                {opt.count}
              </span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}

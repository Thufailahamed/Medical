"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@/portal/components/ui/Empty";
import { cn } from "@/portal/lib/utils";

export interface ChartListProps<T> {
  items: T[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyState: ReactNode;
  /** Called for each item; should return a single <li> with row markup. */
  renderRow: (item: T, index: number) => ReactNode;
  /** Optional skeleton count while loading. */
  skeletonCount?: number;
  /** Optional right-aligned content above the list (e.g. filters, search). */
  toolbar?: ReactNode;
  /** Optional footer below the list. */
  footer?: ReactNode;
  /** Optional className for the outer card. */
  className?: string;
  /** When true, render the items as <a> not <li> (caller already used Link). */
  asLinks?: boolean;
}

export function ChartList<T>({
  items,
  isLoading,
  isEmpty,
  emptyState,
  renderRow,
  skeletonCount = 3,
  toolbar,
  footer,
  className,
}: ChartListProps<T>) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden", className)}>
      {toolbar ? (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 flex-wrap">
          {toolbar}
        </div>
      ) : null}
      {isLoading ? (
        <div className="p-5 flex flex-col gap-3">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-1/2 rounded-md" />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="p-3">{emptyState}</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item, idx) => (
            <li key={(item as any).id ?? idx}>{renderRow(item, idx)}</li>
          ))}
        </ul>
      )}
      {footer ? (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

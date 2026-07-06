"use client";

import type { ReactNode } from "react";

import { Card } from "@/portal/components/ui/Card";
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

/**
 * Standard list container for chart tabs. Renders:
 *   <Card padding={false}>
 *     [toolbar]
 *     <ul> rows </ul>
 *     [footer]
 *   </Card>
 * Handles loading skeleton, empty state, and even-spacing borders.
 */
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
    <Card padding={false} className={cn("overflow-hidden", className)}>
      {toolbar ? (
        <div className="px-4 py-3 border-b border-border/60 bg-surface-2/30 flex items-center justify-between gap-2 flex-wrap">
          {toolbar}
        </div>
      ) : null}
      {isLoading ? (
        <div className="p-4 flex flex-col gap-3">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="p-2">{emptyState}</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((item, idx) => (
            <li key={(item as any).id ?? idx}>{renderRow(item, idx)}</li>
          ))}
        </ul>
      )}
      {footer ? (
        <div className="px-4 py-3 border-t border-border/60 bg-surface-2/20">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}

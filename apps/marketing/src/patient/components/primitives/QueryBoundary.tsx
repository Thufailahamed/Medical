"use client";

import { cn } from "@/portal/lib/utils";

import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

/**
 * Drop-in wrapper for any TanStack Query result. Renders skeletons
 * while loading, an EmptyState when the query returns empty, and the
 * children with the data when ready — so pages don't have to repeat
 * the same three-arm conditional.
 *
 * The empty check is opt-out via `treatEmptyAs` (e.g. "error", or a
 * custom check) and the loading skeleton count defaults to 3.
 */
export function QueryBoundary<T>({
  query,
  isEmpty,
  loadingCount = 3,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error?: unknown; data: T | undefined };
  isEmpty?: (data: T) => boolean;
  loadingCount?: number;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
  children: (data: T) => React.ReactNode;
}) {
  const { isLoading, isError, data } = query;

  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {Array.from({ length: loadingCount }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="We couldn't load this right now"
        description="Refresh the page or check your connection. Your data is safe."
      />
    );
  }

  if (data == null || (isEmpty && isEmpty(data))) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return <>{children(data)}</>;
}

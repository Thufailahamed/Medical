"use client";

import type { UseQueryResult } from "@tanstack/react-query";

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
  query: Pick<
    UseQueryResult<T>,
    "isLoading" | "isError" | "error" | "refetch" | "data"
  >;
  isEmpty?: (data: T) => boolean;
  loadingCount?: number;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
  children: (data: T) => React.ReactNode;
}) {
  const { isLoading, isError, error, data } = query;

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
      <div className={cn("flex flex-col items-center gap-3 py-8 text-center", className)}>
        <EmptyState
          title="We couldn't load this right now"
          description={error instanceof Error ? error.message : "Refresh the page or check your connection. Your data is safe."}
        />
        {query.refetch ? (
          <button
            type="button"
            onClick={() => void query.refetch?.()}
            className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        ) : null}
      </div>
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

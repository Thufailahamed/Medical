import type { ReactNode } from "react";
import { cn } from "@/portal/lib/utils";

export function Empty({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 px-6 text-text-soft",
        className
      )}
    >
      {icon ? (
        <div className="h-12 w-12 rounded-full bg-surface-2 flex items-center justify-center mb-3 text-text-muted">
          {icon}
        </div>
      ) : null}
      <div className="text-sm font-bold text-text">{title}</div>
      {description ? (
        <div className="mt-1 text-xs text-text-soft max-w-sm">{description}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-surface-2",
        className
      )}
    />
  );
}

export function ErrorState({
  title,
  description,
  retry,
}: {
  title?: ReactNode;
  description?: ReactNode;
  retry?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-danger/40 bg-danger-soft/40 px-4 py-3 text-sm text-red-700">
      <div className="font-semibold">{title ?? "Something went wrong"}</div>
      {description ? <div className="mt-1 text-xs">{description}</div> : null}
      {retry ? <div className="mt-2">{retry}</div> : null}
    </div>
  );
}
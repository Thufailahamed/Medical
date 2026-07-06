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
        <div className="h-14 w-14 rounded-2xl bg-surface-2 flex items-center justify-center mb-4 text-text-muted border border-border/50">
          {icon}
        </div>
      ) : null}
      <div className="text-sm font-bold text-text">{title}</div>
      {description ? (
        <div className="mt-1.5 text-xs text-text-muted max-w-sm leading-relaxed">{description}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-surface-2",
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
    <div className="rounded-2xl border border-danger/30 bg-danger-soft/40 px-5 py-4 text-sm text-red-700">
      <div className="font-semibold">{title ?? "Something went wrong"}</div>
      {description ? <div className="mt-1 text-xs">{description}</div> : null}
      {retry ? <div className="mt-3">{retry}</div> : null}
    </div>
  );
}

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
        "flex flex-col items-center justify-center text-center py-12 px-6 text-slate-600",
        className
      )}
    >
      {icon ? (
        <div className="h-14 w-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3.5 border border-sky-100 shadow-xs">
          {icon}
        </div>
      ) : null}
      <div className="text-base sm:text-lg font-bold text-slate-900">{title}</div>
      {description ? (
        <div className="mt-1.5 text-xs text-slate-500 max-w-md leading-relaxed">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-4.5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-slate-100",
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
    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 text-sm text-rose-800 shadow-2xs">
      <div className="font-bold text-rose-900">{title ?? "Something went wrong"}</div>
      {description ? <div className="mt-1 text-xs text-rose-700 leading-relaxed">{description}</div> : null}
      {retry ? <div className="mt-3.5">{retry}</div> : null}
    </div>
  );
}

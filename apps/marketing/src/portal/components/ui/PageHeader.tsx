import type { ReactNode } from "react";
import { cn } from "@/portal/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white p-4.5 sm:p-5 shadow-2xs flex items-start justify-between gap-4 flex-wrap",
        className
      )}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        {icon && (
          <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs md:text-sm text-slate-500 mt-1 leading-relaxed max-w-2xl">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}

/** Section header inside a page — icon + title + count + right action */
export function SectionHeader({
  title,
  count,
  icon,
  right,
  className,
}: {
  title: string;
  count?: number;
  icon?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{title}</span>
          {count != null && (
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {count}
            </span>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

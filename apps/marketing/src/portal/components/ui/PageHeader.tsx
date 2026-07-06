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
    <div className={cn("flex items-start justify-between gap-4 flex-wrap", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="h-10 w-10 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-text tracking-tight">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
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
          <div className="h-8 w-8 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-text">{title}</span>
          {count != null && (
            <span className="text-[11px] font-semibold text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

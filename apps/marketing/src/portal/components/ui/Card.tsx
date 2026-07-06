import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/portal/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: boolean;
}

export function Card({ children, className, padding = true, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-surface shadow-sm transition-all duration-200 hover:shadow-md hover:border-border",
        padding && "p-4 md:p-5",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 pb-3 border-b border-border/60",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <div className="h-8 w-8 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold text-text tracking-tight">{title}</div>
          {subtitle ? (
            <div className="text-[11px] text-text-muted mt-0.5">{subtitle}</div>
          ) : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

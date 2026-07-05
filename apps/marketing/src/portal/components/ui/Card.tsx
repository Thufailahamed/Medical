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
        "rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-sm)] transition-all duration-200 hover:shadow-[var(--shadow-md)]",
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
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 pb-3 border-b border-border",
        className
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-bold text-text tracking-tight">{title}</div>
        {subtitle ? (
          <div className="text-xs text-text-soft mt-0.5">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

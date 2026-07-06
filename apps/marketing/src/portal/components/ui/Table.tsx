import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/portal/lib/utils";

export function Table({ children, className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-surface">
      <table
        className={cn("w-full text-sm border-collapse", className)}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface-2/50 text-text-soft text-[11px] uppercase tracking-wider font-semibold">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) {
  return (
    <tr
      className={cn(
        "border-t border-border/60 transition-colors hover:bg-surface-2/40",
        className
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <th
      className={cn(
        "text-left font-semibold px-4 py-3 whitespace-nowrap",
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <td className={cn("px-4 py-3 align-top", className)} {...rest}>
      {children}
    </td>
  );
}

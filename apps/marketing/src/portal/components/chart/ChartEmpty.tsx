"use client";

import type { ReactNode } from "react";

import { Empty } from "@/portal/components/ui/Empty";

export interface ChartEmptyProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Add vertical padding inside the empty card. */
  padded?: boolean;
}

/** Empty state for chart tabs. Always a CTA — empty isn't a dead end. */
export function ChartEmpty({
  icon,
  title,
  description,
  action,
  padded,
}: ChartEmptyProps) {
  return (
    <Empty
      icon={icon}
      title={title}
      description={description}
      action={action}
      className={padded ? "py-10" : "py-6"}
    />
  );
}

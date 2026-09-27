"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { cn } from "@/portal/lib/utils";

export type AiToolAccent =
  | "sky"
  | "brand"
  | "emerald"
  | "amber"
  | "violet"
  | "teal";

const ACCENT: Record<AiToolAccent, string> = {
  sky: "bg-brand-soft text-brand",
  brand: "bg-brand-soft text-brand",
  emerald: "bg-success-soft text-success",
  amber: "bg-warn-soft text-warn",
  violet: "bg-violet-50 text-violet-600",
  teal: "bg-success-soft text-success",
};

export function AiToolCard({
  href,
  title,
  description,
  cta,
  icon,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
  accent: AiToolAccent;
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="flex h-full flex-col transition-transform duration-200 group-hover:-translate-y-1">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-md transition-transform duration-200 group-hover:scale-105",
              ACCENT[accent],
            )}
            aria-hidden
          >
            {icon}
          </span>
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md border border-border text-text-muted transition-all duration-200 group-hover:border-brand group-hover:bg-brand group-hover:text-white"
          >
            <ArrowRight
              size={13}
              className="transition-transform duration-200 group-hover:-rotate-45"
            />
          </span>
        </div>
        <h3 className="t-card-title mt-3.5 text-text transition-colors group-hover:text-brand">
          {title}
        </h3>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-text-soft">
          {description}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-brand">
          {cta}
        </span>
      </Card>
    </Link>
  );
}

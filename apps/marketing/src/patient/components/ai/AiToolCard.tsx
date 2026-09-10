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
  sky: "bg-sky-50 text-sky-700",
  brand: "bg-brand-soft text-brand",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
  teal: "bg-teal-50 text-teal-700",
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
      <Card className="flex h-full flex-col transition-transform duration-200 group-hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              ACCENT[accent],
            )}
            aria-hidden
          >
            {icon}
          </span>
          <ArrowRight
            size={14}
            aria-hidden
            className="mt-1 text-text-muted transition-all group-hover:translate-x-0.5 group-hover:text-brand"
          />
        </div>
        <h3 className="mt-3 text-sm font-bold text-text">{title}</h3>
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

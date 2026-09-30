"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export type AiToolAccent =
  | "sky"
  | "brand"
  | "emerald"
  | "amber"
  | "violet"
  | "teal";

/** Gradient icon tiles — the admin "Quick tools" treatment. */
const ACCENT: Record<AiToolAccent, string> = {
  sky: "from-sky-500 to-blue-600 shadow-sky-500/30",
  brand: "from-indigo-500 to-violet-600 shadow-indigo-500/30",
  emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
  amber: "from-amber-500 to-orange-500 shadow-amber-500/30",
  violet: "from-violet-500 to-purple-600 shadow-violet-500/30",
  teal: "from-teal-500 to-cyan-600 shadow-teal-500/30",
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
    <Link
      href={href}
      className="group flex h-full flex-col rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.22),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20 transition-transform duration-200 group-hover:scale-105",
            ACCENT[accent],
          )}
          aria-hidden
        >
          {icon}
        </span>
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-sky-50 group-hover:text-sky-600"
        >
          <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
      <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-slate-900 transition-colors group-hover:text-sky-700">
        {title}
      </h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-700">{cta}</span>
    </Link>
  );
}

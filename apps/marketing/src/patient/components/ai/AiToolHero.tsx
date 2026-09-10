"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export function AiToolHero({
  badge,
  title,
  description,
  icon,
  actions,
  trust = [],
  backHref = "/patient/ai",
  backLabel = "Back to AI tools",
  className,
}: {
  badge: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  trust?: string[];
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "dashboard-hero relative overflow-hidden rounded-2xl p-6 text-white shadow-xl md:p-7",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 flex flex-col gap-4">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1 text-[11.5px] font-semibold text-sky-100/90 transition-colors hover:text-white"
        >
          <ArrowLeft size={12} aria-hidden />
          {backLabel}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-200 backdrop-blur-md">
              {icon}
              {badge}
            </span>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white md:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              {description}
            </p>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              {actions}
            </div>
          ) : null}
        </div>

        {trust.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-3.5">
            {trust.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/90"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

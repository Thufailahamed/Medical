"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { cn } from "@/portal/lib/utils";

/**
 * Dark insight card — routes patients into messages without inventing clinical advice.
 */
export function CareAssistant({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "patient-ink-glow anim-rise anim-rise-delay-2 relative overflow-hidden p-6 text-white",
        className
      )}
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-md">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60">
              Care insights
            </p>
            <span
              className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur"
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              <Sparkles size={12} aria-hidden />
              Powered by AI
            </span>
          </div>
          <h3 className="mt-3 text-xl font-bold tracking-tight">
            Questions about your plan?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Ask your care team about medicines, vitals, or what&apos;s next —
            we&apos;ll route you to the right conversation.
          </p>
        </div>
        <Link
          href="/patient/messages"
          className="shrink-0 bg-brand px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
          style={{
            borderRadius: "var(--radius-pill)",
            boxShadow: "var(--shadow-brand)",
          }}
        >
          Open chat
        </Link>
      </div>

      {/* Decorative helix-ish rings */}
      <div
        className="pointer-events-none absolute -right-8 top-1/2 h-40 w-40 -translate-y-1/2 opacity-40"
        aria-hidden
      >
        <div
          className="absolute inset-4 rounded-full border border-brand/50"
          style={{ transform: "rotateX(60deg)" }}
        />
        <div className="absolute inset-8 rounded-full border border-white/20" />
        <div className="absolute inset-12 rounded-full bg-brand/30 blur-xl" />
      </div>
    </div>
  );
}

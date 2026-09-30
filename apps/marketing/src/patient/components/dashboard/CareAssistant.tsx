"use client";

import Link from "next/link";
import { MessageSquare, Sparkles } from "lucide-react";

import { useConversations } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

/**
 * Compact AI / care-team CTA for the dashboard.
 */
export function CareAssistant({ className }: { className?: string }) {
  const conversations = useConversations();
  const unread = (conversations.data?.conversations ?? []).reduce(
    (sum, c) => sum + (c.patientUnread ?? 0),
    0,
  );

  return (
    <div
      className={cn(
        "patient-ink-glow anim-rise anim-rise-delay-2 relative flex h-full flex-col overflow-hidden p-5 text-white",
        className,
      )}
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 rounded-full border border-white/10"
        aria-hidden
      />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white/10 text-sky-200">
            <Sparkles size={17} aria-hidden />
          </span>
          <p className="pt-hero-kicker">Care insights</p>
        </span>
        {unread > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white">
            <MessageSquare size={12} aria-hidden />
            {unread} unread
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            AI ready
          </span>
        )}
      </div>

      <h3 className="relative z-10 mt-4 font-display text-lg font-semibold tracking-[-0.02em]">
        Questions about your plan?
      </h3>
      <p className="relative z-10 mt-1.5 text-sm leading-relaxed text-white/65">
        Ask about medicines, vitals, or what&apos;s next — with your record attached.
      </p>

      <div className="relative z-10 mt-5 grid grid-cols-2 gap-2">
        <Link
          href="/patient/ai/chat"
          data-testid="ask-ai-cta"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-white text-sm font-semibold text-ink-card transition-all hover:-translate-y-px hover:bg-sky-50"
        >
          <Sparkles size={15} aria-hidden />
          Ask AI
        </Link>
        <Link
          href="/patient/messages"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          <MessageSquare size={15} aria-hidden />
          Messages
        </Link>
      </div>
    </div>
  );
}

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
        "patient-ink-glow anim-rise anim-rise-delay-2 relative flex h-full flex-col justify-between overflow-hidden p-5 text-white sm:p-6",
        className,
      )}
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
            Care insights
          </p>
          {unread > 0 ? (
            <span
              className="inline-flex items-center gap-1 bg-brand px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              <MessageSquare size={12} aria-hidden />
              {unread} unread
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/85"
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              <Sparkles size={12} aria-hidden />
              AI ready
            </span>
          )}
        </div>
        <h3 className="mt-3 text-lg font-bold tracking-tight sm:text-xl">
          Questions about your plan?
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/65">
          Ask about medicines, vitals, or what&apos;s next — with your record
          attached.
        </p>
      </div>

      <div className="relative z-10 mt-6 flex flex-wrap gap-2">
        <Link
          href="/patient/ai/chat"
          className="inline-flex items-center gap-1.5 bg-brand px-4 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
          style={{
            borderRadius: "var(--radius-pill)",
            boxShadow: "var(--shadow-brand)",
          }}
        >
          <Sparkles size={15} aria-hidden />
          Ask AI
        </Link>
        <Link
          href="/patient/messages"
          className="inline-flex items-center gap-1.5 border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          <MessageSquare size={15} aria-hidden />
          Messages
        </Link>
      </div>

      <div
        className="pointer-events-none absolute -right-6 top-1/2 h-36 w-36 -translate-y-1/2 opacity-35"
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

"use client";

import Link from "next/link";
import { MessageSquare, Sparkles } from "lucide-react";

import { useConversations } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

/**
 * Compact AI / care-team CTA — the indigo feature card from the admin
 * dashboard, with Ask AI and Messages side by side.
 */
export function CareAssistant({ className }: { className?: string }) {
  const conversations = useConversations();
  const unread = (conversations.data?.conversations ?? []).reduce(
    (sum, c) => sum + (c.patientUnread ?? 0),
    0,
  );

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl p-5 text-white", className)}
      style={{
        background:
          "radial-gradient(420px 200px at 100% 0%, rgba(56,189,248,0.30), transparent 60%), radial-gradient(300px 160px at 0% 100%, rgba(129,140,248,0.25), transparent 60%), linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -18px rgba(49,46,129,0.6)",
      }}
    >
      <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden />
      <span className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 rounded-full border border-white/10" aria-hidden />

      <div className="relative flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-sky-200 ring-1 ring-inset ring-white/15 backdrop-blur">
            <Sparkles size={19} aria-hidden />
          </span>
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-sky-200/80">
            Care insights
          </span>
        </span>
        {unread > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[11px] font-semibold text-white">
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

      <h3 className="relative mt-4 text-lg font-semibold tracking-[-0.01em]">
        Questions about your plan?
      </h3>
      <p className="relative mt-1 text-xs leading-relaxed text-white/60">
        Ask about medicines, vitals, or what&apos;s next — with your record attached.
      </p>

      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <Link
          href="/patient/ai/chat"
          data-testid="ask-ai-cta"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-white text-sm font-semibold text-[#1e1b4b] transition-all hover:-translate-y-px hover:bg-sky-50"
        >
          <Sparkles size={15} aria-hidden />
          Ask AI
        </Link>
        <Link
          href="/patient/messages"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-white/20 bg-white/[0.06] text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
        >
          <MessageSquare size={15} aria-hidden />
          Messages
        </Link>
      </div>
    </div>
  );
}

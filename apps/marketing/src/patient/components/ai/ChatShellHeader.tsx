"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  FlaskConical,
  Globe,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { cn } from "@/portal/lib/utils";

export const CHAT_MODELS = [
  {
    id: "wellness-72",
    name: "Wellness 72",
    blurb: "Best for everyday clinical questions",
    icon: Sparkles,
  },
  {
    id: "wellness-pro",
    name: "Wellness Pro",
    blurb: "Deeper reasoning, lab interpretation",
    icon: FlaskConical,
  },
  {
    id: "wellness-fast",
    name: "Wellness Fast",
    blurb: "Quick, concise answers",
    icon: Globe,
  },
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"];

export function ChatShellHeader({
  modelId,
  onModelChange,
  onNewChat,
  hasMessages,
}: {
  modelId: ChatModelId;
  onModelChange: (id: ChatModelId) => void;
  onNewChat: () => void;
  hasMessages: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const modelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (modelBtnRef.current?.contains(target)) return;
      if (document.getElementById("model-menu")?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const activeModel =
    CHAT_MODELS.find((m) => m.id === modelId) ?? CHAT_MODELS[0];
  const ActiveIcon = activeModel.icon;

  return (
    <header
      className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-2 px-3 text-white sm:px-5"
      style={{
        background:
          "radial-gradient(600px 160px at 100% 0%, rgba(14,165,233,0.35), transparent 60%), radial-gradient(400px 140px at 0% 100%, rgba(20,184,166,0.18), transparent 60%), #07233a",
        boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/patient/ai"
          aria-label="Back to AI workspace"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/15 bg-white/[0.06] text-white/80 transition-colors hover:bg-white/[0.12] hover:text-white"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>

        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-400 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-inset ring-white/20"
        >
          <Sparkles size={16} />
        </span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-white">Care Chat</p>
          <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
            Grounded in your EMR
          </p>
        </div>

        <button
          ref={modelBtnRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={cn(
            "ml-1 inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[12px] font-semibold transition-colors",
            menuOpen
              ? "border-white/30 bg-white/[0.14] text-white"
              : "border-white/15 bg-white/[0.06] text-white/85 hover:bg-white/[0.12]",
          )}
        >
          <ActiveIcon size={13} aria-hidden />
          <span className="hidden sm:inline">{activeModel.name}</span>
          <ChevronDown
            size={12}
            aria-hidden
            className={cn("transition-transform", menuOpen && "rotate-180")}
          />
        </button>

        {menuOpen ? (
          <div
            id="model-menu"
            role="menu"
            className="absolute left-12 top-[60px] z-30 w-72 rounded-2xl bg-white p-1.5 text-slate-900 shadow-[0_24px_52px_-18px_rgba(15,23,42,0.35),inset_0_0_0_1px_rgba(15,23,42,0.07)]"
          >
            {CHAT_MODELS.map((m) => {
              const Icon = m.icon;
              const isActive = m.id === modelId;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onModelChange(m.id);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                    isActive ? "bg-sky-50" : "hover:bg-slate-50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                      isActive
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    <Icon size={14} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-slate-900">
                        {m.name}
                      </span>
                      {isActive ? (
                        <Check
                          size={14}
                          aria-hidden
                          className="shrink-0 text-sky-600"
                        />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                      {m.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {hasMessages ? (
          <button
            type="button"
            onClick={onNewChat}
            title="Start a new conversation"
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-white/15 bg-white/[0.06] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-white/[0.12]"
          >
            <RotateCcw size={13} aria-hidden />
            <span className="hidden sm:inline">New chat</span>
          </button>
        ) : null}
        <Link
          href="/patient/ai/lab-explain"
          className="hidden h-9 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[12px] font-semibold text-[#07233a] transition-all hover:-translate-y-px hover:bg-sky-50 sm:inline-flex"
        >
          <FlaskConical size={13} aria-hidden />
          <span>Lab explainer</span>
        </Link>
      </div>
    </header>
  );
}

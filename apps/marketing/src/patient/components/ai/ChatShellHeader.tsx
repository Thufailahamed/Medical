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
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-white/95 px-3 backdrop-blur-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/patient/ai"
          aria-label="Back to AI workspace"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-text-soft transition-colors hover:bg-surface-2 hover:text-text"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>

        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #0284c7, #38bdf8)" }}
        >
          <Sparkles size={14} />
        </span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <p className="truncate text-[13px] font-bold text-text">Care Chat</p>
          <p className="truncate text-[10.5px] text-text-muted">
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
            "ml-1 inline-flex h-8 items-center gap-1.5 rounded-pill border px-2.5 text-[12px] font-semibold transition-colors",
            menuOpen
              ? "border-brand/40 bg-brand-soft text-brand"
              : "border-border text-text-soft hover:bg-surface-2",
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
            className="absolute left-12 top-[52px] z-30 w-72 rounded-2xl border border-border bg-white p-1.5 shadow-[var(--shadow-float)]"
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
                    isActive ? "bg-brand-soft" : "hover:bg-surface-2",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                      isActive
                        ? "border-brand/30 bg-white text-brand"
                        : "border-border bg-surface-2 text-text-soft",
                    )}
                  >
                    <Icon size={14} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-text">
                        {m.name}
                      </span>
                      {isActive ? (
                        <Check
                          size={14}
                          aria-hidden
                          className="shrink-0 text-brand"
                        />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">
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
            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-medium text-text-soft transition-colors hover:bg-surface-2 hover:text-text"
          >
            <RotateCcw size={13} aria-hidden />
            <span className="hidden sm:inline">New chat</span>
          </button>
        ) : null}
        <Link
          href="/patient/ai/lab-explain"
          className="hidden h-8 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-medium text-text-soft transition-colors hover:bg-surface-2 hover:text-text sm:inline-flex"
        >
          <FlaskConical size={13} aria-hidden />
          <span>Lab explainer</span>
        </Link>
      </div>
    </header>
  );
}

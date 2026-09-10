"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export interface AiQuickPrompt {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

export function AiCommandBar({
  onSubmit,
  quickPrompts,
  placeholder = "Ask about records, labs, symptoms or prescriptions…",
  className,
}: {
  onSubmit: (prompt: string) => void;
  quickPrompts: AiQuickPrompt[];
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(value.trim());
    setValue("");
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <form
        onSubmit={handleSubmit}
        className="flex items-stretch gap-2 rounded-2xl bg-white p-1.5 shadow-[0_14px_40px_rgba(6,16,28,0.28)]"
      >
        <span
          aria-hidden
          className="grid w-9 shrink-0 place-items-center text-brand"
        >
          <Sparkles size={15} />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Ask the AI assistant"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-text placeholder:text-text-muted focus:outline-none"
        />
        <span
          aria-hidden
          className="hidden items-center rounded-lg border border-border bg-surface-2 px-1.5 text-[10px] font-bold text-text-muted sm:inline-flex"
        >
          ⌘K
        </span>
        <button
          type="submit"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-bold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-strong"
        >
          Ask AI
          <SendHorizontal size={12} aria-hidden />
        </button>
      </form>

      {quickPrompts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={prompt.onSelect}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              {prompt.icon}
              {prompt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

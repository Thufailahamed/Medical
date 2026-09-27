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
  promptsLabel,
  placeholder = "Ask about records, labs, symptoms or prescriptions…",
  className,
}: {
  onSubmit: (prompt: string) => void;
  quickPrompts: AiQuickPrompt[];
  promptsLabel?: string;
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
    <div className={cn("flex flex-col gap-3", className)}>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-1.5 shadow-card transition-shadow focus-within:border-brand md:p-2"
      >
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-soft text-brand shadow-2xs"
        >
          <Sparkles size={16} />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Ask the AI assistant"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text placeholder:text-text-muted focus:outline-none"
        />
        <span
          aria-hidden
          className="hidden sm:inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-mono font-bold text-text-muted shadow-2xs"
        >
          ⌘K
        </span>
        <button
          type="submit"
          className="pt-btn pt-btn-primary h-9 shrink-0 px-4 text-xs"
        >
          <span>Ask AI</span>
          <SendHorizontal size={13} strokeWidth={2.5} aria-hidden />
        </button>
      </form>

      {quickPrompts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {promptsLabel ? (
            <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              {promptsLabel}
            </span>
          ) : null}
          {quickPrompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={prompt.onSelect}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 hover:border-border-strong hover:bg-surface-3 px-3.5 py-1.5 text-xs font-medium text-text shadow-2xs transition-all cursor-pointer"
            >
              {prompt.icon}
              <span>{prompt.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

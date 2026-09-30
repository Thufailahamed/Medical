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
        className="flex items-center gap-2 rounded-2xl bg-slate-50 p-1.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_#0284c7,0_0_0_4px_rgba(14,165,233,0.12)] md:p-2"
      >
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30"
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
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <span
          aria-hidden
          className="hidden items-center rounded-md bg-white px-2 py-1 font-mono text-[10px] font-semibold text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] sm:inline-flex"
        >
          ⌘K
        </span>
        <button
          type="submit"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-[#07233a] px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
        >
          <span>Ask AI</span>
          <SendHorizontal size={13} strokeWidth={2.5} aria-hidden />
        </button>
      </form>

      {quickPrompts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {promptsLabel ? (
            <span className="mr-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {promptsLabel}
            </span>
          ) : null}
          {quickPrompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={prompt.onSelect}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-px hover:text-sky-700 hover:shadow-[inset_0_0_0_1px_rgba(2,132,199,0.3)]"
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

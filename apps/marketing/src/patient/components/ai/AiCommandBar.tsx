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
    <div className={cn("flex flex-col gap-3", className)}>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-2xl bg-white p-1.5 md:p-2 shadow-[0_12px_36px_rgba(12,74,110,0.28),0_2px_8px_rgba(0,0,0,0.06)] border border-white/50 ring-4 ring-black/5"
      >
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 shadow-2xs"
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
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
        <span
          aria-hidden
          className="hidden sm:inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-100/90 px-2 py-1 text-[10px] font-mono font-bold text-slate-500 shadow-2xs"
        >
          ⌘K
        </span>
        <button
          type="submit"
          style={{ backgroundColor: "#2563eb", color: "#ffffff" }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] px-4 text-xs font-bold text-white shadow-sm shadow-blue-600/30 transition-all cursor-pointer border border-blue-500/20"
        >
          <span>Ask AI</span>
          <SendHorizontal size={13} strokeWidth={2.5} aria-hidden />
        </button>
      </form>

      {quickPrompts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={prompt.onSelect}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 hover:bg-white/25 active:scale-[0.97] px-3.5 py-1.5 text-xs font-medium text-white shadow-2xs backdrop-blur-md transition-all cursor-pointer hover:border-white/40"
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

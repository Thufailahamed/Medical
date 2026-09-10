"use client";

import { useEffect } from "react";
import { ArrowUp, ShieldCheck, Square } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  useEhr,
  onToggleEhr,
  textareaRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  useEhr: boolean;
  onToggleEhr: (value: boolean) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  useEffect(() => {
    const ta = textareaRef?.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }, [value, textareaRef]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <footer className="shrink-0 px-3 pb-4 pt-2 sm:px-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col rounded-3xl border border-border bg-white shadow-[var(--shadow-card)] transition-all focus-within:border-brand/40 focus-within:shadow-[var(--shadow-md)]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message HealthHub…"
            rows={1}
            aria-label="Message HealthHub"
            className="w-full resize-none border-0 bg-transparent px-4 pb-1.5 pt-3 text-[14.5px] leading-relaxed text-text placeholder:text-text-muted focus:outline-none"
            style={{ maxHeight: 220 }}
          />

          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <button
              type="button"
              onClick={() => onToggleEhr(!useEhr)}
              title={
                useEhr
                  ? "EHR sync on — your records will be used to ground the answer"
                  : "EHR sync off — generic answer"
              }
              aria-label="Toggle EHR sync"
              aria-pressed={useEhr}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-pill border px-2.5 text-[12px] font-semibold transition-colors",
                useEhr
                  ? "border-success/30 bg-success-soft text-success"
                  : "border-border bg-white text-text-soft hover:bg-surface-2",
              )}
            >
              <ShieldCheck size={13} aria-hidden />
              <span className="hidden sm:inline">EHR</span>
            </button>

            {busy ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generating"
                className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-ink px-3 text-[12px] font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                <Square size={11} aria-hidden className="fill-white" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!value.trim()}
                onClick={onSend}
                aria-label="Send message"
                title="Send (Enter)"
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full transition-all",
                  value.trim()
                    ? "bg-brand text-white shadow-[var(--shadow-brand)] hover:bg-brand-strong"
                    : "cursor-not-allowed bg-surface-3 text-text-muted",
                )}
              >
                <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-text-muted">
          HealthHub AI can make mistakes. Verify clinical decisions with your
          physician.
        </p>
      </div>
    </footer>
  );
}

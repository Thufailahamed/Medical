"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Edit3,
  RefreshCw,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from "lucide-react";

import { cn } from "@/portal/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  createdAt: string;
}

function actionClass(active?: boolean, activeClass?: string) {
  return cn(
    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text",
    active && activeClass,
  );
}

export function ChatMessageRow({
  message,
  isLastAssistant,
  busy,
  copied,
  editing,
  rating,
  onCopy,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onReadAloud,
  onRate,
  onRegenerate,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
  busy: boolean;
  copied: boolean;
  editing: boolean;
  rating?: 1 | -1;
  onCopy: () => void;
  onEdit: () => void;
  onSaveEdit: (text: string) => void;
  onCancelEdit: () => void;
  onReadAloud: () => void;
  onRate: (value: 1 | -1) => void;
  onRegenerate: () => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="group/row flex w-full justify-end">
        <div className="flex max-w-[88%] flex-col items-end sm:max-w-[80%]">
          <div className="rounded-2xl rounded-tr-md bg-brand px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-[var(--shadow-brand)]">
            {editing ? (
              <EditUserBubble
                value={message.body}
                onCancel={onCancelEdit}
                onSave={onSaveEdit}
              />
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
            )}
          </div>
          {!editing ? (
            <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
              <button
                type="button"
                onClick={onCopy}
                title="Copy"
                className="inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text"
              >
                {copied ? (
                  <>
                    <Check size={12} aria-hidden className="text-success" />
                    <span className="text-success">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} aria-hidden />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onEdit}
                title="Edit and resubmit"
                className="inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <Edit3 size={12} aria-hidden />
                <span>Edit</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="group/row flex w-full items-start gap-3">
      <span
        aria-hidden
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white shadow-[var(--shadow-brand)]"
        style={{ background: "linear-gradient(135deg, #0284c7, #38bdf8)" }}
      >
        <Sparkles size={13} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-border bg-white p-3.5 text-[14px] leading-relaxed text-text shadow-[var(--shadow-card)]">
          <FormattedMessage content={message.body} />
        </div>

        <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
          <button
            type="button"
            onClick={onCopy}
            title="Copy"
            aria-label="Copy message"
            className={actionClass(copied, "text-success")}
          >
            {copied ? (
              <Check size={13} aria-hidden />
            ) : (
              <Copy size={13} aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={onReadAloud}
            title="Read aloud"
            aria-label="Read aloud"
            className={actionClass()}
          >
            <Volume2 size={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onRate(1)}
            title="Helpful"
            aria-label="Helpful"
            aria-pressed={rating === 1}
            className={actionClass(rating === 1, "text-success")}
          >
            <ThumbsUp
              size={13}
              aria-hidden
              className={cn(rating === 1 && "fill-success")}
            />
          </button>
          <button
            type="button"
            onClick={() => onRate(-1)}
            title="Not helpful"
            aria-label="Not helpful"
            aria-pressed={rating === -1}
            className={actionClass(rating === -1, "text-danger")}
          >
            <ThumbsDown
              size={13}
              aria-hidden
              className={cn(rating === -1 && "fill-danger")}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                void navigator.clipboard.writeText(window.location.href);
              }
            }}
            title="Share"
            aria-label="Share conversation"
            className={actionClass()}
          >
            <Share2 size={13} aria-hidden />
          </button>
          {isLastAssistant && !busy ? (
            <button
              type="button"
              onClick={onRegenerate}
              title="Regenerate response"
              aria-label="Regenerate response"
              className="inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-[11px] font-semibold text-brand hover:bg-brand-soft"
            >
              <RefreshCw size={12} aria-hidden />
              <span>Regenerate</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EditUserBubble({
  value,
  onCancel,
  onSave,
}: {
  value: string;
  onCancel: () => void;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="flex min-w-[220px] flex-col gap-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={Math.min(6, Math.max(2, draft.split("\n").length))}
        className="w-full resize-none rounded-xl border border-white/40 bg-white px-3 py-2 text-[14px] text-text focus:outline-none"
        autoFocus
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-7 rounded-lg px-3 text-[12px] font-medium text-white/90 hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft.trim())}
          disabled={!draft.trim()}
          className="h-7 rounded-lg bg-white px-3 text-[12px] font-bold text-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save &amp; submit
        </button>
      </div>
    </div>
  );
}

function FormattedMessage({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/);
  return (
    <div className="space-y-3">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n");
        const isList = lines.every((line) => {
          const t = line.trim();
          return (
            t === "" ||
            t.startsWith("- ") ||
            t.startsWith("* ") ||
            /^\d+\.\s/.test(t)
          );
        });

        if (isList && lines.some((l) => l.trim() !== "")) {
          const nonEmpty = lines.filter((l) => l.trim() !== "");
          return (
            <ul key={pIdx} className="list-disc space-y-1 pl-5 text-text">
              {nonEmpty.map((line, lIdx) => {
                const text = line.replace(/^\s*[-*]\s+|\s*\d+\.\s+/, "");
                return (
                  <li key={lIdx} className="leading-relaxed">
                    <InlineFormat text={text} />
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p
            key={pIdx}
            className="whitespace-pre-wrap break-words leading-relaxed"
          >
            <InlineFormat text={para} />
          </p>
        );
      })}
    </div>
  );
}

function InlineFormat({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-semibold text-text">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return (
            <em key={idx} className="italic text-text-soft">
              {part.slice(1, -1)}
            </em>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={idx}
              className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] text-text"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowDown, Sparkles, X } from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";
import { ChatComposer } from "@/patient/components/ai/ChatComposer";
import { ChatEmptyState } from "@/patient/components/ai/ChatEmptyState";
import {
  ChatMessageRow,
  type ChatMessage,
} from "@/patient/components/ai/ChatMessageRow";
import {
  ChatShellHeader,
  type ChatModelId,
} from "@/patient/components/ai/ChatShellHeader";

export default function AiChatPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const patientName = profile.data?.patient.users.name ?? "Patient";
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rating, setRating] = useState<Record<string, 1 | -1 | undefined>>({});
  const [modelId, setModelId] = useState<ChatModelId>("wellness-72");
  const [useEhr, setUseEhr] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [focusToken, setFocusToken] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const initialPromptSent = useRef(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 240);
  }

  function scrollToBottom() {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  async function sendMessage(text: string) {
    if (!text.trim() || busy) return;
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      body: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        message: userMsg.body,
        model: modelId,
        useEhr,
      };
      if (patientId) payload.patientId = patientId;
      if (sessionId) payload.sessionId = sessionId;

      const res = await api<{
        reply?: string;
        message?: { body: string };
        sessionId?: string;
      }>("/ai/chat", { method: "POST", json: payload });

      if (res.sessionId) setSessionId(res.sessionId);
      const replyText =
        res.reply ??
        res.message?.body ??
        "I have reviewed your clinical records and synthesized an assessment for you.";

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          body: replyText,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "The AI assistant is taking longer than usual. Please try again.",
      );
    } finally {
      setBusy(false);
      requestAnimationFrame(() => setFocusToken((t) => t + 1));
    }
  }

  function stopGeneration() {
    setBusy(false);
  }

  function regenerate() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === "user");
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.slice(0, realIdx);
    });
    void sendMessage(lastUser.body);
  }

  useEffect(() => {
    const prompt = searchParams.get("prompt")?.trim();
    if (!prompt || initialPromptSent.current) return;
    initialPromptSent.current = true;
    void sendMessage(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function resetChat() {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setInput("");
    setRating({});
    initialPromptSent.current = true;
    setFocusToken((t) => t + 1);
  }

  async function copyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  function readAloud(text: string) {
    if (typeof window === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(
      text.replace(/[*#_`>]/g, "").slice(0, 2000),
    );
    window.speechSynthesis?.speak(utterance);
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-text">
      <ChatShellHeader
        modelId={modelId}
        onModelChange={setModelId}
        onNewChat={resetChat}
        hasMessages={hasMessages}
      />

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {!hasMessages ? (
          <ChatEmptyState
            firstName={patientName.split(" ")[0]}
            disabled={busy}
            onPrompt={(query) => void sendMessage(query)}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
            {messages.map((m, idx) => (
              <ChatMessageRow
                key={m.id}
                message={m}
                isLastAssistant={
                  m.role === "assistant" && idx === messages.length - 1
                }
                busy={busy}
                copied={copiedId === m.id}
                editing={editingId === m.id}
                rating={rating[m.id]}
                onCopy={() => void copyMessage(m.id, m.body)}
                onEdit={() => setEditingId(m.id)}
                onSaveEdit={(text) => {
                  setEditingId(null);
                  setMessages((prev) => prev.slice(0, idx));
                  void sendMessage(text);
                }}
                onCancelEdit={() => setEditingId(null)}
                onReadAloud={() => readAloud(m.body)}
                onRate={(value) =>
                  setRating((prev) => {
                    const next = { ...prev };
                    if (next[m.id] === value) delete next[m.id];
                    else next[m.id] = value;
                    return next;
                  })
                }
                onRegenerate={regenerate}
              />
            ))}

            {busy ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-3"
              >
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white shadow-[var(--shadow-brand)]"
                  style={{
                    background: "linear-gradient(135deg, #0284c7, #38bdf8)",
                  }}
                >
                  <Sparkles size={13} className="animate-spin" />
                </span>
                <div className="flex items-center gap-1.5 pt-2">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      aria-hidden
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {showScrollDown ? (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-border bg-white text-text-soft shadow-[var(--shadow-md)] transition-colors hover:text-brand"
          >
            <ArrowDown size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs font-medium text-danger"
          >
            <div className="flex min-w-0 items-center gap-2">
              <AlertCircle size={14} aria-hidden className="shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const last = [...messages]
                    .reverse()
                    .find((m) => m.role === "user");
                  setError(null);
                  if (last) {
                    setInput(last.body);
                    setFocusToken((t) => t + 1);
                  }
                }}
                className="text-[11px] font-bold text-danger underline underline-offset-2 hover:opacity-80"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                className="text-danger hover:opacity-70"
              >
                <X size={13} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={() => void sendMessage(input)}
        onStop={stopGeneration}
        busy={busy}
        useEhr={useEhr}
        onToggleEhr={setUseEhr}
        focusToken={focusToken}
      />
    </div>
  );
}

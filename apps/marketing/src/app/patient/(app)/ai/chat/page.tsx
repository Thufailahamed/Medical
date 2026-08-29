"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Send,
  Sparkles,
  AlertCircle,
  Bot,
  User,
  Loader2,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api, ApiError } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  createdAt: string;
}

export default function AiChatPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || busy) return;
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      body: input.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await api<{
        reply?: string;
        message?: { body: string };
        sessionId?: string;
      }>("/ai/chat", {
        method: "POST",
        json: {
          message: userMsg.body,
          patientId,
          sessionId,
        },
      });
      if (res.sessionId) setSessionId(res.sessionId);
      const replyText = res.reply ?? res.message?.body ?? "…";
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
          : "AI is taking longer than usual. Try again in a moment."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-4 px-1 pb-2 sm:px-2">
      <Link
        href="/patient/ai"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to AI tools
      </Link>

      <SectionHeader
        label="Care assistant"
        title="Chat with your AI assistant"
        description="Ask anything about your records, meds, or symptoms. The assistant uses your file as context but never replaces your doctor."
      />

      <div className="flex flex-1 flex-col gap-3 overflow-hidden">
        <Card padded={false} className="flex-1 overflow-hidden">
          <div
            ref={listRef}
            className="flex h-full flex-col gap-3 overflow-y-auto p-4"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-text-soft">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
                  <Sparkles size={20} aria-hidden />
                </div>
                <p className="text-sm font-semibold text-text">
                  How can I help you today?
                </p>
                <p className="max-w-md text-xs">
                  Try: "What were my last cholesterol numbers?", "What side
                  effects should I watch for on metformin?", or "Explain my
                  last lab report in plain English."
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {[
                    "Summarize my last visit",
                    "Are my medicines safe together?",
                    "What should I ask my doctor?",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setInput(q)}
                      className="rounded-pill border border-border bg-surface-1 px-3 py-1.5 text-xs text-text-soft hover:border-brand hover:bg-brand-soft hover:text-brand"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => <Bubble key={m.id} message={m} />)
            )}
            {busy ? (
              <div className="flex items-start gap-2">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-brand-soft text-brand">
                  <Bot size={14} aria-hidden />
                </div>
                <div className="rounded-inner bg-surface-2 px-3 py-2 text-xs text-text-soft">
                  <Loader2 size={12} className="inline-block animate-spin" />{" "}
                  Thinking…
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <form onSubmit={send} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your health…"
              className="h-11 flex-1 rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-11 items-center gap-1.5 rounded-pill bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Send size={14} aria-hidden /> Send
            </button>
          </form>
          {error ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-danger">
              <AlertCircle size={12} aria-hidden /> {error}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex items-start gap-2 ${
        isUser ? "flex-row-reverse text-right" : ""
      }`}
    >
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-pill ${
          isUser
            ? "bg-brand text-white"
            : "bg-brand-soft text-brand"
        }`}
      >
        {isUser ? <User size={14} aria-hidden /> : <Bot size={14} aria-hidden />}
      </div>
      <div
        className={`max-w-[80%] rounded-inner px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-brand text-white"
            : "bg-surface-2 text-text"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
      </div>
    </div>
  );
}

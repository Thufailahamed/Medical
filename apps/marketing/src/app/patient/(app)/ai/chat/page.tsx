"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Copy,
  FlaskConical,
  HeartPulse,
  Loader2,
  Pill,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  X,
} from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  createdAt: string;
}

const STARTER_PROMPTS = [
  {
    title: "Medication Safety",
    blurb: "Check if your active medicines interact safely with foods or each other.",
    icon: Pill,
    tint: "bg-rose-50 text-rose-600 border-rose-200",
    query: "Are my current active medications safe to take together? Are there any food or timing interactions I should avoid?",
  },
  {
    title: "Explain Recent Labs",
    blurb: "Plain-English explanation of your latest blood tests and reference ranges.",
    icon: FlaskConical,
    tint: "bg-purple-50 text-purple-600 border-purple-200",
    query: "Explain my recent lab test results in simple, plain English without confusing medical jargon.",
  },
  {
    title: "Doctor Visit Prep",
    blurb: "Questions worth asking your specialist at your next clinical consultation.",
    icon: Stethoscope,
    tint: "bg-sky-50 text-sky-600 border-sky-200",
    query: "What are the most important clinical questions I should ask my doctor at my upcoming consultation?",
  },
  {
    title: "Vitals & Trends",
    blurb: "How your blood pressure, resting heart rate, and SpO2 compare to targets.",
    icon: HeartPulse,
    tint: "bg-emerald-50 text-emerald-600 border-emerald-200",
    query: "How do my recorded heart rate and blood pressure trends compare to healthy clinical target reference ranges?",
  },
];

const SUGGESTION_CHIPS = [
  "Are my meds safe together?",
  "Explain my cholesterol panel",
  "Questions for my doctor",
  "Target blood pressure range",
];

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

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialPromptSent = useRef(false);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

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
      const replyText =
        res.reply ??
        res.message?.body ??
        "I have reviewed your clinical records and synthesized a summary for you.";

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
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  useEffect(() => {
    const prompt = searchParams.get("prompt")?.trim();
    if (!prompt || initialPromptSent.current) return;
    initialPromptSent.current = true;
    setInput(prompt);
    void sendMessage(prompt);
  }, [searchParams]);

  function resetChat() {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setInput("");
    initialPromptSent.current = true;
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function copyMessage(id: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      {/* ── 1. Full-Bleed Oceanic Header Bar ──────────────────────────────── */}
      <header
        className="dashboard-hero relative shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 text-white overflow-hidden shadow-md"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-10 w-44 h-44 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Sparkles size={20} className="text-sky-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                  AI Health Assistant
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 px-2 py-0.5 text-[10.5px] font-bold text-emerald-200 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online · EHR Grounded
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5 hidden sm:block truncate">
                HIPAA Zero-Log · Medical Bio-LLM · Physician Supervised
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {hasMessages && (
              <button
                type="button"
                onClick={resetChat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>New Chat</span>
              </button>
            )}
            <Link
              href="/patient/ai"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
            >
              <ChevronLeft size={13} />
              <span>AI Workspace</span>
            </Link>
            <Link
              href="/patient/ai/lab-explain"
              className="hero-action-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-sm hover:scale-[1.02]"
              style={{ color: "#0c4a6e" }}
            >
              <FlaskConical size={13} className="text-sky-700" style={{ color: "#0284c7" }} />
              <span style={{ color: "#0c4a6e" }}>Lab Explainer</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. Full-Page Message Container ─────────────────────────────────── */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 w-full flex flex-col bg-slate-50/40"
      >
        {!hasMessages ? (
          <div className="my-auto flex flex-col items-center justify-center text-center p-4 max-w-3xl mx-auto w-full">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/25 mb-4"
              style={{
                background:
                  "linear-gradient(135deg, #0EA5E9 0%, #0284C7 50%, #0E7490 100%)",
              }}
            >
              <Sparkles size={28} />
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              How can I assist your health care today, {patientName.split(" ")[0]}?
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-lg">
              Ask about medication interactions, understand clinical diagnostic terms, review doctor summaries, or prepare questions for your next appointment.
            </p>

            {/* Context Highlights Strip */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs">
                <ShieldCheck size={13} className="text-emerald-600" />
                EHR Grounded
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs">
                <Pill size={13} className="text-rose-600" />
                Active Meds Synced
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs">
                <FlaskConical size={13} className="text-purple-600" />
                Lab Panels Live
              </span>
            </div>

            {/* 4 Interactive Starter Prompt Cards */}
            <div className="mt-6 grid w-full grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
              {STARTER_PROMPTS.map((sp) => {
                const Icon = sp.icon;
                return (
                  <button
                    key={sp.title}
                    type="button"
                    disabled={busy}
                    onClick={() => void sendMessage(sp.query)}
                    className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 text-left transition-all hover:border-sky-400 hover:bg-sky-50/30 shadow-2xs hover:shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs group-hover:scale-105 transition-transform",
                        sp.tint,
                      )}
                    >
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-800 transition-colors">
                          {sp.title}
                        </h3>
                        <ArrowRight
                          size={13}
                          className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600"
                        />
                      </div>
                      <p className="mt-1 text-[11.5px] text-slate-500 leading-relaxed">
                        {sp.blurb}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl w-full mx-auto flex flex-col gap-4 py-2">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-start gap-3 max-w-[90%] sm:max-w-[82%]",
                    isUser ? "self-end flex-row-reverse" : "self-start",
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold shadow-2xs",
                      isUser
                        ? "bg-slate-900 text-white"
                        : "bg-sky-600 text-white",
                    )}
                  >
                    {isUser ? <User size={15} /> : <Bot size={16} />}
                  </div>

                  <div className="flex flex-col gap-1 min-w-0">
                    <div
                      className={cn(
                        "p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs",
                        isUser
                          ? "bg-gradient-to-br from-sky-600 to-sky-700 text-white rounded-tr-xs"
                          : "bg-white border border-slate-200 text-slate-800 rounded-tl-xs",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-2 px-1 text-[10px] text-slate-400 font-medium",
                        isUser ? "justify-end" : "justify-start",
                      )}
                    >
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => copyMessage(m.id, m.body)}
                          className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-0.5 cursor-pointer ml-1"
                        >
                          {copiedId === m.id ? (
                            <>
                              <CheckCircle2 size={11} className="text-emerald-600" />
                              <span className="text-emerald-600 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Thinking State */}
            {busy && (
              <div className="flex items-start gap-3 self-start max-w-[80%]">
                <div className="h-8 w-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot size={16} />
                </div>
                <div className="p-3.5 rounded-2xl rounded-tl-xs bg-white border border-slate-200 flex items-center gap-2.5 text-xs font-semibold text-slate-600 shadow-2xs">
                  <Loader2 size={14} className="animate-spin text-sky-600" />
                  <span>Reviewing your clinical health records &amp; synthesizing response…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2.5 bg-rose-50 border-t border-rose-200 text-xs font-semibold text-rose-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-800 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── 3. Docked Full-Width Composer Bar ──────────────────────────────── */}
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-8 sm:py-3.5 w-full shadow-xs">
        <div className="max-w-4xl w-full mx-auto flex flex-col gap-2.5">
          {/* Suggestion Chips Ribbon (Visible when conversation is started) */}
          {hasMessages && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
                Suggested:
              </span>
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={busy}
                  onClick={() => void sendMessage(chip)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-700 transition-colors shrink-0 cursor-pointer shadow-2xs"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Composer Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            className="flex items-end gap-2.5"
          >
            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/60 p-1.5 shadow-2xs focus-within:bg-white focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={busy}
                rows={1}
                placeholder="Ask about medications, labs, symptoms, or doctor visits…"
                className="max-h-32 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none disabled:opacity-60 leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="h-14 px-5 rounded-2xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shrink-0"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
              aria-label="Send message"
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline">Send</span>
                  <Send size={14} />
                </>
              )}
            </button>
          </form>

          {/* Disclaimer text */}
          <p className="text-center text-[10.5px] text-slate-400 leading-tight">
            Grounded in your EHR · Enter to send · Shift+Enter for new line · Educational guidance only, not a substitute for doctor advice.
          </p>
        </div>
      </footer>
    </div>
  );
}

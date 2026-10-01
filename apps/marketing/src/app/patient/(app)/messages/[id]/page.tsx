"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  MessageCircle,
  Send,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import {
  useConversationMessages,
  useMarkConversationRead,
  useSendPatientMessage,
} from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  FIELD_TEXTAREA,
  HERO_CHIP,
  HeroAccent,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
} from "@/patient/components/workspace";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = useConversationMessages(id);
  const markRead = useMarkConversationRead(id);
  const sendMessage = useSendPatientMessage(id);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    markRead.mutate();
    // The conversation id is stable for the lifetime of this route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sendMessage.isPending) return;
    setSendError(null);
    try {
      await sendMessage.mutateAsync(body);
      setDraft("");
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Could not send message.");
    }
  };

  const doctorName = query.data?.doctor?.name ?? "Your doctor";
  const closed = query.data?.conversation?.status === "closed";
  const messages = query.data?.messages ?? [];

  return (
    <PatientPage>
      <div className="-mb-1">
        <Link
          href="/patient/messages"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Messages
        </Link>
      </div>

      <PatientHero
        overlap={false}
        kickerIcon={<ShieldCheck size={13} aria-hidden />}
        kicker="Secure messaging"
        kickerMeta={closed ? "Conversation closed" : "Active thread"}
        title={
          <>
            {doctorName.split(" ")[0]}{" "}
            <HeroAccent>{doctorName.split(" ").slice(1).join(" ") || ""}</HeroAccent>
          </>
        }
        description={
          closed
            ? "This conversation is closed — replies are disabled."
            : "Reply to your care team — messages are end-to-end encrypted."
        }
        chips={
          <>
            <span className={HERO_CHIP}>
              <Lock size={12} className="text-emerald-300" />
              End-to-end encrypted
            </span>
            <span className={HERO_CHIP}>{messages.length} messages</span>
          </>
        }
      />

      <div className="mx-auto w-full max-w-3xl">
        <section className={PANEL}>
          <PanelHeader
            icon={<MessageCircle size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={doctorName}
            caption={closed ? "Conversation closed" : "Care team thread"}
            action={
              closed ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  Closed
                </span>
              ) : undefined
            }
          />

          {query.isLoading ? (
            <div className="mt-4">
              <PanelSkeleton rows={4} />
            </div>
          ) : query.isError ? (
            <EmptyBlock
              icon={<MessageCircle size={19} />}
              title="Could not load messages"
              body="Check your connection and try again."
            />
          ) : messages.length === 0 ? (
            <EmptyBlock
              icon={<MessageCircle size={19} />}
              title="No messages"
              body="When your care team replies, it'll appear here."
            />
          ) : (
            <ol className="mt-4 flex flex-col gap-2.5">
              {messages.map((message) => {
                const mine = message.senderRole === "patient";
                return (
                  <li
                    key={message.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        mine
                          ? "rounded-br-md bg-sky-600 text-white"
                          : "rounded-bl-md border border-slate-100 bg-slate-50 text-slate-800",
                      )}
                    >
                      {message.body}
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          mine ? "text-sky-100/80" : "text-slate-400",
                        )}
                      >
                        {formatRelative(message.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {closed ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
              Replies are disabled because this conversation is closed. Book a new
              appointment to reopen a channel.
            </p>
          ) : (
            <form
              onSubmit={submit}
              className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4"
            >
              {sendError ? (
                <p role="alert" className="text-sm font-semibold text-rose-600">
                  {sendError}
                </p>
              ) : null}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type a reply…"
                  maxLength={4000}
                  rows={3}
                  className={cn(FIELD_TEXTAREA, "min-w-0 flex-1 resize-y")}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sendMessage.isPending}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                >
                  <Send size={14} />
                  {sendMessage.isPending ? "Sending…" : "Send"}
                </button>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Stethoscope size={11} />
                Clinical replies typically arrive within a few hours on working days.
              </p>
            </form>
          )}
        </section>
      </div>
    </PatientPage>
  );
}

"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useConversationMessages, useMarkConversationRead, useSendPatientMessage } from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
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

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <button type="button" onClick={() => router.push("/patient/messages")} className="self-start text-sm font-semibold text-brand hover:underline">
        ← Back to messages
      </button>
      <Card>
        <QueryBoundary
          query={query}
          loadingCount={4}
          emptyTitle="No messages"
          emptyDescription="When your care team replies, it'll appear here."
        >
          {(data) => {
            const closed = data.conversation?.status === "closed";
            return (
              <div className="flex flex-col gap-4">
                <div className="border-b border-surface-3 pb-3">
                  <h1 className="text-lg font-bold text-text">{data.doctor?.name ?? "Your doctor"}</h1>
                  <p className="mt-1 text-sm text-text-soft">
                    {closed ? "This conversation is closed." : "Reply to your care team."}
                  </p>
                </div>
                <ol className="flex flex-col gap-3">
                  {data.messages.map((message) => (
                    <li
                      key={message.id}
                      className={cn("flex", message.senderRole === "patient" ? "justify-end" : "justify-start")}
                    >
                      <div className={cn("max-w-[80%] rounded-inner px-4 py-2 text-sm", message.senderRole === "patient" ? "bg-brand text-white" : "bg-surface-2 text-text")}>
                        {message.body}
                        <p className="mt-1 text-[10px] opacity-70">{formatRelative(message.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {closed ? (
                  <p className="rounded-inner bg-surface-2 px-3 py-2 text-sm text-text-soft">Replies are disabled because this conversation is closed.</p>
                ) : (
                  <form onSubmit={submit} className="flex flex-col gap-2 border-t border-surface-3 pt-4">
                    {sendError ? <p role="alert" className="text-sm text-danger">{sendError}</p> : null}
                    <div className="flex gap-2">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Type a reply…"
                        maxLength={4000}
                        rows={3}
                        className="min-w-0 flex-1 resize-y rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-brand"
                      />
                      <button type="submit" disabled={!draft.trim() || sendMessage.isPending} className="self-end rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                        {sendMessage.isPending ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}

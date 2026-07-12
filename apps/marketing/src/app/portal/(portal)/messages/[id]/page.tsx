"use client";

import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, RefreshCcw } from "lucide-react";
import Link from "next/link";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useAuthStore } from "@/portal/stores/auth";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface Message {
  id: string;
  senderRole: "doctor" | "patient";
  body: string;
  createdAt: string;
  readAt?: string | null;
}

interface ConversationDetail {
  conversation: { id: string; patientId: string; patient: { name: string; photo: string | null } };
  messages: Message[];
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-messages", "conversation", id],
    queryFn: () => api<ConversationDetail>(`/doctor-messages/conversations/${id}/messages`),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "end" });
    }
    api(`/doctor-messages/conversations/${id}/read`, { method: "POST", json: {} }).then(() => {
      qc.invalidateQueries({ queryKey: ["doctor-messages", "conversations"] });
    });
  }, [id, qc, data?.messages?.length]);

  const send = useMutation({
    mutationFn: () =>
      api(`/doctor-messages/conversations/${id}/messages`, {
        method: "POST",
        json: { body },
      }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["doctor-messages", "conversation", id] });
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || send.isPending) return;
    send.mutate();
  }

  const msgs = data?.messages ?? [];
  const patient = data?.conversation?.patient;

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-100px)]">
      <div className="flex items-center gap-3">
        <Link href="/portal/messages" className="text-text-soft hover:text-text">
          <ArrowLeft size={16} />
        </Link>
        {patient ? (
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Avatar name={patient.name} src={patient.photo ?? undefined} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text truncate">{patient.name}</div>
              <div className="text-[10px] text-text-muted">
                {t("messages.conversationHash", { id: id.slice(0, 8) })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Card padding={false} className="flex-1 flex flex-col overflow-hidden">
        <CardHeader
          title={t("messages.title")}
          right={
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<RefreshCcw size={12} />}
              onClick={() =>
                qc.invalidateQueries({ queryKey: ["doctor-messages", "conversation", id] })
              }
            >
              {t("common.retry")}
            </Button>
          }
        />
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : msgs.length === 0 ? (
            <Empty title={t("messages.emptyConversation")} />
          ) : (
            msgs.map((m) => {
              const mine = m.senderRole === "doctor";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    mine
                      ? "self-end bg-brand text-white"
                      : "self-start bg-surface-2 text-text"
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div
                    className={cn(
                      "text-[10px] mt-1",
                      mine ? "text-white/70" : "text-text-muted"
                    )}
                  >
                    {formatDateTime(m.createdAt)}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        <form
          onSubmit={onSubmit}
          className="border-t border-border p-3 flex items-end gap-2"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            placeholder={t("messages.composerPlaceholder")}
            rows={1}
            className="flex-1 resize-none max-h-32 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-ring focus:border-brand focus:outline-none"
          />
          <Button
            type="submit"
            disabled={!body.trim() || send.isPending}
            loading={send.isPending}
            leftIcon={<Send size={14} />}
          >
            {t("common.send")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
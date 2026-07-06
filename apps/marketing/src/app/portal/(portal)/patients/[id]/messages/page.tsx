"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ArrowRight } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
} from "@/portal/components/chart";

interface ConvRow {
  id: string;
  patientId: string;
  patient: { id: string; name: string; photo: string | null };
  lastMessageAt: string;
  lastMessagePreview: string | null;
  doctorUnread: number;
}

interface ConvsResponse {
  conversations: ConvRow[];
}

export default function ChartMessagesTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-messages", "conversations", "chart", id],
    queryFn: () =>
      api<ConvsResponse>(`/doctor-messages/conversations?patientId=${id}&limit=50`),
  });

  const rows = data?.conversations ?? [];

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<MessageSquare size={18} />}
        title={t("tab.messages.title")}
        subtitle={t("tab.messages.subtitle", { count: rows.length })}
        badge={{ count: rows.length, tone: "info" }}
        actions={
          <Link href="/portal/messages">
            <Button size="sm" variant="ghost" leftIcon={<ArrowRight size={14} />}>
              {t("tab.messages.openInbox")}
            </Button>
          </Link>
        }
      />

      <ChartList
        items={rows}
        isLoading={isLoading}
        isEmpty={!isLoading && rows.length === 0}
        emptyState={
          <ChartEmpty
            icon={<MessageSquare size={20} />}
            title={t("chart.messages.empty")}
          />
        }
        renderRow={(c) => (
          <ChartRow
            href={`/portal/messages/${c.id}`}
            icon={
              <Avatar
                name={c.patient.name}
                src={c.patient.photo ?? undefined}
                size="sm"
              />
            }
            iconTone="info"
            title={c.patient.name}
            subtitle={c.lastMessagePreview ?? "—"}
            meta={
              <span className="text-[11px] text-text-muted">
                {relativeTime(c.lastMessageAt)}
              </span>
            }
            actions={
              c.doctorUnread > 0 ? (
                <span className="text-[10px] font-bold bg-brand text-white px-2 py-0.5 rounded-full">
                  {c.doctorUnread}
                </span>
              ) : null
            }
          />
        )}
      />
    </div>
  );
}

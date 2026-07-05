"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ArrowRight } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";

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

export default function ChartMessagesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-messages", "conversations", "chart", id],
    queryFn: () => api<ConvsResponse>(`/doctor-messages/conversations?limit=20`),
  });

  // Inline filter — server doesn't filter conversations by patientId since the
  // conversation list is already a doctor's conversations; match by id.
  const rows = (data?.conversations ?? []).filter((c) => c.patientId === id);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : rows.length === 0 ? (
          <Empty title={t("chart.messages.empty")} />
        ) : (
          <ul className="flex flex-col">
            {rows.map((c) => (
              <li key={c.id} className="border-b border-border last:border-0">
                <Link
                  href={`/messages/${c.id}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-surface-2 px-2 -mx-2 rounded-md"
                >
                  <Avatar name={c.patient.name} src={c.patient.photo ?? undefined} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">
                      {c.patient.name}
                    </div>
                    <div className="text-xs text-text-soft truncate">
                      {c.lastMessagePreview ?? "—"}
                    </div>
                  </div>
                  <div className="text-[10px] text-text-muted shrink-0">
                    {relativeTime(c.lastMessageAt)}
                  </div>
                  {c.doctorUnread > 0 ? (
                    <span className="text-[10px] font-medium bg-brand text-white px-1.5 py-0.5 rounded-full">
                      {c.doctorUnread}
                    </span>
                  ) : null}
                  <ArrowRight size={14} className="text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="flex justify-end">
        <Link href="/portal/messages">
          <Button size="sm" variant="ghost">
            {t("chart.messages.openInbox")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
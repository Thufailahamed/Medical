"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Inbox, MessageSquare, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Input } from "@/portal/components/ui/Form";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface ConvRow {
  id: string;
  patientId: string;
  patient: { id: string; userId: string; name: string; photo: string | null };
  lastMessageAt: string;
  lastMessagePreview: string | null;
  doctorUnread: number;
}

export default function MessagesInboxPage() {
  const t = useT();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-messages", "conversations", "inbox"],
    queryFn: () => api<{ conversations: ConvRow[]; totalUnread: number }>(`/doctor-messages/conversations?limit=100`),
  });

  const rows = useMemo(() => {
    const all = data?.conversations ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((c) => c.patient.name.toLowerCase().includes(term) || (c.lastMessagePreview ?? "").toLowerCase().includes(term));
  }, [data, q]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("messages.title")}
        subtitle={t("messages.subtitle")}
        icon={<MessageSquare size={18} className="text-brand" />}
        badge={
          (data?.totalUnread ?? 0) > 0 ? (
            <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-amber-500 text-[11px] font-bold text-white flex items-center justify-center">
              {data!.totalUnread}
            </span>
          ) : undefined
        }
      />

      <Card>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("messages.search")} className="pl-10" />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-3/4" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("messages.empty")} icon={<Inbox size={20} className="text-text-muted" />} className="py-12" />
        ) : (
          <ul className="flex flex-col">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/portal/messages/${c.id}`} className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors group",
                  c.doctorUnread > 0 ? "bg-sky-50/40 hover:bg-sky-50/70" : "hover:bg-surface-2/40"
                )}>
                  <div className="relative shrink-0">
                    <Avatar name={c.patient.name} src={c.patient.photo ?? undefined} />
                    {c.doctorUnread > 0 && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-sky-500 border-2 border-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-[13px] truncate leading-tight", c.doctorUnread > 0 ? "font-bold text-text" : "font-medium text-text")}>{c.patient.name}</span>
                      <span className="text-[10px] text-text-muted shrink-0 tabular-nums">{relativeTime(c.lastMessageAt)}</span>
                    </div>
                    <div className={cn("text-xs truncate mt-0.5 leading-relaxed", c.doctorUnread > 0 ? "text-text-soft font-medium" : "text-text-muted")}>{c.lastMessagePreview ?? "—"}</div>
                  </div>
                  {c.doctorUnread > 0 && (
                    <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-sky-500 text-[10px] font-bold text-white flex items-center justify-center shrink-0">{c.doctorUnread}</span>
                  )}
                  <ChevronRight size={14} className="text-text-muted/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

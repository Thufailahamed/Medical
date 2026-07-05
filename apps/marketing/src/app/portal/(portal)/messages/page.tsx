"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Inbox } from "lucide-react";
import { useState, useMemo } from "react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Pill } from "@/portal/components/ui/Pill";
import { Input } from "@/portal/components/ui/Form";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";

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
    queryFn: () => api<{ conversations: ConvRow[]; totalUnread: number }>(
      `/doctor-messages/conversations?limit=100`
    ),
  });

  const rows = useMemo(() => {
    const all = data?.conversations ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((c) =>
      c.patient.name.toLowerCase().includes(term) ||
      (c.lastMessagePreview ?? "").toLowerCase().includes(term)
    );
  }, [data, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text">{t("messages.title")}</h1>
          <p className="text-sm text-text-soft mt-1">{t("messages.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-soft">
          <Inbox size={14} />
          <span>{t("messages.unread", { count: data?.totalUnread ?? 0 })}</span>
        </div>
      </div>

      <Card>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("messages.search")}
            className="pl-9"
          />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("messages.empty")} className="m-4" />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <Avatar name={c.patient.name} src={c.patient.photo ?? undefined} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text truncate">
                        {c.patient.name}
                      </span>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {relativeTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="text-xs text-text-soft truncate mt-0.5">
                      {c.lastMessagePreview ?? "—"}
                    </div>
                  </div>
                  {c.doctorUnread > 0 ? (
                    <Pill tone="brand">{c.doctorUnread}</Pill>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
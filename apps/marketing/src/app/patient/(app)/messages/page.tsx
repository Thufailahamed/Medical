"use client";

import Link from "next/link";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useConversations } from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";

export default function MessagesPage() {
  const query = useConversations();

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Care team"
        title="Messages"
        description="Conversations with your doctors and care team."
      />

      <Card>
        <QueryBoundary
          query={query as any}
          loadingCount={3}
          emptyTitle="No messages yet"
          emptyDescription="Conversations with your care team will show here."
        >
          {(data) => (
            <ul className="flex flex-col">
              {data.conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/patient/messages/${c.id}`}
                    className="flex items-start gap-3 border-b border-surface-2 px-2 py-4 last:border-b-0 hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">
                        {c.doctorName ?? "Doctor"}
                      </p>
                      {c.lastMessagePreview ? (
                        <p className="truncate text-xs text-text-soft">
                          {c.lastMessagePreview}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="t-micro">
                        {formatRelative(c.lastMessageAt)}
                      </span>
                      {c.patientUnread > 0 ? (
                        <Pill tone="brand">{c.patientUnread} new</Pill>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}

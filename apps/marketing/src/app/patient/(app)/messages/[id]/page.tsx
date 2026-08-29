"use client";

import { use } from "react";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useConversationMessages } from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = useConversationMessages(id);

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <Card>
        <QueryBoundary
          query={query as any}
          loadingCount={3}
          emptyTitle="No messages"
          emptyDescription="When your care team replies, it'll appear here."
        >
          {(data) => (
            <ol className="flex flex-col gap-3">
              {data.messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "flex",
                    m.senderRole === "patient" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-inner px-4 py-2 text-sm",
                      m.senderRole === "patient"
                        ? "bg-brand text-white"
                        : "bg-surface-2 text-text"
                    )}
                  >
                    {m.body}
                    <p className="mt-1 text-[10px] opacity-70">
                      {formatRelative(m.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}

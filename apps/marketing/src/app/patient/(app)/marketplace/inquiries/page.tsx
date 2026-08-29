"use client";

import Link from "next/link";
import { ChevronRight, Send, Inbox, Clock, Check, X } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useCaretakerInquiries } from "@/patient/hooks/marketplace";
import { formatRelative, humanize } from "@/patient/lib/format";

export default function InquiriesPage() {
  const query = useCaretakerInquiries();
  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Marketplace"
        title="My inquiries"
        description="Conversations with caretakers you've reached out to."
        action={
          <Link
            href="/patient/marketplace"
            className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
          >
            Find more <ChevronRight size={12} aria-hidden />
          </Link>
        }
      />

      <Card>
        <QueryBoundary
          query={query}
          loadingCount={3}
          emptyTitle="No inquiries yet"
          emptyDescription="Find a caretaker in the marketplace and send your first message."
        >
          {(data) => {
            const list = data?.inquiries ?? [];
            return (
              <ul className="flex flex-col gap-2">
                {list.map((inq) => (
                  <li
                    key={inq.id}
                    className="rounded-inner border border-[color:var(--color-border)] bg-surface-1 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-brand-soft text-brand">
                        <Send size={14} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-text">
                            {inq.caretakerName ?? "Caretaker"}
                          </h3>
                          <StatusPill tone={statusTone(inq.status)}>
                            {humanize(inq.status)}
                          </StatusPill>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-text-soft">
                          {inq.message}
                        </p>
                        {inq.response ? (
                          <div className="mt-2 rounded-inner bg-surface-2 p-2 text-xs text-text">
                            <p className="font-semibold text-text-soft">Reply</p>
                            {inq.response}
                          </div>
                        ) : null}
                        <p className="mt-1 text-[10px] text-text-muted">
                          Sent {formatRelative(inq.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}

function statusTone(status: string): "success" | "warn" | "info" | "neutral" {
  if (status === "responded") return "success";
  if (status === "closed") return "neutral";
  if (status === "pending") return "warn";
  return "info";
}

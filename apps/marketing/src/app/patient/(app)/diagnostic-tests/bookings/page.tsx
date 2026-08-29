"use client";

import Link from "next/link";
import { ChevronRight, FlaskConical, MapPin, Calendar } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useTestBookings } from "@/patient/hooks/diagnostic";
import { formatDayLabel, humanize } from "@/patient/lib/format";

export default function TestBookingsPage() {
  const query = useTestBookings();
  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Diagnostics"
        title="My bookings"
        description="Lab tests you've scheduled. Tap a booking to view its status, report, and lab info."
      />

      <Card>
        <QueryBoundary
          query={query}
          loadingCount={3}
          emptyTitle="No bookings yet"
          emptyDescription="Book a test or package to get started."
        >
          {(data) => {
            const list = data?.bookings ?? [];
            if (list.length === 0) {
              return (
                <p className="text-sm text-text-soft">No bookings yet.</p>
              );
            }
            return (
              <ul className="flex flex-col gap-2">
                {list.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/patient/diagnostic-tests/bookings/${b.id}`}
                      className="group flex items-center gap-3 rounded-inner border border-[color:var(--color-border)] bg-surface-1 p-3 hover:border-brand hover:bg-brand-soft"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-brand-soft text-brand">
                        <FlaskConical size={16} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">
                          {b.packageName}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-soft">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={11} aria-hidden />
                            {formatDayLabel(b.scheduledAt)}
                          </span>
                          {b.labName ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} aria-hidden />
                              {b.labName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <StatusPill tone={statusTone(b.status)}>
                        {humanize(b.status)}
                      </StatusPill>
                      <ChevronRight
                        size={14}
                        aria-hidden
                        className="text-text-muted group-hover:text-brand"
                      />
                    </Link>
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

function statusTone(
  status: string
): "success" | "warn" | "danger" | "neutral" | "info" {
  if (status === "completed") return "success";
  if (status === "sample_collected" || status === "processing") return "warn";
  if (status === "cancelled") return "danger";
  return "info";
}

"use client";

import Link from "next/link";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useRecords } from "@/patient/hooks";
import { formatDayLabel } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

export function RecentRecords({ className }: { className?: string }) {
  const query = useRecords({ limit: 5 });
  return (
    <Card className={cn("anim-rise", className)}>
      <div className="flex items-end justify-between">
        <p className="t-label">Recent records</p>
        <Link
          href="/patient/records"
          className="text-xs font-medium text-text-soft hover:text-text"
        >
          See all
        </Link>
      </div>

      <QueryBoundary
        query={query as any}
        emptyTitle="No records yet"
        emptyDescription="Lab results, prescriptions and visit notes will appear here."
        className="mt-4 flex flex-col gap-2"
      >
        {(data) => (
          <ul className="flex flex-col gap-2">
            {data.records.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-inner bg-surface-2 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {r.title}
                  </p>
                  <p className="t-micro">{formatDayLabel(r.date)}</p>
                </div>
                <Pill tone="info">{r.recordType}</Pill>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
}

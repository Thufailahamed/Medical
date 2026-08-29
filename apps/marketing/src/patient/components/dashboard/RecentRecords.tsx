"use client";

import { FileText } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useRecords } from "@/patient/hooks";
import { formatDayLabel } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

export function RecentRecords({ className }: { className?: string }) {
  const query = useRecords({ limit: 5 });
  return (
    <Card accent="violet" className={cn("anim-rise", className)}>
      <CardHeader
        title="Recent records"
        caption="Latest from your file"
        icon={<FileText size={15} />}
        href="/patient/records"
        linkLabel="See all"
      />

      <QueryBoundary
        query={query as any}
        emptyTitle="No records yet"
        emptyDescription="Lab results, prescriptions and visit notes will appear here."
        className="mt-4 flex flex-col gap-2"
      >
        {(data) => (
          <ul className="mt-4 flex flex-col gap-2">
            {data.records.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-inner border border-[color:var(--color-border)] bg-surface-2/80 px-3 py-2.5"
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

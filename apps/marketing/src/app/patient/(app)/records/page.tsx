"use client";

import Link from "next/link";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { useRecords, useRecordStats } from "@/patient/hooks";
import { formatDayLabel } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

export default function RecordsListPage() {
  const query = useRecords({ limit: 50 });
  const stats = useRecordStats();

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <SectionHeader label="Your file" title="Medical records" />

      <Card>
        <QueryBoundary
          query={stats as any}
          emptyTitle=""
          loadingCount={3}
        >
          {(data) => (
            <div className="flex flex-wrap gap-2">
              <Pill tone="brand">
                {data.total} total
              </Pill>
              {Object.entries(data.byType ?? {}).slice(0, 6).map(([k, v]) => (
                <Pill key={k} tone="info">
                  {k} · {v as number}
                </Pill>
              ))}
            </div>
          )}
        </QueryBoundary>
      </Card>

      <Card>
        <QueryBoundary
          query={query as any}
          loadingCount={5}
          emptyTitle="No records on file"
          emptyDescription="Your lab results, prescriptions and visit notes will land here."
        >
          {(data) => (
            <ul className="flex flex-col gap-2">
              {data.records.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/patient/records/${r.id}`}
                    className="flex items-center gap-3 rounded-inner bg-surface-2 px-4 py-3 hover:bg-surface-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">
                        {r.title}
                      </p>
                      <p className="t-micro">
                        {formatDayLabel(r.date)}
                        {r.diagnosis ? ` · ${r.diagnosis}` : ""}
                      </p>
                    </div>
                    <Pill tone="info">{r.recordType}</Pill>
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

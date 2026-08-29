"use client";

import { use } from "react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useRecord } from "@/patient/hooks";
import { formatDayLabel } from "@/patient/lib/format";

export default function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = useRecord(id);

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <Card>
        <QueryBoundary
          query={query as any}
          loadingCount={2}
          emptyTitle="No such record"
          emptyDescription="We couldn't find that record on your file."
        >
          {(data) => (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="t-label">{data.recordType}</p>
                  <h1 className="t-card-title mt-1">{data.title}</h1>
                  <p className="t-micro mt-1">{formatDayLabel(data.date)}</p>
                </div>
                <Pill tone="info">{data.status ?? "—"}</Pill>
              </div>

              {data.diagnosis ? (
                <div>
                  <p className="t-label">Diagnosis</p>
                  <p className="mt-1 text-sm text-text-soft">{data.diagnosis}</p>
                </div>
              ) : null}

              {data.summary ? (
                <div>
                  <p className="t-label">Summary</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-soft">
                    {data.summary}
                  </p>
                </div>
              ) : null}

              {data.tags ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (
                      <Pill key={t} tone="info">
                        {t}
                      </Pill>
                    ))}
                </div>
              ) : null}
            </div>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}

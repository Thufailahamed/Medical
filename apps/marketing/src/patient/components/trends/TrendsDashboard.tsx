"use client";

import { useState } from "react";

import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { Card } from "@/patient/components/primitives/Card";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { useLabResults, useVitalsSeriesRaw } from "@/patient/hooks";
import type { VitalType } from "@/patient/types/patient";

import { MetricTabs, type MetricKey } from "./MetricTabs";
import { RangeTabs, type RangeDays } from "./RangeTabs";
import { MetricChart } from "./MetricChart";

const VITAL_METRICS: VitalType[] = [
  "heart_rate",
  "blood_pressure",
  "spo2",
  "temperature",
  "blood_sugar",
  "weight",
];

function isVital(m: MetricKey): boolean {
  return (VITAL_METRICS as readonly string[]).includes(m);
}

export function TrendsDashboard() {
  const [metric, setMetric] = useState<MetricKey>("blood_pressure");
  const [range, setRange] = useState<RangeDays>(30);

  const vitalsQuery = useVitalsSeriesRaw(
    (isVital(metric) ? metric : "heart_rate") as VitalType,
    range
  );
  const labsQuery = useLabResults({
    months: Math.max(1, Math.ceil(range / 30)),
    test: metric === "hba1c" ? "hba1c" : undefined,
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="Trends" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetricTabs active={metric} onChange={setMetric} />
        <RangeTabs active={range} onChange={setRange} />
      </div>
      {metric === "hba1c" ? (
        <LabsTable
          items={labsQuery.data?.items ?? []}
          isLoading={labsQuery.isLoading}
        />
      ) : (
        <MetricChart query={vitalsQuery} />
      )}
    </div>
  );
}

function LabsTable({
  items,
  isLoading,
}: {
  items: Array<{
    id: string;
    test: string;
    value: string;
    unit: string | null;
    flag: string | null;
    collectedAt: string;
  }>;
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!items.length) {
    return (
      <p className="text-sm text-text-muted">No HbA1c results in this range.</p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((l) => (
        <Card key={l.id}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{l.test}</span>
            <span className="text-text-muted">
              {l.collectedAt.slice(0, 10)}
            </span>
          </div>
          <p className="text-lg font-semibold">
            {l.value}
            {l.unit && (
              <span className="ml-1 text-sm font-normal text-text-muted">{l.unit}</span>
            )}
          </p>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { Card } from "@/patient/components/primitives/Card";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { Sparkline } from "@/patient/components/charts/Sparkline";
import {
  VITAL_REGISTRY,
} from "@/patient/lib/vitals";
import type {
  VitalSeriesResponse,
  VitalType,
} from "@/patient/types/patient";

export function VitalsSparkCard({
  type,
  query,
}: {
  type: VitalType;
  query: { data: VitalSeriesResponse | undefined; isLoading: boolean };
}) {
  if (query.isLoading) return <Skeleton className="h-20 w-full" rounded="card" />;
  const meta = VITAL_REGISTRY[type];
  const points = query.data?.points ?? [];
  const values = points.map((p) => p.value);
  const last = values[values.length - 1];
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-muted">{meta.label}</p>
          <p className="text-2xl font-semibold">
            {last == null ? "—" : last.toFixed(meta.decimals)}
            {last != null && (
              <span className="ml-1 text-sm font-normal text-text-muted">{meta.unit}</span>
            )}
          </p>
        </div>
        <Sparkline data={values} />
      </div>
    </Card>
  );
}

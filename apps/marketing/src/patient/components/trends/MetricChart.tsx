"use client";

import { Card } from "@/patient/components/primitives/Card";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { TrendArea } from "@/patient/components/charts/TrendArea";
import { toSeries } from "@/patient/lib/vitals";
import type { VitalSeriesResponse } from "@/patient/types/patient";

export function MetricChart({
  query,
}: {
  query: { data: VitalSeriesResponse | undefined; isLoading: boolean };
}) {
  if (query.isLoading) return <Skeleton className="h-44 w-full" rounded="card" />;
  const points = toSeries(query.data?.points ?? []);
  return (
    <Card padded={false}>
      <div className="p-4">
        <TrendArea points={points} showSecondary />
      </div>
    </Card>
  );
}

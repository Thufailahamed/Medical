"use client";

import { Card } from "@/patient/components/primitives/Card";
import { Pill, type PillTone } from "@/patient/components/primitives/Pill";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import { VITAL_REGISTRY } from "@/patient/lib/vitals";
import type { VitalAlert } from "@/patient/types/patient";

function toneFor(classification: string): PillTone {
  if (classification === "critical" || classification === "high") return "danger";
  if (classification === "warning") return "warn";
  return "info";
}

export function AlertsList({
  alerts,
  isLoading,
}: {
  alerts: VitalAlert[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-12 w-full" />;
  if (!alerts?.length) {
    return <EmptyState title="No alerts in this range" />;
  }
  return (
    <div className="space-y-2">
      {alerts.map((a, idx) => (
        <Card key={`${a.type}-${a.recordedAt}-${idx}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{VITAL_REGISTRY[a.type]?.label ?? a.type}</p>
              {a.message && (
                <p className="text-sm text-text-muted">{a.message}</p>
              )}
            </div>
            <Pill tone={toneFor(a.classification)}>{a.classification}</Pill>
          </div>
        </Card>
      ))}
    </div>
  );
}

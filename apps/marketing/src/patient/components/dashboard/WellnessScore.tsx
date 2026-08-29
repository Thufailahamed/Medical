"use client";

import { Card } from "@/patient/components/primitives/Card";
import { RadialGauge } from "@/patient/components/charts/RadialGauge";
import { useWellness } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";

export function WellnessScore({ className }: { className?: string }) {
  const query = useWellness();
  return (
    <Card className={cn("anim-rise flex flex-col items-center", className)}>
      <p className="t-label self-start">Wellness score</p>
      <QueryBoundary
        query={query as any}
        emptyTitle="Wellness unavailable"
        emptyDescription="We don't have enough recent data to score today."
        className="mt-6 flex flex-col items-center"
      >
        {(data) => (
          <div className="mt-2 flex flex-col items-center gap-2">
            <RadialGauge
              value={data.score}
              tone={toneFor(data.level.tone)}
              label={data.level.label}
            />
            <p className="t-micro">Updated {data.updatedAt?.slice(0, 10)}</p>
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
}

function toneFor(
  tone: string
): "brand" | "success" | "warn" | "danger" {
  if (tone === "success") return "success";
  if (tone === "warning") return "warn";
  if (tone === "danger") return "danger";
  return "brand";
}

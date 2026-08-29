"use client";

import { useState } from "react";
import { Pill as PillIcon } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { RadialGauge } from "@/patient/components/charts/RadialGauge";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useMedicationStats, useMedicationsToday } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

/**
 * Today's meds as selectable chips + adherence gauge.
 */
export function MedicationsToday({ className }: { className?: string }) {
  const query = useMedicationsToday();
  const stats = useMedicationStats(7);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Card accent="rose" className={cn("anim-rise anim-rise-delay-2", className)}>
      <CardHeader
        title="Today's plan"
        caption="Medications"
        icon={<PillIcon size={15} />}
        href="/patient/medications"
        linkLabel="View all"
      />

      <QueryBoundary
        query={query as any}
        emptyTitle="Nothing scheduled today"
        emptyDescription="You'll see doses here once your doctor issues an active plan."
        className="mt-4"
      >
        {(data) => {
          const meds = data.medicines.slice(0, 5);
          const activeId = selectedId ?? meds[0]?.id ?? null;
          return (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {meds.map((m) => {
                  const on = m.id === activeId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={cn(
                        "max-w-full truncate px-3 py-1.5 text-xs font-semibold transition-colors",
                        on
                          ? "bg-brand text-white shadow-sm"
                          : "bg-surface-2 text-text-soft hover:bg-surface-3"
                      )}
                      style={{ borderRadius: "var(--radius-pill)" }}
                    >
                      {m.name}
                      {m.dosage ? ` ${m.dosage}` : ""}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-4">
                <RadialGauge
                  value={stats.data?.todayTaken ?? 0}
                  max={Math.max(1, stats.data?.todayCount ?? 1)}
                  size={96}
                  tone="brand"
                  display={`${stats.data?.todayTaken ?? 0}/${stats.data?.todayCount ?? 0}`}
                  label="doses"
                />
                <div className="min-w-0 flex-1">
                  {(() => {
                    const selected = meds.find((m) => m.id === activeId);
                    if (!selected) return null;
                    return (
                      <>
                        <p className="truncate text-sm font-semibold text-text">
                          {selected.name}
                        </p>
                        <p className="t-micro mt-0.5">
                          {selected.dosage}
                          {selected.timing ? ` · ${selected.timing}` : ""}
                          {selected.frequency ? ` · ${selected.frequency}` : ""}
                        </p>
                        <p className="mt-2 text-xs text-text-soft">
                          Streak{" "}
                          <span className="font-semibold text-text">
                            {stats.data?.streakDays ?? 0}d
                          </span>
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}

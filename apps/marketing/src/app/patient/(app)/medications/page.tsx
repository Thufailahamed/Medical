"use client";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { StatTile } from "@/patient/components/primitives/StatTile";
import { useMedications, useMedicationStats } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

export default function MedicationsPage() {
  const list = useMedications();
  const stats = useMedicationStats(7);

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <SectionHeader label="Daily plan" title="Medications" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QueryBoundary
          query={stats as any}
          loadingCount={1}
          emptyTitle=""
        >
          {(data) => (
            <>
              <StatTile label="Active" value={String(data.activeCount ?? 0)} />
              <StatTile
                label="Today"
                value={`${data.todayTaken ?? 0}/${data.todayCount ?? 0}`}
              />
              <StatTile
                label="Streak"
                value={`${data.streakDays ?? 0}d`}
              />
            </>
          )}
        </QueryBoundary>
      </div>

      <Card>
        <QueryBoundary
          query={list as any}
          isEmpty={(d) => !d || !d.medicines || d.medicines.length === 0}
          loadingCount={3}
          emptyTitle="No medications yet"
          emptyDescription="When your doctor prescribes a medication, it lands here."
        >
          {(data) => {
            const medicines = data?.medicines ?? [];
            return (
              <ul className="flex flex-col gap-3">
                {medicines.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 rounded-inner px-4 py-3",
                    m.active ? "bg-surface-2" : "bg-surface-2/60"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {m.name}
                    </p>
                    <p className="t-micro">
                      {m.dosage} {m.frequency ? `· ${m.frequency}` : ""}
                      {m.timing ? ` · ${m.timing}` : ""}
                    </p>
                  </div>
                  <Pill tone={m.active ? "success" : "neutral"}>
                    {m.active ? "Active" : "Paused"}
                  </Pill>
                </li>
              ))}
              </ul>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}

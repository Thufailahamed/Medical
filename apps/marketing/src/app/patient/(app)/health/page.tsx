"use client";

import { VitalsTrend } from "@/patient/components/dashboard/VitalsTrend";
import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useHealthSummary, useVitalsAlerts } from "@/patient/hooks";
import { VITAL_REGISTRY } from "@/patient/lib/vitals";
import { cn } from "@/portal/lib/utils";

export default function HealthPage() {
  const summary = useHealthSummary();
  const alerts = useVitalsAlerts(7);

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Vitals & Metrics"
        title="Health"
        description="Track your vitals trends, recent alerts, and health profile."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <VitalsTrend />
        </div>

        <div className="flex flex-col gap-5 xl:col-span-4">
          <Card className="anim-rise anim-rise-delay-1 h-full">
            <p className="t-label">Recent alerts</p>
            <QueryBoundary
              query={alerts}
              isEmpty={(d) => {
                const list = d?.items ?? (d as any)?.alerts;
                return !list || list.length === 0;
              }}
              emptyTitle="No alerts"
              emptyDescription="Your vitals are within healthy range."
              className="mt-4"
            >
              {(data) => {
                const items = data?.items ?? (data as any)?.alerts ?? [];
                if (items.length === 0) {
                  return (
                    <p className="text-sm text-text-soft">
                      Your vitals are within healthy range.
                    </p>
                  );
                }
                return (
                  <ul className="flex flex-col gap-2">
                    {items.slice(0, 5).map((a, i) => (
                      <li
                        key={i}
                        className={cn(
                          "flex items-start gap-3 rounded-inner px-3 py-2.5",
                          a.classification?.toLowerCase().includes("low") ||
                            a.classification?.toLowerCase().includes("critical")
                            ? "bg-danger-soft"
                            : "bg-surface-2"
                        )}
                      >
                        <span
                          className="mt-1.5 block h-2 w-2 rounded-full bg-danger"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">
                            {VITAL_REGISTRY[a.type]?.label ?? a.type}: {a.value}
                            {VITAL_REGISTRY[a.type]?.unit ?? ""}
                          </p>
                          <p className="t-micro">{a.classification}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              }}
            </QueryBoundary>
          </Card>
        </div>
      </div>

      <Card className="anim-rise anim-rise-delay-2">
        <p className="t-label">About you</p>
        <QueryBoundary
          query={summary}
          emptyTitle="No profile summary"
          emptyDescription="Information from your intake will populate here."
          className="mt-4"
        >
          {(data) => (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <Field label="Name" value={data.demographics?.name ?? "—"} />
              <Field label="Age" value={data.demographics?.age ?? "—"} />
              <Field label="Sex" value={data.demographics?.sex ?? "—"} />
              <Field label="Blood group" value={data.demographics?.bloodGroup ?? "—"} />
              <Field label="BMI" value={data.demographics?.bmi ?? "—"} />
              <Field
                label="Active medicines"
                value={data.activeMedicines?.length ?? 0}
              />
            </dl>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-inner bg-surface-2 px-3 py-2.5">
      <dt className="t-micro">{label}</dt>
      <dd className="mt-0.5 font-semibold text-text">{String(value)}</dd>
    </div>
  );
}

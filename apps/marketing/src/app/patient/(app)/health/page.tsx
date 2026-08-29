"use client";

import { useState } from "react";

import { BodyFigure, BodyHotspot } from "@/patient/components/body";
import { OrganDetailPanel, type OrganDetail } from "@/patient/components/body/OrganDetailPanel";
import { VitalsTrend } from "@/patient/components/dashboard/VitalsTrend";
import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useHealthSummary, useVitalsAlerts } from "@/patient/hooks";
import type { VitalType } from "@/patient/types/patient";
import { VITAL_REGISTRY } from "@/patient/lib/vitals";
import { cn } from "@/portal/lib/utils";

interface HotspotSpec {
  id: string;
  cx: number;
  cy: number;
  r?: number;
  label: string;
  /** Which vital type the latest reading for this organ lives under. */
  vital: VitalType;
  /** Tone of the active hotspot; defaults to brand. */
  tone?: "brand" | "warn" | "danger" | "info";
}

const HOTSPOTS: HotspotSpec[] = [
  { id: "head", cx: 50, cy: 14, label: "Head", vital: "blood_pressure" },
  { id: "heart", cx: 50, cy: 42, label: "Heart", vital: "heart_rate", tone: "brand" },
  { id: "lungs", cx: 36, cy: 40, label: "Lungs", vital: "spo2" },
  { id: "liver", cx: 60, cy: 50, label: "Liver", vital: "blood_sugar", tone: "info" },
  { id: "kidney-l", cx: 42, cy: 58, label: "Left kidney", vital: "blood_pressure" },
  { id: "kidney-r", cx: 58, cy: 58, label: "Right kidney", vital: "blood_pressure" },
];

export default function HealthPage() {
  const [active, setActive] = useState<HotspotSpec | null>(null);
  const summary = useHealthSummary();
  const alerts = useVitalsAlerts(7);

  const detail: OrganDetail | null = active
    ? {
        id: active.id,
        title: active.label,
        status: `Latest ${VITAL_REGISTRY[active.vital].label.toLowerCase()} reading is available`,
        metrics: [
          { label: "Tracking", value: VITAL_REGISTRY[active.vital].label },
          { label: "Unit", value: VITAL_REGISTRY[active.vital].unit },
        ],
        body: "The readings mapped to this organ come straight from your vitals feed. Select a different vitals tab to compare, or open Care Assistant to send a question to your doctor.",
      }
    : null;

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="anim-rise flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="t-label">Body map</p>
              <p className="t-card-title mt-1">Tap a region to inspect</p>
            </div>
            <Pill tone="info">Front view</Pill>
          </div>

          <div className="mx-auto aspect-[5/6] w-full max-w-sm">
            <BodyFigure>
              {HOTSPOTS.map((h) => (
                <BodyHotspot
                  key={h.id}
                  cx={h.cx}
                  cy={h.cy}
                  r={h.r ?? 4}
                  label={h.label}
                  tone={h.tone ?? "brand"}
                  active={active?.id === h.id}
                  onSelect={() =>
                    setActive(active?.id === h.id ? null : h)
                  }
                  testId={`spot-${h.id}`}
                />
              ))}
            </BodyFigure>
          </div>
        </Card>

        <div className="flex flex-col gap-6 xl:col-span-2">
          <VitalsTrend />
          <Card className="anim-rise">
            <p className="t-label">Recent alerts</p>
            <QueryBoundary
              query={alerts as any}
              emptyTitle="No alerts"
              emptyDescription="Your vitals are within healthy range."
              className="mt-4"
            >
              {(data) => (
                <ul className="flex flex-col gap-2">
                  {data.items.slice(0, 5).map((a, i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex items-start gap-3 rounded-inner px-3 py-2",
                        a.classification?.toLowerCase().includes("low") ||
                          a.classification?.toLowerCase().includes("critical")
                          ? "bg-danger-soft"
                          : "bg-surface-2"
                      )}
                    >
                      <span
                        className="mt-1 block h-2 w-2 rounded-full bg-danger"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">
                          {VITAL_REGISTRY[a.type].label}:{" "}
                          {a.value}
                          {VITAL_REGISTRY[a.type].unit}
                        </p>
                        <p className="t-micro">{a.classification}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </QueryBoundary>
          </Card>
        </div>
      </div>

      <Card className="anim-rise">
        <p className="t-label">About you</p>
        <QueryBoundary
          query={summary as any}
          emptyTitle="No profile summary"
          emptyDescription="Information from your intake will populate here."
          className="mt-4"
        >
          {(data) => (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
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

      <OrganDetailPanel
        detail={detail}
        open={Boolean(active)}
        onClose={() => setActive(null)}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="t-micro">{label}</dt>
      <dd className="font-medium text-text">{String(value)}</dd>
    </div>
  );
}

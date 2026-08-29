"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BodyFigure, BodyHotspot } from "@/patient/components/body";
import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useHealthSummary, useVitalsAlerts } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

const CALLOUTS = [
  { id: "brain", cx: 50, cy: 14, label: "Brain", side: "left" as const },
  { id: "lungs", cx: 36, cy: 40, label: "Lungs", side: "left" as const },
  { id: "heart", cx: 50, cy: 42, label: "Heart", side: "right" as const },
  { id: "kidneys", cx: 50, cy: 58, label: "Kidneys", side: "right" as const },
];

/**
 * Tall body overview card for the dashboard center column.
 */
export function BodyOverview({ className }: { className?: string }) {
  const router = useRouter();
  const summary = useHealthSummary();
  const alerts = useVitalsAlerts(7);

  const alertCount = alerts.data?.count ?? 0;
  const statusTone = alertCount > 0 ? "warn" : "success";
  const statusLabel = alertCount > 0 ? "Needs review" : "Excellent";
  const openHealth = () => router.push("/patient/health");

  return (
    <Card
      className={cn(
        "anim-rise anim-rise-delay-1 flex h-full min-h-[420px] flex-col",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-label">Body scan</p>
          <p className="t-card-title mt-1">Organ overview</p>
        </div>
        <Pill tone={statusTone === "warn" ? "warn" : "success"}>
          {statusLabel}
        </Pill>
      </div>

      <div className="relative mx-auto mt-4 flex w-full max-w-[240px] flex-1 items-center justify-center">
        {/* Soft ambient glow behind figure */}
        <div
          className="pointer-events-none absolute inset-[12%] rounded-full bg-brand/10 blur-2xl"
          aria-hidden
        />

        <div className="relative aspect-[5/6] w-full">
          <BodyFigure ariaLabel="Body overview">
            {CALLOUTS.map((c) => (
              <BodyHotspot
                key={c.id}
                cx={c.cx}
                cy={c.cy}
                r={3.5}
                label={c.label}
                tone="brand"
                active={false}
                onSelect={openHealth}
                testId={`dash-spot-${c.id}`}
              />
            ))}
          </BodyFigure>

          {/* Floating status chips */}
          <ul className="pointer-events-none absolute inset-0" aria-hidden>
            {CALLOUTS.map((c) => (
              <li
                key={c.id}
                className="absolute"
                style={{
                  top: `${(c.cy / 120) * 100}%`,
                  left: c.side === "left" ? "0%" : "auto",
                  right: c.side === "right" ? "0%" : "auto",
                  transform: "translateY(-50%)",
                }}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 bg-surface/90 px-2 py-1 text-[10px] font-semibold text-text shadow-sm backdrop-blur",
                    c.side === "left" ? "flex-row" : "flex-row-reverse"
                  )}
                  style={{ borderRadius: 10 }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-surface-3 pt-4">
        <QueryBoundary
          query={summary as any}
          emptyTitle=""
          className="min-w-0"
        >
          {(data) => (
            <div className="min-w-0">
              <p className="t-micro">Active conditions</p>
              <p className="truncate text-sm font-semibold text-text">
                {data.conditions?.length
                  ? data.conditions[0].title
                  : "None on file"}
              </p>
            </div>
          )}
        </QueryBoundary>

        <Link
          href="/patient/health"
          className="shrink-0 bg-ink px-3.5 py-2 text-xs font-bold text-white"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          Open map
        </Link>
      </div>
    </Card>
  );
}

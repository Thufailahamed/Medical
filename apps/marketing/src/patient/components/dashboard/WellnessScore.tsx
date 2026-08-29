"use client";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useWellness } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { HeartPulse } from "lucide-react";

const SEGMENT_COLORS = [
  "var(--color-brand)",
  "#8b9bff",
  "var(--color-surface-3)",
  "var(--color-success)",
];

/**
 * Wellness / life-quality card with segmented health distribution ring.
 */
export function WellnessScore({ className }: { className?: string }) {
  const query = useWellness();
  return (
    <Card accent="violet" className={cn("anim-rise anim-rise-delay-3", className)}>
      <CardHeader
        title="Life quality"
        caption="Wellness score"
        icon={<HeartPulse size={15} />}
      />
      <QueryBoundary
        query={query as any}
        emptyTitle="Wellness unavailable"
        emptyDescription="We don't have enough recent data to score today."
        className="mt-3"
      >
        {(data) => {
          const entries = Object.entries(data.components ?? {}).slice(0, 4);
          const total =
            entries.reduce((s, [, v]) => s + Math.max(0, Number(v) || 0), 0) ||
            1;

          return (
            <div className="flex flex-col gap-4">
              <div>
                <p className="flex items-baseline gap-1.5">
                  <span className="t-metric">{data.score}</span>
                  <span className="t-unit text-sm">quality pts</span>
                </p>
                <p className="t-micro mt-1">{data.level.label}</p>
              </div>

              <div className="flex items-center gap-5">
                <DistributionRing
                  score={data.score}
                  segments={entries.map(([key, value], i) => ({
                    key,
                    value: Math.max(0, Number(value) || 0),
                    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }))}
                  total={total}
                />
                <ul className="flex flex-1 flex-col gap-2">
                  {entries.map(([key, value], i) => (
                    <li key={key} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                        }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate font-medium capitalize text-text-soft">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="font-semibold text-text">
                        {Math.round(Number(value) || 0)}
                      </span>
                    </li>
                  ))}
                  {entries.length === 0 ? (
                    <li className="text-xs text-text-soft">
                      Overall score {data.score}%
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}

function DistributionRing({
  score,
  segments,
  total,
}: {
  score: number;
  segments: Array<{ key: string; value: number; color: string }>;
  total: number;
}) {
  const size = 120;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const arcs =
    segments.length > 0
      ? segments.map((seg) => {
          const len = (seg.value / total) * circ;
          const dash = `${len} ${circ - len}`;
          const item = { ...seg, dash, rotate: (offset / circ) * 360 - 90 };
          offset += len;
          return item;
        })
      : [
          {
            key: "score",
            value: score,
            color: "var(--color-brand)",
            dash: `${(Math.min(100, score) / 100) * circ} ${circ}`,
            rotate: -90,
          },
        ];

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={a.dash}
            transform={`rotate(${a.rotate} ${c} ${c})`}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tracking-tight text-text">
          {score}%
        </span>
        <span className="t-micro">overall</span>
      </div>
    </div>
  );
}

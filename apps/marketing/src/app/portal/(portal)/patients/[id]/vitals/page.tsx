"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { Activity, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import {
  ChartTabHeader,
  ChartEmpty,
} from "@/portal/components/chart";
import {
  vitalClassificationToTone,
  vitalLabel,
} from "@/portal/lib/clinicalTones";

interface Vital {
  id: string;
  type: string;
  value: number;
  secondaryValue?: number | null;
  unit?: string | null;
  classification?: string | null;
  recordedAt: string;
  notes?: string | null;
}

interface LatestVital {
  type: string;
  value: number;
  secondaryValue?: number | null;
  unit?: string | null;
  classification?: string | null;
  recordedAt: string;
}

interface PatientSummary {
  vitals: Vital[];
  latestVitals: LatestVital[];
}

const NORMAL_RANGES: Record<string, [number, number]> = {
  systolic_bp: [90, 130],
  diastolic_bp: [60, 85],
  heart_rate: [60, 100],
  blood_glucose: [70, 140],
  spo2: [95, 100],
  body_temp: [36.1, 37.5],
  weight: [40, 120],
};

const CLASSIFICATION_DOT: Record<string, string> = {
  normal: "var(--success)",
  abnormal: "var(--warn)",
  warning: "var(--warn)",
  critical: "var(--danger)",
};

function classifyDot(classification?: string | null): string {
  const k = (classification ?? "").toLowerCase();
  return CLASSIFICATION_DOT[k] ?? "var(--brand)";
}

export default function VitalsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "summary"],
    queryFn: () => api<PatientSummary>(`/doctor-portal/patients/${id}/summary`),
  });

  const vitals = data?.vitals ?? [];
  const latest = data?.latestVitals ?? [];

  const byType = useMemo(() => {
    const map = new Map<string, Vital[]>();
    for (const v of vitals) {
      const arr = map.get(v.type) ?? [];
      arr.push(v);
      map.set(v.type, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => +parseISO(a.recordedAt) - +parseISO(b.recordedAt));
    }
    return map;
  }, [vitals]);

  const totalReadings = vitals.length;

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<Activity size={18} />}
        title={t("tab.vitals.title")}
        subtitle={t("tab.vitals.subtitle", { count: totalReadings })}
        badge={{ count: totalReadings, tone: "brand" }}
        actions={
          <Link href={`/portal/vitals/new?patientId=${id}`}>
            <Button size="sm" leftIcon={<ArrowRight size={14} />}>
              {t("tab.vitals.add")}
            </Button>
          </Link>
        }
      />

      {!isLoading && latest.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {latest.slice(0, 8).map((l) => (
            <Card key={l.type} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-text-soft uppercase tracking-wide font-bold">
                  <Activity size={11} /> {vitalLabel(l.type)}
                </div>
                {l.classification ? (
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: classifyDot(l.classification) }}
                  />
                ) : null}
              </div>
              <div className="text-2xl font-semibold text-text tabular-nums mt-1">
                {l.value}
                {l.secondaryValue != null ? `/${l.secondaryValue}` : ""}
                <span className="text-xs text-text-soft ml-1 font-normal">
                  {l.unit ?? ""}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 gap-1">
                <span className="text-[10px] text-text-muted">
                  {format(parseISO(l.recordedAt), "MMM d, HH:mm")}
                </span>
                {l.classification ? (
                  <Pill
                    tone={vitalClassificationToTone(l.classification)}
                  >
                    {t(`status.${l.classification.toLowerCase()}`)}
                  </Pill>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <Card>
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : byType.size === 0 ? (
        <Card>
          <ChartEmpty
            padded
            icon={<Activity size={22} />}
            title={t("tab.vitals.empty")}
            action={
              <Link href={`/portal/vitals/new?patientId=${id}`}>
                <Button size="sm" leftIcon={<ArrowRight size={14} />}>
                  {t("tab.vitals.add")}
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        Array.from(byType.entries()).map(([type, points]) => {
          const range = NORMAL_RANGES[type];
          const values = points.map((p) => p.value);
          const yMin = range
            ? Math.min(range[0], ...values) - 5
            : Math.min(...values) - 5;
          const yMax = range
            ? Math.max(range[1], ...values) + 5
            : Math.max(...values) + 5;
          const data = points.map((p) => ({
            t: +parseISO(p.recordedAt),
            value: p.value,
            secondary: p.secondaryValue ?? null,
            classification: p.classification ?? "normal",
            label: format(parseISO(p.recordedAt), "MMM d"),
          }));
          return (
            <Card key={type}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-text">
                  {vitalLabel(type)}
                </h3>
                <div className="flex items-center gap-1.5">
                  <Pill tone="neutral">{points.length} readings</Pill>
                  {range ? (
                    <Pill tone="success">
                      {t("tab.vitals.normalRange", {
                        min: range[0],
                        max: range[1],
                      })}
                    </Pill>
                  ) : null}
                </div>
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data}
                    margin={{ top: 5, right: 10, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(v) => format(new Date(v), "MMM d")}
                      stroke="var(--text-muted)"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      domain={[yMin, yMax]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      labelFormatter={(v) =>
                        format(new Date(v as number), "MMM d, HH:mm")
                      }
                      formatter={(v: number) => [v, vitalLabel(type)]}
                    />
                    {range ? (
                      <ReferenceArea
                        y1={range[0]}
                        y2={range[1]}
                        fill="var(--success-soft)"
                        fillOpacity={0.4}
                      />
                    ) : null}
                    {range ? (
                      <ReferenceLine
                        y={range[1]}
                        stroke="var(--warn)"
                        strokeDasharray="2 2"
                        strokeOpacity={0.5}
                      />
                    ) : null}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--brand)"
                      strokeWidth={2}
                      dot={({ cx, cy, payload }) => (
                        <circle
                          key={`${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r={3}
                          fill={classifyDot(payload.classification)}
                          stroke="var(--surface)"
                          strokeWidth={1.5}
                        />
                      )}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

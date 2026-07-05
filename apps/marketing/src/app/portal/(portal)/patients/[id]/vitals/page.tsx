"use client";

import { use, useMemo } from "react";
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
} from "recharts";
import { Activity } from "lucide-react";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";

interface Vital {
  id: string;
  type: string;
  value: number;
  secondaryValue?: number | null;
  unit?: string | null;
  recordedAt: string;
  notes?: string | null;
}

interface LatestVital {
  type: string;
  value: number;
  secondaryValue?: number | null;
  unit?: string | null;
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

function vitalLabel(type: string) {
  return type.replace(/_/g, " ");
}

export default function VitalsTab({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="flex flex-col gap-4">
      {!isLoading && latest.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {latest.slice(0, 8).map((l) => (
            <Card key={l.type} className="p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-text-soft uppercase tracking-wide">
                <Activity size={11} /> {vitalLabel(l.type)}
              </div>
              <div className="text-2xl font-semibold text-text tabular-nums mt-1">
                {l.value}
                {l.secondaryValue != null ? `/${l.secondaryValue}` : ""}
                <span className="text-xs text-text-soft ml-1 font-normal">{l.unit ?? ""}</span>
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {format(parseISO(l.recordedAt), "MMM d, HH:mm")}
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
          <Empty title={t("vitals.empty")} />
        </Card>
      ) : (
        Array.from(byType.entries()).map(([type, points]) => {
          const range = NORMAL_RANGES[type];
          const data = points.map((p) => ({
            t: +parseISO(p.recordedAt),
            value: p.value,
            secondary: p.secondaryValue ?? null,
            label: format(parseISO(p.recordedAt), "MMM d"),
          }));
          return (
            <Card key={type}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-text">{vitalLabel(type)}</h3>
                <Pill tone="neutral">{points.length} readings</Pill>
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(v) => format(new Date(v), "MMM d")}
                      stroke="var(--text-muted)"
                      fontSize={11}
                    />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      labelFormatter={(v) => format(new Date(v as number), "MMM d, HH:mm")}
                      formatter={(v: number) => [v, vitalLabel(type)]}
                    />
                    {range ? (
                      <ReferenceArea
                        y1={range[0]}
                        y2={range[1]}
                        fill="var(--success-soft)"
                        fillOpacity={0.35}
                      />
                    ) : null}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--brand)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
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
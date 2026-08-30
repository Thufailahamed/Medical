"use client";

import { use, useMemo, useState } from "react";
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
import { Activity, Plus, HeartPulse } from "lucide-react";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Drawer } from "@/portal/components/ui/Modal";
import { RecordVitalsForm } from "@/portal/components/vitals/RecordVitalsForm";
import { ChartEmpty } from "@/portal/components/chart";
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
  recordedAt?: string | null;
  notes?: string | null;
}

interface LatestVital {
  type: string;
  value?: number;
  secondaryValue?: number | null;
  unit?: string | null;
  classification?: string | null;
  recordedAt?: string | null;
  latest?: {
    value?: number;
    secondary?: number | null;
    unit?: string | null;
    classification?: string | null;
    recordedAt?: string | null;
  };
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
  normal: "#10b981",
  abnormal: "#f59e0b",
  warning: "#f59e0b",
  critical: "#ef4444",
  elevated: "#f59e0b",
  low: "#0ea5e9",
  high: "#f43f5e",
};

function classifyDot(classification?: string | null): string {
  const k = (classification ?? "").toLowerCase();
  return CLASSIFICATION_DOT[k] ?? "#0284c7";
}

function safeFormat(isoString?: string | null, fmt = "MMM d, HH:mm"): string {
  if (!isoString) return "—";
  try {
    const d = parseISO(isoString);
    if (isNaN(+d)) return "—";
    return format(d, fmt);
  } catch {
    return "—";
  }
}

export default function VitalsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const [open, setOpen] = useState(false);

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
      arr.sort((a, b) => {
        const at = a.recordedAt ? +new Date(a.recordedAt) : 0;
        const bt = b.recordedAt ? +new Date(b.recordedAt) : 0;
        return at - bt;
      });
    }
    return map;
  }, [vitals]);

  const totalReadings = vitals.length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Tab Action Strip ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200 shadow-2xs">
            <HeartPulse size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Patient Vitals Telemetry
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                {totalReadings} Readings
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Longitudinal physiological tracking, clinical reference bounds, and alert classifications.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
          }}
        >
          <Plus size={14} />
          <span>Record New Vitals</span>
        </button>
      </div>

      {/* ── Latest Readings Matrix ─────────────────────────────────────────── */}
      {!isLoading && latest.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {latest.slice(0, 8).map((l: any) => {
            const val = l.value ?? l.latest?.value ?? 0;
            const sec = l.secondaryValue ?? l.latest?.secondary ?? null;
            const unit = l.unit ?? l.latest?.unit ?? "";
            const cls = l.classification ?? l.latest?.classification ?? null;
            const recAt = l.recordedAt ?? l.latest?.recordedAt;
            const formattedDate = safeFormat(recAt, "MMM d, HH:mm");

            return (
              <div
                key={l.type}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-sky-300 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 truncate">
                      {vitalLabel(l.type)}
                    </span>
                    {cls && (
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ background: classifyDot(cls) }}
                        title={cls}
                      />
                    )}
                  </div>

                  <div className="text-2xl font-black text-slate-900 tabular-nums mt-1.5 leading-none">
                    {val}
                    {sec != null ? `/${sec}` : ""}
                    {unit && (
                      <span className="text-xs font-semibold text-slate-400 ml-1">
                        {unit}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {formattedDate}
                  </span>
                  {cls && (
                    <Pill tone={vitalClassificationToTone(cls)}>
                      {cls}
                    </Pill>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Charts / Empty States ──────────────────────────────────────────── */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : byType.size === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-2xs">
          <ChartEmpty
            padded
            icon={<Activity size={24} />}
            title="No vitals recorded yet"
          />
        </div>
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

          const chartData = points.map((p) => {
            let tVal = Date.now();
            let lbl = "—";
            if (p.recordedAt) {
              try {
                const parsed = parseISO(p.recordedAt);
                if (!isNaN(+parsed)) {
                  tVal = +parsed;
                  lbl = format(parsed, "MMM d");
                }
              } catch {}
            }
            return {
              t: tVal,
              value: p.value,
              secondary: p.secondaryValue ?? null,
              classification: p.classification ?? "normal",
              label: lbl,
            };
          });

          return (
            <div
              key={type}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 capitalize">
                    {vitalLabel(type)}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">
                    {points.length} reading{points.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {range && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Normal Range: {range[0]} – {range[1]}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 15, bottom: 5, left: -10 }}
                  >
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(v) => {
                        try {
                          return format(new Date(v), "MMM d");
                        } catch {
                          return "";
                        }
                      }}
                      stroke="#94a3b8"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      domain={[yMin, yMax]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: 12,
                      }}
                      labelFormatter={(v) => {
                        try {
                          return format(new Date(v as number), "MMM d, HH:mm");
                        } catch {
                          return "";
                        }
                      }}
                      formatter={(v: number) => [v, vitalLabel(type)]}
                    />
                    {range && (
                      <ReferenceArea
                        y1={range[0]}
                        y2={range[1]}
                        fill="#10b981"
                        fillOpacity={0.06}
                      />
                    )}
                    {range && (
                      <ReferenceLine
                        y={range[1]}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      dot={({ cx, cy, payload }) => (
                        <circle
                          key={`${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r={3.5}
                          fill={classifyDot(payload.classification)}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />
                      )}
                      activeDot={{ r: 5.5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Record Patient Vitals"
        size="lg"
      >
        <RecordVitalsForm
          patientId={id}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Drawer>
    </div>
  );
}

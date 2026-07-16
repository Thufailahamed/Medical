"use client";

// SnapshotPanel — Tier 1 records: portal-side rendering of the
// Patient Health Snapshot.
//
// Renders the same fields as the mobile HealthSnapshotCard.tsx but in
// Recharts/HTML for the web portal. Both patient-portal and
// doctor-portal records pages mount this above their main list.

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, AlertTriangle, Pill as PillIcon, Calendar, Activity } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from "recharts";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";

export interface SnapshotResponse {
  redBanner: { id: string; substance: string; severity: string; reaction: string | null }[];
  drugAllergyWarnings: { medicine: string; allergen: string; severity: string }[];
  chronicConditions: { id: string; title: string; since: string | null; diagnosis: string | null }[];
  activeMedicines: {
    id: string;
    name: string;
    dosage: string | null;
    frequency: string | null;
    startedAt: string | null;
    prescriberName: string | null;
  }[];
  recentVitals: {
    bp: { value: number; secondaryValue: number | null; recordedAt: string }[];
    hr: { value: number; recordedAt: string }[];
    glucose: { value: number; recordedAt: string }[];
    weight: { value: number; recordedAt: string }[];
    spo2: { value: number; recordedAt: string }[];
    temp: { value: number; recordedAt: string }[];
  };
  upcomingFollowUps: { id: string; title: string; date: string | null; doctorName: string | null }[];
  recentVisits: { id: string; title: string; date: string | null; diagnosis: string | null }[];
  fetchedAt: string;
}

interface Props {
  /** When set, hits the doctor-portal endpoint. When null, hits the patient endpoint. */
  patientId?: string | null;
  compact?: boolean;
}

export function SnapshotPanel({ patientId, compact }: Props) {
  const endpoint = patientId
    ? `/doctor-portal/patients/${patientId}/snapshot`
    : `/medical-records/me/snapshot`;

  const { data, isLoading } = useQuery({
    queryKey: ["health-snapshot", patientId ?? "me"],
    queryFn: () => api<SnapshotResponse>(endpoint),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }
  if (!data) return null;

  const empty =
    !data.redBanner.length &&
    !data.drugAllergyWarnings.length &&
    !data.chronicConditions.length &&
    !data.activeMedicines.length &&
    !Object.values(data.recentVitals).some((a) => a.length > 0) &&
    !data.upcomingFollowUps.length;
  if (empty) return null;

  return (
    <Card className="p-4 space-y-3">
      {/* Red banner */}
      {data.redBanner.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 border border-red-200">
          <ShieldAlert size={18} className="text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">Severe allergies</p>
            <p className="text-xs text-red-700">
              {data.redBanner
                .map((a) => a.substance + (a.reaction ? ` — ${a.reaction}` : ""))
                .join(" • ")}
            </p>
          </div>
        </div>
      )}

      {/* Drug allergy warnings */}
      {data.drugAllergyWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 border border-amber-200">
          <AlertTriangle size={16} className="text-amber-700 mt-0.5" />
          <p className="text-xs text-amber-800 flex-1">
            Drug-allergy match: {data.drugAllergyWarnings[0].medicine} ↔ {data.drugAllergyWarnings[0].allergen}
            {data.drugAllergyWarnings.length > 1 && ` +${data.drugAllergyWarnings.length - 1}`}
          </p>
        </div>
      )}

      {/* Chronic conditions */}
      {data.chronicConditions.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Chronic conditions
          </p>
          <div className="flex flex-wrap gap-1">
            {data.chronicConditions.slice(0, compact ? 4 : 8).map((c) => (
              <Pill key={c.id} tone="info">
                {c.title}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* Active medicines */}
      {data.activeMedicines.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <PillIcon size={12} />
            {data.activeMedicines.length} active medicines
          </p>
          <ul className="space-y-1">
            {data.activeMedicines.slice(0, 3).map((m) => (
              <li key={m.id} className="flex items-center justify-between text-xs">
                <span className="font-semibold">{m.name}</span>
                <span className="text-text-soft">
                  {[m.dosage, m.frequency].filter(Boolean).join(" • ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent vitals (mini charts) */}
      <div>
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
          <Activity size={12} />
          Trends
        </p>
        <div className="grid grid-cols-4 gap-2">
          <VitalTile label="BP" arr={data.recentVitals.bp} unit="mmHg" color="#DC2626" />
          <VitalTile label="HR" arr={data.recentVitals.hr} unit="bpm" color="#EF4444" />
          <VitalTile label="Glucose" arr={data.recentVitals.glucose} unit="mg/dL" color="#7C3AED" />
          <VitalTile label="Weight" arr={data.recentVitals.weight} unit="kg" color="#0D9488" />
        </div>
      </div>

      {/* Upcoming follow-ups */}
      {data.upcomingFollowUps.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <Calendar size={12} />
            Upcoming follow-ups
          </p>
          <ul className="space-y-1">
            {data.upcomingFollowUps.slice(0, 3).map((f) => (
              <li key={f.id} className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold">{f.title}</span>
                  {f.doctorName && (
                    <span className="text-text-soft ml-1">· {f.doctorName}</span>
                  )}
                </div>
                {f.date && (
                  <span className="text-text-muted">
                    {new Date(f.date).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function VitalTile({
  label,
  arr,
  unit,
  color,
}: {
  label: string;
  arr: { value: number; recordedAt: string }[];
  unit: string;
  color: string;
}) {
  const last = arr[0];
  const sorted = [...arr].reverse();
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2">
      <p className="text-[10px] font-bold text-text-muted">{label}</p>
      {last ? (
        <>
          <p className="text-sm font-bold">
            {Math.round(last.value)} <span className="text-[10px] text-text-soft">{unit}</span>
          </p>
          {sorted.length > 1 && (
            <ResponsiveContainer width="100%" height={24}>
              <LineChart data={sorted}>
                <YAxis hide domain={["auto", "auto"]} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      ) : (
        <p className="text-xs text-text-soft">—</p>
      )}
    </div>
  );
}

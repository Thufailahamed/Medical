"use client";

export type MetricKey =
  | "blood_pressure"
  | "blood_sugar"
  | "heart_rate"
  | "spo2"
  | "weight"
  | "temperature"
  | "hba1c";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "blood_pressure", label: "Blood pressure" },
  { key: "blood_sugar", label: "Glucose" },
  { key: "heart_rate", label: "Heart rate" },
  { key: "spo2", label: "SpO₂" },
  { key: "weight", label: "Weight" },
  { key: "temperature", label: "Temperature" },
  { key: "hba1c", label: "HbA1c" },
];

export function MetricTabs({
  active,
  onChange,
}: {
  active: MetricKey;
  onChange: (m: MetricKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {METRICS.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`rounded-full px-3 py-1 text-sm ${
            active === m.key
              ? "bg-brand text-white"
              : "bg-surface-2 text-text"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

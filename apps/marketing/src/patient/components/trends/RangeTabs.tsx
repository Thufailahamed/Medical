"use client";

export type RangeDays = 7 | 30 | 90 | 365;

const RANGES: { days: RangeDays; label: string }[] = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
];

export function RangeTabs({
  active,
  onChange,
}: {
  active: RangeDays;
  onChange: (r: RangeDays) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-surface-2 p-1">
      {RANGES.map((r) => (
        <button
          key={r.days}
          onClick={() => onChange(r.days)}
          className={`rounded-full px-3 py-1 text-sm ${
            active === r.days
              ? "bg-surface-1 font-medium"
              : "text-text-muted"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

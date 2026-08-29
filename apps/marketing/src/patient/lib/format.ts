/**
 * Display formatting.
 *
 * The em-dash return for null is deliberate and load-bearing: the spec
 * forbids printing 0 or an invented value when data is missing, and a
 * formatter that silently coerces null to 0 is the easiest way for that
 * rule to be broken by accident.
 */

const EM_DASH = "—";

export function formatMetric(
  value: number | null | undefined,
  decimals = 0
): string {
  if (value == null || Number.isNaN(value)) return EM_DASH;
  return value.toFixed(decimals);
}

export function formatDelta(
  value: number | null | undefined,
  decimals = 0
) {
  if (value == null || Number.isNaN(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}`;
}

export function formatRelative(
  iso: string | null | undefined,
  now: Date = new Date()
): string {
  if (!iso) return EM_DASH;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return EM_DASH;

  const seconds = Math.floor((now.getTime() - then) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** "2026-08-29" → "Sat, 29 Aug". */
export function formatDayLabel(iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "14:30" → "2:30 PM". */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return EM_DASH;
  const [hStr, mStr = "00"] = hhmm.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return EM_DASH;
  const meridiem = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr.padStart(2, "0")} ${meridiem}`;
}

/** Title-cases an API enum such as "in_person" → "In person". */
export function humanize(value: string | null | undefined): string {
  if (!value) return EM_DASH;
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
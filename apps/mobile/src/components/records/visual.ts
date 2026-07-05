// visual.ts — kind-aware icon + tone + formatter helpers.
// Records-v2 reads these from the registry (`RECORD_REGISTRY[kind]`) and
// resolves them through this file so the screen stays theme-driven.

import {
  FlaskConical,
  ScanLine,
  Pill,
  Hospital,
  Syringe,
  Scissors,
  AlertTriangle,
  Shield,
  Dumbbell,
  FileText,
  BadgeCheck,
  NotebookPen,
  Receipt,
  Notebook,
  TestTube,
  CalendarCheck2,
  Folder,
  PillBottle,
  Microscope,
  Paperclip,
  Layers,
  Activity,
  ShieldCheck,
  Clock,
  Plus,
  Search,
  X,
  Share2,
  Download,
  type LucideIcon,
} from "lucide-react-native";

const ICONS: Record<string, LucideIcon> = {
  FlaskConical,
  ScanLine,
  Pill,
  Hospital,
  Syringe,
  Scissors,
  AlertTriangle,
  Shield,
  Dumbbell,
  FileText,
  BadgeCheck,
  NotebookPen,
  Receipt,
  Notebook,
  TestTube,
  CalendarCheck2,
  Folder,
  PillBottle,
  Microscope,
  Paperclip,
  Layers,
  Activity,
};

export function kindIcon(k: string | null | undefined): LucideIcon {
  if (!k) return Folder;
  return ICONS[k] ?? Folder;
}

export type ThemeTone =
  | "primary"
  | "accent"
  | "accent2"
  | "warning"
  | "danger"
  | "info"
  | "success"
  | "neutral";

/**
 * Map registry color token → theme tone. The theme exposes
 * primary/accent/accent2/warning/danger/info/success/neutral, so we
 * re-purpose the closest semantic slot.
 */
export function kindTone(
  c:
    | "blue"
    | "red"
    | "amber"
    | "green"
    | "violet"
    | "teal"
    | "slate"
    | "pink",
): ThemeTone {
  switch (c) {
    case "blue":
      return "info";
    case "red":
      return "danger";
    case "amber":
      return "warning";
    case "green":
      return "success";
    case "violet":
      return "accent2";
    case "teal":
      return "primary";
    case "slate":
      return "neutral";
    case "pink":
      return "accent";
  }
}

// Re-export convenience icons used by the hub.
export { ShieldCheck, Clock, Plus, Search, X, Share2, Download };

// Small locale-aware formatters used inline by the hub.
export function fmtCount(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  }
  return n.toLocaleString();
}

export function fmtRelative(iso: string | null | undefined, locale = "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);

  // Fallback if Intl.RelativeTimeFormat is not supported in the React Native runtime
  if (typeof Intl === "undefined" || !Intl.RelativeTimeFormat) {
    if (diffDays <= 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffDays <= 0) return rtf.format(0, "day");
  if (diffDays < 7) return rtf.format(-diffDays, "day");
  if (diffDays < 30) return rtf.format(-Math.floor(diffDays / 7), "week");
  if (diffDays < 365) return rtf.format(-Math.floor(diffDays / 30), "month");
  return rtf.format(-Math.floor(diffDays / 365), "year");
}

export function fmtDate(iso: string | null | undefined, locale = "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}
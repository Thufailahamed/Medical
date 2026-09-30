import { FileText, FlaskConical, LogOut, Pill, ScanLine, Sparkles, Syringe } from "lucide-react";

import type { Tone } from "@/patient/components/workspace";

/** Visual identity per record kind — shared by the list, detail and edit pages. */
export function recordTone(type: string | null | undefined): Tone {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab")) return "sky";
  if (key.includes("prescription") || key.includes("medication")) return "emerald";
  if (key.includes("imaging") || key.includes("scan")) return "violet";
  if (key.includes("vaccin")) return "amber";
  if (key.includes("allerg")) return "rose";
  return "sky";
}

export function recordGradient(type: string | null | undefined): string {
  const tone = recordTone(type);
  if (tone === "emerald") return "from-emerald-400 to-teal-600";
  if (tone === "violet") return "from-violet-400 to-purple-600";
  if (tone === "amber") return "from-amber-400 to-orange-500";
  if (tone === "rose") return "from-rose-400 to-pink-600";
  return "from-sky-400 to-blue-600";
}

export function RecordTypeIcon({ type, size = 16 }: { type: string | null | undefined; size?: number }) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab")) return <FlaskConical size={size} />;
  if (key.includes("prescription") || key.includes("medication")) return <Pill size={size} />;
  if (key.includes("imaging") || key.includes("scan")) return <ScanLine size={size} />;
  if (key.includes("vaccin")) return <Syringe size={size} />;
  if (key.includes("allerg")) return <Sparkles size={size} />;
  if (key.includes("discharge")) return <LogOut size={size} />;
  return <FileText size={size} />;
}

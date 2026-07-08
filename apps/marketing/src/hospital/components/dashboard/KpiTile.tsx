"use client";

import Link from "next/link";
import {
  Users,
  BedDouble,
  Receipt,
  FlaskConical,
  Pill,
  DoorOpen,
  PackageOpen,
  Stethoscope,
  ArrowUpRight,
} from "lucide-react";

import { cn } from "@/hospital/lib/utils";
import { useT } from "@/hospital/i18n";
import type { DashboardTile } from "@/hospital/hooks/useDashboard";

const ICON_MAP: Record<DashboardTile["key"], any> = {
  opdToday: Stethoscope,
  ipdCensus: BedDouble,
  beds: BedDouble,
  revenueToday: Receipt,
  pendingLabs: FlaskConical,
  pendingRx: Pill,
  walkInsWaiting: DoorOpen,
  lowStock: PackageOpen,
};

const TONE_MAP: Record<DashboardTile["key"], string> = {
  opdToday: "from-sky-50 to-white text-sky-700",
  ipdCensus: "from-emerald-50 to-white text-emerald-700",
  beds: "from-amber-50 to-white text-amber-700",
  revenueToday: "from-emerald-50 to-white text-emerald-700",
  pendingLabs: "from-violet-50 to-white text-violet-700",
  pendingRx: "from-rose-50 to-white text-rose-700",
  walkInsWaiting: "from-sky-50 to-white text-sky-700",
  lowStock: "from-amber-50 to-white text-amber-700",
};

/**
 * Single KPI tile on the hospital dashboard.
 *
 * Renders the value, optional denominator / unit, and a click-through
 * link to the relevant surface. Tiles with `available === false` are
 * dimmed and labelled with a "coming soon" hint so staff understand
 * why a count is 0 (revenue/inventory tables land in HOS-7 / HOS-9).
 */
export function KpiTile({ tile }: { tile: DashboardTile }) {
  const t = useT();
  const Icon = ICON_MAP[tile.key] ?? Users;
  const tone = TONE_MAP[tile.key] ?? "from-slate-50 to-white text-slate-700";
  const isAvailable = tile.available !== false;

  const body = (
    <div
      className={cn(
        "relative h-full rounded-2xl border bg-gradient-to-br p-4 md:p-5 flex flex-col gap-2 transition-all duration-200",
        isAvailable
          ? "border-border hover:border-brand/30 hover:shadow-md"
          : "border-dashed border-border opacity-75",
        tone
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center bg-white shadow-sm",
              isAvailable ? "text-current" : "text-text-muted"
            )}
          >
            <Icon size={16} strokeWidth={2} />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">
            {tile.label}
          </span>
        </div>
        {isAvailable && (
          <ArrowUpRight
            size={14}
            className="opacity-40 group-hover:opacity-100 transition-opacity"
          />
        )}
      </div>

      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-3xl md:text-4xl font-extrabold text-text tabular-nums">
          {isAvailable ? tile.value.toLocaleString() : "—"}
        </span>
        {typeof tile.total === "number" && isAvailable && (
          <span className="text-sm font-semibold text-text-muted">
            / {tile.total.toLocaleString()}
          </span>
        )}
        {tile.unit && isAvailable && (
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
            {tile.unit}
          </span>
        )}
      </div>

      {!isAvailable && (
        <div className="text-[11px] font-medium text-text-muted">
          {t("dashboard.comingSoon")}
        </div>
      )}
    </div>
  );

  if (!tile.href || !isAvailable) return body;

  return (
    <Link href={tile.href} className="group block h-full focus-ring rounded-2xl">
      {body}
    </Link>
  );
}
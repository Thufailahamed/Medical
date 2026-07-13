import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { useTranslation } from "react-i18next";
import { TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import type { VitalsPoint, VitalsSeriesStats } from "@/hooks/useApi";

type Props = {
  /** Current period data points */
  currentPoints: VitalsPoint[];
  currentStats: VitalsSeriesStats | null;
  /** Previous period data points */
  previousPoints: VitalsPoint[];
  previousStats: VitalsSeriesStats | null;
  /** Chart width */
  width: number;
  /** Chart height (default 80 — sparkline-sized) */
  height?: number;
};

/**
 * Trend comparison component that overlays current and previous period
 * sparklines and shows delta stats (avg, min, max changes).
 */
export function TrendComparison({
  currentPoints,
  currentStats,
  previousPoints,
  previousStats,
  width,
  height = 80,
}: Props) {
  const { colors, spacing, typography, radius } = useTheme();
  const { t } = useTranslation();

  const padding = { top: 4, right: 4, bottom: 4, left: 4 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  // Compute combined Y domain from both periods
  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const p of currentPoints) {
      if (Number.isFinite(p.value)) vals.push(p.value);
    }
    for (const p of previousPoints) {
      if (Number.isFinite(p.value)) vals.push(p.value);
    }
    if (vals.length === 0) return { min: 0, max: 100 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.15 || 5;
    return { min: min - pad, max: max + pad };
  }, [currentPoints, previousPoints]);

  const yScale = (v: number) =>
    padding.top + innerH - ((v - yDomain.min) / (yDomain.max - yDomain.min)) * innerH;

  // Build sparkline paths
  const buildPath = (pts: VitalsPoint[]) => {
    if (pts.length === 0) return "";
    return pts
      .filter((p) => Number.isFinite(p.value))
      .map((p, i, arr) => {
        const x =
          arr.length > 1
            ? padding.left + (i / (arr.length - 1)) * innerW
            : padding.left + innerW / 2;
        const y = yScale(p.value);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const currentPath = buildPath(currentPoints);
  const previousPath = buildPath(previousPoints);

  // Compute deltas
  const deltas = useMemo(() => {
    if (!currentStats || !previousStats) return null;
    const calcDelta = (curr: number | null, prev: number | null) => {
      if (curr == null || prev == null || !Number.isFinite(curr) || !Number.isFinite(prev))
        return null;
      const diff = curr - prev;
      const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : null;
      return { diff: Math.round(diff), pct: pct != null ? Math.round(pct) : null };
    };
    return {
      avg: calcDelta(currentStats.avg, previousStats.avg),
      min: calcDelta(currentStats.min, previousStats.min),
      max: calcDelta(currentStats.max, previousStats.max),
    };
  }, [currentStats, previousStats]);

  if (currentPoints.length === 0 && previousPoints.length === 0) {
    return null;
  }

  const deltaIcon = (diff: number | null) => {
    if (diff == null) return null;
    if (diff > 0) return <TrendingUp size={12} color={colors.danger} strokeWidth={2.5} />;
    if (diff < 0) return <TrendingDown size={12} color={colors.success} strokeWidth={2.5} />;
    return <Minus size={12} color={colors.textMuted} strokeWidth={2.5} />;
  };

  const deltaColor = (diff: number | null) => {
    if (diff == null) return colors.textMuted;
    return diff > 0 ? colors.danger : diff < 0 ? colors.success : colors.textMuted;
  };

  const deltaCell = (label: string, delta: { diff: number; pct: number | null } | null) => (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text
        style={[
          typography.caption,
          { color: colors.textMuted, fontWeight: "600", letterSpacing: 0.3 },
        ]}
      >
        {label}
      </Text>
      {delta ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}>
          {deltaIcon(delta.diff)}
          <Text
            style={[
              typography.title.sm,
              { color: deltaColor(delta.diff), fontWeight: "700" },
            ]}
          >
            {delta.diff > 0 ? "+" : ""}
            {delta.diff}
            {delta.pct != null ? (
              <Text style={[typography.caption, { color: deltaColor(delta.diff) }]}>
                {" "}
                ({delta.pct > 0 ? "+" : ""}
                {delta.pct}%)
              </Text>
            ) : null}
          </Text>
        </View>
      ) : (
        <Text style={[typography.title.sm, { color: colors.textMuted }]}>—</Text>
      )}
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "600" }]}>
          {t("vitals.trendComparison.title")}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 12,
                height: 2,
                backgroundColor: colors.primary,
                borderRadius: 1,
              }}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {t("vitals.trendComparison.current")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 12,
                height: 2,
                backgroundColor: colors.textSubtle,
                borderRadius: 1,
                opacity: 0.5,
              }}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {t("vitals.trendComparison.previous")}
            </Text>
          </View>
        </View>
      </View>

      {/* Sparkline overlay */}
      <Svg width={width} height={height}>
        {/* Previous period line (muted) */}
        {previousPath ? (
          <Path
            d={previousPath}
            stroke={colors.textSubtle}
            strokeWidth={1.5}
            fill="none"
            opacity={0.4}
            strokeDasharray="4,3"
          />
        ) : null}

        {/* Current period line (solid) */}
        {currentPath ? (
          <Path d={currentPath} stroke={colors.primary} strokeWidth={2} fill="none" />
        ) : null}

        {/* Current period end dot */}
        {currentPoints.length > 0 &&
        Number.isFinite(currentPoints[currentPoints.length - 1]?.value) ? (
          <Circle
            cx={
              currentPoints.length > 1
                ? padding.left + innerW
                : padding.left + innerW / 2
            }
            cy={yScale(currentPoints[currentPoints.length - 1].value)}
            r={3}
            fill={colors.primary}
          />
        ) : null}
      </Svg>

      {/* Delta stats */}
      {deltas ? (
        <View
          style={{
            flexDirection: "row",
            paddingTop: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {deltaCell(t("vitals.trendComparison.avg"), deltas.avg)}
          {deltaCell(t("vitals.trendComparison.min"), deltas.min)}
          {deltaCell(t("vitals.trendComparison.max"), deltas.max)}
        </View>
      ) : null}
    </View>
  );
}

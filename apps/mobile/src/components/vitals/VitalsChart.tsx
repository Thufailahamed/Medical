import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Rect, Line, Path, Circle, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { useTranslation } from "react-i18next";
import type { VitalsPoint, VitalsSeriesStats } from "@/hooks/useApi";
import { rangeFor, classifyReading, type VitalType } from "@healthcare/shared/vitals";

type Props = {
  type: VitalType;
  points: VitalsPoint[];
  stats: VitalsSeriesStats | null;
  width: number;
  height?: number;
  showSecondary?: boolean;
  ageYears?: number | null;
};

/**
 * Hand-rolled SVG chart with the normal-range band painted on the
 * background. Drops in for the previous Victory-based chart without
 * adding a heavy dependency. Colour-aware (light/dark theme) and
 * pure derived from props — no global state.
 */
export function VitalsChart({
  type,
  points,
  stats,
  width,
  height = 220,
  showSecondary = false,
  ageYears,
}: Props) {
  const { colors, spacing, typography, radius } = useTheme();
  const { t } = useTranslation();
  const isBP = type === "blood_pressure";

  const padding = { top: 12, right: 12, bottom: 32, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const p of points) {
      if (Number.isFinite(p.value)) vals.push(p.value);
      if (isBP && p.secondary != null && Number.isFinite(p.secondary))
        vals.push(p.secondary);
    }
    const r = rangeFor(type, { ageYears });
    if (stats) {
      if (stats.min != null) vals.push(stats.min);
      if (stats.max != null) vals.push(stats.max);
    }
    // Anchor y-axis to the normal band so the chart stays readable.
    vals.push(r.low, r.high);
    if (r.criticalLow != null) vals.push(r.criticalLow);
    if (r.criticalHigh != null) vals.push(r.criticalHigh);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.1 || 5;
    return { min: min - pad, max: max + pad };
  }, [points, stats, type, isBP, ageYears]);

  const yScale = (v: number) =>
    padding.top + innerH - ((v - yDomain.min) / (yDomain.max - yDomain.min)) * innerH;

  const xScale = (i: number) =>
    points.length > 1 ? padding.left + (i / (points.length - 1)) * innerW : padding.left + innerW / 2;

  const r = rangeFor(type, { ageYears });

  // Build paths
  const primaryPath = points
    .map((p, i) => {
      if (!Number.isFinite(p.value)) return null;
      const cmd = i === 0 ? "M" : "L";
      return `${cmd}${xScale(i).toFixed(1)},${yScale(p.value).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  const secondaryPoints = isBP && showSecondary
    ? points.filter((p) => p.secondary != null && Number.isFinite(p.secondary))
    : [];

  const secondaryPath = secondaryPoints
    .map((p, i) => {
      const cmd = i === 0 ? "M" : "L";
      const idx = points.indexOf(p);
      return `${cmd}${xScale(idx).toFixed(1)},${yScale(p.secondary as number).toFixed(1)}`;
    })
    .join(" ");

  // Normal-band Y coords
  const bandTop = yScale(r.high);
  const bandBot = yScale(r.low);
  const bandH = Math.max(0, bandBot - bandTop);

  // Tick labels (4 across the Y axis)
  const yTicks = [yDomain.min, (yDomain.min + yDomain.max) / 2, yDomain.max];

  // X labels — show ~4 evenly spaced dates
  const xTickIdx = points.length <= 1
    ? [0]
    : [0, Math.floor(points.length / 3), Math.floor((2 * points.length) / 3), points.length - 1];

  if (points.length === 0) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text style={[typography.body.sm, { color: colors.textMuted }]}>
          {t("vitals.chart.noReadings")}
        </Text>
      </View>
    );
  }

  // Round 3 P1 polish: stats strip above the chart so users can read
  // the trend at a glance without hovering. Format guard keeps stats
  // intact even if the API returns 0/null fields.
  const statCell = (
    label: string,
    value: number | null | undefined,
    suffix?: string
  ) => (
    <View
      style={{
        flex: 1,
        alignItems: "flex-start",
        paddingHorizontal: spacing.xs,
      }}
    >
      <Text
        style={[
          typography.caption,
          { color: colors.textMuted, fontWeight: "700", letterSpacing: 0.4 },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={[
          typography.title.sm,
          { color: colors.text, fontWeight: "700", marginTop: 2 },
        ]}
      >
        {value == null || !Number.isFinite(value)
          ? "—"
          : suffix
            ? `${Math.round(value)} ${suffix}`
            : Math.round(value)}
      </Text>
    </View>
  );

  return (
    <View>
      {stats ? (
        <View
          style={{
            flexDirection: "row",
            paddingVertical: spacing.xs,
            marginBottom: spacing.xs,
          }}
          accessibilityLabel={t("vitals.chart.statsLabel")}
        >
          {statCell(t("vitals.chart.min"), stats.min)}
          {statCell(t("vitals.chart.avg"), stats.avg)}
          {statCell(t("vitals.chart.max"), stats.max)}
          {isBP && showSecondary
            ? statCell(t("vitals.chart.count"), stats.count)
            : statCell(t("vitals.chart.count"), stats.count)}
        </View>
      ) : null}
      <Svg width={width} height={height}>
      {/* Normal-range band */}
      <Rect
        x={padding.left}
        y={bandTop}
        width={innerW}
        height={bandH}
        fill={colors.success}
        opacity={0.12}
        rx={radius.sm}
      />

      {/* Y gridlines + labels */}
      {yTicks.map((y, i) => (
        <React.Fragment key={`yt-${i}`}>
          <Line
            x1={padding.left}
            y1={yScale(y)}
            x2={padding.left + innerW}
            y2={yScale(y)}
            stroke={colors.border}
            strokeDasharray="2,4"
            strokeWidth={0.5}
          />
          <SvgText
            x={padding.left - 6}
            y={yScale(y) + 3}
            fontSize={10}
            fill={colors.textMuted}
            textAnchor="end"
          >
            {Math.round(y)}
          </SvgText>
        </React.Fragment>
      ))}

      {/* X axis baseline */}
      <Line
        x1={padding.left}
        y1={padding.top + innerH}
        x2={padding.left + innerW}
        y2={padding.top + innerH}
        stroke={colors.border}
      />

      {/* X labels */}
      {xTickIdx.map((idx) => {
        const p = points[idx];
        if (!p) return null;
        const d = new Date(p.t);
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        return (
          <SvgText
            key={`xt-${idx}`}
            x={xScale(idx)}
            y={padding.top + innerH + 16}
            fontSize={10}
            fill={colors.textMuted}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}

      {/* Primary line */}
      {primaryPath ? (
        <Path d={primaryPath} stroke={colors.primary} strokeWidth={2.5} fill="none" />
      ) : null}

      {/* Secondary line (BP diastolic only) */}
      {secondaryPath ? (
        <Path d={secondaryPath} stroke={colors.danger} strokeWidth={2} fill="none" />
      ) : null}

      {/* Data points */}
      {points.map((p, i) =>
        Number.isFinite(p.value) ? (
          <Circle
            key={`p-${i}`}
            cx={xScale(i)}
            cy={yScale(p.value)}
            r={3}
            fill={colors.primary}
          />
        ) : null,
      )}

      {/* Secondary points */}
      {secondaryPoints.map((p, i) => {
        const idx = points.indexOf(p);
        return (
          <Circle
            key={`s-${i}`}
            cx={xScale(idx)}
            cy={yScale(p.secondary as number)}
            r={2.5}
            fill={colors.danger}
          />
        );
      })}

      {/* Legend — clarifies which line is which when both are present
          (BP systolic vs diastolic). Hidden otherwise so the chart stays
          uncluttered for single-line metrics. */}
      {isBP && showSecondary ? (
        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            marginTop: spacing.xs,
          }}
          accessibilityLabel={t("vitals.chart.legendLabel")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 14,
                height: 3,
                backgroundColor: colors.primary,
                borderRadius: 2,
              }}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {t("vitals.chart.systolic")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 14,
                height: 3,
                backgroundColor: colors.danger,
                borderRadius: 2,
              }}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {t("vitals.chart.diastolic")}
            </Text>
          </View>
        </View>
      ) : null}
    </Svg>
    </View>
  );
}
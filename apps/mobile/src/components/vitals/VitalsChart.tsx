import React, { useMemo, useCallback } from "react";
import { View, Text, LayoutRectangle } from "react-native";
import Svg, { Rect, Line, Path, Circle, Text as SvgText } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  runOnJS,
} from "react-native-reanimated";
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
 * Interactive SVG chart with touch crosshair tooltip.
 * Uses react-native-gesture-handler for pan tracking and
 * react-native-reanimated for smooth 60fps animations.
 * Shows a vertical crosshair + tooltip bubble on horizontal pan.
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

  // Gesture state
  const touchX = useSharedValue(-1);
  const isActive = useSharedValue(0);

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
    points.length > 1
      ? padding.left + (i / (points.length - 1)) * innerW
      : padding.left + innerW / 2;

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

  const secondaryPoints =
    isBP && showSecondary
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

  // Tick labels
  const yTicks = [yDomain.min, (yDomain.min + yDomain.max) / 2, yDomain.max];
  const xTickIdx =
    points.length <= 1
      ? [0]
      : [
          0,
          Math.floor(points.length / 3),
          Math.floor((2 * points.length) / 3),
          points.length - 1,
        ];

  // Find nearest point index for a given x coordinate
  const findNearestIndex = useCallback(
    (x: number): number => {
      if (points.length <= 1) return 0;
      const relX = (x - padding.left) / innerW;
      const idx = Math.round(relX * (points.length - 1));
      return Math.max(0, Math.min(points.length - 1, idx));
    },
    [points.length, padding.left, innerW]
  );

  // Gesture handler
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      touchX.value = e.x;
      isActive.value = 1;
    })
    .onUpdate((e) => {
      touchX.value = e.x;
    })
    .onEnd(() => {
      isActive.value = 0;
      touchX.value = -1;
    });

  // Derived nearest index from touch position
  const nearestIdx = useDerivedValue(() => {
    if (touchX.value < 0) return -1;
    if (points.length <= 1) return 0;
    const relX = (touchX.value - padding.left) / innerW;
    const idx = Math.round(relX * (points.length - 1));
    return Math.max(0, Math.min(points.length - 1, idx));
  });

  // Animated crosshair line style
  const crosshairStyle = useAnimatedStyle(() => {
    if (isActive.value === 0 || nearestIdx.value < 0) {
      return { opacity: 0 };
    }
    const idx = nearestIdx.value;
    const xPos =
      points.length > 1
        ? padding.left + (idx / (points.length - 1)) * innerW
        : padding.left + innerW / 2;
    return {
      opacity: isActive.value,
      transform: [{ translateX: xPos }],
    };
  });

  // Animated tooltip style
  const tooltipStyle = useAnimatedStyle(() => {
    if (isActive.value === 0 || nearestIdx.value < 0) {
      return { opacity: 0 };
    }
    const idx = nearestIdx.value;
    const xPos =
      points.length > 1
        ? padding.left + (idx / (points.length - 1)) * innerW
        : padding.left + innerW / 2;
    // Flip tooltip to left side if near right edge
    const tooltipW = 140;
    const offsetX = xPos > width - tooltipW - 20 ? xPos - tooltipW - 8 : xPos + 8;
    return {
      opacity: isActive.value,
      transform: [{ translateX: offsetX }, { translateY: padding.top + 4 }],
    };
  });

  // Animated point highlight style
  const pointHighlightStyle = useAnimatedStyle(() => {
    if (isActive.value === 0 || nearestIdx.value < 0) {
      return { opacity: 0 };
    }
    const idx = nearestIdx.value;
    if (idx < 0 || idx >= points.length) return { opacity: 0 };
    const p = points[idx];
    if (!p || !Number.isFinite(p.value)) return { opacity: 0 };
    const xPos =
      points.length > 1
        ? padding.left + (idx / (points.length - 1)) * innerW
        : padding.left + innerW / 2;
    const yPos = yScale(p.value);
    return {
      opacity: isActive.value,
      transform: [{ translateX: xPos - 6 }, { translateY: yPos - 6 }],
    };
  });

  // Tooltip content (derived value for reanimated)
  const tooltipData = useDerivedValue(() => {
    const idx = nearestIdx.value;
    if (idx < 0 || idx >= points.length) return null;
    const p = points[idx];
    if (!p) return null;
    const d = new Date(p.t);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const val = Number.isFinite(p.value) ? Math.round(p.value) : null;
    const sec = p.secondary != null && Number.isFinite(p.secondary) ? Math.round(p.secondary) : null;
    const ctx = (p as any).context || null;
    return { dateStr, val, sec, ctx };
  });

  if (points.length === 0) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text style={[typography.body.sm, { color: colors.textMuted }]}>
          {t("vitals.chart.noReadings")}
        </Text>
      </View>
    );
  }

  // Stats strip
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
          {statCell(t("vitals.chart.count"), stats.count)}
        </View>
      ) : null}

      <GestureDetector gesture={panGesture}>
        <View style={{ width, height, position: "relative" }}>
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
              ) : null
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

            {/* Legend for BP */}
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

          {/* Crosshair line overlay */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top: padding.top,
                width: 1,
                height: innerH,
                backgroundColor: colors.textMuted,
                opacity: 0.4,
              },
              crosshairStyle,
            ]}
          />

          {/* Highlighted point */}
          <Animated.View
            style={[
              {
                position: "absolute",
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.surface,
              },
              pointHighlightStyle,
            ]}
          />

          {/* Tooltip bubble */}
          <AnimatedTooltip
            tooltipStyle={tooltipStyle}
            nearestIdx={nearestIdx}
            points={points}
            isBP={isBP}
            showSecondary={showSecondary}
            colors={colors}
            typography={typography}
            spacing={spacing}
            radius={radius}
            t={t}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

/**
 * Tooltip component that reads the nearest point data from reanimated
 * derived values and renders a styled bubble.
 */
function AnimatedTooltip({
  tooltipStyle,
  nearestIdx,
  points,
  isBP,
  showSecondary,
  colors,
  typography,
  spacing,
  radius,
  t,
}: {
  tooltipStyle: any;
  nearestIdx: Animated.SharedValue<number>;
  points: VitalsPoint[];
  isBP: boolean;
  showSecondary: boolean;
  colors: any;
  typography: any;
  spacing: any;
  radius: any;
  t: (key: string) => string;
}) {
  // We need to read the value outside of worklet for rendering.
  // useAnimatedProps doesn't work for View children, so we use
  // a JS-driven approach: the tooltip content is rendered from
  // the current nearestIdx value, which updates on every frame.
  const idx = nearestIdx.value;
  const p = idx >= 0 && idx < points.length ? points[idx] : null;

  if (!p) return null;

  const d = new Date(p.t);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  const val = Number.isFinite(p.value) ? Math.round(p.value) : "—";
  const sec =
    isBP && showSecondary && p.secondary != null && Number.isFinite(p.secondary)
      ? Math.round(p.secondary)
      : null;
  const ctx = (p as any).context || null;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 140,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 3,
        },
        tooltipStyle,
      ]}
    >
      <Text
        style={[
          typography.caption,
          { color: colors.textMuted, fontWeight: "600", marginBottom: 2 },
        ]}
      >
        {dateStr}
      </Text>
      <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
        {val}
        {sec != null ? (
          <Text style={{ color: colors.danger }}> / {sec}</Text>
        ) : null}
      </Text>
      {ctx ? (
        <Text style={[typography.caption, { color: colors.textSubtle, marginTop: 1 }]}>
          {ctx}
        </Text>
      ) : null}
    </Animated.View>
  );
}

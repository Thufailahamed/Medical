import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Rect, Line, Path, Circle, Text as SvgText } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { useTranslation } from "react-i18next";
import type { VitalsPoint, VitalsSeriesStats } from "@/hooks/useApi";

type Props = {
  points: VitalsPoint[];
  stats: VitalsSeriesStats | null;
  width: number;
  height?: number;
};

// Glucose context color map
const CONTEXT_COLORS: Record<string, string> = {
  fasting: "#3B82F6",       // blue
  pre_meal: "#8B5CF6",      // purple
  post_meal: "#F97316",     // orange
  bedtime: "#6366F1",       // indigo
  random: "#9CA3AF",        // gray
};

const CONTEXT_LABELS: Record<string, string> = {
  fasting: "Fasting",
  pre_meal: "Pre-meal",
  post_meal: "Post-meal",
  bedtime: "Bedtime",
  random: "Random",
};

// Target ranges (mg/dL)
const FASTING_LOW = 70;
const FASTING_HIGH = 100;
const POST_MEAL_HIGH = 140;
const GENERAL_LOW = 70;
const GENERAL_HIGH = 180;

// A1C estimation: eAG = (average glucose + 46.7) / 28.7
function estimateA1C(avgGlucose: number): number {
  return (avgGlucose + 46.7) / 28.7;
}

/**
 * Glucose-specific chart with target range bands, context-colored
 * data points, and A1C estimate line.
 */
export function GlucoseChart({ points, stats, width, height = 240 }: Props) {
  const { colors, spacing, typography, radius } = useTheme();
  const { t } = useTranslation();

  const padding = { top: 12, right: 12, bottom: 40, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  // Gesture state for crosshair
  const touchX = useSharedValue(-1);
  const isActive = useSharedValue(0);

  // Determine if most readings are fasting (for target band)
  const isMostlyFasting = useMemo(() => {
    const withCtx = points.filter((p) => (p as any).context);
    if (withCtx.length === 0) return false;
    const fastingCount = withCtx.filter(
      (p) => (p as any).context === "fasting"
    ).length;
    return fastingCount > withCtx.length / 2;
  }, [points]);

  const targetLow = isMostlyFasting ? FASTING_LOW : GENERAL_LOW;
  const targetHigh = isMostlyFasting ? FASTING_HIGH : POST_MEAL_HIGH;

  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const p of points) {
      if (Number.isFinite(p.value)) vals.push(p.value);
    }
    if (stats?.min != null) vals.push(stats.min);
    if (stats?.max != null) vals.push(stats.max);
    vals.push(targetLow, targetHigh);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.15 || 10;
    return { min: Math.max(0, min - pad), max: max + pad };
  }, [points, stats, targetLow, targetHigh]);

  const yScale = (v: number) =>
    padding.top + innerH - ((v - yDomain.min) / (yDomain.max - yDomain.min)) * innerH;

  const xScale = (i: number) =>
    points.length > 1
      ? padding.left + (i / (points.length - 1)) * innerW
      : padding.left + innerW / 2;

  // Primary line path
  const primaryPath = points
    .map((p, i) => {
      if (!Number.isFinite(p.value)) return null;
      const cmd = i === 0 ? "M" : "L";
      return `${cmd}${xScale(i).toFixed(1)},${yScale(p.value).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  // Target range band
  const bandTop = yScale(targetHigh);
  const bandBot = yScale(targetLow);
  const bandH = Math.max(0, bandBot - bandTop);

  // A1C estimate line
  const a1cLine = useMemo(() => {
    if (!stats?.avg || !Number.isFinite(stats.avg)) return null;
    const a1c = estimateA1C(stats.avg);
    return { y: yScale(stats.avg), a1c: a1c.toFixed(1) };
  }, [stats, yScale]);

  // Y ticks
  const yTicks = [yDomain.min, targetLow, targetHigh, yDomain.max].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  // X labels
  const xTickIdx =
    points.length <= 1
      ? [0]
      : [
          0,
          Math.floor(points.length / 3),
          Math.floor((2 * points.length) / 3),
          points.length - 1,
        ];

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

  const nearestIdx = useDerivedValue(() => {
    if (touchX.value < 0) return -1;
    if (points.length <= 1) return 0;
    const relX = (touchX.value - padding.left) / innerW;
    const idx = Math.round(relX * (points.length - 1));
    return Math.max(0, Math.min(points.length - 1, idx));
  });

  const crosshairStyle = useAnimatedStyle(() => {
    if (isActive.value === 0 || nearestIdx.value < 0) return { opacity: 0 };
    const idx = nearestIdx.value;
    const xPos =
      points.length > 1
        ? padding.left + (idx / (points.length - 1)) * innerW
        : padding.left + innerW / 2;
    return { opacity: isActive.value, transform: [{ translateX: xPos }] };
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
  const statCell = (label: string, value: number | null | undefined) => (
    <View style={{ flex: 1, alignItems: "flex-start", paddingHorizontal: spacing.xs }}>
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
        {value == null || !Number.isFinite(value) ? "—" : Math.round(value)}
      </Text>
    </View>
  );

  return (
    <View>
      {/* Stats strip */}
      {stats ? (
        <View
          style={{ flexDirection: "row", paddingVertical: spacing.xs, marginBottom: spacing.xs }}
        >
          {statCell(t("vitals.chart.min"), stats.min)}
          {statCell(t("vitals.chart.avg"), stats.avg)}
          {statCell(t("vitals.chart.max"), stats.max)}
          {statCell(t("vitals.chart.count"), stats.count)}
        </View>
      ) : null}

      {/* A1C estimate */}
      {a1cLine ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.xs,
            paddingHorizontal: spacing.xs,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.warning,
            }}
          />
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Est. A1C: {a1cLine.a1c}%
          </Text>
        </View>
      ) : null}

      {/* Chart */}
      <GestureDetector gesture={panGesture}>
        <View style={{ width, height, position: "relative" }}>
          <Svg width={width} height={height}>
            {/* Target range band */}
            <Rect
              x={padding.left}
              y={bandTop}
              width={innerW}
              height={bandH}
              fill={colors.success}
              opacity={0.1}
              rx={radius.sm}
            />

            {/* Target range labels */}
            <SvgText
              x={padding.left + innerW - 4}
              y={bandTop - 4}
              fontSize={8}
              fill={colors.success}
              textAnchor="end"
              opacity={0.7}
            >
              {targetHigh}
            </SvgText>
            <SvgText
              x={padding.left + innerW - 4}
              y={bandBot + 10}
              fontSize={8}
              fill={colors.success}
              textAnchor="end"
              opacity={0.7}
            >
              {targetLow}
            </SvgText>

            {/* Y gridlines */}
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

            {/* A1C estimate line */}
            {a1cLine ? (
              <Line
                x1={padding.left}
                y1={a1cLine.y}
                x2={padding.left + innerW}
                y2={a1cLine.y}
                stroke={colors.warning}
                strokeDasharray="6,4"
                strokeWidth={1}
                opacity={0.6}
              />
            ) : null}

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
              <Path d={primaryPath} stroke={colors.primary} strokeWidth={2} fill="none" />
            ) : null}

            {/* Context-colored data points */}
            {points.map((p, i) => {
              if (!Number.isFinite(p.value)) return null;
              const ctx = (p as any).context || "random";
              const color = CONTEXT_COLORS[ctx] || CONTEXT_COLORS.random;
              return (
                <Circle
                  key={`p-${i}`}
                  cx={xScale(i)}
                  cy={yScale(p.value)}
                  r={4}
                  fill={color}
                  stroke={colors.surface}
                  strokeWidth={1.5}
                />
              );
            })}
          </Svg>

          {/* Crosshair overlay */}
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
        </View>
      </GestureDetector>

      {/* Context legend */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
          marginTop: spacing.sm,
          paddingHorizontal: spacing.xs,
        }}
      >
        {Object.entries(CONTEXT_COLORS).map(([ctx, color]) => (
          <View key={ctx} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: color,
              }}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {CONTEXT_LABELS[ctx] || ctx}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

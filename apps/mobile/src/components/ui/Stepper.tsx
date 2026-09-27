import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  steps: string[]; // labels
  current: number; // 0-indexed
};

export function Stepper({ steps, current }: Props) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const progress = useSharedValue(current);

  useEffect(() => {
    progress.value = withTiming(current, {
      duration: 420,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [current, progress]);

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          borderCurve: "continuous",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
          paddingVertical: spacing.md + 2,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          ...(scheme === "dark" ? null : shadow.card),
        }}
      >
        <View style={styles.headRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.kicker, { color: colors.textSubtle, textTransform: "uppercase" }]}>
              {`${current + 1} / ${steps.length}`}
            </Text>
            <Text numberOfLines={1} style={[typography.title.md, { color: colors.text, marginTop: 2 }]}>
              {steps[current]}
            </Text>
          </View>
          <View style={[styles.dots, { gap: 6 }]}>
            {steps.map((label, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <View
                  key={label + i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: done || active ? colors.primary : colors.fill,
                      ...(active && scheme !== "dark" ? shadow.primary : null),
                    },
                  ]}
                >
                  {done ? (
                    <Check size={13} color={colors.onPrimary} strokeWidth={3.2} />
                  ) : (
                    <Text
                      style={[
                        typography.label.xs,
                        { color: active ? colors.onPrimary : colors.textMuted },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={[styles.segments, { gap: 6 }]}>
            {steps.map((label, i) => (
              <Segment key={label + i} index={i} progress={progress} track={colors.fill} fill={colors.primary} />
            ))}
          </View>
          <View style={[styles.segments, { gap: 6 }]}>
            {steps.map((label, i) => {
              const state = i < current ? "done" : i === current ? "active" : "todo";
              return (
                <Text
                  key={label + i}
                  numberOfLines={1}
                  style={[
                    typography.caption,
                    {
                      flex: 1,
                      color:
                        state === "active"
                          ? colors.primary
                          : state === "done"
                            ? colors.text
                            : colors.textSubtle,
                      fontFamily:
                        state === "active" ? typography.label.xs.fontFamily : typography.caption.fontFamily,
                    },
                  ]}
                >
                  {label}
                </Text>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function Segment({
  index,
  progress,
  track,
  fill,
}: {
  index: number;
  progress: SharedValue<number>;
  track: string;
  fill: string;
}) {
  const fillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value + 1 - index, [0, 1], [0, 100], Extrapolation.CLAMP)}%`,
  }));
  return (
    <View style={[styles.segment, { backgroundColor: track }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: fill }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segments: {
    flexDirection: "row",
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  segmentFill: {
    height: "100%",
    borderRadius: 999,
  },
});

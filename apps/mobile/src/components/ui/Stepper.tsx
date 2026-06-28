import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  steps: string[]; // labels
  current: number; // 0-indexed
};

export function Stepper({ steps, current }: Props) {
  const { colors, spacing, typography, radius } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(current, {
      duration: 380,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [current, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${(progress.value / Math.max(1, steps.length - 1)) * 100}%`,
  }));

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <View
        style={[
          styles.track,
          {
            backgroundColor: colors.border,
            borderRadius: 999,
            height: 6,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              borderRadius: 999,
            },
            fillStyle,
          ]}
        />
      </View>

      <View style={[styles.row, { marginTop: spacing.sm }]}>
        {steps.map((label, i) => {
          const state = i < current ? "done" : i === current ? "active" : "todo";
          const dotColor =
            state === "done"
              ? colors.primary
              : state === "active"
              ? colors.primary
              : colors.borderStrong;
          const textColor =
            state === "todo" ? colors.textMuted : colors.text;
          return (
            <View key={label + i} style={styles.stepWrap}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: dotColor,
                    borderRadius: 999,
                  },
                  state === "active" && {
                    borderWidth: 3,
                    borderColor: colors.primarySoft,
                  },
                ]}
              >
                {state === "done" ? (
                  <Text style={[styles.check, { color: colors.onPrimary }]}>✓</Text>
                ) : (
                  <Text style={[styles.numeral, { color: colors.onPrimary }]}>{i + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  typography.caption,
                  {
                    color: textColor,
                    fontWeight: state === "active" ? "700" : "500",
                  },
                  { marginTop: 6 },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepWrap: {
    flex: 1,
    alignItems: "center",
  },
  dot: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    fontSize: 14,
    fontWeight: "700",
  },
  numeral: {
    fontSize: 12,
    fontWeight: "700",
  },
});

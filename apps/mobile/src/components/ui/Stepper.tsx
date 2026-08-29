import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  steps: string[]; // labels
  current: number; // 0-indexed
};

export function Stepper({ steps, current }: Props) {
  const { colors, spacing, typography } = useTheme();
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
        style={{
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
        }}
      >
        {/* Connector track behind the dots */}
        <View style={[styles.trackRow]}>
          <View
            style={[
              styles.track,
              {
                backgroundColor: colors.border,
                borderRadius: 999,
                height: 3,
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

          {steps.map((label, i) => {
            const state = i < current ? "done" : i === current ? "active" : "todo";
            const isDone = state === "done";
            const isActive = state === "active";

            return (
              <View
                key={label + i}
                style={[
                  styles.dotWrap,
                  {
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    borderWidth: isActive ? 0 : 1.5,
                    borderColor: isDone
                      ? colors.primary
                      : colors.borderStrong,
                    backgroundColor: isDone || isActive
                      ? colors.primary
                      : colors.surfaceMuted,
                    shadowColor: isActive ? colors.primary : "transparent",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isActive ? 0.28 : 0,
                    shadowRadius: 8,
                    elevation: isActive ? 3 : 0,
                  },
                ]}
              >
                {isDone ? (
                  <Check size={15} color={colors.onPrimary} strokeWidth={3} />
                ) : (
                  <Text
                    style={[
                      styles.numeral,
                      {
                        color: isActive ? colors.onPrimary : colors.textMuted,
                      },
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Labels */}
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          {steps.map((label, i) => {
            const state = i < current ? "done" : i === current ? "active" : "todo";
            return (
              <View key={label + i} style={styles.stepWrap}>
                <Text
                  style={[
                    typography.caption,
                    {
                      color:
                        state === "todo"
                          ? colors.textSubtle
                          : state === "active"
                            ? colors.primary
                            : colors.text,
                      fontWeight: state === "active" ? "800" : "600",
                      textAlign: "center",
                      fontSize: 12,
                    },
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
    </View>
  );
}

const styles = StyleSheet.create({
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  track: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 14.5,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
  dotWrap: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepWrap: {
    flex: 1,
    alignItems: "center",
  },
  numeral: {
    fontSize: 13,
    fontWeight: "800",
  },
});

import React, { useEffect } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";

type Props = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = "100%", height = 16, radius: r = 8, style }: Props) {
  const { colors, motion: motionTokens } = useTheme();
  const motionEnabled = useMotionEnabled();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!motionEnabled) return;
    progress.value = withRepeat(
      withTiming(1, { duration: motionTokens.duration.pulse }),
      -1,
      true
    );
  }, [motionEnabled, progress, motionTokens.duration.pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.surfaceMuted, colors.border]
    ),
  }));

  if (!motionEnabled) {
    return (
      <View
        style={[
          {
            width,
            height,
            borderRadius: r,
            backgroundColor: colors.surfaceMuted,
          },
          style,
        ]}
      />
    );
  }

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({});

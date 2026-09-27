import React, { useEffect } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";

type Props = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Shimmering placeholder block — soft pulse plus a travelling highlight sweep. */
export function Skeleton({ width = "100%", height = 16, radius: r = 8, style }: Props) {
  const { colors, scheme } = useTheme();
  const motionEnabled = useMotionEnabled();
  const pulse = useSharedValue(0.7);
  const sweep = useSharedValue(-1);

  useEffect(() => {
    if (!motionEnabled) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }), -1, true);
    sweep.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [motionEnabled, pulse, sweep]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const shineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sweep.value * 280 }] }));

  const base: ViewStyle = {
    width,
    height,
    borderRadius: r,
    backgroundColor: scheme === "dark" ? colors.surfaceMuted : colors.bgMuted,
    overflow: "hidden",
  };

  if (!motionEnabled) {
    return <View style={[base, style]} />;
  }

  return (
    <Animated.View style={[base, pulseStyle, style]}>
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: 100, left: -50 }, shineStyle]}>
        <LinearGradient
          colors={
            scheme === "dark"
              ? ["rgba(255,255,255,0)", "rgba(255,255,255,0.08)", "rgba(255,255,255,0)"]
              : ["rgba(255,255,255,0)", "rgba(255,255,255,0.7)", "rgba(255,255,255,0)"]
          }
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

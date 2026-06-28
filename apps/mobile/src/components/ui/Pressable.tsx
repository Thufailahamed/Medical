import React, { useCallback } from "react";
import { Pressable as RNPressable, type PressableProps, type ViewStyle, type StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeProvider";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";
import { motion } from "@/constants/theme";

type Props = Omit<PressableProps, "style" | "children"> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  pressedOpacity?: number;
  haptic?: "none" | "light" | "medium" | "heavy" | "soft";
  hapticOnPress?: boolean;
};

const HapticMap: Record<string, Haptics.ImpactFeedbackStyle | "soft"> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  soft: "soft",
};

export function Pressable({
  children,
  style,
  pressedScale = 0.97,
  pressedOpacity = 0.85,
  haptic = "none",
  hapticOnPress = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: Props) {
  const { motion: motionTokens } = useTheme();
  const motionEnabled = useMotionEnabled();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = useCallback(
    (e: any) => {
      if (motionEnabled) {
        scale.value = withTiming(pressedScale, { duration: motionTokens.duration.fast });
        opacity.value = withTiming(pressedOpacity, { duration: motionTokens.duration.fast });
      }
      if (haptic !== "none" && !disabled) {
        const v = HapticMap[haptic];
        if (v === "soft") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
        } else {
          Haptics.impactAsync(v as Haptics.ImpactFeedbackStyle).catch(() => {});
        }
      }
      onPressIn?.(e);
    },
    [motionEnabled, pressedScale, pressedOpacity, haptic, disabled, scale, opacity, motionTokens.duration.fast, onPressIn]
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withTiming(1, { duration: motionTokens.duration.fast });
      opacity.value = withTiming(1, { duration: motionTokens.duration.fast });
      onPressOut?.(e);
    },
    [scale, opacity, motionTokens.duration.fast, onPressOut]
  );

  const handlePress = useCallback(
    (e: any) => {
      if (hapticOnPress) {
        Haptics.selectionAsync().catch(() => {});
      }
      onPress?.(e);
    },
    [onPress, hapticOnPress]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <RNPressable
        {...rest}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={style}
      >
        {children}
      </RNPressable>
    </Animated.View>
  );
}

// Re-export interpolate helper for downstream components
export { interpolate };

import React, { useCallback } from "react";
import {
  Pressable as RNPressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeProvider";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";

type Props = Omit<PressableProps, "style" | "children"> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
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

/** Layout props that must live on the outer wrapper so flex children expand correctly. */
function extractLayoutStyle(style: StyleProp<ViewStyle> | undefined): ViewStyle {
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  if (!flat) return {};
  const out: ViewStyle = {};
  if (flat.flex != null) out.flex = flat.flex;
  if (flat.flexGrow != null) out.flexGrow = flat.flexGrow;
  if (flat.flexShrink != null) out.flexShrink = flat.flexShrink;
  if (flat.flexBasis != null) out.flexBasis = flat.flexBasis;
  if (flat.alignSelf != null) out.alignSelf = flat.alignSelf;
  if (flat.width != null) out.width = flat.width;
  if (flat.height != null) out.height = flat.height;
  if (flat.minWidth != null) out.minWidth = flat.minWidth;
  if (flat.minHeight != null) out.minHeight = flat.minHeight;
  if (flat.maxWidth != null) out.maxWidth = flat.maxWidth;
  if (flat.maxHeight != null) out.maxHeight = flat.maxHeight;
  if (flat.margin != null) out.margin = flat.margin;
  if (flat.marginTop != null) out.marginTop = flat.marginTop;
  if (flat.marginBottom != null) out.marginBottom = flat.marginBottom;
  if (flat.marginLeft != null) out.marginLeft = flat.marginLeft;
  if (flat.marginRight != null) out.marginRight = flat.marginRight;
  if (flat.marginHorizontal != null) out.marginHorizontal = flat.marginHorizontal;
  if (flat.marginVertical != null) out.marginVertical = flat.marginVertical;
  return out;
}

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
        scale.value = withTiming(pressedScale, {
          duration: motionTokens.duration.fast,
        });
        opacity.value = withTiming(pressedOpacity, {
          duration: motionTokens.duration.fast,
        });
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
    [
      motionEnabled,
      pressedScale,
      pressedOpacity,
      haptic,
      disabled,
      scale,
      opacity,
      motionTokens.duration.fast,
      onPressIn,
    ],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withTiming(1, { duration: motionTokens.duration.fast });
      opacity.value = withTiming(1, { duration: motionTokens.duration.fast });
      onPressOut?.(e);
    },
    [scale, opacity, motionTokens.duration.fast, onPressOut],
  );

  const handlePress = useCallback(
    (e: any) => {
      if (hapticOnPress) {
        Haptics.selectionAsync().catch(() => {});
      }
      onPress?.(e);
    },
    [onPress, hapticOnPress],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const staticStyle = typeof style === "function" ? undefined : style;
  const layoutStyle = extractLayoutStyle(staticStyle);

  return (
    <Animated.View style={[layoutStyle, animatedStyle]}>
      <RNPressable
        {...rest}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={style as any}
      >
        {children}
      </RNPressable>
    </Animated.View>
  );
}

export { interpolate };

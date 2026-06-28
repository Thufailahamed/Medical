import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";

type Props = {
  /** 0..1 progress. */
  value: number;
  size?: number;
  tone?: Tone;
  /** Center label (e.g. "3" or "67%"). */
  label?: string;
  sublabel?: string;
  /** Render the ring clickable. */
  onPress?: () => void;
  accessibilityLabel?: string;
  centerColor?: string;
};

// Create an animated circle using reanimated
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function DoseRing({
  value,
  size = 64,
  tone = "primary",
  label,
  sublabel,
  onPress,
  accessibilityLabel,
  centerColor,
}: Props) {
  const { colors, motion: motionTokens, typography } = useTheme();
  const motionEnabled = useMotionEnabled();
  const { fg } = useTone(tone);

  const clamped = Math.max(0, Math.min(1, value));
  const arc = useSharedValue(clamped);
  const press = useSharedValue(1);
  const flash = useSharedValue(0);

  useEffect(() => {
    arc.value = motionEnabled
      ? withTiming(clamped, {
          duration: motionTokens.duration.slow,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        })
      : clamped;
  }, [clamped, motionEnabled, arc, motionTokens.duration.slow]);

  const strokeWidth = Math.max(4, size * 0.08);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated props for SVG strokeDashoffset
  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - arc.value * circumference;
    return {
      strokeDashoffset,
    };
  });

  const ringWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
    opacity: flash.value > 0 ? 1 - flash.value * 0.3 : 1,
  }));

  const handlePress = () => {
    if (!onPress) return;
    if (motionEnabled) {
      press.value = withSequence(
        withSpring(1.08, motionTokens.spring.snappy as any),
        withSpring(1, motionTokens.spring.snappy as any)
      );
      flash.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 320 })
      );
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    onPress();
  };

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        ringWrapStyle,
      ]}
      onTouchEnd={onPress ? handlePress : undefined}
      accessibilityRole={onPress ? "button" : "progressbar"}
      accessibilityLabel={accessibilityLabel ?? `${Math.round(clamped * 100)} percent`}
      accessibilityValue={{ min: 0, max: 1, now: clamped }}
    >
      <View style={{ width: size, height: size, transform: [{ rotate: "-90deg" }] }}>
        <Svg width={size} height={size}>
          {/* Background Track Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill={centerColor ?? "transparent"}
          />
          {/* Foreground Progress Circle */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={fg}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
          />
        </Svg>
      </View>

      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {label ? (
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "700" },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ) : null}
        {sublabel ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, fontSize: 9, lineHeight: 11 },
            ]}
            numberOfLines={1}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});

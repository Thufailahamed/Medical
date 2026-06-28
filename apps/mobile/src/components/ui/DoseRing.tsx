import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
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
};

/**
 * Circular progress ring built from rotated, clipped Views — no SVG dep.
 * Visually mimics a stroke by rotating a half-arc into position.
 */
export function DoseRing({
  value,
  size = 64,
  tone = "primary",
  label,
  sublabel,
  onPress,
  accessibilityLabel,
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

  const halfSize = size / 2;
  const trackWidth = Math.max(4, size * 0.08);
  const radius = halfSize - trackWidth / 2 - 2;

  // Render two halves of the ring, masked via opacity + rotation.
  const halfAStyle = useAnimatedStyle(() => {
    const rotation = arc.value * 360;
    return {
      transform: [{ rotate: `${rotation}deg` }],
      opacity: arc.value > 0 ? 1 : 0,
    };
  });

  const halfBStyle = useAnimatedStyle(() => {
    const rotate = (Math.max(arc.value, 0.5) - 0.5) * 360;
    return {
      transform: [{ rotate: `${rotate}deg` }],
      opacity: arc.value > 0.5 ? 1 : 0,
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
      {/* track ring (two halves) */}
      <View style={[styles.ring, { width: size, height: size }]}>
        <View
          style={[
            styles.halfClip,
            { left: 0, width: halfSize, height: size },
          ]}
        >
          <View
            style={[
              styles.half,
              {
                width: size,
                height: size,
                borderRadius: halfSize,
                borderWidth: trackWidth,
                borderColor: colors.border,
                borderRightColor: "transparent",
                borderBottomColor: "transparent",
              },
            ]}
          />
        </View>
        <View
          style={[
            styles.halfClip,
            { right: 0, width: halfSize, height: size },
          ]}
        >
          <View
            style={[
              styles.half,
              {
                width: size,
                height: size,
                borderRadius: halfSize,
                borderWidth: trackWidth,
                borderColor: colors.border,
                borderLeftColor: "transparent",
                borderTopColor: "transparent",
                transform: [{ rotate: "180deg" }],
              },
            ]}
          />
        </View>

        {/* progress arc A (rotates 0..360) */}
        <Animated.View
          style={[
            styles.halfClip,
            {
              left: 0,
              width: halfSize,
              height: size,
              borderColor: fg,
            },
            halfAStyle,
          ]}
        >
          <View
            style={[
              styles.half,
              {
                width: size,
                height: size,
                borderRadius: halfSize,
                borderWidth: trackWidth,
                borderColor: fg,
                borderRightColor: "transparent",
                borderBottomColor: "transparent",
              },
            ]}
          />
        </Animated.View>

        {/* progress arc B (visible when >0.5) */}
        <Animated.View
          style={[
            styles.halfClip,
            {
              right: 0,
              width: halfSize,
              height: size,
            },
            halfBStyle,
          ]}
        >
          <View
            style={[
              styles.half,
              {
                width: size,
                height: size,
                borderRadius: halfSize,
                borderWidth: trackWidth,
                borderColor: fg,
                borderLeftColor: "transparent",
                borderTopColor: "transparent",
                transform: [{ rotate: "180deg" }],
              },
            ]}
          />
        </Animated.View>

        {/* center hole */}
        <View
          style={[
            {
              position: "absolute",
              width: size - trackWidth * 2 - 4,
              height: size - trackWidth * 2 - 4,
              borderRadius: (size - trackWidth * 2 - 4) / 2,
              backgroundColor: colors.surface,
              top: trackWidth + 2,
              left: trackWidth + 2,
            },
          ]}
        />
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
  ring: {
    position: "absolute",
  },
  halfClip: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
  half: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});

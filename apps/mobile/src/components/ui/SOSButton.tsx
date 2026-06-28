import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Siren } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";

type Props = {
  onActivate: () => void;
  size?: number;
  holdMs?: number;
  label?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SOSButton({
  onActivate,
  size = 200,
  holdMs = 1500,
  label = "SOS",
  compact = false,
  style,
}: Props) {
  const { colors, typography } = useTheme();
  const motionEnabled = useMotionEnabled();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);

  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  useEffect(() => {
    if (!motionEnabled) {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(ring3);
      ring1.value = 0.3;
      ring2.value = 0.5;
      ring3.value = 0.7;
      return;
    }
    const dur = 1800;
    ring1.value = withRepeat(
      withTiming(1, { duration: dur, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    ring2.value = withDelay(
      600,
      withRepeat(
        withTiming(1, { duration: dur, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    ring3.value = withDelay(
      1200,
      withRepeat(
        withTiming(1, { duration: dur, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    return () => {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(ring3);
    };
  }, [motionEnabled, ring1, ring2, ring3]);

  const startHold = () => {
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setProgress(0);
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / holdMs, 1);
      setProgress(p);
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        onActivate();
        setHolding(false);
      }
    };
    requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    setHolding(false);
    setProgress(0);
  };

  const ring1Style = useAnimatedStyle(() => ({
    opacity: 1 - ring1.value * 0.85,
    transform: [{ scale: 1 + ring1.value * 0.35 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: 1 - ring2.value * 0.85,
    transform: [{ scale: 1 + ring2.value * 0.35 }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: 1 - ring3.value * 0.85,
    transform: [{ scale: 1 + ring3.value * 0.35 }],
  }));

  const ringSize = size;
  const innerSize = size * 0.7;

  return (
    <View
      style={[
        { alignItems: "center", justifyContent: "center", gap: 12 },
        style,
      ]}
    >
      <View
        style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}
      >
        {motionEnabled ? (
          <>
            <Animated.View
              style={[
                styles.ring,
                { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colors.danger },
                ring1Style,
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colors.danger },
                ring2Style,
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colors.danger },
                ring3Style,
              ]}
            />
          </>
        ) : (
          <>
            <View
              style={[
                styles.ring,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderColor: colors.danger,
                  opacity: 0.3,
                },
              ]}
            />
            <View
              style={[
                styles.ring,
                {
                  width: ringSize * 0.85,
                  height: ringSize * 0.85,
                  borderRadius: ringSize,
                  borderColor: colors.danger,
                  opacity: 0.5,
                  position: "absolute",
                },
              ]}
            />
          </>
        )}

        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Emergency SOS. Press and hold to activate."
          accessibilityHint="Hold for 1.5 seconds to send an emergency alert with your location."
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          onTouchCancel={cancelHold}
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: colors.danger,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Siren size={compact ? 28 : 40} color={colors.onDanger} strokeWidth={2.25} />
          <Text
            style={{
              color: colors.onDanger,
              fontWeight: "800",
              fontSize: compact ? 14 : 18,
              letterSpacing: 1.5,
              marginTop: 2,
            }}
          >
            {label}
          </Text>
          {holding ? (
            <View
              style={{
                position: "absolute",
                bottom: 14,
                width: innerSize * 0.7,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.3)",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${progress * 100}%`,
                  height: "100%",
                  backgroundColor: colors.onDanger,
                }}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
});

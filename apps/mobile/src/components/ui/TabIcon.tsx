import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";

type Props = {
  icon: LucideIcon;
  focused?: boolean;
  badge?: number;
  tint?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function TabIcon({
  icon: Icon,
  focused,
  badge,
  tint,
  size = 21,
  style,
}: Props) {
  const { colors, radius, motion } = useTheme();
  const motionEnabled = useMotionEnabled();

  const fg = tint ?? (focused ? colors.primary : colors.textSubtle);
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    if (!motionEnabled) {
      progress.value = focused ? 1 : 0;
      return;
    }
    progress.value = withSpring(focused ? 1 : 0, motion.spring.snappy);
  }, [focused, motionEnabled, progress, motion.spring.snappy]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + progress.value * 0.4 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 1 }],
  }));

  return (
    <View
      style={[
        {
          width: 48,
          height: 30,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          {
            backgroundColor: colors.primarySoft,
            borderRadius: 16,
            borderCurve: "continuous",
          },
          pillStyle,
        ]}
      />
      <Animated.View style={iconStyle}>
        <Icon size={size} color={fg} strokeWidth={focused ? 2.5 : 2} />
      </Animated.View>
      {typeof badge === "number" && badge > 0 ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.danger, borderColor: colors.surface || "#FFFFFF" },
          ]}
          accessibilityLabel={`${badge} unread`}
        >
          <Text style={[styles.badgeText, { color: colors.onDanger }]}>
            {badge > 9 ? "9+" : badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    width: 52,
    height: 32,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "PlusJakartaSans_800ExtraBold",
  },
});

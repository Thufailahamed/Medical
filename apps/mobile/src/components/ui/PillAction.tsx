import React from "react";
import { Text, StyleSheet } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Pressable } from "./Pressable";

type Props = {
  label: string;
  onPress: () => void;
  /** Frosted variant for use on gradient heroes. */
  onDark?: boolean;
};

/** Compact "See all" capsule used as a section / card action. */
export function PillAction({ label, onPress, onDark }: Props) {
  const { colors, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const clean = label.replace(/\s*[→›>]\s*$/, "");
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      hitSlop={8}
      pressedScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={clean}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          height: 30,
          paddingLeft: 12,
          paddingRight: 8,
          borderRadius: 999,
          backgroundColor: onDark ? "rgba(255,255,255,0.16)" : colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: onDark ? "rgba(255,255,255,0.28)" : isDark ? colors.borderStrong : colors.hairline,
        },
        onDark || isDark ? null : shadow.xs,
      ]}
    >
      <Text style={[typography.label.sm, { color: onDark ? "#FFFFFF" : colors.text }]} numberOfLines={1}>
        {clean}
      </Text>
      <ChevronRight size={14} color={onDark ? "#FFFFFF" : colors.primary} strokeWidth={2.5} />
    </Pressable>
  );
}

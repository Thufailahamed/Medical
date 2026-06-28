import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import { Pressable } from "./Pressable";

type Props = {
  icon: LucideIcon;
  onPress: () => void;
  variant?: "solid" | "soft" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  badge?: number;
  tint?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  haptic?: "none" | "light" | "medium" | "heavy" | "soft";
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon: Icon,
  onPress,
  variant = "ghost",
  size = "md",
  badge,
  tint,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  haptic = "light",
  style,
}: Props) {
  const { colors } = useTheme();

  const sizeMap = {
    sm: { box: 32, icon: 16 },
    md: { box: 44, icon: 20 },
    lg: { box: 52, icon: 24 },
  } as const;
  const s = sizeMap[size];

  // Resolve variant via tonePalette so all tone/color decisions live in one place.
  const variantTone: "primary" | "danger" | "neutral" =
    variant === "solid"
      ? "primary"
      : variant === "danger"
      ? "danger"
      : variant === "soft"
      ? "primary"
      : "neutral";

  const palette = useTone(variantTone);
  const bg =
    variant === "solid"
      ? palette.bgStrong
      : variant === "soft"
      ? palette.bg
      : variant === "danger"
      ? palette.bg
      : "transparent";
  const defaultFg =
    variant === "solid" ? colors.onPrimary : palette.fg;
  const fg = tint ?? defaultFg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic={disabled ? "none" : haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={12}
      style={[
        {
          width: s.box,
          height: s.box,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Icon size={s.icon} color={fg} strokeWidth={2.25} />
    </Pressable>
  );
}

const styles = StyleSheet.create({});

import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  StyleSheet as RNStyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Pressable } from "./Pressable";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: "none" | "light" | "medium" | "heavy" | "soft";
  hapticOnPress?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = true,
  style,
  haptic = "light",
  hapticOnPress = false,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { colors, spacing, radius, typography, shadow } = useTheme();

  const sizeMap = {
    sm: { height: 40, px: spacing.md, font: typography.label.md },
    md: { height: 48, px: spacing.lg, font: typography.title.sm },
    lg: { height: 56, px: spacing.xl, font: typography.title.md },
  } as const;
  const s = sizeMap[size];

  const variantMap = {
    primary: {
      bg: colors.primary,
      text: colors.onPrimary,
      border: "transparent",
      shadow: shadow.primary,
    },
    secondary: {
      bg: colors.accent,
      text: colors.onAccent,
      border: "transparent",
      shadow: shadow.sm,
    },
    ghost: {
      bg: "transparent",
      text: colors.primary,
      border: "transparent",
      shadow: undefined,
    },
    danger: {
      bg: colors.danger,
      text: colors.onDanger,
      border: "transparent",
      shadow: shadow.sm,
    },
    outline: {
      bg: "transparent",
      text: colors.primary,
      border: colors.borderStrong,
      shadow: undefined,
    },
  } as const;
  const v = variantMap[variant];

  const isDisabled = disabled || loading;
  const iconSize = size === "sm" ? 16 : size === "lg" ? 22 : 18;
  const iconColor = v.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      haptic={isDisabled ? "none" : haptic}
      hapticOnPress={hapticOnPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={[
        {
          minHeight: s.height,
          paddingHorizontal: s.px,
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderRadius: radius.full,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: isDisabled ? 0.5 : 1,
        },
        v.shadow as any,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : Icon ? (
        <Icon size={iconSize} color={iconColor} strokeWidth={2.25} />
      ) : null}
      <Text
        style={[
          s.font,
          { color: v.text, textAlign: "center" },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {IconRight && !loading ? <IconRight size={iconSize} color={iconColor} strokeWidth={2.25} /> : null}
    </Pressable>
  );
}

// Re-export so consumers don't need a separate StyleSheet import
export const buttonStyles = RNStyleSheet.create({});

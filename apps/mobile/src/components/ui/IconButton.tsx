import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import { Pressable } from "./Pressable";

type Props = {
  icon: LucideIcon;
  onPress: () => void;
  /** `surface` = paper disc with soft lift (headers); `glass` = frosted disc for gradient heroes. */
  variant?: "solid" | "soft" | "ghost" | "danger" | "surface" | "glass";
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
  const { colors, shadow, scheme } = useTheme();

  const isDark = scheme === "dark";
  const sizeMap = {
    sm: { box: 32, icon: 16 },
    md: { box: variant === "surface" || variant === "glass" ? 42 : 44, icon: 20 },
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
      : variant === "surface"
      ? colors.surface
      : variant === "glass"
      ? "rgba(255,255,255,0.16)"
      : tint
      ? "transparent"
      : colors.fill;
  const defaultFg =
    variant === "solid" || variant === "glass"
      ? variant === "glass" ? "#FFFFFF" : colors.onPrimary
      : variant === "surface"
      ? colors.text
      : palette.fg;
  const fg = tint ?? defaultFg;
  const edge =
    variant === "surface"
      ? { borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? colors.borderStrong : colors.hairline }
      : variant === "glass"
      ? { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.3)" }
      : null;

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
        edge,
        variant === "solid" && !isDark ? shadow.primary : null,
        variant === "surface" && !isDark ? shadow.sm : null,
        style,
      ]}
    >
      <Icon size={s.icon} color={variant === "ghost" && !tint ? colors.text : fg} strokeWidth={2.1} />
      {typeof badge === "number" && badge > 0 ? (
        <View
          style={{
            position: "absolute",
            top: -3,
            right: -4,
            minWidth: 19,
            height: 19,
            borderRadius: 10,
            paddingHorizontal: 5,
            backgroundColor: colors.danger,
            borderWidth: 2,
            borderColor: variant === "glass" ? "transparent" : colors.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.onDanger, fontSize: 10, lineHeight: 12, fontFamily: "PlusJakartaSans_800ExtraBold" }}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({});

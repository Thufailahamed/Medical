import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
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
  const { colors, shadow, scheme } = useTheme();

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
      : tint
      ? "transparent"
      : colors.fill;
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
        variant === "solid" && scheme !== "dark" ? shadow.primary : null,
        style,
      ]}
    >
      <Icon size={s.icon} color={variant === "ghost" && !tint ? colors.text : fg} strokeWidth={2.25} />
      {typeof badge === "number" && badge > 0 ? (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: colors.danger,
            borderWidth: 2,
            borderColor: colors.bg,
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

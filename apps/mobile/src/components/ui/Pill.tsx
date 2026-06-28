import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";

export type PillTone =
  | "neutral"
  | "primary"
  | "accent"
  | "accent2"
  | "danger"
  | "warning"
  | "success"
  | "info";

type Props = {
  label: string;
  tone?: PillTone;
  icon?: LucideIcon;
  size?: "sm" | "md";
  outlined?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Pill({ label, tone = "neutral", icon: Icon, size = "md", outlined, style }: Props) {
  const { spacing, radius, typography } = useTheme();
  const { fg, bg } = useTone(tone);

  const isMd = size === "md";
  const padH = isMd ? spacing.sm + 2 : spacing.sm;
  const padV = isMd ? 4 : 2;
  const font = isMd ? typography.caption : { ...typography.caption, fontSize: 10 };
  const iconSize = isMd ? 11 : 10;

  return (
    <View
      style={[
        {
          paddingHorizontal: padH,
          paddingVertical: padV,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: outlined ? "transparent" : bg,
          borderColor: fg,
          borderWidth: outlined ? 1 : 0,
          borderRadius: radius.full,
          alignSelf: "flex-start",
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${label}`}
    >
      {Icon ? <Icon size={iconSize} color={fg} strokeWidth={3} /> : null}
      <Text style={[font, { color: fg, fontWeight: "700" as const }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({});

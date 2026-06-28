import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";

export type StatTone =
  | "primary"
  | "accent"
  | "accent2"
  | "warning"
  | "danger"
  | "info"
  | "success";

type Props = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
};

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  size = "md",
  style,
}: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const { fg, bg } = useTone(tone);

  const compact = size === "sm";

  return (
    <View
      style={[
        {
          flex: 1,
          padding: compact ? spacing.md : spacing.lg,
          backgroundColor: bg,
          borderRadius: radius.xl,
          gap: spacing.sm,
          minHeight: compact ? 84 : 110,
          justifyContent: "space-between",
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ""}`}
    >
      <View
        style={{
          width: compact ? 32 : 36,
          height: compact ? 32 : 36,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        }}
      >
        <Icon
          size={compact ? 16 : 18}
          color={fg}
          strokeWidth={2.25}
        />
      </View>
      <View>
        <Text
          style={[
            compact ? typography.title.md : typography.display.sm,
            {
              color: colors.text,
              fontFamily: typography.title.lg.fontFamily,
            },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, marginTop: 2 },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textSubtle, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Compact inline metric tile for hero or list rows. */
export function MetricTile(props: Props) {
  return <StatCard {...props} size="sm" />;
}

const styles = StyleSheet.create({});

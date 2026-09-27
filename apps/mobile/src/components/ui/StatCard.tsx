import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { ChevronRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Card } from "./Card";
import { IconTile } from "./IconTile";

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
  /** Percentage change; positive renders green/up. */
  delta?: number | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** KPI tile: tinted icon, big metric numerals, label and an optional delta chip. */
export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "primary",
  size = "md",
  delta,
  onPress,
  style,
}: Props) {
  const { colors, spacing, typography } = useTheme();
  const compact = size === "sm";
  const hasDelta = delta !== undefined && delta !== null;
  const up = (delta ?? 0) >= 0;

  const body = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <IconTile icon={icon} tone={tone} size={compact ? 30 : 36} />
        {hasDelta ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              paddingHorizontal: 7,
              height: 22,
              borderRadius: 11,
              backgroundColor: up ? colors.successSoft : colors.dangerSoft,
            }}
          >
            {up ? (
              <TrendingUp size={11} color={colors.success} strokeWidth={2.4} />
            ) : (
              <TrendingDown size={11} color={colors.danger} strokeWidth={2.4} />
            )}
            <Text style={[typography.label.xs, { color: up ? colors.success : colors.danger }]}>
              {up ? "+" : ""}
              {delta!.toFixed(1)}%
            </Text>
          </View>
        ) : onPress ? (
          <View style={styles.chev}>
            <ChevronRight size={15} color={colors.textSubtle} strokeWidth={2.5} />
          </View>
        ) : null}
      </View>
      <View>
        <Text
          style={[compact ? typography.title.lg : typography.metric, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        <Text style={[typography.label.md, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={[typography.caption, { color: colors.textSubtle, marginTop: 2 }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </>
  );

  const cardStyle: StyleProp<ViewStyle> = [
    {
      flex: 1,
      padding: compact ? spacing.md : spacing.lg,
      gap: compact ? spacing.sm : spacing.md,
      minHeight: compact ? 88 : 120,
      justifyContent: "space-between",
    },
    style,
  ];
  const a11y = `${label}: ${value}${hint ? `, ${hint}` : ""}`;

  return onPress ? (
    <Card padded={false} onPress={onPress} style={cardStyle} accessibilityLabel={a11y}>
      {body}
    </Card>
  ) : (
    <Card padded={false} style={cardStyle} accessibilityLabel={a11y}>
      {body}
    </Card>
  );
}

/** Compact inline metric tile for hero or list rows. */
export function MetricTile(props: Props) {
  return <StatCard {...props} size="sm" />;
}

const styles = StyleSheet.create({
  chev: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
});

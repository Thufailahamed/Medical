import React from "react";
import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { PillAction } from "./PillAction";

type Props = {
  title: string;
  /** Wide-tracked eyebrow shown above the title. */
  kicker?: string;
  count?: number;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

/** Overline + title + optional "See all" capsule — heads every content block. */
export function SectionHeader({ title, kicker, count, action, style }: Props) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: spacing.md,
          paddingHorizontal: 2,
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        {kicker ? (
          <Text style={[typography.kicker, { color: colors.primary, textTransform: "uppercase" }]} numberOfLines={1}>
            {kicker}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text
            style={[typography.title.lg, { color: colors.text, flexShrink: 1 }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {typeof count === "number" ? (
            <View
              style={{
                minWidth: 22,
                height: 20,
                paddingHorizontal: 6,
                borderRadius: 10,
                backgroundColor: colors.fill,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={[typography.label.xs, { color: colors.textMuted }]}>{count}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {action ? <PillAction label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

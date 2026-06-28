import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Pressable } from "./Pressable";

type Props = {
  title: string;
  count?: number;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, count, action, style }: Props) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.xs,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
        <Text style={[typography.title.sm, { color: colors.text }]}>{title}</Text>
        {typeof count === "number" ? (
          <Text style={[typography.caption, { color: colors.textSubtle }]}>{count}</Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          style={{ paddingHorizontal: spacing.xs, paddingVertical: 4 }}
        >
          <Text
            style={[
              typography.label.md,
              { color: colors.primary, fontWeight: "700" as const },
            ]}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});

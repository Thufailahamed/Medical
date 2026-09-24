import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { ChevronRight } from "lucide-react-native";
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
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
        <Text style={[typography.title.lg, { color: colors.text }]}>{title}</Text>
        {typeof count === "number" ? (
          <Text style={[typography.title.sm, { color: colors.textSubtle }]}>{count}</Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          style={{ paddingHorizontal: spacing.xs, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 1 }}
        >
          <Text style={[typography.label.lg, { color: colors.primary }]}>
            {action.label}
          </Text>
          <ChevronRight size={16} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});

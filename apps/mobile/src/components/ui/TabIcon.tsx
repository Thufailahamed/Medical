import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  icon: LucideIcon;
  focused?: boolean;
  badge?: number;
  tint?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Glyph + unread badge for the Dynamic Island tab bar (the bar draws the active pill). */
export function TabIcon({ icon: Icon, focused, badge, tint, size = 21, style }: Props) {
  const { colors } = useTheme();
  const fg = tint ?? (focused ? "#FFFFFF" : colors.textSubtle);

  return (
    <View style={[{ width: size + 2, height: size + 2, alignItems: "center", justifyContent: "center" }, style]}>
      <Icon size={size} color={fg} strokeWidth={focused ? 2.3 : 1.9} />
      {typeof badge === "number" && badge > 0 ? (
        <View
          style={[styles.badge, { backgroundColor: colors.danger, borderColor: focused ? colors.primary : colors.surface }]}
          accessibilityLabel={`${badge} unread`}
        >
          <Text style={[styles.badgeText, { color: colors.onDanger }]}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "PlusJakartaSans_800ExtraBold",
  },
});

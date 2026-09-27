import React from "react";
import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Card } from "./Card";

/** Inset-grouped list — rows share one rounded card with hairline separators. */
export function ListCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Card padded={false} style={[{ paddingVertical: 4 }, style]}>
      {children}
    </Card>
  );
}

/** Small-caps label above a ListCard, with an optional footnote. */
export function ListSection({
  label,
  footer,
  children,
  style,
}: {
  label?: string;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? (
        <Text style={[typography.kicker, { color: colors.textSubtle, textTransform: "uppercase", marginLeft: 6 }]}>
          {label}
        </Text>
      ) : null}
      <ListCard>{children}</ListCard>
      {footer ? (
        <Text style={[typography.caption, { color: colors.textSubtle, marginHorizontal: 6 }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

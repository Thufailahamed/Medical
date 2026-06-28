import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function FormField({ label, helper, error, required, children, style }: Props) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[{ gap: spacing.xs }, style]}>
      {label ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
            ]}
          >
            {label}
          </Text>
          {required ? (
            <Text style={[typography.label.md, { color: colors.danger }]}>*</Text>
          ) : null}
        </View>
      ) : null}
      {children}
      {error ? (
        <Text
          style={[typography.caption, { color: colors.danger }]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : helper ? (
        <Text style={[typography.caption, { color: colors.textSubtle }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});

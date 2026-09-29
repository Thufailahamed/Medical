import React from "react";
import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  title: string;
  /** Wide-tracked eyebrow above the title (date range, status…). */
  kicker?: string;
  /** Tone of the kicker — defaults to brand primary. */
  kickerColor?: string;
  /** Muted line under the title. */
  subtitle?: string;
  /** Right-aligned actions (IconButtons, pills), bottom-aligned with the title. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Large-title header for tab roots (Schedule, Inbox, Prescribe, Profile):
 * kicker + display title on the left, round actions on the right.
 */
export function LargeHeader({ title, kicker, kickerColor, subtitle, right, style }: Props) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {kicker ? (
          <Text
            style={[
              typography.kicker,
              { color: kickerColor ?? colors.primary, textTransform: "uppercase" },
            ]}
            numberOfLines={1}
          >
            {kicker}
          </Text>
        ) : null}
        <Text
          style={[typography.display.md, { color: colors.text, marginTop: kicker ? 2 : 0 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>{right}</View>
      ) : null}
    </View>
  );
}

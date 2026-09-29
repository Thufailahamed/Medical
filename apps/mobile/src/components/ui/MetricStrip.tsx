import React from "react";
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";

export type MetricItem = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  tone?: Tone;
  /** Small tone dot beside the value — "something is happening now". */
  live?: boolean;
  onPress?: () => void;
};

type Props = {
  items: MetricItem[];
  /** `lg` = 30pt figures (dashboards); `md` = 24pt (secondary pages). */
  size?: "md" | "lg";
  style?: StyleProp<ViewStyle>;
};

/**
 * One paper card holding 2–4 metric columns split by hairlines — the
 * premium alternative to a row of separate mini-cards.
 */
export function MetricStrip({ items, size = "lg", style }: Props) {
  const { colors, spacing, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "stretch",
          paddingVertical: spacing.xs + 2,
          paddingHorizontal: 5,
          borderRadius: radius.card,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? colors.borderStrong : colors.hairline,
        },
        isDark ? null : shadow.card,
        style,
      ]}
    >
      {items.map((item, i) => (
        <React.Fragment key={`${item.label}-${i}`}>
          {i > 0 ? (
            <View
              style={{
                width: StyleSheet.hairlineWidth,
                marginVertical: 14,
                backgroundColor: colors.separator,
              }}
            />
          ) : null}
          <MetricColumn item={item} size={size} />
        </React.Fragment>
      ))}
    </View>
  );
}

function MetricColumn({ item, size }: { item: MetricItem; size: "md" | "lg" }) {
  const { colors, spacing, typography, fontFamily } = useTheme();
  const palette = useTone(item.tone ?? "primary");
  const Icon = item.icon;
  const lg = size === "lg";

  return (
    <Pressable
      onPress={item.onPress}
      disabled={!item.onPress}
      accessibilityRole={item.onPress ? "button" : "summary"}
      accessibilityLabel={
        item.sub ? `${item.label}: ${item.value}. ${item.sub}` : `${item.label}: ${item.value}`
      }
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        paddingVertical: lg ? spacing.md : spacing.sm + 2,
        paddingHorizontal: spacing.sm + 2,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <View
        style={{
          width: lg ? 32 : 28,
          height: lg ? 32 : 28,
          borderRadius: lg ? 10 : 9,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
        }}
      >
        <Icon size={lg ? 16 : 14} color={palette.fg} strokeWidth={2.3} />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: lg ? spacing.md : spacing.sm,
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            flexShrink: 1,
            fontFamily: fontFamily.heavy,
            fontSize: lg ? 30 : 24,
            lineHeight: lg ? 34 : 28,
            letterSpacing: lg ? -1.1 : -0.8,
            color: colors.text,
            fontVariant: ["tabular-nums"],
          }}
        >
          {item.value}
        </Text>
        {item.live ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: palette.fg,
              borderWidth: 2,
              borderColor: palette.bg,
            }}
          />
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[typography.label.md, { color: colors.text, marginTop: 2 }]}
      >
        {item.label}
      </Text>
      {item.sub ? (
        <Text
          numberOfLines={1}
          style={[typography.caption, { fontSize: 11.5, color: colors.textSubtle, marginTop: 1 }]}
        >
          {item.sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

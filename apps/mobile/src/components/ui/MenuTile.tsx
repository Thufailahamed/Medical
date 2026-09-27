import React from "react";
import { View, Text } from "react-native";
import { ArrowUpRight, type LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { Tone } from "@/theme/tone";
import { Card } from "./Card";
import { IconTile } from "./IconTile";

type Props = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
  badge?: string | number;
  tone?: Tone;
  /** `brand` renders the tile on the brand gradient. */
  featured?: boolean;
};

/** Hub tile: tinted icon, arrow well, label and hint. */
export function MenuTile({ icon, label, hint, onPress, badge, tone = "primary", featured }: Props) {
  const { colors, typography } = useTheme();
  const onBrand = !!featured;
  return (
    <Card
      variant={onBrand ? "brand" : "flat"}
      onPress={onPress}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={{ flexBasis: "46%", flexGrow: 1, minHeight: 124, justifyContent: "space-between" }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <IconTile icon={icon} tone={tone} appearance={onBrand ? "glass" : "soft"} size={42} />
        {badge !== undefined && badge !== 0 ? (
          <View
            style={{
              backgroundColor: onBrand ? "#FFFFFF" : colors.primary,
              borderRadius: 11,
              minWidth: 22,
              height: 22,
              paddingHorizontal: 7,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[typography.label.xs, { color: onBrand ? colors.primary : colors.onPrimary }]}>{badge}</Text>
          </View>
        ) : (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: onBrand ? "rgba(255,255,255,0.16)" : colors.well,
            }}
          >
            <ArrowUpRight size={14} color={onBrand ? "#FFFFFF" : colors.textMuted} strokeWidth={2.4} />
          </View>
        )}
      </View>
      <View style={{ gap: 2, marginTop: 16 }}>
        <Text style={[typography.title.sm, { color: onBrand ? "#FFFFFF" : colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text
            style={[typography.caption, { color: onBrand ? "rgba(255,255,255,0.8)" : colors.textMuted }]}
            numberOfLines={2}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

export function MenuGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{children}</View>;
}

import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";

type Props = {
  icon: LucideIcon;
  tone?: Tone;
  /** soft = tinted wash; solid = filled tone with sheen; glass = frosted on gradients; surface = paper chip */
  appearance?: "soft" | "solid" | "glass" | "surface";
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Rounded-square icon holder (continuous corners at ~32% of size) used by
 * rows, tiles and section heads. Solid tiles carry a faint top sheen.
 */
export function IconTile({ icon: Icon, tone = "primary", appearance = "soft", size = 40, color, style }: Props) {
  const { colors, shadow, scheme } = useTheme();
  const p = useTone(tone);
  const r = Math.round(size * 0.32);

  const bg =
    appearance === "solid"
      ? p.bgStrong
      : appearance === "glass"
      ? "rgba(255,255,255,0.16)"
      : appearance === "surface"
      ? colors.surface
      : p.bg;
  const fg =
    color ??
    (appearance === "solid" ? p.onBgStrong : appearance === "glass" ? "#FFFFFF" : p.fg);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: r,
          borderCurve: "continuous",
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          overflow: appearance === "solid" ? "hidden" : "visible",
        },
        appearance === "glass"
          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.28)" }
          : appearance === "surface"
          ? [
              { borderWidth: StyleSheet.hairlineWidth, borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline },
              scheme === "dark" ? null : shadow.xs,
            ]
          : null,
        style,
      ]}
    >
      {appearance === "solid" ? (
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.26)", "rgba(255,255,255,0)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Icon size={Math.round(size * 0.47)} color={fg} strokeWidth={2.1} />
    </View>
  );
}

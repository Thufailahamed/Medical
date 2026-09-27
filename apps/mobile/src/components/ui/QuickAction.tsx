import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { Pressable } from "./Pressable";

type Props = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: Tone;
  /** `surface` = paper tile on the canvas, `solid` = filled tone (primary action), `glass` = on gradient heroes. */
  appearance?: "surface" | "solid" | "glass";
  badge?: number;
  size?: number;
  /** Override the outer layout (e.g. a fixed width inside horizontal scrollers). */
  style?: StyleProp<ViewStyle>;
};

/** Rounded-square action with a caption — the quick-action row on dashboards. */
export function QuickAction({ icon: Icon, label, onPress, tone = "primary", appearance = "surface", badge, size = 56, style }: Props) {
  const { colors, typography, shadow, scheme } = useTheme();
  const p = useTone(tone);
  const isDark = scheme === "dark";

  const bg = appearance === "solid" ? p.bgStrong : appearance === "glass" ? "rgba(255,255,255,0.16)" : colors.surface;
  const fg = appearance === "solid" ? p.onBgStrong : appearance === "glass" ? "#FFFFFF" : p.fg;

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressedScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[{ flex: 1, alignItems: "center", gap: 8, minWidth: 64 }, style]}
    >
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.36),
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            borderWidth: appearance === "solid" ? 0 : StyleSheet.hairlineWidth,
            borderColor: appearance === "glass" ? "rgba(255,255,255,0.28)" : isDark ? colors.borderStrong : colors.hairline,
          },
          isDark || appearance === "glass"
            ? null
            : appearance === "solid"
            ? { ...shadow.primary, shadowColor: p.bgStrong }
            : shadow.card,
        ]}
      >
        {appearance === "solid" ? (
          <View style={[StyleSheet.absoluteFill, { borderRadius: Math.round(size * 0.36), overflow: "hidden" }]} pointerEvents="none">
            <LinearGradient
              colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : appearance === "surface" ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: size - 18,
              height: size - 18,
              borderRadius: Math.round((size - 18) * 0.34),
              borderCurve: "continuous",
              backgroundColor: p.bg,
            }}
          />
        ) : null}
        <Icon size={Math.round(size * 0.4)} color={fg} strokeWidth={2.1} />
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              paddingHorizontal: 5,
              backgroundColor: colors.danger,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: appearance === "glass" ? "transparent" : colors.bg,
            }}
          >
            <Text style={{ color: colors.onDanger, fontSize: 10, lineHeight: 12, fontFamily: "PlusJakartaSans_800ExtraBold" }}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={[
          typography.label.sm,
          { fontSize: 11.5, color: appearance === "glass" ? "rgba(255,255,255,0.9)" : colors.textMuted, textAlign: "center" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Evenly spaced row of QuickActions. */
export function QuickActions({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", justifyContent: "space-between", gap: 8 }, style]}>{children}</View>;
}

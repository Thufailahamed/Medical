import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";
import { Pressable } from "./Pressable";

export type CardTone = "default" | Tone;

/**
 * Surface kinds:
 *  - flat      → default card: soft depth + whisper hairline edge
 *  - elevated  → lifted a little further off the canvas
 *  - floating  → hero-level lift for featured content
 *  - brand     → brand gradient with a material sheen (use light content)
 *  - muted     → recessed inset panel, no shadow
 *  - outline   → dashed placeholder (e.g. "add" slots)
 */
export type CardVariant = "flat" | "elevated" | "floating" | "brand" | "muted" | "outline";

type CommonProps = {
  children: React.ReactNode;
  padded?: boolean;
  tone?: CardTone;
  variant?: CardVariant;
  elevated?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

type StaticProps = CommonProps & { onPress?: undefined };
type PressableProps = CommonProps & {
  onPress: () => void;
  haptic?: "none" | "light" | "medium" | "heavy" | "soft";
  disabled?: boolean;
};

export type CardProps = StaticProps | PressableProps;

/**
 * Premium card: continuous corners, layered soft depth in light mode, a
 * whisper-light hairline edge and a faint material sheen in dark mode.
 */
export function Card(props: CardProps) {
  const {
    children,
    padded = true,
    tone = "default",
    variant = "flat",
    elevated = true,
    radius: radiusProp,
    style,
    accessibilityLabel,
    accessibilityHint,
  } = props;
  const { colors, spacing, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const r = radiusProp ?? radius.card;

  const isDefault = tone === "default";
  const isBrand = variant === "brand";
  const isMuted = variant === "muted";
  const isOutline = variant === "outline";

  const bg = isBrand
    ? colors.primary
    : isOutline
    ? "transparent"
    : isMuted
    ? colors.surfaceMuted
    : isDefault
    ? colors.surface
    : tonePalette(tone, colors).bg;

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: r,
    borderCurve: "continuous",
    padding: padded ? spacing.lg : 0,
    borderWidth: isOutline ? 1.5 : isDefault || isMuted ? StyleSheet.hairlineWidth : 0,
    borderStyle: isOutline ? "dashed" : "solid",
    borderColor: isOutline ? colors.borderStrong : isDark ? colors.borderStrong : colors.hairline,
    overflow: "hidden",
  };

  // Shadows are clipped by overflow:hidden on iOS, so put them on the
  // outer (animated) wrapper via the style prop order below.
  const lift: ViewStyle | null =
    !elevated || isMuted || isOutline
      ? null
      : isBrand
      ? shadow.primary
      : isDark
      ? null
      : variant === "floating"
      ? shadow.lg
      : variant === "elevated"
      ? shadow.md
      : shadow.card;

  const sheen = isBrand ? (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  ) : isDark && !isOutline ? (
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(255,255,255,0.045)", "rgba(255,255,255,0)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  ) : null;

  if (props.onPress) {
    return (
      <Pressable
        onPress={props.onPress}
        haptic={props.haptic ?? "light"}
        disabled={props.disabled}
        pressedScale={0.98}
        pressedOpacity={0.96}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[containerStyle, style]}
        wrapperStyle={lift ? [lift, { borderRadius: r }] : undefined}
      >
        {sheen}
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[lift, { borderRadius: r }, extractOuter(style)]}>
      <View style={[containerStyle, stripOuter(style)]} accessibilityLabel={accessibilityLabel}>
        {sheen}
        {children}
      </View>
    </View>
  );
}

// Margins / flex sizing belong on the shadow wrapper so layout is unchanged.
const OUTER_KEYS = [
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
  "marginHorizontal", "marginVertical", "flex", "flexGrow", "flexShrink",
  "flexBasis", "alignSelf", "width", "minWidth", "maxWidth", "position",
  "top", "left", "right", "bottom", "zIndex",
] as const;

function extractOuter(style: StyleProp<ViewStyle>): ViewStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of OUTER_KEYS) if (flat[k] != null) out[k] = flat[k];
  return out as ViewStyle;
}

function stripOuter(style: StyleProp<ViewStyle>): ViewStyle {
  const flat = { ...((StyleSheet.flatten(style) ?? {}) as Record<string, unknown>) };
  for (const k of OUTER_KEYS) {
    if (k === "flex" || k === "flexGrow") {
      // Keep inner filling the wrapper when the card is flex-sized.
      if (flat[k] != null) flat[k] = 1;
      continue;
    }
    if (k === "width" || k === "minWidth" || k === "maxWidth" || k === "alignSelf") {
      delete flat[k];
      continue;
    }
    delete flat[k];
  }
  return flat as ViewStyle;
}

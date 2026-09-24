import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";
import { Pressable } from "./Pressable";

export type CardTone = "default" | Tone;

type CommonProps = {
  children: React.ReactNode;
  padded?: boolean;
  tone?: CardTone;
  elevated?: boolean;
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
 * Inset-grouped iOS card: continuous corners, a whisper of shadow in light
 * mode, and a hairline edge that keeps it crisp on the grouped background
 * (and carries the elevation on its own in dark mode).
 */
export function Card(props: CardProps) {
  const {
    children,
    padded = true,
    tone = "default",
    elevated = true,
    style,
    accessibilityLabel,
    accessibilityHint,
  } = props;
  const { colors, spacing, radius, shadow, scheme } = useTheme();

  const isDefault = tone === "default";
  const bg = isDefault ? colors.surface : tonePalette(tone, colors).bg;

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: padded ? spacing.lg : 0,
    borderWidth: isDefault ? StyleSheet.hairlineWidth : 0,
    borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
    overflow: "hidden",
  };

  // Shadows are clipped by overflow:hidden on iOS, so put them on the
  // outer (animated) wrapper via the style prop order below.
  const lift = elevated && scheme !== "dark" ? shadow.sm : null;

  if (props.onPress) {
    return (
      <Pressable
        onPress={props.onPress}
        haptic={props.haptic ?? "light"}
        disabled={props.disabled}
        pressedScale={0.98}
        pressedOpacity={0.94}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[containerStyle, style]}
        wrapperStyle={lift}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[lift, { borderRadius: radius.card }, extractOuter(style)]}>
      <View style={[containerStyle, stripOuter(style)]} accessibilityLabel={accessibilityLabel}>
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

import React from "react";
import { Text as RNText, type TextProps } from "react-native";
import { resolveOutfitTextStyle } from "@/lib/fonts";
import { useTheme } from "@/theme/ThemeProvider";

const SIZE_TO_FONT: Record<string, number> = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  "2xl": 28,
};

export type AppTextWeight =
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "normal"
  | "bold";

export type AppTextSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type AppTextColor =
  | "muted"
  | "subtle"
  | "primary"
  | "accent"
  | "danger"
  | "text";

export type AppTextVariant =
  | "display"
  | "title"
  | "heading"
  | "body"
  | "label"
  | "caption"
  | "overline";

export interface AppTextProps extends TextProps {
  weight?: AppTextWeight;
  size?: AppTextSize;
  color?: AppTextColor;
  variant?: AppTextVariant;
}

/**
 * Text that always resolves to a Plus Jakarta Sans font file (never system
 * Roboto on Android). Theme-aware: defaults to `colors.text` so copy stays
 * legible in dark mode, and maps semantic `color` names to theme tokens.
 */
export function AppText(props: AppTextProps) {
  const { style, weight, size, color, variant, ...rest } = props;
  const { colors, typography } = useTheme();

  const colorMap: Record<AppTextColor, string> = {
    text: colors.text,
    muted: colors.textMuted,
    subtle: colors.textSubtle,
    primary: colors.primary,
    accent: colors.accent,
    danger: colors.danger,
  };
  const variantStyle =
    variant === "display"
      ? typography.display.sm
      : variant === "title" || variant === "heading"
      ? typography.title.md
      : variant === "label"
      ? typography.label.md
      : variant === "caption"
      ? typography.caption
      : variant === "overline"
      ? typography.overline
      : variant === "body"
      ? typography.body.md
      : null;

  const extra: Record<string, unknown> = { color: colors.text };
  if (variantStyle) Object.assign(extra, variantStyle);
  // An explicit weight must win over the variant's font file.
  if (weight) {
    extra.fontWeight = weight;
    delete extra.fontFamily;
  }
  if (size) extra.fontSize = SIZE_TO_FONT[size];
  if (color) extra.color = colorMap[color] ?? colors.text;
  return (
    <RNText
      {...rest}
      style={resolveOutfitTextStyle([
        extra,
        style as Record<string, unknown>,
      ])}
    />
  );
}

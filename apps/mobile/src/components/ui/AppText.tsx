import React from "react";
import { Text as RNText, type TextProps } from "react-native";
import { resolveOutfitTextStyle } from "@/lib/fonts";

const SIZE_TO_FONT: Record<string, number> = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  "2xl": 28,
};

const COLOR_TO_HEX: Record<string, string> = {
  text: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",
  primary: "#2563EB",
  accent: "#10B981",
  danger: "#EF4444",
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

export interface AppTextProps extends TextProps {
  weight?: AppTextWeight;
  size?: AppTextSize;
  color?: AppTextColor;
}

/**
 * Text that always resolves to an Outfit font file (never system Roboto on
 * Android). Accepts semantic props `weight`, `size`, `color` mapped to
 * numeric/hex values so screens can stay terse.
 */
export function AppText(props: AppTextProps) {
  const { style, weight, size, color, ...rest } = props;
  const extra: Record<string, unknown> = {};
  if (weight) extra.fontWeight = weight;
  if (size) extra.fontSize = SIZE_TO_FONT[size];
  if (color) extra.color = COLOR_TO_HEX[color];
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
// @ts-nocheck
import { StyleSheet, type StyleProp, type TextStyle } from "react-native";

/** PostScript names for Plus Jakarta Sans font. */
export const JAKARTA = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

export const OUTFIT = JAKARTA;
export const GEIST = JAKARTA;
export const SORA = JAKARTA;
export const URBANIST = JAKARTA;

const WEIGHT_TO_JAKARTA: Record<string, string> = {
  normal: JAKARTA.regular,
  "400": JAKARTA.regular,
  "500": JAKARTA.medium,
  "600": JAKARTA.semibold,
  "700": JAKARTA.bold,
  bold: JAKARTA.bold,
  "800": JAKARTA.extrabold,
  "900": JAKARTA.extrabold,
};

/**
 * Maps fontWeight → Plus Jakarta Sans file name and drops fontWeight.
 * Android ignores fontWeight for custom fonts and falls back to Roboto.
 */
export function resolveJakartaTextStyle(
  style: StyleProp<TextStyle> | undefined
): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style);
  if (!flat) {
    return { fontFamily: JAKARTA.regular };
  }

  if (
    flat.fontFamily &&
    (String(flat.fontFamily).startsWith("PlusJakartaSans") ||
      String(flat.fontFamily).startsWith("Sora") ||
      String(flat.fontFamily).startsWith("Urbanist") ||
      String(flat.fontFamily).startsWith("Outfit") ||
      String(flat.fontFamily).startsWith("Geist"))
  ) {
    const { fontWeight: _drop, ...rest } = flat;
    return rest;
  }

  const weightKey =
    flat.fontWeight != null ? String(flat.fontWeight) : undefined;
  const fontFamily =
    flat.fontFamily ??
    (weightKey ? WEIGHT_TO_JAKARTA[weightKey] : undefined) ??
    JAKARTA.regular;

  const { fontWeight: _drop, ...rest } = flat;
  return { ...rest, fontFamily };
}

export const resolveOutfitTextStyle = resolveJakartaTextStyle;
export const resolveGeistTextStyle = resolveJakartaTextStyle;
export const resolveSoraTextStyle = resolveJakartaTextStyle;
export const resolveUrbanistTextStyle = resolveJakartaTextStyle;


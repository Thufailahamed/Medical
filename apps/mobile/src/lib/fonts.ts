// @ts-nocheck
import { Text, TextInput, StyleSheet, type StyleProp, type TextStyle } from "react-native";

/** PostScript names from @expo-google-fonts/outfit (must match theme.ts). */
export const OUTFIT = {
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
  extrabold: "Outfit_800ExtraBold",
} as const;

const WEIGHT_TO_OUTFIT: Record<string, string> = {
  normal: OUTFIT.regular,
  "400": OUTFIT.regular,
  "500": OUTFIT.medium,
  "600": OUTFIT.semibold,
  "700": OUTFIT.bold,
  bold: OUTFIT.bold,
  "800": OUTFIT.extrabold,
  "900": OUTFIT.extrabold,
};

/**
 * Maps fontWeight → Outfit file name and drops fontWeight.
 * Android ignores fontWeight for custom fonts and falls back to Roboto.
 */
export function resolveOutfitTextStyle(
  style: StyleProp<TextStyle> | undefined
): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style);
  if (!flat) {
    return { fontFamily: OUTFIT.regular };
  }

  if (flat.fontFamily && String(flat.fontFamily).startsWith("Outfit_")) {
    const { fontWeight: _drop, ...rest } = flat;
    return rest;
  }

  const weightKey =
    flat.fontWeight != null ? String(flat.fontWeight) : undefined;
  const fontFamily =
    flat.fontFamily ??
    (weightKey ? WEIGHT_TO_OUTFIT[weightKey] : undefined) ??
    OUTFIT.regular;

  const { fontWeight: _drop, ...rest } = flat;
  return { ...rest, fontFamily };
}

/** Default Outfit on bare Text / TextInput (no style prop). */
export function applyOutfitFontDefaults() {
  Text.defaultProps = {
    ...Text.defaultProps,
    style: { fontFamily: OUTFIT.regular },
  };
  TextInput.defaultProps = {
    ...TextInput.defaultProps,
    style: { fontFamily: OUTFIT.regular },
  };
}

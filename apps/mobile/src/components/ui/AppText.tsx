import React from "react";
import { Text as RNText, type TextProps } from "react-native";
import { resolveOutfitTextStyle } from "@/lib/fonts";

/**
 * Text that always resolves to an Outfit font file (never system Roboto on Android).
 */
export function AppText({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={resolveOutfitTextStyle(style)} />;
}

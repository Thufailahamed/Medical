import "react";
import type { TextProps } from "react-native";

/**
 * AppText props extension used across screens. The component reads
 * `weight`/`size`/`color` and translates them into fontWeight/fontSize/color
 * via `resolveOutfitTextStyle` at runtime — see `lib/fonts.ts`.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicAttributes {
      weight?: "400" | "500" | "600" | "700" | "800" | "900" | "normal" | "bold";
      size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
      color?: "muted" | "subtle" | "primary" | "accent" | "danger" | "text";
    }
  }
}

declare module "@/components/ui/AppText" {
  export interface AppTextProps extends TextProps {
    weight?: "400" | "500" | "600" | "700" | "800" | "900" | "normal" | "bold";
    size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
    color?: "muted" | "subtle" | "primary" | "accent" | "danger" | "text";
  }
}
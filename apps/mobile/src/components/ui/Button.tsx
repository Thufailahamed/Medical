import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  StyleSheet as RNStyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useTheme } from "@/theme/ThemeProvider";
import { Pressable } from "./Pressable";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: "none" | "light" | "medium" | "heavy" | "soft";
  hapticOnPress?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = true,
  style,
  haptic = "light",
  hapticOnPress = false,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { colors, spacing, radius, typography } = useTheme();

  const sizeMap = {
    sm: { height: 40, px: spacing.md, font: typography.label.md },
    md: { height: 48, px: spacing.lg, font: typography.title.sm },
    lg: { height: 56, px: spacing.xl, font: typography.title.md },
  } as const;
  const s = sizeMap[size];

  // High-visibility Liquid Glass parameters
  let textColor = colors.primary;
  let glassTintColors = ["rgba(255, 255, 255, 0.8)", "rgba(248, 250, 252, 0.4)", "rgba(241, 245, 249, 0.2)"];
  let outerBorderColor = "rgba(255, 255, 255, 0.95)";
  let innerBorderColor = "rgba(255, 255, 255, 0.65)";
  let glowColor = "rgba(0, 0, 0, 0.1)";

  if (variant === "primary") {
    textColor = "#1E3B8B"; // High contrast Brand Blue text
    // Sky-blue crystal glass tint (higher visibility, beautiful refraction)
    glassTintColors = ["rgba(240, 249, 255, 0.8)", "rgba(224, 242, 254, 0.4)", "rgba(186, 230, 253, 0.2)"];
    outerBorderColor = "rgba(255, 255, 255, 0.98)";
    innerBorderColor = "rgba(255, 255, 255, 0.75)";
    glowColor = "#0284C7"; // Cyan-blue glowing drop shadow
  } else if (variant === "secondary") {
    textColor = "#0F766E"; // High contrast Teal text
    // Mint-teal crystal glass tint
    glassTintColors = ["rgba(240, 253, 250, 0.8)", "rgba(204, 251, 241, 0.4)", "rgba(153, 246, 228, 0.2)"];
    outerBorderColor = "rgba(255, 255, 255, 0.95)";
    innerBorderColor = "rgba(255, 255, 255, 0.7)";
    glowColor = "#0D9488"; // Teal glowing drop shadow
  } else if (variant === "danger") {
    textColor = "#DC2626"; // Red text
    // Rose-red crystal glass tint
    glassTintColors = ["rgba(254, 242, 242, 0.8)", "rgba(254, 226, 226, 0.4)", "rgba(252, 165, 165, 0.2)"];
    outerBorderColor = "rgba(255, 255, 255, 0.95)";
    innerBorderColor = "rgba(255, 255, 255, 0.7)";
    glowColor = "#EF4444"; // Red glowing drop shadow
  } else if (variant === "outline") {
    textColor = colors.primary;
    glassTintColors = ["rgba(255, 255, 255, 0.85)", "rgba(248, 250, 252, 0.45)", "rgba(241, 245, 249, 0.25)"];
    outerBorderColor = "rgba(255, 255, 255, 0.85)";
    innerBorderColor = "rgba(255, 255, 255, 0.55)";
    glowColor = "rgba(0, 0, 0, 0.08)";
  }

  const isDisabled = disabled || loading;
  const iconSize = size === "sm" ? 16 : size === "lg" ? 22 : 18;

  const isGlass = variant !== "ghost";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      haptic={isDisabled ? "none" : haptic}
      hapticOnPress={hapticOnPress}
      pressedScale={0.98}
      pressedOpacity={0.92}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={[
        {
          minHeight: s.height,
          paddingHorizontal: s.px,
          borderColor: outerBorderColor,
          borderWidth: variant === "ghost" ? 0 : 1.75, // Slightly thicker border for high definition
          borderRadius: radius.full,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: isDisabled ? 0.55 : 1,
          overflow: "hidden", // Clips the blur and gradients to pill shape

          // Premium glowing glass outer shadow
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: variant === "ghost" ? 0 : 0.16,
          shadowRadius: 10.0,
          elevation: 4,
        },
        style,
      ]}
    >
      {/* 1. Backdrop Blur View for Translucent Glass */}
      {isGlass && (
        <BlurView
          intensity={75} // Higher intensity for more frosted premium look
          tint="light"
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* 2. Glass Base Color Overlay */}
      {isGlass && (
        <LinearGradient
          colors={glassTintColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* 3. Refracting Inner Ring Border */}
      {isGlass && (
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            margin: 1.5,
            borderWidth: 1.25,
            borderColor: innerBorderColor,
            borderRadius: radius.full,
          }}
        />
      )}

      {/* 4. Glossy Top-Half Highlight/Sheen */}
      {isGlass && (
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.35)", "rgba(255, 255, 255, 0.0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "50%",
          }}
        />
      )}

      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : Icon ? (
        <Icon size={iconSize} color={textColor} strokeWidth={2.5} />
      ) : null}
      
      <Text
        style={[
          s.font,
          {
            color: textColor,
            textAlign: "center",
            fontFamily: typography.title.sm.fontFamily,
            letterSpacing: 0.25,
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      
      {IconRight && !loading ? (
        <IconRight size={iconSize} color={textColor} strokeWidth={2.5} />
      ) : null}
    </Pressable>
  );
}

export const buttonStyles = RNStyleSheet.create({});

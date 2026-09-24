import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeProvider";
import { Pressable } from "./Pressable";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

type Props = {
  title?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: any;
  iconRight?: any;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: "none" | "light" | "medium" | "heavy" | "soft";
  hapticOnPress?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * iOS-style button family:
 *  - primary   → filled, brand gradient with a soft coloured lift
 *  - secondary → tinted (brand-soft fill, brand label)
 *  - outline   → bordered on surface
 *  - danger    → tinted destructive
 *  - ghost     → plain text button
 */
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
  ...rest
}: Props & {
  label?: string;
  compact?: boolean;
  /** Aliases accepted for compatibility with call sites. */
  leftIcon?: any;
  rightIcon?: any;
  children?: React.ReactNode;
}) {
  const { colors, spacing, radius, typography, shadow, scheme } = useTheme();

  // Children may carry the label (string) or custom content.
  const childText =
    typeof rest.children === "string" || typeof rest.children === "number"
      ? String(rest.children)
      : undefined;
  const childNode = childText === undefined ? rest.children : undefined;
  const displayTitle = title ?? rest.label ?? childText ?? "";
  if (!Icon && rest.leftIcon) Icon = rest.leftIcon;
  if (!IconRight && rest.rightIcon) IconRight = rest.rightIcon;
  const actualSize = rest.compact ? "sm" : size;
  const isFullWidth = rest.compact ? false : fullWidth;

  const sizeMap = {
    sm: { height: 38, px: spacing.md + 2, font: typography.label.md, r: 12, icon: 16 },
    md: { height: 50, px: spacing.xl, font: typography.title.sm, r: radius.button, icon: 18 },
    lg: { height: 56, px: spacing.xxl, font: typography.title.md, r: 18, icon: 20 },
  } as const;
  const s = sizeMap[actualSize];

  let textColor: string = colors.primary;
  let bg: string = "transparent";
  let borderColor: string = "transparent";
  let lift: ViewStyle | null = null;

  switch (variant) {
    case "primary":
      textColor = colors.onPrimary;
      bg = colors.primary;
      lift = scheme === "dark" ? null : shadow.primary;
      break;
    case "secondary":
      textColor = colors.primary;
      bg = colors.primarySoft;
      break;
    case "outline":
      textColor = colors.primary;
      bg = colors.surface;
      borderColor = colors.borderStrong;
      lift = shadow.xs;
      break;
    case "danger":
      textColor = colors.danger;
      bg = colors.dangerSoft;
      break;
    case "ghost":
    default:
      textColor = colors.primary;
      break;
  }

  const isDisabled = disabled || loading;
  const isPrimary = variant === "primary";

  const labelStyle: TextStyle = {
    ...s.font,
    fontFamily: typography.title.md.fontFamily,
    color: textColor,
    textAlign: "center",
  };

  const renderIcon = (I: any) =>
    React.isValidElement(I) ? I : <I size={s.icon} color={textColor} strokeWidth={2.4} />;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      haptic={isDisabled ? "none" : haptic}
      hapticOnPress={hapticOnPress}
      pressedScale={0.97}
      pressedOpacity={0.9}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? displayTitle}
      accessibilityHint={accessibilityHint}
      style={[
        {
          minHeight: s.height,
          paddingHorizontal: variant === "ghost" ? spacing.sm : s.px,
          borderRadius: s.r,
          borderCurve: "continuous",
          backgroundColor: bg,
          borderWidth: borderColor === "transparent" ? 0 : StyleSheet.hairlineWidth * 2,
          borderColor,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          alignSelf: isFullWidth ? "stretch" : "auto",
          opacity: isDisabled ? 0.45 : 1,
        },
        !isDisabled && lift,
        style,
      ]}
    >
      {isPrimary ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: s.r, borderCurve: "continuous", overflow: "hidden" }]}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Top sheen — the subtle lit edge on iOS filled buttons */}
          <LinearGradient
            colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 0.6 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : Icon ? (
        renderIcon(Icon)
      ) : null}

      {displayTitle ? (
        <Text style={labelStyle} numberOfLines={1}>
          {displayTitle}
        </Text>
      ) : null}

      {!displayTitle && childNode && !loading ? childNode : null}

      {IconRight && !loading ? renderIcon(IconRight) : null}
    </Pressable>
  );
}

export const buttonStyles = StyleSheet.create({});

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
 * Capsule button family with a soft material sheen and depth:
 *  - primary   → filled brand gradient, coloured lift; a trailing icon sits
 *                in its own round glass well (native-app CTA)
 *  - secondary → tinted (brand-soft fill, brand label)
 *  - outline   → paper surface with hairline edge + soft lift
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
    sm: { height: 38, px: spacing.lg, font: typography.label.md, r: radius.pill, icon: 16 },
    md: { height: 52, px: spacing.xl, font: typography.title.sm, r: radius.pill, icon: 18 },
    lg: { height: 58, px: spacing.xxl, font: typography.title.md, r: radius.pill, icon: 20 },
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
      borderColor = scheme === "dark" ? colors.borderStrong : colors.hairline;
      lift = scheme === "dark" ? null : shadow.sm;
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
  const wellSize = s.height - 12;
  const well = isPrimary && !!IconRight && !React.isValidElement(IconRight) && actualSize !== "sm";

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
          paddingRight: well ? 6 : undefined,
          borderRadius: s.r,
          borderCurve: "continuous",
          backgroundColor: bg,
          borderWidth: borderColor === "transparent" ? 0 : StyleSheet.hairlineWidth * 2,
          borderColor,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: well && isFullWidth ? "space-between" : "center",
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
          {/* Top sheen — the subtle lit edge on filled capsules */}
          <LinearGradient
            colors={["rgba(255,255,255,0.24)", "rgba(255,255,255,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.75 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      {well && isFullWidth && !loading ? <View style={{ width: wellSize }} /> : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 }}>
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

        {IconRight && !loading && !well ? renderIcon(IconRight) : null}
      </View>

      {well && !loading ? (
        <View
          style={{
            width: wellSize,
            height: wellSize,
            borderRadius: wellSize / 2,
            backgroundColor: "rgba(255,255,255,0.22)",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconRight size={s.icon} color={textColor} strokeWidth={2.4} />
        </View>
      ) : null}
    </Pressable>
  );
}

export const buttonStyles = StyleSheet.create({});

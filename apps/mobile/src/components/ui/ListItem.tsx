import React from "react";
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { Pressable } from "./Pressable";
import { Pill, type PillTone } from "./Pill";

export type ListItemVariant = "default" | "media" | "contact" | "timeline";

type Props = {
  icon?: LucideIcon;
  /** Legacy overrides; prefer `iconTone`. */
  iconBg?: string;
  iconFg?: string;
  iconTone?: Tone;
  variant?: ListItemVariant;
  title: string;
  subtitle?: string;
  subtitleMaxLines?: number;
  trailing?: React.ReactNode;
  pill?: { label: string; tone?: PillTone };
  mediaSlot?: React.ReactNode;
  /** Right-side accessory slot (e.g. a small action icon stack). */
  rightSlot?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function ListItem({
  icon: Icon,
  iconBg,
  iconFg,
  iconTone = "primary",
  variant = "default",
  title,
  subtitle,
  subtitleMaxLines = 2,
  trailing,
  pill,
  mediaSlot,
  rightSlot,
  onPress,
  showChevron,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = useTone(iconTone);

  const compact = variant === "timeline";
  const padV = compact ? spacing.sm : spacing.md;
  const padH = compact ? spacing.sm : spacing.lg;
  const radius_ = compact ? radius.lg : radius.xl;
  const showBorder = !compact;

  const iconBox = compact ? 36 : 44;
  const iconSize = compact ? 16 : 20;

  const content = (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: padV,
          paddingHorizontal: padH,
          backgroundColor: colors.surface,
          borderRadius: radius_,
          borderWidth: showBorder ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {mediaSlot ? (
        <View>{mediaSlot}</View>
      ) : Icon ? (
        <View
          style={{
            width: iconBox,
            height: iconBox,
            borderRadius: variant === "contact" ? 999 : radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBg ?? palette.bg,
          }}
        >
          <Icon
            size={iconSize}
            color={iconFg ?? palette.fg}
            strokeWidth={2.25}
          />
        </View>
      ) : null}

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, flexShrink: 1 },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {pill ? (
            <Pill
              label={pill.label}
              tone={pill.tone ?? "neutral"}
              size="sm"
            />
          ) : null}
        </View>
        {subtitle ? (
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted },
            ]}
            numberOfLines={subtitleMaxLines}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightSlot ? <View>{rightSlot}</View> : null}
      {trailing}
      {showChevron && onPress && !rightSlot ? (
        <ChevronRight
          size={18}
          color={colors.textSubtle}
          strokeWidth={2.25}
        />
      ) : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={onPress}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={{ borderRadius: radius_ }}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({});

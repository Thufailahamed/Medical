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
  bordered?: boolean;
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
  bordered,
}: Props) {
  const { colors, spacing, radius, typography, shadow, scheme } = useTheme();
  const palette = useTone(iconTone);

  const compact = variant === "timeline";
  const padV = compact ? spacing.sm : spacing.md;
  const padH = compact ? spacing.sm : spacing.lg;
  const showBorder = bordered !== undefined ? bordered : !compact;
  const radius_ = showBorder ? (compact ? radius.lg : radius.xl) : 0;

  // Rows grouped inside a Card (bordered={false}) get iOS Settings-style
  // solid tiles with a white glyph; standalone rows keep soft tinted tiles.
  const settingsTile = !showBorder && !compact && variant !== "contact";
  const iconBox = compact ? 34 : settingsTile ? 32 : 40;
  const iconSize = compact ? 16 : 19;

  const content = (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: compact ? padV : spacing.md + 2,
          paddingHorizontal: padH,
          minHeight: compact ? undefined : 64,
          backgroundColor: showBorder ? colors.surface : "transparent",
          borderRadius: radius_,
          borderCurve: "continuous",
          borderWidth: showBorder ? StyleSheet.hairlineWidth : 0,
          borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
          opacity: disabled ? 0.5 : 1,
        },
        showBorder && scheme !== "dark" ? shadow.xs : null,
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
            borderRadius: variant === "contact" ? 999 : compact || settingsTile ? 9 : 12,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBg ?? (settingsTile ? palette.bgStrong : palette.bg),
          }}
        >
          <Icon
            size={settingsTile ? iconSize - 1 : iconSize}
            color={iconFg ?? (settingsTile ? palette.onBgStrong : palette.fg)}
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
              { color: colors.text, flexShrink: 1, fontFamily: typography.title.md.fontFamily },
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
          strokeWidth={2.5}
          style={{ marginRight: -4 }}
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

import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Check, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import { Pressable } from "./Pressable";

export type ChipTone =
  | "neutral"
  | "primary"
  | "accent"
  | "accent2"
  | "danger"
  | "warning"
  | "success"
  | "info";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: ChipTone;
  icon?: LucideIcon;
  trailingIcon?: "check" | "x";
  size?: "sm" | "md";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Chip({
  label,
  selected = false,
  onPress,
  tone = "neutral",
  icon: Icon,
  trailingIcon,
  size = "md",
  disabled = false,
  style,
  accessibilityLabel,
}: ChipProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = useTone(tone);
  const { fg: selFg, bgStrong: selBg } = useTone(
    tone === "neutral" ? "primary" : tone
  );

  const bg = selected ? selBg : palette.bg;
  const fg = selected ? selFg : palette.fg;
  const isNeutral = tone === "neutral" && !selected;
  const borderColor = isNeutral ? colors.border : "transparent";
  const borderWidth = isNeutral ? 1 : 0;

  const isMd = size === "md";
  const height = isMd ? 36 : 30;
  const padH = isMd ? spacing.md : spacing.sm + 2;
  const font = isMd ? typography.label.md : typography.caption;
  const iconSize = isMd ? 14 : 12;

  const inner = (
    <View
      style={[
        {
          minHeight: height,
          paddingHorizontal: padH,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.xs,
          backgroundColor: bg,
          borderColor,
          borderWidth,
          borderRadius: radius.full,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {Icon ? (
        <Icon size={iconSize} color={fg} strokeWidth={2.5} />
      ) : null}
      <Text
        style={[
          font,
          { color: fg, textAlign: "center" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailingIcon === "check" && selected ? (
        <Check size={iconSize} color={fg} strokeWidth={3} />
      ) : null}
      {trailingIcon === "x" && selected ? (
        <X size={iconSize} color={fg} strokeWidth={3} />
      ) : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={onPress}
        haptic="light"
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={accessibilityLabel ?? label}
        hitSlop={6}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}

// ---- ChipGroup ----

type ChipGroupProps = {
  options: { label: string; value: string; icon?: LucideIcon; tone?: ChipTone }[];
  value: string | string[];
  onChange: (v: any) => void;
  multiple?: boolean;
  scrollable?: boolean;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
};

export function ChipGroup({
  options,
  value,
  onChange,
  multiple = false,
  scrollable = false,
  size = "md",
  style,
}: ChipGroupProps) {
  const { spacing } = useTheme();
  const selectedSet = new Set(Array.isArray(value) ? value : [value]);

  const Row = (
    <View
      style={[
        { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
        style,
      ]}
    >
      {options.map((opt) => {
        const isSelected = selectedSet.has(opt.value);
        const handle = () => {
          if (multiple) {
            const next = new Set(selectedSet);
            if (next.has(opt.value)) next.delete(opt.value);
            else next.add(opt.value);
            onChange(Array.from(next));
          } else {
            onChange(opt.value);
          }
        };
        return (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={isSelected}
            onPress={handle}
            tone={opt.tone}
            icon={opt.icon}
            size={size}
          />
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "nowrap" }}>{Row}</View>
    );
  }
  return Row;
}

const styles = StyleSheet.create({});

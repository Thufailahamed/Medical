import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";
import { Pressable } from "./Pressable";

export type CardTone = "default" | Tone;

type CommonProps = {
  children: React.ReactNode;
  padded?: boolean;
  tone?: CardTone;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

type StaticProps = CommonProps & { onPress?: undefined };
type PressableProps = CommonProps & {
  onPress: () => void;
  haptic?: "none" | "light" | "medium" | "heavy" | "soft";
  disabled?: boolean;
};

export type CardProps = StaticProps | PressableProps;

export function Card(props: CardProps) {
  const {
    children,
    padded = true,
    tone = "default",
    elevated = true,
    style,
    accessibilityLabel,
    accessibilityHint,
  } = props;
  const { colors, spacing, radius, shadow } = useTheme();

  const isDefault = tone === "default";
  const palette = tone === "default" ? { bg: colors.surface } : tonePalette(tone, colors);
  const bg = palette.bg;

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.xl,
    padding: padded ? spacing.lg : 0,
    borderWidth: isDefault ? 1 : 0,
    borderColor: colors.border,
    overflow: "hidden",
  };

  if (props.onPress) {
    return (
      <Pressable
        onPress={props.onPress}
        haptic={props.haptic ?? "light"}
        disabled={props.disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[containerStyle, elevated ? shadow.sm : null, style]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      style={[containerStyle, elevated ? shadow.sm : null, style]}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({});

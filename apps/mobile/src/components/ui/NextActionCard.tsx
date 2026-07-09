import React from "react";
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { Pressable } from "./Pressable";

type Props = {
  subject: string;
  verb?: string;
  context?: string;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  iconTone?: Tone;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function NextActionCard({
  subject,
  verb,
  context,
  meta,
  icon: Icon,
  iconTone = "primary",
  trailing,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const { bg, fg, bgStrong } = useTone(iconTone);

  const inner = (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          gap: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {Icon ? (
        <View
          style={[
            styles.iconDisc,
            {
              borderRadius: radius.lg,
              overflow: "hidden",
            },
          ]}
        >
          <LinearGradient
            colors={[bgStrong, fg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <Icon size={26} color={colors.onPrimary} strokeWidth={2.25} />
          </LinearGradient>
        </View>
      ) : null}

      <View style={styles.text}>
        <Text
          style={[
            typography.title.md,
            { color: colors.text },
          ]}
          numberOfLines={1}
        >
          {subject}
        </Text>
        {verb ? (
          <Text
            style={[
              typography.body.md,
              { color: colors.text, marginTop: 1 },
            ]}
            numberOfLines={1}
          >
            {verb}
          </Text>
        ) : null}
        {context ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {context}
          </Text>
        ) : null}
        {meta ? (
          <View style={{ marginTop: 6, flexDirection: "row", gap: 6 }}>
            {meta}
          </View>
        ) : null}
      </View>

      {trailing ?? (onPress ? (
        <View
          style={[
            styles.chev,
            { backgroundColor: colors.surfaceMuted, borderRadius: 999 },
          ]}
        >
          <ChevronRight size={18} color={colors.textMuted} strokeWidth={2.5} />
        </View>
      ) : null)}
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? subject}
      accessibilityHint={accessibilityHint}
      style={{ borderRadius: 24 }}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconDisc: {
    width: 56,
    height: 56,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  chev: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});

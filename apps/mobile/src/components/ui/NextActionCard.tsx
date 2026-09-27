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
  const { colors, spacing, radius, typography, shadow, scheme } = useTheme();
  const { fg, bgStrong } = useTone(iconTone);
  const isDark = scheme === "dark";

  const inner = (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderCurve: "continuous",
          padding: spacing.md + 2,
          gap: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? colors.borderStrong : colors.hairline,
          opacity: disabled ? 0.5 : 1,
        },
        isDark ? null : shadow.card,
        style,
      ]}
    >
      {Icon ? (
        <View
          style={[
            styles.iconDisc,
            { borderRadius: 18, borderCurve: "continuous" },
            isDark ? null : { ...shadow.primary, shadowColor: bgStrong, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
          ]}
        >
          <View style={[StyleSheet.absoluteFill, { borderRadius: 18, borderCurve: "continuous", overflow: "hidden" }]}>
            <LinearGradient
              colors={[bgStrong, fg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.8 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <Icon size={26} color={colors.onPrimary} strokeWidth={2.1} />
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
            { backgroundColor: colors.well, borderRadius: 999 },
          ]}
        >
          <ChevronRight size={17} color={colors.textMuted} strokeWidth={2.5} />
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
    alignItems: "center",
    justifyContent: "center",
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

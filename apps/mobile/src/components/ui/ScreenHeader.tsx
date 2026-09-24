import React from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Pressable } from "./Pressable";

type Props = {
  title?: string;
  subtitle?: string;
  kicker?: string;
  greeting?: string;
  back?: boolean | (() => void);
  onBack?: () => void;
  right?: React.ReactNode;
  left?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "default" | "compact" | "hero";
  style?: StyleProp<ViewStyle>;
  onPressTitle?: () => void;
};

/**
 * iOS navigation header. `hero` renders a Large Title; `default` a bold
 * inline title; `compact` a tighter bar. The back affordance is a round
 * frosted chevron like Apple's own apps (Health, Fitness, Wallet).
 */
export function ScreenHeader({
  title,
  subtitle,
  kicker,
  greeting,
  back,
  onBack,
  right,
  left,
  icon,
  variant = "default",
  style,
  onPressTitle,
}: Props) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const router = useRouter();

  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
    } else if (typeof back === "function") {
      back();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)");
    }
  };

  const showBack = back !== false && (!!back || !!onBack || router.canGoBack());
  const showLeft = !!left || !!icon;
  const leftContent = left ?? icon;

  const isHero = variant === "hero";
  const variantSpacing = isHero
    ? { paddingTop: spacing.md, paddingBottom: spacing.lg }
    : variant === "compact"
    ? { paddingTop: spacing.sm, paddingBottom: spacing.sm }
    : { paddingTop: spacing.md, paddingBottom: spacing.md };

  const titleNode = title ? (
    <Text
      style={[
        isHero ? typography.display.lg : typography.display.sm,
        { color: colors.text },
      ]}
      numberOfLines={2}
      onPress={onPressTitle}
      accessibilityRole="header"
    >
      {title}
    </Text>
  ) : null;

  return (
    <View
      style={[
        styles.row,
        {
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.bg,
          ...variantSpacing,
        },
        style,
      ]}
    >
      {showBack ? (
        <Pressable
          onPress={handleBack}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          pressedScale={0.92}
          style={[
            styles.iconButton,
            {
              backgroundColor: colors.surface,
              borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
              borderWidth: StyleSheet.hairlineWidth,
            },
            scheme === "dark" ? null : shadow.xs,
          ]}
        >
          <ChevronLeft size={22} color={colors.text} strokeWidth={2.5} style={{ marginLeft: -2 }} />
        </Pressable>
      ) : showLeft ? (
        <View style={[styles.iconButton, { backgroundColor: "transparent" }]}>{leftContent}</View>
      ) : isHero ? null : (
        <View style={styles.iconButton} />
      )}

      <View style={styles.center}>
        {kicker ? (
          <Text
            style={[
              typography.overline,
              { color: colors.primary, textTransform: "uppercase", marginBottom: 2 },
            ]}
          >
            {kicker}
          </Text>
        ) : null}
        {greeting ? (
          <Text style={[typography.body.sm, { color: colors.textMuted, marginBottom: 2 }]}>
            {greeting}
          </Text>
        ) : null}
        {titleNode}
        {subtitle ? (
          <Text
            style={[typography.body.sm, { color: colors.textMuted, marginTop: 3 }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightSlot}>
        {right ?? (isHero ? null : <View style={styles.iconButton} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  rightSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});

import React from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Pressable } from "./Pressable";

type Props = {
  title?: string;
  subtitle?: string;
  greeting?: string;
  back?: boolean | (() => void);
  onBack?: () => void;
  right?: React.ReactNode;
  left?: React.ReactNode;
  variant?: "default" | "compact" | "hero";
  style?: StyleProp<ViewStyle>;
  onPressTitle?: () => void;
};

export function ScreenHeader({
  title,
  subtitle,
  greeting,
  back,
  onBack,
  right,
  left,
  variant = "default",
  style,
}: Props) {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();

  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else if (typeof back === "function") back();
    else router.back();
  };

  const showBack = !!back;
  const showLeft = !!left;

  const variantSpacing =
    variant === "hero"
      ? { paddingTop: spacing.lg, paddingBottom: spacing.lg }
      : variant === "compact"
      ? { paddingTop: spacing.sm, paddingBottom: spacing.sm }
      : { paddingTop: spacing.lg, paddingBottom: spacing.md };

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
          style={[
            styles.iconButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: 999,
            },
          ]}
        >
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.25} />
        </Pressable>
      ) : showLeft ? (
        <View style={[styles.iconButton, { backgroundColor: "transparent" }]}>{left}</View>
      ) : (
        <View style={styles.iconButton} />
      )}

      <View style={styles.center}>
        {greeting ? (
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginBottom: 2 },
            ]}
          >
            {greeting}
          </Text>
        ) : null}
        {title ? (
          <Text
            style={[
              variant === "hero" ? typography.display.md : typography.title.lg,
              { color: colors.text },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightSlot}>
        {right ?? <View style={styles.iconButton} />}
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
    width: 44,
    height: 44,
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

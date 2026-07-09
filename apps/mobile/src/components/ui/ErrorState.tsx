import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { AlertTriangle, RefreshCw, type LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "./Button";

type Props = {
  icon?: LucideIcon;
  title: string;
  message?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "danger" | "warning" | "neutral";
  style?: StyleProp<ViewStyle>;
};

/**
 * Error state shown when a fetch fails (network, 5xx, parse). Always
 * renders a retry CTA — silent failure is the worst UX for healthcare.
 */
export function ErrorState({
  icon: Icon = AlertTriangle,
  title,
  message,
  body,
  actionLabel,
  onAction,
  tone = "danger",
  style,
}: Props) {
  const { colors, spacing, typography, radius } = useTheme();
  const bg = tone === "warning" ? colors.warningSoft : colors.dangerSoft;
  const fg = tone === "warning" ? colors.warning || "#FF9500" : colors.danger || "#FF3B30";
  const displayMessage = message || body;

  return (
    <View
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.xxxl,
          paddingHorizontal: spacing.xl,
          gap: spacing.lg,
        },
        style,
      ]}
      accessibilityRole="alert"
    >
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
        }}
      >
        <Icon size={40} color={fg} strokeWidth={1.5} />
      </View>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text
          style={[
            typography.title.md,
            { color: colors.text, textAlign: "center" },
          ]}
        >
          {title}
        </Text>
        {displayMessage ? (
          <Text
            style={[
              typography.body.md,
              { color: colors.textMuted, textAlign: "center" },
            ]}
          >
            {displayMessage}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant={tone === "neutral" ? "outline" : "primary"}
          fullWidth={false}
          icon={RefreshCw}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});
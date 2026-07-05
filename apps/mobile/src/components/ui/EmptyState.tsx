import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Folder, type LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import { Button } from "./Button";

type Props = {
  icon?: LucideIcon;
  title: string;
  message?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "primary" | "accent" | "accent2" | "neutral";
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon: Icon = Folder,
  title,
  message,
  body,
  actionLabel,
  onAction,
  tone = "primary",
  style,
}: Props) {
  const { colors, spacing, typography, radius } = useTheme();
  const { bg, fg } = useTone(tone);
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
      accessibilityRole="summary"
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
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});

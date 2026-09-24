import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Folder, type LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import { Button } from "./Button";
import { withOpacity } from "@/constants/theme";

type Props = {
  icon?: LucideIcon | React.ReactElement;
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

  const renderIcon = () => {
    if (React.isValidElement(Icon)) {
      return Icon;
    }
    const Component = Icon as any;
    return <Component size={34} color={fg} strokeWidth={1.75} />;
  };

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
      {/* Concentric halo: the soft layered glyph used for empty lists on iOS */}
      <View
        style={{
          width: 116,
          height: 116,
          borderRadius: 58,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withOpacity(fg, 0.06),
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 26,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: withOpacity(fg, 0.18),
          }}
        >
          {renderIcon()}
        </View>
      </View>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text
          style={[
            typography.title.lg,
            { color: colors.text, textAlign: "center" },
          ]}
        >
          {title}
        </Text>
        {displayMessage ? (
          <Text
            style={[
              typography.body.md,
              { color: colors.textMuted, textAlign: "center", maxWidth: 300 },
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
          style={{ alignSelf: "center" }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});

import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const { fg, bgStrong, onBgStrong } = useTone(tone);
  const displayMessage = message || body;

  const renderIcon = () => {
    if (React.isValidElement(Icon)) {
      return Icon;
    }
    const Component = Icon as any;
    return <Component size={28} color={onBgStrong} strokeWidth={1.9} />;
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
      {/* Concentric halo around a solid, sheened glyph disc */}
      <View
        style={{
          width: 112,
          height: 112,
          borderRadius: 56,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withOpacity(fg, 0.07),
        }}
      >
        <View
          style={{
            width: 86,
            height: 86,
            borderRadius: 43,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withOpacity(fg, 0.1),
          }}
        >
          <View
            style={[
              {
                width: 62,
                height: 62,
                borderRadius: 31,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: bgStrong,
              },
              scheme === "dark"
                ? null
                : { ...shadow.md, shadowColor: bgStrong, shadowOpacity: 0.3 },
            ]}
          >
            <View style={[StyleSheet.absoluteFill, { borderRadius: 31, overflow: "hidden" }]} pointerEvents="none">
              <LinearGradient
                colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            {renderIcon()}
          </View>
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

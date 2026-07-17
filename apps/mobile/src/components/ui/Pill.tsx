import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import { Pressable } from "./Pressable";

export type PillTone =
  | "neutral"
  | "primary"
  | "accent"
  | "accent2"
  | "danger"
  | "warning"
  | "success"
  | "info";

type Props = {
  label?: string;
  children?: React.ReactNode;
  tone?: PillTone;
  icon?: any;
  size?: "sm" | "md";
  outlined?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Pill({ label, children, tone = "neutral", icon: Icon, size = "md", outlined, onPress, style }: Props) {
  const { spacing, radius, typography } = useTheme();
  const { fg, bg } = useTone(tone);

  const isMd = size === "md";
  const padH = isMd ? spacing.sm + 2 : spacing.sm;
  const padV = isMd ? 4 : 2;
  const font = isMd ? typography.caption : { ...typography.caption, fontSize: 10 };
  const iconSize = isMd ? 11 : 10;

  const containerStyle: ViewStyle = {
    paddingHorizontal: padH,
    paddingVertical: padV,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: outlined ? "transparent" : bg,
    borderColor: fg,
    borderWidth: outlined ? 1 : 0,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  };

  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) {
      return Icon;
    }
    const IconCmp = Icon;
    return <IconCmp size={iconSize} color={fg} strokeWidth={3} />;
  };

  const renderContent = () => {
    if (children) {
      if (React.isValidElement(children)) {
        return children;
      }
      return (
        <Text style={[font, { color: fg, fontWeight: "700" as const }]} numberOfLines={1}>
          {children}
        </Text>
      );
    }
    return (
      <Text style={[font, { color: fg, fontWeight: "700" as const }]} numberOfLines={1}>
        {label}
      </Text>
    );
  };

  const inner = (
    <>
      {renderIcon()}
      {renderContent()}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[containerStyle, style]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      style={[containerStyle, style]}
      accessibilityRole="text"
      accessibilityLabel={`${label}`}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({});

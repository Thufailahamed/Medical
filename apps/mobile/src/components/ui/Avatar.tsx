import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { withOpacity } from "@/constants/theme";

type Props = {
  name?: string;
  source?: { uri: string } | number;
  /** Convenience alias for `source={{ uri }}`. */
  uri?: string | null;
  /** Named size, or an explicit pixel size. */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | number;
  tone?: Tone;
  ring?: boolean;
};

function hashColor(name: string, colors: ReturnType<typeof useTheme>["colors"]) {
  const list = [
    colors.primary,
    colors.accent,
    colors.info,
    colors.warning,
    colors.danger,
    colors.accent2,
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return list[Math.abs(h) % list.length];
}

export function Avatar({ name, source: sourceProp, uri, size = "md", tone = "primary", ring }: Props) {
  const source = sourceProp ?? (uri ? { uri } : undefined);
  const { colors, typography } = useTheme();
  const palette = useTone(tone);

  const sizeMap = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
    "2xl": 104,
  } as const;
  const px = typeof size === "number" ? size : sizeMap[size] ?? sizeMap.md;

  const fontSize = px <= 24 ? 10 : px <= 32 ? 12 : px <= 40 ? 14 : px <= 56 ? 18 : px <= 80 ? 26 : 36;

  const initials = name
    ? name
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const colorForName = name ? hashColor(name, colors) : palette.fg;

  return (
    <View
      style={[
        {
          width: px,
          height: px,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: name ? withOpacity(colorForName, 0.14) : palette.bg,
          borderWidth: ring ? 2.5 : StyleSheet.hairlineWidth,
          borderColor: ring ? colors.surface : withOpacity(colorForName, 0.2),
          overflow: "hidden",
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={name ? `${name} avatar` : "Avatar"}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: px, height: px, borderRadius: 9999 }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={[
            typography.title.md,
            { color: colorForName, fontSize, lineHeight: fontSize + 2, fontFamily: "PlusJakartaSans_700Bold", letterSpacing: -0.2 },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({});

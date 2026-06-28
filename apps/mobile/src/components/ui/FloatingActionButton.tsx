import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { BlurView } from "expo-blur";
import type { LucideIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { Pressable } from "./Pressable";

type Props = {
  icon: LucideIcon;
  label?: string; // extended FAB text
  onPress: () => void;
  tone?: Tone;
  badge?: number;
  /** Offset above the tab bar (use on tab screens). */
  aboveTabBar?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function FloatingActionButton({
  icon: Icon,
  label,
  onPress,
  tone = "primary",
  badge,
  aboveTabBar,
  style,
  accessibilityLabel,
}: Props) {
  const { colors, spacing, layout, typography, radius } = useTheme();
  const { fg, bg } = useTone(tone);
  const insets = useSafeAreaInsets();

  const extended = !!label;
  const fabHeight = layout.fabSize;
  const fabWidth = extended ? undefined : fabHeight;
  const bottomOffset =
    insets.bottom + (aboveTabBar ? layout.tabBarHeight + spacing.sm : spacing.lg);

  const content = (
    <View style={styles.content}>
      <Icon
        size={22}
        color={tone === "primary" || tone === "danger" || tone === "accent" ? colors.onPrimary : fg}
        strokeWidth={2.4}
      />
      {label ? (
        <Text
          style={[
            typography.title.md,
            {
              color:
                tone === "primary" || tone === "danger" || tone === "accent"
                  ? colors.onPrimary
                  : colors.text,
              fontWeight: "700",
              marginLeft: spacing.sm,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
      {badge ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.danger, borderColor: colors.onDanger },
          ]}
        >
          <Text style={[typography.caption, { color: colors.onDanger, fontWeight: "700" }]}>
            {badge > 9 ? "9+" : badge}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const useGradient = tone === "primary" || tone === "danger" || tone === "accent";

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom: bottomOffset,
          right: spacing.lg,
        },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        haptic="medium"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label ?? "Floating action"}
      >
        <View
          style={[
            {
              borderRadius: extended ? radius.glass : fabHeight / 2,
              overflow: "hidden",
              minHeight: fabHeight,
              minWidth: fabHeight,
              width: fabWidth,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          {useGradient ? (
            <LinearGradient
              colors={[fg, bg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: extended ? radius.glass : fabHeight / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  paddingHorizontal: extended ? spacing.lg : 0,
                },
              ]}
            >
              {content}
            </LinearGradient>
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.surface,
                  borderRadius: extended ? radius.glass : fabHeight / 2,
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === "ios" ? 50 : 30}
                tint="default"
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    paddingHorizontal: extended ? spacing.lg : 0,
                    backgroundColor: colors.glass,
                    borderRadius: extended ? radius.glass : fabHeight / 2,
                  },
                ]}
              >
                {content}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
});

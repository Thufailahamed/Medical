import React from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import type { LucideIcon } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";

export type HeroStatus = {
  icon: LucideIcon;
  label: string;
  tone?: Tone;
};

type Props = {
  // identity
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  numeral?: string;
  numeralLabel?: string;
  numeralTrend?: "up" | "down" | "flat";
  // status row (chips)
  status?: HeroStatus[];
  // layout
  height?: number; // explicit pixel height (overrides ratio)
  heightRatio?: number; // 0..1 of viewport
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Hero({
  eyebrow,
  title,
  subtitle,
  numeral,
  numeralLabel,
  numeralTrend,
  status,
  height,
  heightRatio,
  right,
  children,
  style,
}: Props) {
  const { colors, spacing, typography, radius, layout, shadow } = useTheme();
  const { width, height: viewportHeight } = useWindowDimensions();

  const ratio = heightRatio ?? layout.heroHeightRatio;
  const resolvedHeight =
    height ?? Math.max(220, Math.min(360, viewportHeight * ratio));

  // Ambient orb floats gently to give the hero a sense of life.
  const orbDrift = useSharedValue(0);
  React.useEffect(() => {
    orbDrift.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [orbDrift]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: orbDrift.value * 18 },
      { translateY: orbDrift.value * -12 },
    ],
  }));

  const orbStyle2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: orbDrift.value * -14 },
      { translateY: orbDrift.value * 16 },
    ],
  }));

  return (
    <View
      style={[
        {
          height: resolvedHeight,
          borderBottomLeftRadius: radius.xxxl,
          borderBottomRightRadius: radius.xxxl,
          overflow: "hidden",
        },
        shadow.hero,
        style,
      ]}
      accessibilityRole="header"
    >
      <LinearGradient
        colors={[colors.primary, colors.orb, colors.orbDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ambient orbs */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: 220,
            height: 220,
            top: -60,
            left: -60,
            backgroundColor: colors.glassOnPrimary,
            borderRadius: 9999,
          },
          orbStyle,
        ]}
      >
        <BlurView
          intensity={60}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.orb,
          {
            width: 180,
            height: 180,
            bottom: -40,
            right: -30,
            backgroundColor: colors.glassOnPrimary,
            borderRadius: 9999,
          },
          orbStyle2,
        ]}
      >
        <BlurView
          intensity={80}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* content */}
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xxxl,
            paddingBottom: spacing.lg,
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            {eyebrow ? (
              <Text
                style={[
                  typography.overline,
                  {
                    color: colors.glassOnPrimarySoft,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                {eyebrow.toUpperCase()}
              </Text>
            ) : null}
          </View>
          {right ? <View style={styles.topRight}>{right}</View> : null}
        </View>

        {numeral ? (
          <View style={[styles.numeralRow, { marginTop: spacing.xs }]}>
            <Text
              style={[
                typography.display.lg,
                {
                  color: colors.onPrimary,
                  fontSize: 56,
                  lineHeight: 60,
                  letterSpacing: -1.5,
                },
              ]}
              numberOfLines={1}
            >
              {numeral}
            </Text>
            {numeralTrend ? (
              <View style={[styles.trendBadge, { backgroundColor: colors.glassOnPrimary }]}>
                <TrendArrow trend={numeralTrend} />
              </View>
            ) : null}
          </View>
        ) : null}

        {numeralLabel ? (
          <Text
            style={[
              typography.body.md,
              {
                color: colors.glassOnPrimarySoft,
                marginTop: -2,
                marginBottom: spacing.sm,
              },
            ]}
          >
            {numeralLabel}
          </Text>
        ) : null}

        {title ? (
          <Text
            style={[
              numeral ? typography.title.lg : typography.display.md,
              {
                color: colors.onPrimary,
                marginTop: numeral ? 0 : spacing.xs,
              },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
        ) : null}

        {subtitle ? (
          <Text
            style={[
              typography.body.md,
              {
                color: colors.glassOnPrimarySoft,
                marginTop: 2,
              },
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}

        {children}

        {status && status.length > 0 ? (
          <View style={[styles.statusRow, { marginTop: spacing.md, gap: spacing.sm }]}>
            {status.map((s, i) => (
              <HeroStatusChip key={i} status={s} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function HeroStatusChip({ status }: { status: HeroStatus }) {
  const { spacing, typography } = useTheme();
  const { bg, fg } = useTone(status.tone ?? "neutral");
  const Icon = status.icon;
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: fg,
        },
      ]}
    >
      <Icon size={11} color={fg} strokeWidth={2.5} />
      <Text style={[typography.caption, { color: fg, fontWeight: "700" }]} numberOfLines={1}>
        {status.label}
      </Text>
    </View>
  );
}

function TrendArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  const { colors } = useTheme();
  const { fg } = useTone("success");
  const stroke = trend === "down" ? colors.danger : trend === "flat" ? colors.textMuted : fg;
  if (trend === "up") {
    return (
      <Text style={{ color: stroke, fontSize: 14, fontWeight: "700" }}>↗</Text>
    );
  }
  if (trend === "down") {
    return (
      <Text style={{ color: stroke, fontSize: 14, fontWeight: "700" }}>↘</Text>
    );
  }
  return (
    <Text style={{ color: stroke, fontSize: 14, fontWeight: "700" }}>→</Text>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    opacity: 0.6,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  topLeft: {
    flex: 1,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  numeralRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});

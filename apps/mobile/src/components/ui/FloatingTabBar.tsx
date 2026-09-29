import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/theme/ThemeProvider";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";

const ITEM = 44;
const PAD = 6;
const GAP = 2;
const BAR_MARGIN = 16;
const ICON = 21;
const PILL_PAD_L = 11;
const PILL_PAD_R = 15;
/** Floor width for inactive icon cells — they flex to fill leftover space. */
const CELL_MIN = 40;
/** Below this much label room, the active pill renders icon-only. */
const LABEL_MIN = 40;
const RADIUS = (ITEM + PAD * 2) / 2;

/**
 * Shared screenOptions for every role's (Tabs) layout. Pair with
 * `tabBar={(p) => <IslandTabBar {...p} />}` on the navigator.
 */
export function useFloatingTabBarOptions(labelStyle?: TextStyle) {
  const { colors } = useTheme();
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.onPrimary,
    tabBarInactiveTintColor: colors.textSubtle,
    tabBarLabelStyle: labelStyle,
  };
}

/**
 * Dynamic Island–style tab bar: a floating capsule stretched edge-to-edge.
 * The focused tab morphs into a brand-gradient pill carrying its label;
 * inactive tabs flex into evenly-spaced icon cells. On narrow screens or
 * wide-script locales the pill degrades to an icon-only dot.
 */
export function IslandTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, fontFamily, motion, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const motionEnabled = useMotionEnabled();

  const focusedOptions = descriptors[state.routes[state.index].key].options;
  const hiddenBar = StyleSheet.flatten(focusedOptions.tabBarStyle as any)?.display === "none";

  const routes = state.routes.filter((r) => {
    const btn = descriptors[r.key].options.tabBarButton as any;
    return !(btn && btn({}) === null);
  });

  if (hiddenBar) return null;

  const dark = scheme === "dark";
  const count = routes.length;
  const barWidth = width - BAR_MARGIN * 2;
  // Width left for the label after capsule padding, inter-item gaps, the
  // inactive cells at their floor, and the pill's icon + padding chrome.
  const labelMax =
    barWidth -
    PAD * 2 -
    GAP * (count - 1) -
    CELL_MIN * (count - 1) -
    (PILL_PAD_L + ICON + 6 + PILL_PAD_R);
  const showLabel = labelMax >= LABEL_MIN;
  const dense = count > 5;

  const layout = motionEnabled
    ? LinearTransition.springify()
        .damping(motion.spring.snappy.damping)
        .stiffness(motion.spring.snappy.stiffness)
        .mass(motion.spring.snappy.mass)
    : undefined;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom > 0 ? insets.bottom - 4 : 14,
        paddingHorizontal: BAR_MARGIN,
      }}
    >
      <Animated.View
        layout={layout}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: GAP,
          padding: PAD,
          borderRadius: RADIUS,
          borderCurve: "continuous",
          backgroundColor: Platform.OS === "ios" ? "transparent" : dark ? "rgba(28,28,32,0.35)" : "rgba(255,255,255,0.3)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: dark ? 0.45 : 0.12,
          shadowRadius: 28,
          elevation: 12,
        }}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: RADIUS, borderCurve: "continuous", overflow: "hidden" }]}
        >
          <BlurView
            intensity={dark ? 60 : 70}
            tint={
              Platform.OS === "ios"
                ? dark
                  ? "systemUltraThinMaterialDark"
                  : "systemUltraThinMaterialLight"
                : dark
                ? "dark"
                : "light"
            }
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: dark ? "rgba(40,40,46,0.28)" : "rgba(255,255,255,0.28)" },
            ]}
          />
          <LinearGradient
            colors={
              dark
                ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0)"]
                : ["rgba(255,255,255,0.65)", "rgba(255,255,255,0)"]
            }
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: RADIUS,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.75)",
              },
            ]}
          />
        </View>
        {routes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = state.routes[state.index].key === route.key;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const showPillLabel = focused && showLabel;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              if (Platform.OS === "ios") Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              testID={options.tabBarButtonTestID}
              style={{
                flexGrow: focused ? 0 : 1,
                flexShrink: 1,
                flexBasis: focused ? undefined : CELL_MIN,
              }}
            >
              {({ pressed }) => (
                <Animated.View
                  layout={layout}
                  style={{
                    height: ITEM,
                    minWidth: focused ? ITEM : CELL_MIN,
                    borderRadius: ITEM / 2,
                    borderCurve: "continuous",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingLeft: showPillLabel ? PILL_PAD_L : 0,
                    paddingRight: showPillLabel ? PILL_PAD_R : 0,
                    overflow: "hidden",
                    backgroundColor: !focused && pressed ? colors.fill : "transparent",
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  }}
                >
                  {focused ? (
                    <Animated.View
                      entering={motionEnabled ? FadeIn.duration(180) : undefined}
                      style={StyleSheet.absoluteFill}
                    >
                      <LinearGradient
                        colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <LinearGradient
                        colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 0.9 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                  ) : null}
                  {options.tabBarIcon?.({
                    focused,
                    color: focused ? "#FFFFFF" : colors.textSubtle,
                    size: ICON,
                  }) as React.ReactNode}
                  {showPillLabel ? (
                    <Animated.Text
                      entering={motionEnabled ? FadeIn.delay(60).duration(200) : undefined}
                      exiting={motionEnabled ? FadeOut.duration(80) : undefined}
                      numberOfLines={1}
                      style={{
                        maxWidth: labelMax,
                        color: "#FFFFFF",
                        fontSize: dense ? 12.5 : 13,
                        letterSpacing: -0.1,
                        fontFamily: fontFamily.bodySemibold,
                      }}
                    >
                      {label}
                    </Animated.Text>
                  ) : null}
                </Animated.View>
              )}
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

import React from "react";
import { Platform, StyleSheet, View, type TextStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Shared screenOptions for the floating, frosted-glass iOS tab bar used by
 * every role's (Tabs) layout. Spread into `screenOptions`, then override
 * per-layout keys (e.g. `tabBarLabelStyle`) as needed.
 */
export function useFloatingTabBarOptions(labelStyle?: TextStyle) {
  const { colors, scheme, layout } = useTheme();
  const r = layout.tabBarRadius;
  const isDark = scheme === "dark";

  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textSubtle,
    tabBarItemStyle: { paddingTop: 6 },
    tabBarStyle: {
      position: "absolute" as const,
      left: 14,
      right: 14,
      bottom: Platform.OS === "ios" ? 26 : 14,
      height: 70,
      backgroundColor: "transparent",
      borderTopWidth: 0,
      paddingBottom: 8,
      paddingTop: 4,
      borderRadius: r,
      elevation: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.5 : 0.14,
      shadowRadius: 28,
    },
    tabBarBackground: () => (
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: r, borderCurve: "continuous", overflow: "hidden" },
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={isDark ? 60 : 85}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor:
                Platform.OS === "android" ? colors.surface : colors.glass,
            },
          ]}
        />
        {/* Hairline edge + lit top rim, like iOS material chrome */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: r,
              borderCurve: "continuous",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isDark ? colors.glassBorder : colors.separator,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: StyleSheet.hairlineWidth,
            left: r / 2,
            right: r / 2,
            height: 1,
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
          }}
        />
      </View>
    ),
    tabBarLabelStyle: {
      fontSize: 10,
      fontFamily: "PlusJakartaSans_600SemiBold",
      letterSpacing: -0.1,
      marginTop: 2,
      ...labelStyle,
    },
  };
}

import React, { forwardRef } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  type RefreshControlProps,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  bottomInset?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  keyboard?: boolean;
  contentContainerStyle?: any;
  style?: any;
  /** When true and inside a tab layout, adds bottom padding to clear the tab bar. */
  tabBarOffset?: boolean;
};

export const Screen = forwardRef<View, Props>(function Screen(
  {
    children,
    scroll = false,
    padded = true,
    edges = ["top"],
    bottomInset = true,
    refreshing,
    onRefresh,
    refreshControl,
    keyboard = false,
    contentContainerStyle,
    style,
    tabBarOffset = false,
  },
  ref
) {
  const { colors, spacing, layout } = useTheme();
  const insets = useSafeAreaInsets();

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.bg },
    style,
  ];

  const inner = scroll ? (
    <ScrollView
      ref={ref as any}
      style={{ flex: 1 }}
      contentContainerStyle={[
        padded && { paddingHorizontal: spacing.lg },
        tabBarOffset && { paddingBottom: layout.tabBarHeight + spacing.lg },
        bottomInset && { paddingBottom: insets.bottom + spacing.lg },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        refreshControl ??
        (onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined)
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      ref={ref as any}
      style={[
        { flex: 1 },
        padded && { paddingHorizontal: spacing.lg },
        tabBarOffset && { paddingBottom: layout.tabBarHeight + spacing.lg },
        bottomInset && { paddingBottom: insets.bottom + spacing.lg },
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  const body = keyboard ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView style={containerStyle} edges={edges}>
      {body}
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
});

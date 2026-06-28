import React, { useEffect } from "react";
import { Modal, View, Text, Pressable, StyleSheet, BackHandler } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children: React.ReactNode;
  height?: number | "auto";
};

export function BottomSheet({ visible, onDismiss, title, children, height = "auto" }: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const translateY = useSharedValue(600);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(1, { duration: 220 });
    } else {
      translateY.value = withTiming(600, { duration: 220, easing: Easing.in(Easing.cubic) });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, opacity]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (visible) {
        onDismiss();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [visible, onDismiss]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onDismiss}
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.fill}>
        <Animated.View style={[styles.scrim, { backgroundColor: colors.scrim }, scrimStyle]}>
          <Pressable
            style={styles.fill}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgElevated,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.xl,
              maxHeight: typeof height === "number" ? height : undefined,
            },
            sheetStyle,
          ]}
        >
          <View
            style={{
              alignSelf: "center",
              width: 44,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.borderStrong,
              marginBottom: spacing.md,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing.md,
            }}
          >
            <Text style={[typography.title.md, { color: colors.text }]}>{title}</Text>
            <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={colors.textMuted} strokeWidth={2.25} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});

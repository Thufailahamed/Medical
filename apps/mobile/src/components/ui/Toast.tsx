import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeProvider";

export type ToastTone = "success" | "danger" | "warning" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{
  show: (message: string, tone?: ToastTone) => void;
} | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors, spacing, radius, typography, shadow } = useTheme();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(-40)).current;

  const dismiss = useCallback(
    (id: number) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    []
  );

  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = ++toastId;
      Haptics.notificationAsync(
        tone === "danger" || tone === "warning"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => dismiss(id), 3500);
    },
    [dismiss]
  );

  const toneMap = {
    success: { bg: colors.successSoft, fg: colors.success },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    info: { bg: colors.infoSoft, fg: colors.info },
  } as const;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View
        pointerEvents="box-none"
        style={[
          styles.stack,
          { top: 60, paddingHorizontal: spacing.lg },
        ]}
      >
        {toasts.map((t) => {
          const tm = toneMap[t.tone];
          const Icon =
            t.tone === "success"
              ? CheckCircle2
              : t.tone === "warning" || t.tone === "danger"
              ? AlertTriangle
              : Info;
          return (
            <Animated.View
              key={t.id}
              style={[
                shadow.lg,
                {
                  backgroundColor: colors.bgElevated,
                  borderRadius: radius.lg,
                  borderLeftWidth: 4,
                  borderLeftColor: tm.fg,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  marginBottom: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                },
              ]}
            >
              <Icon size={20} color={tm.fg} strokeWidth={2.25} />
              <Text
                style={[typography.body.md, { color: colors.text, flex: 1 }]}
                numberOfLines={3}
              >
                {t.message}
              </Text>
              <Pressable
                onPress={() => dismiss(t.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
              >
                <X size={16} color={colors.textSubtle} strokeWidth={2.5} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: (message: string, tone?: ToastTone) => {
        // Fallback no-op if used outside provider
        console.log(`[toast:${tone ?? "success"}]`, message);
      },
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "stretch",
    zIndex: 1000,
  },
});

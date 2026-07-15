import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeProvider";

export type ToastTone = "success" | "danger" | "warning" | "info";

type ToastAction = {
  label: string;
  onPress: () => void | Promise<void>;
};

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  durationMs?: number;
};

export type ToastOptions = {
  tone?: ToastTone;
  action?: ToastAction;
  durationMs?: number;
};

type ToastContextType = {
  show: (message: string, optsOrTone?: ToastTone | ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;
const DEFAULT_DURATION_MS = 3500;
const ACTION_DURATION_MS = 7000;

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { colors, spacing, radius, typography, shadow } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spring in
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();

    const timer = setTimeout(() => {
      handleDismiss();
    }, toast.durationMs || DEFAULT_DURATION_MS);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onDismiss(toast.id);
    });
  };

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const toneMap = {
    success: { bg: colors.successSoft || "rgba(76,175,80,0.1)", fg: colors.success || "#4CAF50" },
    danger: { bg: colors.dangerSoft || "rgba(244,67,54,0.1)", fg: colors.danger || "#F44336" },
    warning: { bg: colors.warningSoft || "rgba(255,152,0,0.1)", fg: colors.warning || "#FF9800" },
    info: { bg: colors.infoSoft || "rgba(33,150,243,0.1)", fg: colors.info || "#2196F3" },
  } as const;

  const tm = toneMap[toast.tone];
  const Icon =
    toast.tone === "success"
      ? CheckCircle2
      : toast.tone === "warning" || toast.tone === "danger"
      ? AlertTriangle
      : Info;

  return (
    <Animated.View
      style={[
        shadow.lg,
        {
          opacity,
          transform: [{ translateY }],
          backgroundColor: colors.bgElevated,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 5,
          borderLeftColor: tm.fg,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          marginBottom: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        },
      ]}
    >
      {/* Soft color icon badge */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: tm.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={tm.fg} strokeWidth={2.5} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.body.md,
            {
              color: colors.text,
              fontWeight: "500",
              lineHeight: 20,
            },
          ]}
          numberOfLines={3}
        >
          {toast.message}
        </Text>
      </View>

      {toast.action && (
        <Pressable
          onPress={async () => {
            try {
              await toast.action!.onPress();
            } catch {
              // ignore
            } finally {
              handleDismiss();
            }
          }}
          style={({ pressed }) => ({
            backgroundColor: pressed ? tm.bg : "transparent",
            paddingHorizontal: spacing.sm,
            paddingVertical: 6,
            borderRadius: radius.md,
          })}
          accessibilityRole="button"
          accessibilityLabel={toast.action.label}
        >
          <Text
            style={[
              typography.label.md,
              {
                color: tm.fg,
                fontWeight: "800",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              },
            ]}
          >
            {toast.action.label}
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={handleDismiss}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? 0.5 : 1,
          padding: 4,
        })}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
      >
        <X size={16} color={colors.textSubtle} strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (messageOrObj: any, optsOrTone?: any) => {
      const id = ++toastId;
      let message = "";
      let tone: ToastTone = "success";
      let action: ToastAction | undefined;
      let durationMs: number | undefined;

      if (messageOrObj && typeof messageOrObj === "object") {
        message = messageOrObj.message || messageOrObj.title || "";
        tone = messageOrObj.tone || messageOrObj.type || "success";
        action = messageOrObj.action;
        durationMs = messageOrObj.durationMs;
      } else {
        message = String(messageOrObj || "");
        const opts: ToastOptions =
          typeof optsOrTone === "string"
            ? { tone: optsOrTone }
            : optsOrTone || {};
        tone = opts.tone || "success";
        action = opts.action;
        durationMs = opts.durationMs;
      }

      // Safeguard: mapping "neutral" tone to "info" since toneMap only supports success, danger, warning, info
      if ((tone as any) === "neutral") {
        tone = "info";
      }

      const hasAction = !!action;
      const duration = durationMs ?? (hasAction ? ACTION_DURATION_MS : DEFAULT_DURATION_MS);

      Haptics.notificationAsync(
        tone === "danger" || tone === "warning"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      setToasts((prev) => [
        ...prev,
        { id, message, tone, action, durationMs: duration },
      ]);
    },
    []
  );

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
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: (message: string, optsOrTone?: ToastTone | ToastOptions) => {
        console.log(`[toast:${typeof optsOrTone === "string" ? optsOrTone : optsOrTone?.tone ?? "success"}]`, message);
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
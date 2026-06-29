import React, { createContext, useContext, useRef, useState, useCallback } from "react";
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
  // Backward-compat: show(message, tone?)
  // New:        show(message, opts?)
  show: (message: string, optsOrTone?: ToastTone | ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

const DEFAULT_DURATION_MS = 3500;
const ACTION_DURATION_MS = 7000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors, spacing, radius, typography, shadow } = useTheme();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextType["show"]>(
    (message, optsOrTone) => {
      const id = ++toastId;
      // Accept either the legacy positional tone or the new options object.
      const opts: ToastOptions =
        typeof optsOrTone === "string"
          ? { tone: optsOrTone }
          : optsOrTone || {};
      const tone = opts.tone || "success";
      const hasAction = !!opts.action;
      const duration = opts.durationMs ?? (hasAction ? ACTION_DURATION_MS : DEFAULT_DURATION_MS);

      Haptics.notificationAsync(
        tone === "danger" || tone === "warning"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      setToasts((prev) => [
        ...prev,
        { id, message, tone, action: opts.action, durationMs: duration },
      ]);
      setTimeout(() => dismiss(id), duration);
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
              {t.action ? (
                <Pressable
                  onPress={async () => {
                    try {
                      await t.action!.onPress();
                    } catch {
                      // swallow — caller logs if needed
                    } finally {
                      dismiss(t.id);
                    }
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t.action.label}
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
                    {t.action.label}
                  </Text>
                </Pressable>
              ) : null}
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
      show: (message: string, optsOrTone?: ToastTone | ToastOptions) => {
        // Fallback no-op if used outside provider
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
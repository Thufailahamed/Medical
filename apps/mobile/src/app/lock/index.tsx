// Phase 2.4 — unlock screen.
//
// Cold-start + post-timeout entry point. On mount:
//   - if biometric is enabled + available → auto-prompt (Face ID sheet)
//   - user can switch to manual PIN entry at any time
//
// PIN verify happens locally via PBKDF2 against the SecureStore-hashed
// PIN — the raw PIN never crosses the device boundary. On success we
// simply `setLocked(false)`; the root layout's gate drops us back into
// the app shell.
//
// "Forgot PIN" is the only path that resets the lock. It zeroes the
// SecureStore blob and clears the offline cache — the user then has to
// sign in again. The server-side session is unaffected (we don't store
// the PIN server-side, by design).
//
// On a fresh dev build with no PIN yet we `router.replace("/lock/setup")`
// so the first-time flow happens exactly once.

import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Alert, StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Fingerprint, Heart, LogOut, ShieldCheck } from "lucide-react-native";
import { Screen } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAppLockStore } from "@/stores/appLock";
import { useAuthStore } from "@/stores/auth";
import {
  getBiometricStatus,
  promptBiometric,
  biometricName,
  type BiometricStatus,
  type BiometricAuthResult,
} from "@/lib/biometric";
import { PinPad } from "./_components/PinPad";

type Mode = "biometric" | "pin";

export default function LockScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, fontFamily, spacing, typography } = useTheme();
  const { height } = useWindowDimensions();
  const compact = height < 900;
  const tiny = height < 700;

  const hasPin = useAppLockStore((s) => !!s.pinHash);
  const biometricEnabled = useAppLockStore((s) => s.biometricEnabled);
  const verifyAndUnlock = useAppLockStore((s) => s.verifyAndUnlock);
  const unlockStore = useAppLockStore((s) => s.unlock);
  const reset = useAppLockStore((s) => s.reset);
  const signOut = useAuthStore((s) => s.logout);

  const [mode, setMode] = useState<Mode>("biometric");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [biometricName_, setBiometricName] = useState("Biometric");
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(
    null,
  );
  const autoPromptedRef = useRef(false);

  // If we landed here with no PIN, send to setup. Also detect biometric
  // capability once, so we can decide between biometric-first vs PIN-first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [status, name] = await Promise.all([
        getBiometricStatus(),
        biometricName(),
      ]);
      if (cancelled) return;
      setBiometricStatus(status);
      setBiometricName(name);
      const startInBiometric =
        biometricEnabled && status === "available";
      setMode(startInBiometric ? "biometric" : "pin");
    })();
    return () => {
      cancelled = true;
    };
  }, [biometricEnabled]);

  useEffect(() => {
    if (!hasPin) {
      router.replace("/lock/setup");
    }
  }, [hasPin, router]);

  // Auto-trigger biometric prompt when we land in biometric mode. Guarded
  // by a ref so a strict-mode double-mount + a re-render after switching
  // to PIN don't both fire.
  useEffect(() => {
    if (mode !== "biometric") return;
    if (autoPromptedRef.current) return;
    autoPromptedRef.current = true;
    void runBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function runBiometric(): Promise<BiometricAuthResult> {
    const result = await promptBiometric(t("appLock.unlock.title"), t("common.cancel"));
    switch (result) {
      case "ok":
        unlockStore();
        return result;
      case "canceled":
      case "failed":
        setMode("pin");
        return result;
      case "locked_out":
        setError(t("appLock.errors.biometricLocked"));
        setMode("pin");
        return result;
      case "no_passcode":
        setError(t("appLock.errors.biometricNoPasscode"));
        setMode("pin");
        return result;
    }
  }

  async function submitPin(value: string) {
    if (busy) return;
    setBusy(true);
    const ok = await verifyAndUnlock(value);
    setBusy(false);
    if (!ok) {
      setError(t("appLock.unlock.wrongPin"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setPin("");
    }
  }

  function onForgotPin() {
    Alert.alert(
      t("appLock.unlock.forgotPinConfirmTitle"),
      t("appLock.unlock.forgotPinConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("appLock.unlock.forgotPinConfirmAction"),
          style: "destructive",
          onPress: async () => {
            await reset();
            await signOut();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  }

  // While we don't know biometric status yet, render the PIN pad so the
  // screen never appears blank. Same if the device has no biometric at
  // all — we just stay in PIN mode.
  const showBiometricCta =
    biometricEnabled && biometricStatus === "available" && mode === "pin";

  return (
    <Screen
      padded={false}
      scroll={false}
      edges={["top", "bottom"]}
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[colors.primarySoft, colors.surfaceSubtle]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ height: "48%", width: "100%" }}
        />
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.lg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Heart size={18} color={colors.primary} strokeWidth={2.5} />
            </View>
            <Text style={{ fontSize: 17, letterSpacing: -0.5, color: colors.text, fontFamily: fontFamily.heavy }}>
              HealthHub
            </Text>
          </View>
          <View accessibilityLabel={t("appLock.settings.title")} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
            <ShieldCheck size={17} color={colors.primary} strokeWidth={2} />
          </View>
        </View>

        <View style={{ alignItems: "center", marginTop: tiny ? spacing.lg : compact ? spacing.xxl : spacing.xxxxl }}>
          <View style={{ width: tiny ? 72 : compact ? 86 : 100, height: tiny ? 72 : compact ? 86 : 100, borderRadius: 50, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: tiny ? spacing.sm : spacing.md }}>
            <View style={{ width: tiny ? 54 : compact ? 64 : 72, height: tiny ? 54 : compact ? 64 : 72, borderRadius: tiny ? 18 : 22, borderCurve: "continuous", overflow: "hidden", alignItems: "center", justifyContent: "center", shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 }}>
              <LinearGradient
                colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Fingerprint size={36} color="#FFFFFF" strokeWidth={1.9} />
            </View>
          </View>
          <Text style={[compact ? typography.display.sm : typography.display.md, { color: colors.text, textAlign: "center" }]}>
            {mode === "biometric"
              ? t("appLock.unlock.useBiometric", { name: biometricName_ })
              : t("appLock.unlock.title")}
          </Text>
          <Text style={{ fontSize: tiny ? 13 : 15, color: colors.textMuted, fontFamily: fontFamily.body, textAlign: "center", lineHeight: tiny ? 19 : 22, marginTop: spacing.xs, maxWidth: 300 }}>
            {t("appLock.unlock.subtitle")}
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: "center", paddingVertical: tiny ? spacing.sm : compact ? spacing.md : spacing.xl }}>
          {mode === "biometric" ? (
            <View
              style={{
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Pressable
                onPress={() => void runBiometric()}
                accessibilityRole="button"
                accessibilityLabel={biometricName_}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: compact ? 96 : 112,
                  height: compact ? 96 : 112,
                  borderRadius: compact ? 48 : 56,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 6,
                  borderColor: colors.surface,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <Fingerprint size={52} color={colors.primary} strokeWidth={1.8} />
              </Pressable>
              <Pressable
                onPress={() => setMode("pin")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("appLock.unlock.useBiometric", {
                  name: "PIN",
                })}
                style={{
                  paddingHorizontal: spacing.lg,
                  height: 36,
                  justifyContent: "center",
                  borderRadius: 20,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 14,
                    fontFamily: fontFamily.bodySemibold,
                  }}
                >
                  {t("appLock.unlock.subtitle")}
                </Text>
              </Pressable>
            </View>
          ) : (
            <PinPad
              value={pin}
              onChange={(v) => {
                setError(null);
                setPin(v);
                if (v.length === 6) {
                  void submitPin(v);
                }
              }}
              length={6}
              error={!!error}
              hint={error ?? undefined}
              disabled={busy}
            />
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          {showBiometricCta ? (
            <Pressable
              onPress={() => setMode("biometric")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={biometricName_}
              style={({ pressed }) => ({
                height: 50,
                borderRadius: 16,
                borderCurve: "continuous",
                overflow: "hidden",
                transform: [{ scale: pressed ? 0.98 : 1 }],
                shadowColor: colors.primary,
                shadowOpacity: 0.22,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 7 },
                elevation: 4,
              })}
            >
              <LinearGradient
                colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                <Fingerprint size={19} color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 15,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {t("appLock.unlock.useBiometric", { name: biometricName_ })}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              minHeight: 50,
              borderRadius: 16,
              borderCurve: "continuous",
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              shadowColor: colors.shadow,
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}
          >
            <Pressable
              onPress={onForgotPin}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("appLock.unlock.forgotPin")}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                backgroundColor: pressed ? colors.dangerSoft : "transparent",
              })}
            >
              <Text
                numberOfLines={2}
                style={{
                  color: colors.danger,
                  fontSize: 12,
                  lineHeight: 16,
                  textAlign: "center",
                  fontFamily: fontFamily.bodySemibold,
                }}
              >
                {t("appLock.unlock.forgotPin")}
              </Text>
            </Pressable>

            <View style={{ width: 1, backgroundColor: colors.border }} />

            <Pressable
              onPress={async () => {
                await signOut();
                router.replace("/(auth)/login");
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("appLock.unlock.switchAccount")}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                backgroundColor: pressed ? colors.fill : "transparent",
              })}
            >
              <LogOut size={14} color={colors.textMuted} />
              <Text
                numberOfLines={2}
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  lineHeight: 16,
                  textAlign: "center",
                  fontFamily: fontFamily.bodyMedium,
                }}
              >
                {t("appLock.unlock.switchAccount")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}


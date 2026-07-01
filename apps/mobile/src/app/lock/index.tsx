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
import { View, Text, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Fingerprint, LogOut } from "lucide-react-native";
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
  const { colors, fontFamily, spacing, radius } = useTheme();

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
    <Screen padded={false} scroll={false} edges={["top", "bottom"]}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xl,
          paddingBottom: spacing.xl,
        }}
      >
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Fingerprint size={32} color={colors.primary} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "700",
              color: colors.text,
              fontFamily: fontFamily.displayBold,
              textAlign: "center",
            }}
          >
            {t("appLock.unlock.title")}
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textMuted,
              fontFamily: fontFamily.body,
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            {mode === "biometric"
              ? t("appLock.unlock.useBiometric", { name: biometricName_ })
              : t("appLock.unlock.subtitle")}
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
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
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: colors.primary,
                }}
              >
                <Fingerprint size={48} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => setMode("pin")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("appLock.unlock.useBiometric", {
                  name: "PIN",
                })}
                style={{ padding: spacing.sm }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 14,
                    fontFamily: fontFamily.body,
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

        <View style={{ gap: spacing.sm, alignItems: "center" }}>
          {showBiometricCta ? (
            <Pressable
              onPress={() => setMode("biometric")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={biometricName_}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Fingerprint size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: "600",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {t("appLock.unlock.useBiometric", { name: biometricName_ })}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onForgotPin}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("appLock.unlock.forgotPin")}
            style={{ padding: spacing.sm }}
          >
            <Text
              style={{
                color: colors.danger,
                fontSize: 14,
                fontFamily: fontFamily.body,
              }}
            >
              {t("appLock.unlock.forgotPin")}
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/(auth)/login");
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("appLock.unlock.switchAccount")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              padding: spacing.sm,
            }}
          >
            <LogOut size={14} color={colors.textMuted} />
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 13,
                fontFamily: fontFamily.body,
              }}
            >
              {t("appLock.unlock.switchAccount")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}


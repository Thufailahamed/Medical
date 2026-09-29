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
import {
  Fingerprint,
  Heart,
  KeyRound,
  Lock,
  ScanFace,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react-native";
import { Screen } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
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
  const { colors, fontFamily, spacing, shadow, typography, scheme } = useTheme();
  const { height } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
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
  const BiometricIcon = /face/i.test(biometricName_) ? ScanFace : Fingerprint;
  const avatarSize = tiny ? 64 : compact ? 76 : 84;
  const ring = 3;
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const dark = scheme === "dark";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        pointerEvents="none"
        colors={
          dark
            ? ["rgba(14,165,233,0.22)", "rgba(14,165,233,0.04)", "rgba(0,0,0,0)"]
            : ["#D6ECFB", "#EEF6FD", colors.background]
        }
        locations={[0, 0.45, 1]}
        style={[StyleSheet.absoluteFill, { bottom: "35%" }]}
      />
    <Screen
      padded={false}
      scroll={false}
      edges={["top", "bottom"]}
      style={{ backgroundColor: "transparent" }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: tiny ? spacing.md : compact ? spacing.xl : spacing.xxxl,
          paddingBottom: spacing.sm,
        }}
      >
        <View style={{ alignItems: "center" }}>
          <View style={{ marginBottom: tiny ? spacing.md : spacing.lg, ...shadow.hero, shadowOpacity: dark ? 0.4 : 0.18 }}>
            <LinearGradient
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: avatarSize + ring * 2,
                height: avatarSize + ring * 2,
                borderRadius: avatarSize,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {user ? (
                <View style={{ borderRadius: avatarSize, borderWidth: 2.5, borderColor: colors.surface, backgroundColor: colors.surface, overflow: "hidden" }}>
                  <Avatar name={user.name} uri={user.photo} size={avatarSize - 5} />
                </View>
              ) : (
                <Heart size={avatarSize * 0.42} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
              )}
            </LinearGradient>
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                ...shadow.sm,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Lock size={12} color={colors.onPrimary} strokeWidth={2.6} />
              </View>
            </View>
          </View>
          <Text
            style={{
              ...typography.kicker,
              color: colors.primary,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {t("appLock.unlock.kicker")}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              ...(tiny ? typography.title.lg : typography.display.sm),
              color: colors.text,
              textAlign: "center",
            }}
          >
            {mode === "biometric"
              ? t("appLock.unlock.useBiometric", { name: biometricName_ })
              : firstName
                ? t("appLock.unlock.welcomeName", { name: firstName })
                : t("appLock.unlock.title")}
          </Text>
          <Text
            style={{
              ...typography.body.md,
              color: colors.textMuted,
              textAlign: "center",
              marginTop: 6,
              maxWidth: 300,
            }}
          >
            {mode === "biometric" ? t("appLock.unlock.subtitle") : t("appLock.unlock.pinPrompt")}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingTop: tiny ? spacing.lg : spacing.xxl,
            paddingBottom: tiny ? spacing.xs : spacing.sm,
          }}
        >
          {mode === "biometric" ? (
            <View style={{ alignItems: "center", gap: spacing.xl }}>
              <Pressable
                onPress={() => void runBiometric()}
                accessibilityRole="button"
                accessibilityLabel={t("appLock.unlock.useBiometric", { name: biometricName_ })}
                style={({ pressed }) => ({
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  backgroundColor: pressed ? colors.primarySoft : colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.hairline,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                  ...shadow.card,
                })}
              >
                <BiometricIcon size={50} color={colors.primary} strokeWidth={1.5} />
              </Pressable>
              {error ? (
                <Text style={{ color: colors.danger, fontSize: 13, fontFamily: fontFamily.bodyMedium, textAlign: "center" }}>
                  {error}
                </Text>
              ) : null}
              <Pressable onPress={() => setMode("pin")} hitSlop={12} accessibilityRole="button">
                {({ pressed }) => (
                  <Text style={{ color: colors.primary, fontSize: 17, fontFamily: fontFamily.bodySemibold, opacity: pressed ? 0.5 : 1 }}>
                    {t("appLock.unlock.enterPin")}
                  </Text>
                )}
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
              leftAction={
                showBiometricCta
                  ? {
                      icon: <BiometricIcon size={30} color={colors.primary} strokeWidth={1.6} />,
                      onPress: () => void runBiometric(),
                      accessibilityLabel: t("appLock.unlock.useBiometric", { name: biometricName_ }),
                    }
                  : undefined
              }
            />
          )}
        </View>

        <View style={{ gap: tiny ? spacing.sm : spacing.md }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <FooterPill icon={KeyRound} label={t("appLock.unlock.forgotPinShort")} onPress={onForgotPin} />
            <FooterPill
              icon={UserRoundCog}
              label={t("appLock.unlock.switchAccountShort")}
              onPress={async () => {
                await signOut();
                router.replace("/(auth)/login");
              }}
            />
          </View>
        </View>
      </View>
    </Screen>
    </View>
  );
}

function FooterPill({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { colors, fontFamily, shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 46,
        borderRadius: 23,
        borderCurve: "continuous",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 12,
        backgroundColor: pressed ? colors.primarySoft : colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.hairline,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        ...shadow.xs,
      })}
    >
      <Icon size={16} color={colors.primary} strokeWidth={2.2} />
      <Text
        numberOfLines={1}
        style={{ color: colors.text, fontSize: 14, fontFamily: fontFamily.bodySemibold, letterSpacing: -0.1, flexShrink: 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Phase 2.4 — app lock settings screen.
//
// Sections:
//   1. State: PIN enabled / disabled. If disabled, tap to enable
//      (router.push /lock/setup). If enabled, tap to change.
//   2. Biometric toggle — only shown when device reports biometric
//      capability. Falls back to a hint card on no_enrolment / no_hardware.
//   3. Timeout preset picker — immediate / 30s / 1m / 5m / never.
//   4. Remove PIN — destroys the SecureStore hash + biometric pref.
//
// All mutations are local. The server never sees the PIN.

import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Alert, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Fingerprint,
  Lock,
  LockOpen,
  Timer,
  ChevronRight,
  ShieldAlert,
} from "lucide-react-native";
import { Screen, ScreenHeader, Card, Button, SectionHeader } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/stores/auth";
import { useAppLockStore, type LockTimeout } from "@/stores/appLock";
import {
  getBiometricStatus,
  biometricName,
  type BiometricStatus,
} from "@/lib/biometric";
import { withOpacity } from "@/constants/theme";

type TimeoutOption = {
  value: LockTimeout;
  labelKey: string;
};

const TIMEOUT_OPTIONS: TimeoutOption[] = [
  { value: 0, labelKey: "appLock.settings.timeoutImmediate" },
  { value: 30, labelKey: "appLock.settings.timeout30" },
  { value: 60, labelKey: "appLock.settings.timeout60" },
  { value: 300, labelKey: "appLock.settings.timeout300" },
  { value: -1, labelKey: "appLock.settings.timeoutNever" },
];

export default function AppLockScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();

  const hasPin = useAppLockStore((s) => !!s.pinHash);
  const biometricEnabled = useAppLockStore((s) => s.biometricEnabled);
  const timeoutSeconds = useAppLockStore((s) => s.timeoutSeconds);
  const setBiometricEnabled = useAppLockStore((s) => s.setBiometricEnabled);
  const setTimeoutSeconds = useAppLockStore((s) => s.setTimeoutSeconds);
  const reset = useAppLockStore((s) => s.reset);
  const logout = useAuthStore((s) => s.logout);

  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(
    null,
  );
  const [biometricName_, setBiometricName] = useState("Biometric");

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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function confirmRemovePin() {
    Alert.alert(
      t("appLock.settings.removePinConfirmTitle"),
      t("appLock.settings.removePinConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("appLock.settings.removePinConfirmAction"),
          style: "destructive",
          onPress: async () => {
            await reset();
          },
        },
      ],
    );
  }

  function handleSetupOrChange() {
    if (hasPin) {
      // For change, push to the same setup screen. The "first time vs
      // change" distinction doesn't affect UX much; setup's confirm step
      // validates the user can repeat the new PIN. If we wanted stricter
      // behaviour we'd ask for the current PIN first.
      router.push("/lock/setup");
      return;
    }
    router.push("/lock/setup");
  }

  const biometricAvailable = biometricStatus === "available";
  const biometricHint =
    biometricStatus === "no_enrolment"
      ? t("appLock.settings.biometricNoEnrolment", { name: biometricName_ })
      : biometricStatus === "no_hardware" ||
          biometricStatus === "unsupported"
        ? t("appLock.settings.biometricUnavailable")
        : null;

  return (
    <Screen padded={false} edges={["top"]} bottomInset scroll>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("appLock.settings.title")}
        subtitle={t("appLock.settings.subtitle")}
      />

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
      >
        {/* ─── State ────────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t("appLock.settings.stateHeading")} />
          <Card padded={false}>
            <Pressable
              onPress={handleSetupOrChange}
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: hasPin ? colors.successSoft : colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {hasPin ? (
                  <Lock size={20} color={colors.success} strokeWidth={2.25} />
                ) : (
                  <LockOpen size={20} color={colors.textMuted} strokeWidth={2.25} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.title.sm, { color: colors.text }]}>
                  {hasPin
                    ? t("appLock.settings.changePin")
                    : t("appLock.settings.setPin")}
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                  numberOfLines={2}
                >
                  {hasPin
                    ? t("appLock.settings.enabled")
                    : t("appLock.settings.disabled")}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.25} />
            </Pressable>
            {hasPin ? (
              <>
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.border,
                    marginHorizontal: spacing.md,
                  }}
                />
                <Pressable
                  onPress={confirmRemovePin}
                  accessibilityRole="button"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.dangerSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ShieldAlert size={20} color={colors.danger} strokeWidth={2.25} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.danger },
                      ]}
                    >
                      {t("appLock.settings.removePin")}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, marginTop: 2 },
                      ]}
                      numberOfLines={2}
                    >
                      {t("appLock.settings.removePinHint")}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.25} />
                </Pressable>
              </>
            ) : null}
          </Card>
        </View>

        {/* ─── Biometric ───────────────────────────────── */}
        {hasPin ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t("appLock.settings.biometricHeading")} />
            <Card padded={false}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Fingerprint size={20} color={colors.primary} strokeWidth={2.25} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("appLock.settings.biometricToggle", {
                      name: biometricName_,
                    })}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                    numberOfLines={2}
                  >
                    {biometricHint ?? t("appLock.settings.biometricSubtitle")}
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={setBiometricEnabled}
                  disabled={!biometricAvailable}
                  trackColor={{
                    true: withOpacity(colors.primary, 0.6),
                    false: colors.border,
                  }}
                  thumbColor={colors.surface}
                />
              </View>
            </Card>
          </View>
        ) : null}

        {/* ─── Timeout ─────────────────────────────────── */}
        {hasPin ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t("appLock.settings.timeoutHeading")} />
            <Card padded={false}>
              {TIMEOUT_OPTIONS.map((opt, i) => {
                const selected = timeoutSeconds === opt.value;
                return (
                  <View key={opt.value}>
                    <Pressable
                      onPress={() => setTimeoutSeconds(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        padding: spacing.md,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: selected
                            ? colors.primarySoft
                            : colors.surfaceMuted,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Timer
                          size={18}
                          color={selected ? colors.primary : colors.text}
                          strokeWidth={2.25}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            typography.title.sm,
                            {
                              color: selected ? colors.primary : colors.text,
                            },
                          ]}
                        >
                          {t(opt.labelKey)}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 2,
                          borderColor: selected
                            ? colors.primary
                            : colors.textSubtle,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {selected ? (
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: colors.primary,
                            }}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                    {i < TIMEOUT_OPTIONS.length - 1 ? (
                      <View
                        style={{
                          height: 1,
                          backgroundColor: colors.border,
                          marginHorizontal: spacing.md,
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

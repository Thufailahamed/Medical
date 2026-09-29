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
  ShieldAlert,
  ShieldCheck,
  KeyRound,
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
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();

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

  const timeoutLabel = t(
    TIMEOUT_OPTIONS.find((o) => o.value === timeoutSeconds)?.labelKey ??
      "appLock.settings.timeout60",
  ).toLowerCase();
  const summary =
    timeoutSeconds === 0
      ? t("appLock.settings.summaryImmediate")
      : timeoutSeconds === -1
        ? t("appLock.settings.summaryNever")
        : t("appLock.settings.summaryAfter", { time: timeoutLabel });
  const biometricOn = biometricAvailable && biometricEnabled;

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
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
      >
        {/* ─── Status ──────────────────────────────────── */}
        <Card style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                borderCurve: "continuous",
                backgroundColor: hasPin ? colors.successSoft : colors.warningSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {hasPin ? (
                <ShieldCheck size={26} color={colors.success} strokeWidth={2.2} />
              ) : (
                <LockOpen size={24} color={colors.warning} strokeWidth={2.2} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {hasPin ? t("appLock.settings.enabled") : t("appLock.settings.disabled")}
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {hasPin ? summary : t("appLock.settings.offBody")}
              </Text>
            </View>
          </View>

          {hasPin ? (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <StatusChip
                icon={Timer}
                label={t(`appLock.settings.timeoutShort${timeoutSeconds === -1 ? "Never" : timeoutSeconds}`)}
                on
              />
              <StatusChip
                icon={Fingerprint}
                label={
                  biometricOn
                    ? t("appLock.settings.biometricOn", { name: biometricName_ })
                    : t("appLock.settings.biometricOff", { name: biometricName_ })
                }
                on={biometricOn}
              />
            </View>
          ) : null}

          <Button
            title={hasPin ? t("appLock.settings.changePin") : t("appLock.settings.setPin")}
            icon={hasPin ? KeyRound : Lock}
            variant={hasPin ? "secondary" : "primary"}
            onPress={handleSetupOrChange}
          />
        </Card>

        {/* ─── Biometric ───────────────────────────────── */}
        {hasPin ? (
          <View>
            <SectionHeader title={t("appLock.settings.biometricHeading")} />
            <Card padded={false}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  opacity: biometricAvailable ? 1 : 0.85,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    backgroundColor: biometricAvailable ? colors.primarySoft : colors.well,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Fingerprint
                    size={20}
                    color={biometricAvailable ? colors.primary : colors.textMuted}
                    strokeWidth={2.25}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("appLock.settings.biometricToggle", { name: biometricName_ })}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      {
                        color: biometricHint ? colors.warning : colors.textMuted,
                        marginTop: 2,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {biometricHint ??
                      t("appLock.settings.biometricSubtitle", { name: biometricName_ })}
                  </Text>
                </View>
                <Switch
                  value={biometricOn}
                  onValueChange={setBiometricEnabled}
                  disabled={!biometricAvailable}
                  trackColor={{ true: colors.primary, false: colors.fillStrong }}
                  ios_backgroundColor={colors.fillStrong}
                />
              </View>
            </Card>
          </View>
        ) : null}

        {/* ─── Auto-lock ───────────────────────────────── */}
        {hasPin ? (
          <View>
            <SectionHeader title={t("appLock.settings.timeoutHeading")} />
            <Card style={{ gap: spacing.md }}>
              <View
                accessibilityRole="radiogroup"
                style={{
                  flexDirection: "row",
                  padding: 3,
                  gap: 2,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                }}
              >
                {TIMEOUT_OPTIONS.map((opt) => {
                  const selected = timeoutSeconds === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setTimeoutSeconds(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t(opt.labelKey)}
                      style={[
                        {
                          flex: 1,
                          height: 36,
                          borderRadius: 11,
                          borderCurve: "continuous",
                          alignItems: "center",
                          justifyContent: "center",
                        },
                        selected
                          ? {
                              backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
                              ...(scheme === "dark" ? null : shadow.xs),
                            }
                          : null,
                      ]}
                    >
                      <Text
                        style={[
                          typography.label.sm,
                          { color: selected ? colors.text : colors.textMuted },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {t(`appLock.settings.timeoutShort${opt.value === -1 ? "Never" : opt.value}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {t("appLock.settings.timeoutHint")}
              </Text>
            </Card>
          </View>
        ) : null}

        {/* ─── Remove PIN (kept apart from everyday settings) ─── */}
        {hasPin ? (
          <Pressable
            onPress={confirmRemovePin}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 48,
              borderRadius: radius.full,
              backgroundColor: colors.dangerSoft,
              opacity: pressed ? 0.8 : 1,
              marginTop: spacing.sm,
            })}
          >
            <ShieldAlert size={17} color={colors.danger} strokeWidth={2.3} />
            <Text style={[typography.label.lg, { color: colors.danger }]}>
              {t("appLock.settings.removePin")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function StatusChip({ icon: Icon, label, on }: { icon: any; label: string; on: boolean }) {
  const { colors, typography, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 34,
        paddingHorizontal: 10,
        borderRadius: radius.full,
        backgroundColor: on ? colors.primarySoft : colors.fill,
      }}
    >
      <Icon size={14} color={on ? colors.primary : colors.textMuted} strokeWidth={2.3} />
      <Text
        style={[typography.label.sm, { color: on ? colors.primary : colors.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

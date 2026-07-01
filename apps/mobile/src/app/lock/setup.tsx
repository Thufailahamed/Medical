// Phase 2.4 — first-time PIN setup.
//
// Two-step flow:
//   step "create":  user picks a PIN, we hold it locally
//   step "confirm": user re-enters, we hash + persist
//
// Optional biometric step after confirm (only if the device supports
// it AND the user hasn't skipped via the toggle). Biometric is enabled
// by default for supported devices — the user can disable inline.
//
// On success we replace into the home route — there's no back button
// out of setup, since this screen is shown right after sign-up.

import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Fingerprint, ChevronLeft } from "lucide-react-native";
import { Screen, Button } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAppLockStore } from "@/stores/appLock";
import {
  getBiometricStatus,
  biometricName,
  type BiometricStatus,
} from "@/lib/biometric";
import { isWellFormedPin } from "@/lib/appLock";
import { PinPad, isWeakPin } from "./_components/PinPad";

type Step = "create" | "confirm" | "biometric" | "done";

export default function LockSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, fontFamily, spacing, radius } = useTheme();
  const setPin = useAppLockStore((s) => s.setPin);
  const setBiometricEnabled = useAppLockStore((s) => s.setBiometricEnabled);

  const [step, setStep] = useState<Step>("create");
  const [firstPin, setFirstPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | undefined>(undefined);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(
    null,
  );
  const [biometricName_, setBiometricName] = useState("Biometric");
  const [biometricEnabled, setBiometricEnabledLocal] = useState(true);

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

  // Auto-advance once both stages have a full PIN.
  useEffect(() => {
    if (step === "create" && firstPin.length === 6) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // tiny defer so the last dot fills visually before transition
      const t = setTimeout(() => setStep("confirm"), 120);
      return () => clearTimeout(t);
    }
    if (step === "confirm" && confirmPin.length === 6) {
      handleConfirmSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPin, confirmPin, step]);

  async function handleConfirmSubmit() {
    if (confirmPin !== firstPin) {
      setError(t("appLock.setup.mismatch"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setConfirmPin("");
      return;
    }
    if (!isWellFormedPin(confirmPin)) {
      setError(t("appLock.setup.mismatch"));
      setConfirmPin("");
      return;
    }
    setError(null);
    await setPin(confirmPin);
    if (biometricStatus === "available") {
      setStep("biometric");
    } else {
      setBiometricEnabled(false);
      setStep("done");
    }
  }

  function finish() {
    setBiometricEnabled(biometricEnabled);
    router.replace("/(app)" as any);
  }

  const headerTitle =
    step === "create"
      ? t("appLock.setup.title")
      : step === "confirm"
        ? t("appLock.setup.confirm")
        : step === "biometric"
          ? t("appLock.settings.biometricToggle", {
              name: biometricName_,
            })
          : t("appLock.setup.successTitle");

  const headerSubtitle =
    step === "create"
      ? t("appLock.setup.subtitle")
      : step === "confirm"
        ? t("appLock.setup.subtitle")
        : step === "biometric"
          ? t("appLock.setup.useBiometric", { name: biometricName_ })
          : t("appLock.setup.successBody");

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
        {step !== "create" && step !== "done" ? (
          <Pressable
            onPress={() => {
              if (step === "confirm") {
                setFirstPin("");
                setConfirmPin("");
                setError(null);
                setStep("create");
              } else if (step === "biometric") {
                setBiometricEnabled(false);
                setBiometricEnabledLocal(false);
                setStep("done");
              }
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ marginBottom: spacing.lg, paddingVertical: spacing.xs }}
          >
            <ChevronLeft size={28} color={colors.text} />
          </Pressable>
        ) : null}

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
            {headerTitle}
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
            {headerSubtitle}
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
          {step === "create" ? (
            <PinPad
              value={firstPin}
              onChange={(v) => {
                setError(null);
                if (isWeakPin(v)) {
                  setHint(t("appLock.setup.weakPin"));
                } else {
                  setHint(undefined);
                }
                setFirstPin(v);
              }}
              length={6}
              error={!!error}
              hint={hint}
            />
          ) : step === "confirm" ? (
            <PinPad
              value={confirmPin}
              onChange={(v) => {
                setError(null);
                setConfirmPin(v);
              }}
              length={6}
              error={!!error}
              hint={error ?? undefined}
            />
          ) : step === "biometric" ? (
            <View style={{ gap: spacing.md, alignItems: "center" }}>
              <Pressable
                onPress={() => setBiometricEnabledLocal((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: biometricEnabled }}
                hitSlop={8}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: biometricEnabled
                    ? colors.primary
                    : colors.border,
                  backgroundColor: biometricEnabled
                    ? colors.primarySoft
                    : colors.surface,
                  flexDirection: "row",
                  gap: spacing.sm,
                  alignItems: "center",
                }}
              >
                <Fingerprint size={22} color={colors.primary} />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: biometricEnabled ? colors.primary : colors.text,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {biometricName_}
                </Text>
              </Pressable>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                  textAlign: "center",
                  maxWidth: 280,
                }}
              >
                {biometricEnabled
                  ? t("appLock.setup.useBiometric", { name: biometricName_ })
                  : t("appLock.setup.skipBiometric")}
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: spacing.md }}>
              <Text
                style={{
                  fontSize: 48,
                  fontFamily: fontFamily.displayBold,
                  color: colors.success,
                }}
              >
                ✓
              </Text>
            </View>
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          {step === "biometric" ? (
            <Button
              title={t("appLock.setup.continue")}
              onPress={() => setStep("done")}
              fullWidth
              size="lg"
            />
          ) : step === "done" ? (
            <Button
              title={t("appLock.setup.continue")}
              onPress={finish}
              fullWidth
              size="lg"
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
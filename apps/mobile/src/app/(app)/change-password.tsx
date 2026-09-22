// @ts-nocheck

import { useState, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Lock,
  KeyRound,
  ShieldCheck,
  Check,
  AlertCircle,
  Shield,
  CheckCircle2,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useChangePassword } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  FormField,
  TextInput,
  Button,
  useToast,
  Card,
  Pill,
  Pressable,
} from "@/components/ui";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, scheme } = useTheme();
  const isDark = scheme === "dark";
  const toast = useToast();
  const changePw = useChangePassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  // Validation criteria
  const hasMinLength = next.length >= 8;
  const hasNumber = /\d/.test(next);
  const hasUpperOrSpecial = /[A-Z]/.test(next) || /[^A-Za-z0-9]/.test(next);

  // Strength calculation (0 to 4)
  const strengthScore = useMemo(() => {
    if (!next) return 0;
    let score = 0;
    if (next.length >= 8) score += 1;
    if (next.length >= 12) score += 1;
    if (hasNumber) score += 1;
    if (hasUpperOrSpecial) score += 1;
    return Math.max(1, Math.min(score, 4));
  }, [next, hasNumber, hasUpperOrSpecial]);

  const strengthMeta = useMemo(() => {
    switch (strengthScore) {
      case 1:
        return { label: "Weak", color: colors.danger };
      case 2:
        return { label: "Fair", color: colors.warning };
      case 3:
        return { label: "Good", color: colors.primary };
      case 4:
        return { label: "Strong", color: colors.success };
      default:
        return { label: "", color: colors.border };
    }
  }, [strengthScore, colors]);

  // Match state
  const matchStatus = useMemo(() => {
    if (!confirm) return null;
    if (next === confirm) return "match";
    return "mismatch";
  }, [next, confirm]);

  const canSubmit =
    current.trim().length > 0 &&
    hasMinLength &&
    next === confirm &&
    !changePw.isPending;

  async function save() {
    if (!current.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast.show("Please enter your current password", "warning");
      return;
    }
    if (!hasMinLength) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast.show(t("changePassword.error.tooShort", "New password must be at least 8 characters"), "warning");
      return;
    }
    if (next !== confirm) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast.show(t("changePassword.error.mismatch", "Passwords don't match"), "warning");
      return;
    }
    if (current === next) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast.show("New password must be different from current password", "warning");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      await changePw.mutateAsync({
        currentPassword: current,
        newPassword: next,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.show(t("changePassword.toast.success", "Password updated"), "success");
      router.back();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      toast.show(err?.message || t("changePassword.toast.error", "Could not change password"), "danger");
    }
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("changePassword.title", "Change password")}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          paddingBottom: spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Security Overview Hero Banner */}
        <LinearGradient
          colors={
            isDark
              ? [colors.surfaceElevated, colors.surface]
              : [colors.primarySoft, colors.surface]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 20,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <ShieldCheck size={26} color={colors.onPrimary} />
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
              Account Security
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, lineHeight: 17 }]}>
              Protect your health records, prescriptions, and clinical data with a strong password.
            </Text>
          </View>
        </LinearGradient>

        {/* Elevated Form Card */}
        <Card
          style={{
            padding: spacing.lg,
            borderRadius: 20,
            gap: spacing.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Current Password */}
          <View style={{ gap: spacing.xs }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={[
                  typography.label.sm,
                  {
                    color: colors.textSubtle,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  },
                ]}
              >
                {t("changePassword.field.currentLabel", "Current password")} *
              </Text>

              <Pressable
                onPress={() => router.push("/(auth)/forgot-password" as any)}
                hitSlop={8}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: colors.primary, fontWeight: "600" },
                  ]}
                >
                  Forgot?
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={current}
              onChangeText={setCurrent}
              placeholder={t("changePassword.field.currentPlaceholder", "••••••••")}
              secureTextEntry
              showPasswordToggle
              leadingIcon={Lock}
            />
          </View>

          {/* New Password */}
          <View style={{ gap: spacing.xs }}>
            <Text
              style={[
                typography.label.sm,
                {
                  color: colors.textSubtle,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                },
              ]}
            >
              {t("changePassword.field.newLabel", "New password")} *
            </Text>

            <TextInput
              value={next}
              onChangeText={setNext}
              placeholder={t("changePassword.field.newPlaceholder", "At least 8 characters")}
              secureTextEntry
              showPasswordToggle
              leadingIcon={KeyRound}
            />

            {/* Password Strength Meter */}
            {next.length > 0 && (
              <View style={{ gap: 6, marginTop: 4 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]}>
                    Password Strength
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: strengthMeta.color, fontWeight: "700", fontSize: 11 },
                    ]}
                  >
                    {strengthMeta.label}
                  </Text>
                </View>

                {/* 4 Segment Progress Bar */}
                <View style={{ flexDirection: "row", gap: 4, height: 4 }}>
                  {[1, 2, 3, 4].map((step) => (
                    <View
                      key={step}
                      style={{
                        flex: 1,
                        height: "100%",
                        borderRadius: 2,
                        backgroundColor:
                          strengthScore >= step ? strengthMeta.color : colors.border,
                      }}
                    />
                  ))}
                </View>

                {/* Real-time Checklist Chips */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <CriteriaChip label="8+ chars" met={hasMinLength} />
                  <CriteriaChip label="Number" met={hasNumber} />
                  <CriteriaChip label="Uppercase/Symbol" met={hasUpperOrSpecial} />
                </View>
              </View>
            )}
          </View>

          {/* Confirm New Password */}
          <View style={{ gap: spacing.xs }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={[
                  typography.label.sm,
                  {
                    color: colors.textSubtle,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  },
                ]}
              >
                {t("changePassword.field.confirmLabel", "Confirm new password")} *
              </Text>

              {matchStatus === "match" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={12} color={colors.success} />
                  <Text style={[typography.caption, { color: colors.success, fontWeight: "600", fontSize: 11 }]}>
                    Passwords match
                  </Text>
                </View>
              )}

              {matchStatus === "mismatch" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <AlertCircle size={12} color={colors.danger} />
                  <Text style={[typography.caption, { color: colors.danger, fontWeight: "600", fontSize: 11 }]}>
                    Does not match
                  </Text>
                </View>
              )}
            </View>

            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t("changePassword.field.confirmPlaceholder", "Repeat new password")}
              secureTextEntry
              showPasswordToggle
              leadingIcon={Lock}
            />
          </View>

          {/* Primary Submit Button */}
          <Button
            title={t("changePassword.action.submit", "Update password")}
            onPress={save}
            loading={changePw.isPending}
            disabled={!canSubmit}
            icon={ShieldCheck}
            size="lg"
            variant="primary"
            fullWidth
          />
        </Card>

        {/* Best Practice Security Notice */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: 14,
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Shield size={18} color={colors.textMuted} />
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, flex: 1, lineHeight: 18 },
            ]}
          >
            Never share your password with anyone. We will keep you logged in on this device after your password is updated.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function CriteriaChip({ label, met }: { label: string; met: boolean }) {
  const { colors, typography } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: met ? colors.successSoft : colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: met ? colors.success + "40" : colors.border,
      }}
    >
      <Check
        size={11}
        color={met ? colors.success : colors.textMuted}
        strokeWidth={met ? 2.5 : 1.5}
      />
      <Text
        style={[
          typography.caption,
          {
            color: met ? colors.success : colors.textMuted,
            fontWeight: met ? "600" : "400",
            fontSize: 11,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
// @ts-nocheck

import { useState, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Lock,
  KeyRound,
  ShieldCheck,
  Check,
  AlertCircle,
  CheckCircle2,
  Circle,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useChangePassword } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  TextInput,
  Button,
  useToast,
  Card,
  Pressable,
} from "@/components/ui";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const changePw = useChangePassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  // Validation criteria
  const hasMinLength = next.length >= 8;
  const hasNumber = /\d/.test(next);
  const hasUpperOrSpecial = /[A-Z]/.test(next) || /[^A-Za-z0-9]/.test(next);
  const isDifferent = next.length > 0 && next !== current;

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
        return { label: t("changePassword.ui.weak"), color: colors.danger };
      case 2:
        return { label: t("changePassword.ui.fair"), color: colors.warning };
      case 3:
        return { label: t("changePassword.ui.good"), color: colors.primary };
      case 4:
        return { label: t("changePassword.ui.strong"), color: colors.success };
      default:
        return { label: "", color: colors.border };
    }
  }, [strengthScore, colors, t]);

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
      toast.show(t("changePassword.ui.currentRequired"), "warning");
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
      toast.show(t("changePassword.ui.sameAsCurrent"), "warning");
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
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("changePassword.title", "Change password")}
        subtitle={t("changePassword.ui.subtitle")}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Step 1: current password ─── */}
        <SectionLabel step={1} label={t("changePassword.ui.currentSection")} />
        <Card style={{ gap: spacing.sm }}>
          <FieldLabel label={t("changePassword.field.currentLabel", "Current password")} />
          <TextInput
            value={current}
            onChangeText={setCurrent}
            placeholder={t("changePassword.ui.currentPlaceholder")}
            secureTextEntry
            showPasswordToggle
            leadingIcon={Lock}
            autoComplete="current-password"
            textContentType="password"
          />
          <Pressable
            onPress={() => router.push("/(auth)/forgot-password" as any)}
            hitSlop={8}
            accessibilityRole="link"
            style={{ alignSelf: "flex-end", paddingVertical: 2 }}
          >
            <Text style={[typography.label.md, { color: colors.primary }]}>
              {t("changePassword.ui.forgot")}
            </Text>
          </Pressable>
        </Card>

        {/* ─── Step 2: new password ─── */}
        <SectionLabel step={2} label={t("changePassword.ui.newSection")} />
        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <FieldLabel label={t("changePassword.field.newLabel", "New password")} />
              {next.length > 0 ? (
                <Text style={[typography.label.sm, { color: strengthMeta.color }]}>
                  {strengthMeta.label}
                </Text>
              ) : null}
            </View>
            <TextInput
              value={next}
              onChangeText={setNext}
              placeholder={t("changePassword.field.newPlaceholder", "At least 8 characters")}
              secureTextEntry
              showPasswordToggle
              leadingIcon={KeyRound}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {/* 4-segment strength bar */}
            <View
              style={{ flexDirection: "row", gap: 4, height: 4 }}
              accessibilityLabel={`${t("changePassword.ui.strength")}: ${strengthMeta.label}`}
            >
              {[1, 2, 3, 4].map((step) => (
                <View
                  key={step}
                  style={{
                    flex: 1,
                    borderRadius: 2,
                    backgroundColor: strengthScore >= step ? strengthMeta.color : colors.fill,
                  }}
                />
              ))}
            </View>
          </View>

          {/* Requirements — always visible so the rules are known up front */}
          <View style={{ gap: 8 }}>
            <Rule label={t("changePassword.ui.ruleLength")} met={hasMinLength} />
            <Rule label={t("changePassword.ui.ruleNumber")} met={hasNumber} />
            <Rule label={t("changePassword.ui.ruleCase")} met={hasUpperOrSpecial} />
            <Rule label={t("changePassword.ui.ruleDifferent")} met={isDifferent} />
          </View>

          <View style={{ height: 1, backgroundColor: colors.separator }} />

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <FieldLabel label={t("changePassword.field.confirmLabel", "Confirm new password")} />
              {matchStatus ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {matchStatus === "match" ? (
                    <CheckCircle2 size={13} color={colors.success} />
                  ) : (
                    <AlertCircle size={13} color={colors.danger} />
                  )}
                  <Text
                    style={[
                      typography.label.sm,
                      { color: matchStatus === "match" ? colors.success : colors.danger },
                    ]}
                  >
                    {matchStatus === "match"
                      ? t("changePassword.ui.match")
                      : t("changePassword.ui.mismatch")}
                  </Text>
                </View>
              ) : null}
            </View>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t("changePassword.field.confirmPlaceholder", "Repeat new password")}
              secureTextEntry
              showPasswordToggle
              leadingIcon={Lock}
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </View>
        </Card>

        {/* ─── Submit ─── */}
        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <Button
            title={t("changePassword.action.submit", "Update password")}
            onPress={save}
            loading={changePw.isPending}
            disabled={!canSubmit}
            icon={ShieldCheck}
            size="lg"
          />
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 6, paddingHorizontal: spacing.md }}>
            <Lock size={12} color={colors.textSubtle} style={{ marginTop: 2 }} />
            <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center", flexShrink: 1 }]}>
              {t("changePassword.ui.footnote")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function SectionLabel({ step, label }: { step: number; label: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: 2,
        marginTop: step === 1 ? 0 : spacing.xl,
        marginBottom: spacing.sm,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}
      >
        <Text style={[typography.caption, { color: colors.primary, fontWeight: "800", fontSize: 11 }]}>
          {step}
        </Text>
      </View>
      <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase" }]}>
        {label}
      </Text>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  const { colors, typography } = useTheme();
  return <Text style={[typography.label.md, { color: colors.text }]}>{label}</Text>;
}

function Rule({ label, met }: { label: string; met: boolean }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {met ? (
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.success,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={10} color="#FFFFFF" strokeWidth={3.5} />
        </View>
      ) : (
        <Circle size={16} color={colors.borderStrong} strokeWidth={1.8} />
      )}
      <Text style={[typography.body.sm, { color: met ? colors.text : colors.textMuted }]}>{label}</Text>
    </View>
  );
}

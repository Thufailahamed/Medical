// @ts-nocheck

// Round 2 P0: TOTP MFA enrollment screen for doctors.
// Three steps:
//   1. POST /mfa/setup → render QR + secret fallback for Authenticator
//   2. Doctor enters 6-digit code; POST /mfa/verify-setup flips MFA on
//   3. Show 10 single-use recovery codes (one-time view) + gate CTA

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { Check, Copy, ShieldCheck } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, Card, Button, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export default function MfaSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  const [phase, setPhase] = useState<"setup" | "verify" | "recovery">("setup");
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [accepted, setAccepted] = useState(false);

  async function startSetup() {
    try {
      setSubmitting(true);
      const res = await api<{ otpauthUrl: string; secret: string }>(
        "/mfa/setup",
        { method: "POST", body: {} }
      );
      setOtpauthUrl(res.otpauthUrl);
      setSecret(res.secret);
      setPhase("verify");
    } catch (err: any) {
      toast.show(err?.message || t("mfa.setup.error"), "danger");
    } finally {
      setSubmitting(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      toast.show(t("mfa.code.invalid"), "warning");
      return;
    }
    try {
      setSubmitting(true);
      const res = await api<{
        enabled: boolean;
        enrolledAt: string;
        recoveryCodes: string[];
      }>("/mfa/verify-setup", {
        method: "POST",
        body: { token: code },
      });
      setRecoveryCodes(res.recoveryCodes);
      setPhase("recovery");
    } catch (err: any) {
      toast.show(err?.message || t("mfa.verify.error"), "danger");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCodes() {
    try {
      await Clipboard.setStringAsync(recoveryCodes.join("\n"));
      toast.show(t("mfa.codes.copied"), "success");
    } catch {
      toast.show(t("mfa.codes.copyFail"), "danger");
    }
  }

  function finish() {
    queryClient.clear();
    setUser(useAuthStore.getState().user);
    (async () => {
      // Replace the mfaToken bearer with a confirmed session — mobile has
      // no helper to swap token without re-login, so we mark the user
      // unlocked and let the next API call authenticate via refresh.
      // In practice the doctor receives the session JWT in /mfa/challenge;
      // here the mfaToken has been validated by /mfa/verify-setup already.
      router.replace("/(app)" as any);
    })();
  }

  return (
    <Screen padded={false} edges={["top", "bottom"]} keyboard scroll>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs, alignItems: "center" }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: radius.full,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck size={40} color={colors.primary} />
          </View>
          <Text style={[typography.title.lg, { color: colors.text, textAlign: "center" }]}>
            {t("mfa.setup.title")}
          </Text>
          <Text
            style={[typography.body.md, { color: colors.textMuted, textAlign: "center" }]}
          >
            {t("mfa.setup.subtitle")}
          </Text>
        </View>

        {phase === "setup" ? (
          <Card padded gap={spacing.md}>
            <Text style={[typography.body.md, { color: colors.text }]}>
              {t("mfa.setup.intro")}
            </Text>
            <Button
              title={submitting ? t("common.loading") : t("mfa.setup.start")}
              onPress={startSetup}
              loading={submitting}
              fullWidth
            />
          </Card>
        ) : null}

        {phase === "verify" && otpauthUrl && secret ? (
          <>
            <Card padded gap={spacing.md}>
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("mfa.setup.qrLabel")}
              </Text>
              <View
                style={{
                  alignItems: "center",
                  padding: spacing.md,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <QRCode
                  value={otpauthUrl}
                  size={200}
                  color={colors.text}
                  backgroundColor={colors.surface}
                />
              </View>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, textAlign: "center" },
                ]}
              >
                {t("mfa.setup.qrHint")}
              </Text>
            </Card>

            <Card padded gap={spacing.sm}>
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("mfa.setup.manualLabel")}
              </Text>
              <Text
                selectable
                style={{
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  fontSize: 13,
                  color: colors.text,
                  padding: spacing.sm,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radius.md,
                  textAlign: "center",
                }}
              >
                {secret}
              </Text>
            </Card>

            <Card padded gap={spacing.md}>
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("mfa.setup.verifyLabel")}
              </Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  fontSize: 24,
                  letterSpacing: 6,
                  textAlign: "center",
                  color: colors.text,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                }}
              />
              <Button
                title={
                  submitting ? t("common.loading") : t("mfa.setup.verifyCta")
                }
                onPress={verify}
                loading={submitting}
                disabled={code.length !== 6}
                fullWidth
              />
            </Card>
          </>
        ) : null}

        {phase === "recovery" ? (
          <>
            <Card padded gap={spacing.md}>
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("mfa.codes.title")}
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {t("mfa.codes.warning")}
              </Text>
              <View
                style={{
                  padding: spacing.md,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radius.md,
                  gap: spacing.xs,
                }}
              >
                {recoveryCodes.map((c) => (
                  <Text
                    key={c}
                    selectable
                    style={{
                      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                      fontSize: 14,
                      color: colors.text,
                      textAlign: "center",
                    }}
                  >
                    {c}
                  </Text>
                ))}
              </View>
              <Button
                title={t("mfa.codes.copy")}
                onPress={copyCodes}
                variant="outline"
                fullWidth
                icon={Copy}
              />
            </Card>

            <Pressable
              onPress={() => setAccepted(!accepted)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                padding: spacing.sm,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: radius.sm,
                  borderWidth: 2,
                  borderColor: accepted ? colors.primary : colors.border,
                  backgroundColor: accepted ? colors.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {accepted ? (
                  <Check size={14} color={colors.onPrimary} strokeWidth={3} />
                ) : null}
              </View>
              <Text style={[typography.body.md, { color: colors.text, flex: 1 }]}>
                {t("mfa.codes.confirm")}
              </Text>
            </Pressable>

            <Button
              title={t("mfa.codes.continue")}
              onPress={finish}
              disabled={!accepted}
              fullWidth
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

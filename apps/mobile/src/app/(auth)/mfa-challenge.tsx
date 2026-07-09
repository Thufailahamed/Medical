// @ts-nocheck

// Round 2 P0: TOTP MFA verification screen shown after login.
// Doctor entered credentials, got an mfaToken, and must now prove
// possession of their authenticator. Accepts either a 6-digit code or
// a recovery code, posts to /mfa/challenge, then persists the full
// session JWT in SecureStore.

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, Card, Button, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

type Mode = "totp" | "recovery";

export default function MfaChallengeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, typography, radius } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.show(t("mfa.code.required"), "warning");
      return;
    }
    if (mode === "totp" && !/^\d{6}$/.test(trimmed)) {
      toast.show(t("mfa.code.invalid"), "warning");
      return;
    }

    try {
      setSubmitting(true);
      // The mfaToken was previously written to SecureStore as auth_token
      // when the verify-otp / login route detected the MFA branch.
      const mfaToken = (await SecureStore.getItemAsync("auth_token")) || "";
      if (!mfaToken) {
        toast.show(t("mfa.token.missing"), "danger");
        router.replace("/(auth)/login" as any);
        return;
      }

      const res = await api<{ token: string; user: any }>("/mfa/challenge", {
        method: "POST",
        body: { mfaToken, code: trimmed },
      });

      queryClient.clear();
      await SecureStore.setItemAsync("auth_token", res.token);
      if (res.user) setUser(res.user);
      toast.show(t("mfa.challenge.success"), "success");
      const home = res.user?.role === "doctor" ? "/(doctor)" : "/(app)";
      router.replace(home as any);
    } catch (err: any) {
      const msg = err?.message || t("mfa.challenge.error");
      toast.show(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setCode("");
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
            {t("mfa.challenge.title")}
          </Text>
          <Text
            style={[typography.body.md, { color: colors.textMuted, textAlign: "center" }]}
          >
            {t("mfa.challenge.subtitle")}
          </Text>
        </View>

        <Card padded gap={spacing.md}>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surfaceMuted,
              borderRadius: radius.full,
              padding: 4,
            }}
          >
            <ModePill
              active={mode === "totp"}
              label={t("mfa.challenge.modeTotp")}
              onPress={() => switchMode("totp")}
            />
            <ModePill
              active={mode === "recovery"}
              label={t("mfa.challenge.modeRecovery")}
              onPress={() => switchMode("recovery")}
            />
          </View>

          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {mode === "totp"
              ? t("mfa.challenge.totpHint")
              : t("mfa.challenge.recoveryHint")}
          </Text>

          <TextInput
            value={code}
            onChangeText={(v) =>
              setCode(
                mode === "totp"
                  ? v.replace(/\D/g, "").slice(0, 6)
                  : v.toUpperCase().slice(0, 14)
              )
            }
            keyboardType={mode === "totp" ? "number-pad" : "default"}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={mode === "totp" ? "000000" : "XXXX-XXXX-XXXX"}
            placeholderTextColor={colors.textMuted}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              fontSize: mode === "totp" ? 24 : 18,
              letterSpacing: mode === "totp" ? 6 : 2,
              textAlign: "center",
              color: colors.text,
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            }}
          />
          <Button
            title={submitting ? t("common.loading") : t("mfa.challenge.submit")}
            onPress={submit}
            loading={submitting}
            disabled={code.length === 0}
            fullWidth
          />
        </Card>

        <Pressable
          onPress={() => router.replace("/(auth)/login" as any)}
          style={{ alignItems: "center", padding: spacing.sm }}
        >
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {t("mfa.challenge.useDifferent")}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function ModePill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        paddingVertical: 8,
        borderRadius: radius.full,
        backgroundColor: active ? colors.surface : "transparent",
        alignItems: "center",
      }}
    >
      <Text
        style={[
          typography.body.sm,
          {
            color: active ? colors.text : colors.textMuted,
            fontWeight: active ? "600" : "500",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

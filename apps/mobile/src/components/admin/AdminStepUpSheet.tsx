import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { ShieldCheck, Lock } from "lucide-react-native";
import { BottomSheet, Button, TextInput, useToast } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import {
  registerStepUpPrompt,
  resolveStepUpPrompt,
  cancelStepUpPrompt,
} from "@/lib/admin-api";
import { useAdminStepUpStore } from "@/stores/adminStepUp";

/**
 * Mounted once inside the (admin) layout. When a step-up-gated admin
 * mutation 401s, `adminApiWithStepUp` triggers this sheet: the admin
 * re-enters their account password, we exchange it for a 5-minute
 * step-up token, then the original action retries automatically.
 */
export function AdminStepUpSheet() {
  const { colors, spacing, typography } = useTheme();
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => registerStepUpPrompt(() => setVisible(true)), []);

  const close = (cancelled: boolean) => {
    setVisible(false);
    setPassword("");
    setError(null);
    if (cancelled) cancelStepUpPrompt();
  };

  const submit = async () => {
    if (!password.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{
        ok: boolean;
        stepUpToken?: string;
        expiresIn?: number;
      }>("/admin/webauthn/password-stepup", {
        method: "POST",
        body: { password },
        silent401: true,
      });
      if (res?.stepUpToken) {
        useAdminStepUpStore
          .getState()
          .setToken(res.stepUpToken, res.expiresIn ?? 300);
        resolveStepUpPrompt(res.stepUpToken);
        close(false);
        toast.show("Verified — continuing", "success");
      } else {
        setError("Could not verify. Try again.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={() => close(true)}
      title="Confirm it's you"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: colors.primarySoft,
          borderRadius: 16,
          padding: spacing.md,
          marginBottom: spacing.md,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldCheck size={20} color={colors.primary} strokeWidth={2.25} />
        </View>
        <Text
          style={[
            typography.body.sm,
            { color: colors.textMuted, flex: 1 },
          ]}
        >
          This action is protected. Re-enter your admin password to continue.
        </Text>
      </View>

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Admin password"
        secureTextEntry
        showPasswordToggle
        leadingIcon={Lock}
        autoFocus
        onSubmitEditing={submit}
        returnKeyType="done"
      />

      {error ? (
        <Text
          style={[
            typography.caption,
            { color: colors.danger, marginTop: spacing.sm },
          ]}
        >
          {error}
        </Text>
      ) : null}

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button
          title={submitting ? "Verifying…" : "Verify & continue"}
          onPress={submit}
          disabled={!password.trim() || submitting}
          loading={submitting}
        />
        <Button
          title="Cancel"
          variant="ghost"
          onPress={() => close(true)}
          disabled={submitting}
        />
      </View>
      {submitting ? (
        <ActivityIndicator
          style={{ position: "absolute", opacity: 0 }}
          size="small"
        />
      ) : null}
    </BottomSheet>
  );
}

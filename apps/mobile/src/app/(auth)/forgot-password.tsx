import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Mail, ArrowRight, Lock, KeyRound } from "lucide-react-native";
import { useForgotPassword, useResetPassword } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  FormField,
  TextInput,
  Button,
  useToast,
} from "@/components/ui";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const forgot = useForgotPassword();
  const reset = useResetPassword();

  const [stage, setStage] = useState<"request" | "reset">("request");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function requestReset() {
    if (!emailOrPhone.trim()) {
      toast.show("Enter your email or phone", "warning");
      return;
    }
    const isEmail = emailOrPhone.includes("@");
    try {
      const res = await forgot.mutateAsync(
        isEmail ? { email: emailOrPhone } : { phone: emailOrPhone }
      );
      // In dev the API returns devToken; prefill it for convenience.
      if (res.devToken) {
        setToken(res.devToken);
        toast.show("Reset token created (dev)", "info");
      } else {
        toast.show(
          "If an account exists, a reset link has been sent.",
          "success"
        );
      }
      setStage("reset");
    } catch (err: any) {
      toast.show(err?.message || "Could not send reset", "danger");
    }
  }

  async function submitReset() {
    if (newPassword.length < 8) {
      toast.show("Password must be at least 8 characters", "warning");
      return;
    }
    if (newPassword !== confirm) {
      toast.show("Passwords don't match", "warning");
      return;
    }
    try {
      await reset.mutateAsync({ token, newPassword });
      toast.show("Password reset. Please sign in.", "success");
      router.replace("/(auth)/login");
    } catch (err: any) {
      toast.show(err?.message || "Reset failed", "danger");
    }
  }

  return (
    <Screen scroll keyboard padded edges={["top"]}>
      <ScreenHeader back title="Reset password" />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        {stage === "request" ? (
          <>
            <Text style={[typography.body.md, { color: colors.textMuted }]}>
              Enter your email or phone. We'll send a reset code (in
              development, the code appears below the form).
            </Text>
            <FormField label="Email or phone" required>
              <TextInput
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                leadingIcon={Mail}
              />
            </FormField>
            <Button
              title="Send reset link"
              onPress={requestReset}
              loading={forgot.isPending}
              iconRight={ArrowRight}
              size="lg"
              fullWidth
            />
          </>
        ) : (
          <>
            <FormField label="Reset token" required>
              <TextInput
                value={token}
                onChangeText={setToken}
                placeholder="Paste the token from your email"
                autoCapitalize="none"
                leadingIcon={KeyRound}
              />
            </FormField>
            <FormField label="New password" required>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                leadingIcon={Lock}
              />
            </FormField>
            <FormField label="Confirm password" required>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat new password"
                secureTextEntry
              />
            </FormField>
            <Button
              title="Update password"
              onPress={submitReset}
              loading={reset.isPending}
              size="lg"
              fullWidth
            />
          </>
        )}
      </View>
    </Screen>
  );
}
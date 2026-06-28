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

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function requestReset() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.show("Enter a valid email address", "warning");
      return;
    }
    try {
      await forgot.mutateAsync({ email: trimmed });
      setSent(true);
      toast.show(
        "If an account exists for that email, a reset link has been sent.",
        "success"
      );
    } catch (err: any) {
      toast.show(err?.message || "Could not send reset", "danger");
    }
  }

  return (
    <Screen scroll keyboard padded edges={["top"]}>
      <ScreenHeader back title="Reset password" />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={[typography.body.md, { color: colors.textMuted }]}>
          Enter the email on your account. We'll send a password reset link.
          The link works for a short time.
        </Text>
        <FormField label="Email" required>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!sent}
            leadingIcon={Mail}
          />
        </FormField>
        {sent ? (
          <View
            style={{
              padding: spacing.md,
              borderRadius: spacing.md,
              backgroundColor: colors.successSoft,
              borderWidth: 1,
              borderColor: colors.success,
            }}
          >
            <Text style={[typography.body.md, { color: colors.text }]}>
              Check your inbox for the reset link. Open it on this device to
              finish resetting your password.
            </Text>
          </View>
        ) : (
          <Button
            title="Send reset link"
            onPress={requestReset}
            loading={forgot.isPending}
            iconRight={ArrowRight}
            size="lg"
            fullWidth
          />
        )}
        <Button
          title="Back to sign in"
          onPress={() => router.replace("/(auth)/login")}
          variant="ghost"
          fullWidth
        />
      </View>
    </Screen>
  );
}
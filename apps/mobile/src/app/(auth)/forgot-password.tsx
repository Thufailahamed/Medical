import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Mail, ArrowRight, ChevronLeft, KeyRound } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useForgotPassword } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  FormField,
  TextInput,
  Button,
  IconButton,
  useToast,
} from "@/components/ui";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius, shadow } = useTheme();
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
      console.error("Forgot password error details:", err);
      let msg = "Could not send reset";
      if (err) {
        if (typeof err === "string") {
          msg = err;
        } else if (err.message && typeof err.message === "string" && err.message !== "{}" && err.message !== "[object Object]") {
          msg = err.message;
        } else {
          try {
            msg = JSON.stringify(err);
            if (msg === "{}" || msg === "[]" || !msg) {
              msg = err.toString ? err.toString() : "Could not send reset";
            }
          } catch {
            msg = "Could not send reset";
          }
        }
      }
      toast.show(msg, "danger");
    }
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top", "bottom"]} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Soft top gradient backdrop */}
      <LinearGradient
        colors={["#EEF2FF", "transparent"]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 240,
        }}
      />

      {/* Header Navigation */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          zIndex: 10,
        }}
      >
        <IconButton
          icon={ChevronLeft}
          onPress={() => router.replace("/(auth)/login")}
          variant="ghost"
          accessibilityLabel="Go back"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[typography.overline, { color: colors.primary, letterSpacing: 1, fontWeight: "700" }]}>
            HEALTHHUB
          </Text>
          <Text style={[typography.title.lg, { color: colors.text, fontWeight: "700" }]}>
            Reset password
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg }}>
        <Text style={[typography.body.md, { color: colors.textMuted, marginTop: -spacing.xs }]}>
          Enter the email on your account. We'll send a password reset link. The link works for a short time.
        </Text>

        {/* Form Card */}
        <View
          style={[
            {
              backgroundColor: colors.surface,
              borderRadius: radius.xxl,
              padding: spacing.xl,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.lg,
            },
            shadow.lg,
          ]}
        >
          <View style={{ alignItems: "center", marginVertical: spacing.xs }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.xl,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.primary + "15",
              }}
            >
              <KeyRound size={26} color={colors.primary} strokeWidth={2.25} />
            </View>
          </View>

          <FormField label="Email" required>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!sent}
              leadingIcon={Mail}
              tone="soft"
            />
          </FormField>

          {sent ? (
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.successSoft,
                borderWidth: 1,
                borderColor: colors.success + "20",
              }}
            >
              <Text style={[typography.body.md, { color: colors.text, lineHeight: 22 }]}>
                Check your inbox for the reset link. Open it on this device to finish resetting your password.
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
            style={{ marginTop: spacing.xs }}
          />
        </View>
      </View>
    </Screen>
  );
}
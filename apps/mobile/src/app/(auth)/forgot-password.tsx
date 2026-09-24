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
  const { spacing, colors, typography, radius, shadow, fontFamily } = useTheme();
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
    <Screen
      scroll
      keyboard
      padded={false}
      edges={["top", "bottom"]}
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      {/* Header Navigation */}
      <View
        style={{
          paddingHorizontal: spacing.xl,
          marginTop: 40,
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
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fill }}
        />
        <Text
          style={[
            typography.title.lg,
            { color: colors.text, fontFamily: fontFamily.heavy, letterSpacing: -0.4 },
          ]}
        >
          HealthHub
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: 40, paddingBottom: spacing.xxl, gap: 20 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 17,
            borderCurve: "continuous",
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <KeyRound size={26} color="#FFFFFF" strokeWidth={2.25} />
        </View>
        <View style={{ gap: 10, marginBottom: 8 }}>
          <Text style={[typography.display.lg, { color: colors.text }]}>
            Reset password
          </Text>
          <Text style={[typography.body.md, { color: colors.textMuted, lineHeight: 22 }]}>
            Enter the email on your account. We'll send a password reset link. The link works for a short time.
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: spacing.lg }}>

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
                padding: spacing.lg,
                borderRadius: radius.lg,
                borderCurve: "continuous",
                backgroundColor: colors.successSoft,
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
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, ArrowRight, HeartPulse, ShieldCheck } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Button,
  TextInput,
  FormField,
  useToast,
} from "@/components/ui";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, typography, radius, shadow } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const setUser = useAuthStore((s) => s.setUser);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const onSubmit = async (data: FormData) => {
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const res = await api<{ user: any; session: any }>("/auth/login", {
        method: "POST",
        body: { email: data.email, password: data.password },
      });

      if (res.session?.access_token) {
        await SecureStore.setItemAsync("auth_token", res.session.access_token);
      }

      setUser(res.user);
      toast.show("Welcome back", "success");
      // V3: route doctors straight to the portal, not the patient dashboard.
      const home =
        res.user?.role === "doctor" ? "/(app)/doctor" : "/(app)";
      router.replace(home as any);
    } catch (err: any) {
      console.error("Login error details:", err);
      let msg = "Could not sign in.";
      if (err) {
        if (typeof err === "string") {
          msg = err;
        } else if (err.message && typeof err.message === "string" && err.message !== "{}" && err.message !== "[object Object]") {
          msg = err.message;
        } else {
          try {
            msg = JSON.stringify(err);
            if (msg === "{}" || msg === "[]" || !msg) {
              msg = err.toString ? err.toString() : "Could not sign in.";
            }
          } catch {
            msg = "Could not sign in.";
          }
        }
      }
      setError("root", { message: msg });
      toast.show(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const goForgot = () => router.push("/(auth)/forgot-password");
  const goRegister = () => router.push("/(auth)/register" as any);

  return (
    <Screen
      keyboard
      scroll
      padded={false}
      bottomInset={false}
      edges={["top", "bottom"]}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      {/* Hero band — gradient + decorative shapes */}
      <View style={{ height: 320, position: "relative", overflow: "hidden" }}>
        <LinearGradient
          colors={["#1E3B8B", "#0F766E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />


        {/* Logo + brand */}
        <View
          style={{
            position: "absolute",
            top: 70,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <View
            style={[
              {
                width: 76,
                height: 76,
                borderRadius: 24,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
              },
              shadow.lg,
            ]}
          >
            <HeartPulse size={36} color={colors.primary} strokeWidth={2.25} />
          </View>
          <Text
            style={[
              typography.overline,
              {
                color: "#FFFFFF",
                opacity: 0.85,
                letterSpacing: 2.5,
                fontWeight: "700",
              },
            ]}
          >
            HEALTHHUB
          </Text>
        </View>
      </View>

      {/* Form card — overlapping hero */}
      <View
        style={{
          flex: 1,
          marginTop: -36,
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xl,
        }}
      >
        <View
          style={[
            {
              backgroundColor: colors.surface,
              borderRadius: radius.xxl,
              padding: spacing.xl,
              gap: spacing.lg,
            },
            shadow.lg,
          ]}
        >
          {/* Heading */}
          <View style={{ gap: spacing.xs, marginBottom: spacing.xs }}>
            <Text
              style={[
                typography.display.sm,
                {
                  color: colors.text,
                  fontWeight: "700",
                  fontSize: 24,
                  lineHeight: 32,
                },
              ]}
            >
              Welcome back
            </Text>
            <Text
              style={[
                typography.body.md,
                { color: colors.textMuted },
              ]}
            >
              Sign in to continue managing your health.
            </Text>
          </View>

          {/* Email */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormField
                label="Email"
                required
                error={errors.email?.message}
              >
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  leadingIcon={Mail}
                  invalid={!!errors.email}
                  tone="soft"
                />
              </FormField>
            )}
          />

          {/* Password */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormField
                label="Password"
                required
                error={errors.password?.message}
              >
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textSubtle}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  leadingIcon={Lock}
                  showPasswordToggle
                  invalid={!!errors.password}
                  tone="soft"
                />
              </FormField>
            )}
          />

          {/* Forgot password link */}
          <Pressable
            onPress={goForgot}
            accessibilityRole="link"
            hitSlop={8}
            style={{ alignSelf: "flex-end", marginTop: -spacing.sm }}
          >
            <Text
              style={[
                typography.label.md,
                { color: colors.primary, fontWeight: "700" },
              ]}
            >
              Forgot password?
            </Text>
          </Pressable>

          {/* Error banner */}
          {errors.root ? (
            <View
              style={{
                backgroundColor: colors.dangerSoft,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <ShieldCheck size={14} color={colors.danger} strokeWidth={2.5} />
              <Text
                style={[
                  typography.caption,
                  { color: colors.danger, fontWeight: "600", flex: 1 },
                ]}
                accessibilityLiveRegion="polite"
              >
                {errors.root.message}
              </Text>
            </View>
          ) : null}

          {/* Submit */}
          <Button
            title="Sign in"
            onPress={handleSubmit(onSubmit)}
            loading={submitting}
            size="lg"
            iconRight={ArrowRight}
          />

          {/* Divider */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text
              style={[
                typography.caption,
                { color: colors.textSubtle, fontWeight: "500" },
              ]}
            >
              or
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          {/* Register link */}
          <Pressable
            onPress={goRegister}
            accessibilityRole="link"
            hitSlop={8}
            style={{ alignItems: "center", paddingVertical: spacing.xs }}
          >
            <Text style={[typography.body.md, { color: colors.textMuted }]}>
              New to HealthHub?{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>
                Create account
              </Text>
            </Text>
          </Pressable>
        </View>

        {/* Footer micro-copy */}
        <Text
          style={[
            typography.caption,
            {
              color: colors.textSubtle,
              textAlign: "center",
              marginTop: spacing.lg,
            },
          ]}
        >
          By signing in you agree to our Terms & Privacy Policy.
        </Text>
      </View>
    </Screen>
  );
}
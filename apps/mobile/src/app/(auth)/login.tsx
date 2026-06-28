import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, ArrowRight, Sparkles } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Hero,
  Card,
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
  const { colors, spacing, typography } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

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
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setSubmitting(false);
    if (error) {
      const msg = error.message.toLowerCase().includes("invalid")
        ? "Email or password is incorrect."
        : error.message;
      setError("root", { message: msg });
      toast.show(msg, "danger");
    } else {
      toast.show("Welcome back", "success");
    }
  };

  return (
    <Screen
      keyboard
      padded={false}
      bottomInset={false}
      edges={["top", "bottom"]}
    >
      <Hero
        eyebrow="HealthHub"
        title="Your health, in rhythm"
        subtitle="Sign in to keep your care on track"
        right={
          <Pressable
            onPress={() => router.push("/(auth)/register" as any)}
            accessibilityRole="link"
            hitSlop={8}
            style={({ pressed }: any) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 999,
              backgroundColor: pressed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.18)",
            })}
          >
            <Text
              style={[
                typography.label.md,
                { color: colors.onPrimary },
              ]}
            >
              Sign up
            </Text>
          </Pressable>
        }
        status={[
          { icon: Sparkles, label: "Care that listens", tone: "accent2" },
        ]}
      />

      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xxl,
          paddingBottom: spacing.xl,
          gap: spacing.xl,
          marginTop: -spacing.xxxl,
          backgroundColor: colors.bg,
          borderTopLeftRadius: 36,
          borderTopRightRadius: 36,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.display.sm, { color: colors.text }]}>
            Welcome back
          </Text>
          <Text style={[typography.body.md, { color: colors.textMuted }]}>
            Sign in to continue to your account
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
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
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  leadingIcon={Mail}
                  invalid={!!errors.email}
                />
              </FormField>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormField
                label="Password"
                required
                error={errors.password?.message}
                helper="At least 6 characters"
              >
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Enter your password"
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  leadingIcon={Lock}
                  showPasswordToggle
                  invalid={!!errors.password}
                />
              </FormField>
            )}
          />

          {errors.root ? (
            <Text
              style={[
                typography.caption,
                { color: colors.danger, textAlign: "center" },
              ]}
              accessibilityLiveRegion="polite"
            >
              {errors.root.message}
            </Text>
          ) : null}

          <Button
            title="Sign in"
            onPress={handleSubmit(onSubmit)}
            loading={submitting}
            size="lg"
            iconRight={ArrowRight}
          />

          <Pressable
            onPress={() => toast.show("Password reset coming soon", "info")}
            accessibilityRole="link"
            hitSlop={8}
            style={{
              alignItems: "center",
              paddingVertical: spacing.sm,
            } as StyleProp<ViewStyle>}
          >
            <Text
              style={[
                typography.body.md,
                { color: colors.primary, fontWeight: "700" },
              ]}
            >
              Forgot password?
            </Text>
          </Pressable>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginVertical: spacing.xs,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={[typography.caption, { color: colors.textMuted }]}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Pressable
            onPress={() => router.push("/(auth)/register" as any)}
            accessibilityRole="link"
            hitSlop={8}
            style={{
              alignItems: "center",
              paddingVertical: spacing.sm,
            }}
          >
            <Text style={[typography.body.md, { color: colors.textMuted }]}>
              New here?{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>
                Create account
              </Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

import { useState } from "react";
import {
  View,
  Text,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  HeartPulse,
  ChevronLeft,
  IdCard,
} from "lucide-react-native";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Card,
  Button,
  TextInput,
  FormField,
  IconButton,
  useToast,
} from "@/components/ui";

const schema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    nic: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => !!d.email || !!d.phone, {
    message: "Email or phone is required",
    path: ["email"],
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();
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
    defaultValues: { name: "", email: "", phone: "", nic: "", password: "", confirm: "" },
    mode: "onBlur",
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const res = await api<{ user: any; session?: any; message?: string }>(
        "/auth/register",
        {
          method: "POST",
          body: {
            name: data.name,
            email: data.email || undefined,
            phone: data.phone || undefined,
            nic: data.nic || undefined,
            password: data.password,
            role: "patient",
          },
        }
      );

      if (res.session?.access_token && res.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: res.session.access_token,
          refresh_token: res.session.refresh_token,
        });
        setUser(res.user);
        toast.show("Account created", "success");
      } else {
        toast.show(
          res.message || "Account created. Please sign in.",
          "success"
        );
        router.replace("/(auth)/login" as any);
      }
    } catch (err: any) {
      const msg = err?.message || "Could not create account.";
      setError("root", { message: msg });
      toast.show(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false} keyboard scroll edges={["bottom"]}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <IconButton
          icon={ChevronLeft}
          onPress={() => router.back()}
          variant="ghost"
          accessibilityLabel="Go back"
        />
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <HeartPulse size={20} color={colors.primary} strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.overline, { color: colors.textMuted }]}>
            HealthHub
          </Text>
          <Text style={[typography.title.lg, { color: colors.text }]}>
            Create your account
          </Text>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
      >
        <Text
          style={[
            typography.body.md,
            { color: colors.textMuted, marginBottom: spacing.xs },
          ]}
        >
          Start managing your health today. It takes less than a minute.
        </Text>

        <Card padded={false}>
          <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
            <Text style={[typography.label.lg, { color: colors.textMuted, letterSpacing: 0.6 }]}>
              IDENTITY
            </Text>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.lg }}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField label="Full name" required error={errors.name?.message}>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="John Doe"
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    leadingIcon={User}
                    invalid={!!errors.name}
                  />
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Email"
                  helper="Provide email or phone number"
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
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField label="Phone (optional)">
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="+94 77 123 4567"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    leadingIcon={Phone}
                  />
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="nic"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField label="National ID (optional)" helper="Used for verification">
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="200012345678"
                    autoCapitalize="characters"
                    leadingIcon={IdCard}
                  />
                </FormField>
              )}
            />
          </View>
        </Card>

        <Card padded={false}>
          <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
            <Text style={[typography.label.lg, { color: colors.textMuted, letterSpacing: 0.6 }]}>
              SECURITY
            </Text>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.lg }}>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField label="Password" required error={errors.password?.message}>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="At least 8 characters"
                    secureTextEntry
                    autoComplete="password-new"
                    textContentType="newPassword"
                    leadingIcon={Lock}
                    showPasswordToggle
                    invalid={!!errors.password}
                  />
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="confirm"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Confirm password"
                  required
                  error={errors.confirm?.message}
                >
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Repeat password"
                    secureTextEntry
                    autoComplete="password-new"
                    textContentType="newPassword"
                    leadingIcon={Lock}
                    showPasswordToggle
                    invalid={!!errors.confirm}
                  />
                </FormField>
              )}
            />
          </View>
        </Card>

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
          title="Create account"
          onPress={handleSubmit(onSubmit)}
          loading={submitting}
          size="lg"
          iconRight={ArrowRight}
        />

        <Pressable
          onPress={() => router.push("/(auth)/login" as any)}
          accessibilityRole="link"
          hitSlop={8}
          style={{ alignItems: "center", paddingVertical: spacing.sm }}
        >
          <Text style={[typography.body.md, { color: colors.textMuted }]}>
            Already have an account?{" "}
            <Text style={{ color: colors.primary, fontWeight: "700" }}>
              Sign in
            </Text>
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
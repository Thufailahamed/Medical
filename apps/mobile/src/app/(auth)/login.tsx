import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  Lock,
  ArrowRight,
  Heart,
  Eye,
  EyeOff,
  ShieldCheck,
  IdCard,
  Calendar,
  KeyRound,
  MessageCircle,
} from "lucide-react-native";
import { api } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, useToast } from "@/components/ui";
import { isStructurallyValidNic, nicMatchesDob, parseDob } from "@/lib/format";

type Mode = "password" | "nic";

const passwordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const nicSchema = z.object({
  nic: z
    .string()
    .refine(isStructurallyValidNic, {
      message: "Enter a valid NIC (old: 9 digits + V/X, new: 12 digits)",
    }),
  dob: z.string().refine((s) => parseDob(s) !== null, {
    message: "Enter a valid past date (YYYY-MM-DD)",
  }),
});

type PasswordData = z.infer<typeof passwordSchema>;
type NicData = z.infer<typeof nicSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<Mode>("password");
  const toast = useToast();
  const setUser = useAuthStore((s) => s.setUser);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const {
    control: nicControl,
    handleSubmit: handleNicSubmit,
    setError: setNicError,
    formState: { errors: nicErrors },
  } = useForm<NicData>({
    resolver: zodResolver(nicSchema),
    defaultValues: { nic: "", dob: "" },
    mode: "onBlur",
  });

  const onSubmit = async (data: PasswordData) => {
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
      const home = res.user?.role === "doctor" ? "/(app)/doctor" : "/(app)";
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

  const onNicSubmit = async (data: NicData) => {
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const res = await api<{ user: any; session?: any; nextStep?: string }>(
        "/auth/login-by-nic",
        {
          method: "POST",
          body: { nic: data.nic.toUpperCase(), dob: data.dob },
        },
      );
      if (!res.session?.access_token || !res.user) {
        toast.show("Could not sign in", "danger");
        return;
      }
      // Issue is short-lived token; send OTP and route through verify screen.
      const sendRes = await api<{ sent: boolean; target: string }>(
        "/auth/send-otp",
        {
          method: "POST",
          body: {
            userId: res.user.id,
            channel: "mobile",
            purpose: "login",
          },
        },
      );
      toast.show(`Code sent to ${sendRes.target}`, "info");
      router.replace({
        pathname: "/(auth)/verify-otp",
        params: {
          userId: res.user.id,
          channel: "mobile",
          target: sendRes.target,
          mode: "login",
        },
      } as any);
    } catch (err: any) {
      const msg = err?.message ?? "Invalid credentials";
      setNicError("root", { message: msg });
      toast.show(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const goForgot = () => router.push("/(auth)/forgot-password");
  const goRegister = () => router.push("/(auth)/register" as any);

  // Phase 1.3: WhatsApp onboarding deep-link. The phone number is set
  // at build time via EXPO_PUBLIC_WA_PHONE. When unset the button is
  // hidden so the auth landing stays clean for builds that haven't
  // configured a bot yet.
  const waPhone =
    ((Constants.expoConfig as any)?.extra?.waPhone as string | undefined) ||
    "";
  const openWhatsApp = async () => {
    if (!waPhone) return;
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(
      "Hi HealthHub, I want to register.",
    )}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        toast.show("WhatsApp isn't installed on this device.", "danger");
        return;
      }
      await Linking.openURL(url);
    } catch {
      toast.show("Couldn't open WhatsApp. Try again.", "danger");
    }
  };

  return (
    <Screen
      keyboard
      scroll
      padded={false}
      bottomInset={true}
      edges={["top", "bottom"]}
      style={{ backgroundColor: "#FFFFFF" }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl }}
    >
      {/* Branding Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 40,
        }}
      >
        <Heart size={26} color={colors.primary} strokeWidth={2.25} />
        <Text
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: "#1D1B20",
            letterSpacing: 3,
            fontFamily: fontFamily.displayBold,
            marginLeft: 8,
          }}
        >
          HEALTHHUB
        </Text>
      </View>

      {/* Heading Section */}
      <View style={{ marginTop: 48, marginBottom: 24 }}>
        <Text
          style={{
            fontSize: 34,
            fontWeight: "800",
            color: "#1D1B20",
            fontFamily: fontFamily.displayBold,
            lineHeight: 42,
          }}
        >
          Welcome back.
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: "#7F7B8C",
            marginTop: 10,
            fontFamily: fontFamily.body,
            lineHeight: 22,
          }}
        >
          {mode === "password"
            ? "Sign in to continue managing your health."
            : "Use your national ID + date of birth — we'll send a code to verify."}
        </Text>
      </View>

      {/* Mode toggle */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#FFFFFF",
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "#E6E4EA",
          padding: 3,
          marginBottom: 24,
        }}
      >
        {([
          { value: "password", label: "Email + password", icon: Lock },
          { value: "nic", label: "National ID + OTP", icon: KeyRound },
        ] as const).map(({ value, label, icon: Icon }) => {
          const active = mode === value;
          return (
            <Pressable
              key={value}
              onPress={() => setMode(value)}
              accessibilityRole="button"
              accessibilityLabel={`Login with ${label}`}
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                borderRadius: 21,
                backgroundColor: active ? colors.primarySoft : "transparent",
              }}
            >
              <Icon
                size={14}
                color={active ? colors.primary : "#7F7B8C"}
                strokeWidth={2.5}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: active ? colors.primary : "#7F7B8C",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Form Fields */}
      {mode === "password" ? (
      <View style={{ gap: 20 }}>
        {/* Email Field */}
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomUnderlineInput
              label="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="you@example.com"
              icon={Mail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              error={errors.email?.message}
            />
          )}
        />

        {/* Password Field */}
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomUnderlineInput
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Enter your password"
              icon={Lock}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? EyeOff : Eye}
              onRightIconPress={() => setShowPassword(!showPassword)}
              error={errors.password?.message}
            />
          )}
        />

        {/* Forgot Password Link */}
        <Pressable
          onPress={goForgot}
          accessibilityRole="link"
          hitSlop={8}
          style={{ alignSelf: "flex-end", marginTop: -8 }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.primary,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            Forgot password?
          </Text>
        </Pressable>

        {/* Error Banner */}
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
              marginTop: 10,
            }}
          >
            <ShieldCheck size={14} color={colors.danger} strokeWidth={2.5} />
            <Text
              style={[
                typography.caption,
                { color: colors.danger, fontWeight: "600", flex: 1 },
              ]}
            >
              {errors.root.message}
            </Text>
          </View>
        ) : null}

        {/* Sign In Button */}
        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={submitting}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: submitting ? `${colors.primary}80` : colors.primary,
            height: 52,
            borderRadius: 26,
            marginTop: 20,
            opacity: pressed ? 0.8 : 1,
            gap: 8,
          })}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#FFFFFF",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                Sign in
              </Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2} />
            </>
          )}
        </Pressable>
      </View>
      ) : (
      // ─── NIC + DOB login flow ──────────────────────────────────
      <View style={{ gap: 20 }}>
        <Controller
          control={nicControl}
          name="nic"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomUnderlineInput
              label="National ID"
              value={value}
              onChangeText={(t) => onChange(t.toUpperCase())}
              onBlur={onBlur}
              placeholder="200012345678 or 123456789V"
              icon={IdCard}
              autoCapitalize="characters"
              error={nicErrors.nic?.message}
            />
          )}
        />

        <Controller
          control={nicControl}
          name="dob"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomUnderlineInput
              label="Date of birth"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="YYYY-MM-DD"
              icon={Calendar}
              keyboardType="numbers-and-punctuation"
              autoComplete="birthdate-full"
              error={nicErrors.dob?.message}
            />
          )}
        />

        {nicErrors.root ? (
          <View
            style={{
              backgroundColor: colors.dangerSoft,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginTop: 10,
            }}
          >
            <ShieldCheck size={14} color={colors.danger} strokeWidth={2.5} />
            <Text
              style={[
                typography.caption,
                { color: colors.danger, fontWeight: "600", flex: 1 },
              ]}
            >
              {nicErrors.root.message}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleNicSubmit(onNicSubmit)}
          disabled={submitting}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: submitting ? `${colors.primary}80` : colors.primary,
            height: 52,
            borderRadius: 26,
            marginTop: 20,
            opacity: pressed ? 0.8 : 1,
            gap: 8,
          })}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#FFFFFF",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                Send verification code
              </Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2} />
            </>
          )}
        </Pressable>

        <Text
          style={{
            fontSize: 12,
            color: "#7F7B8C",
            marginTop: 4,
            fontFamily: fontFamily.body,
            lineHeight: 18,
          }}
        >
          We'll text a 6-digit code to the mobile number on your account.
        </Text>
      </View>
      )}

      {/* Divider */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginTop: 24,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: "#E6E4EA" }} />
        <Text
          style={{
            fontSize: 12,
            color: "#7F7B8C",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 1,
            fontFamily: fontFamily.body,
          }}
        >
          or
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: "#E6E4EA" }} />
      </View>

      {/* WhatsApp onboarding (Phase 1.3). Hidden when EXPO_PUBLIC_WA_PHONE
          is unset so unfinished builds don't dangle a useless CTA. */}
      {waPhone ? (
        <Pressable
          onPress={openWhatsApp}
          accessibilityRole="button"
          accessibilityLabel="Continue with WhatsApp"
          hitSlop={8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            paddingVertical: spacing.md,
            marginTop: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: "#25D366",
            backgroundColor: "#FFFFFF",
          }}
        >
          <MessageCircle size={18} color="#25D366" />
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#128C7E",
              fontFamily: fontFamily.bodyBold,
            }}
          >
            Continue with WhatsApp
          </Text>
        </Pressable>
      ) : null}

      {/* Register footer link */}
      <Pressable
        onPress={goRegister}
        accessibilityRole="link"
        hitSlop={8}
        style={{ alignItems: "center", paddingVertical: spacing.xs, marginBottom: 40 }}
      >
        <Text style={{ fontSize: 15, color: "#7F7B8C", fontFamily: fontFamily.body }}>
          New to HealthHub?{" "}
          <Text style={{ color: colors.primary, fontWeight: "700", fontFamily: fontFamily.bodyBold }}>
            Create account
          </Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

function CustomUnderlineInput({
  label,
  value,
  onChangeText,
  placeholder,
  icon: Icon,
  secureTextEntry,
  rightIcon: RightIcon,
  onRightIconPress,
  error,
  onBlur,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  icon: any;
  secureTextEntry?: boolean;
  rightIcon?: any;
  onRightIconPress?: () => void;
  error?: string;
  onBlur?: () => void;
  [key: string]: any;
}) {
  const { colors, fontFamily } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 4 }}>
      {/* Label */}
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: "#7F7B8C",
            letterSpacing: 0.8,
            fontFamily: fontFamily.displayBold,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 11, color: colors.danger || "#FF3B30", marginLeft: 2 }}>*</Text>
      </View>

      {/* Input Row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingBottom: 8,
          borderBottomWidth: focused ? 2 : 1,
          borderBottomColor: focused ? colors.primary : "#E6E4EA",
        }}
      >
        <Icon size={18} color="#C4C0CC" style={{ marginRight: 10 }} />
        
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#C4C0CC"
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (onBlur) onBlur();
          }}
          style={{
            flex: 1,
            fontSize: 15,
            color: "#1D1B20",
            fontFamily: fontFamily.body,
            padding: 0,
          }}
          {...props}
        />

        {RightIcon && (
          <Pressable onPress={onRightIconPress} hitSlop={8}>
            <RightIcon size={18} color="#C4C0CC" />
          </Pressable>
        )}
      </View>

      {/* Error text */}
      {error && (
        <Text
          style={{
            fontSize: 12,
            color: colors.danger || "#FF3B30",
            marginTop: 6,
            fontFamily: fontFamily.body,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
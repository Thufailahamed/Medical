import { useState, type ReactNode, type ComponentProps } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
  TextInput,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Phone,
  ArrowRight,
  Heart,
  ShieldCheck,
  MessageCircle,
  Mail,
  Lock,
  Stethoscope,
  User,
  Eye,
  EyeOff,
} from "lucide-react-native";
import { api } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, useToast } from "@/components/ui";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { homeForRole } from "@/hooks/useProtectedRoute";

// SL mobile number validation: 07X XXXXXXX (10 digits) or +94 7X XXXXXXX
const phoneSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine(
      (v) => {
        const digits = v.replace(/[\s\-().+]/g, "");
        // 10-digit local: 07XXXXXXXX
        if (/^07[0-9]\d{7}$/.test(digits)) return true;
        // 11-digit with country code: 947XXXXXXXX
        if (/^947[0-9]\d{7}$/.test(digits)) return true;
        // With + prefix already stripped
        return false;
      },
      { message: "Enter a valid Sri Lankan mobile number (07X XXXX XXX)" },
    ),
});

type PhoneData = z.infer<typeof phoneSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily, scheme, shadow } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [staffMode, setStaffMode] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const quickLogin = async (phone: string) => {
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      // 1. Send OTP to get devCode
      const res = await api<{
        otpSent: boolean;
        userId: string;
        channel: string;
        target: string;
        expiresAt: string;
        devCode?: string;
      }>("/auth/login-by-phone", {
        method: "POST",
        body: { phone },
      });

      if (!res.otpSent) {
        toast.show("Could not send verification code", "danger");
        return;
      }

      if (!res.devCode) {
        router.push({
          pathname: "/(auth)/verify-otp",
          params: {
            userId: res.userId,
            channel: "mobile",
            target: res.target,
            mode: "login",
            preSent: "true",
          },
        } as any);
        return;
      }

      // 2. Auto-verify the OTP using the devCode
      const verifyRes = await api<{
        user: any;
        session?: any;
        mfaRequired?: "enroll" | "verify";
        mfaToken?: string;
      }>("/auth/verify-otp", {
        method: "POST",
        body: {
          userId: res.userId,
          channel: "mobile",
          code: res.devCode,
        },
      });

      // Round 2 P0: doctors may be redirected to MFA flow.
      if (verifyRes.mfaRequired && verifyRes.mfaToken) {
        await SecureStore.setItemAsync("auth_token", verifyRes.mfaToken);
        // NOTE: do NOT call setUser here — the mfaToken is not a full
        // session. Marking the store authenticated would race the route
        // guard (authed + in (auth) group → bounce to /(doctor)) and
        // skip the MFA screens entirely. The MFA screens mint the real
        // session via /mfa/verify-setup or /mfa/challenge.
        router.replace(
          verifyRes.mfaRequired === "enroll"
            ? ("/(auth)/mfa-setup" as any)
            : ("/(auth)/mfa-challenge" as any)
        );
        return;
      }

      if (verifyRes.session?.access_token) {
        queryClient.clear();
        await SecureStore.setItemAsync("auth_token", verifyRes.session.access_token);
        setUser(verifyRes.user);
        toast.show("Quick login successful!", "success");
        router.replace(homeForRole(verifyRes.user?.role) as any);
      } else {
        toast.show("Failed to log in", "danger");
      }
    } catch (err: any) {
      console.warn("Quick login error:", err);
      toast.show(err?.message || "Quick login failed", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PhoneData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
    mode: "onBlur",
  });

  const onSubmit = async (data: PhoneData) => {
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const res = await api<{
        otpSent: boolean;
        userId: string;
        channel: string;
        target: string;
        expiresAt: string;
        devCode?: string;
      }>("/auth/login-by-phone", {
        method: "POST",
        body: { phone: data.phone },
      });

      if (!res.otpSent) {
        toast.show("Could not send verification code", "danger");
        return;
      }

      router.push({
        pathname: "/(auth)/verify-otp",
        params: {
          userId: res.userId,
          channel: "mobile",
          target: res.target,
          mode: "login",
          preSent: "true",
          devCode: res.devCode || "",
        },
      } as any);
    } catch (err: any) {
      console.warn("Login error:", err);
      let msg = "Could not sign in.";
      if (err) {
        if (typeof err === "string") {
          msg = err;
        } else if (
          err.message &&
          typeof err.message === "string" &&
          err.message !== "{}" &&
          err.message !== "[object Object]"
        ) {
          msg = err.message;
        }
      }
      setError("root", { message: msg });
      toast.show(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  // Staff sign-in (doctors, admins, operators): same portal, email +
  // password credential instead of phone OTP. /auth/login mints the
  // correct audience token per role (admin tokens get aud:"admin").
  const submitStaff = async () => {
    Keyboard.dismiss();
    if (!staffEmail.trim() || !staffPassword) {
      setStaffError("Enter your email and password");
      return;
    }
    setSubmitting(true);
    setStaffError(null);
    try {
      const res = await api<{
        user: any;
        session?: any;
        mfaRequired?: "enroll" | "verify";
        mfaToken?: string;
      }>("/auth/login", {
        method: "POST",
        body: { email: staffEmail.trim(), password: staffPassword },
      });

      if (res.mfaRequired && res.mfaToken) {
        await SecureStore.setItemAsync("auth_token", res.mfaToken);
        // NOTE: do NOT call setUser here — see above. The MFA screens
        // mint the real session.
        router.replace(
          res.mfaRequired === "enroll"
            ? ("/(auth)/mfa-setup" as any)
            : ("/(auth)/mfa-challenge" as any)
        );
        return;
      }

      if (res.session?.access_token) {
        queryClient.clear();
        await SecureStore.setItemAsync("auth_token", res.session.access_token);
        setUser(res.user);
        toast.show("Welcome back", "success");
        router.replace(homeForRole(res.user?.role) as any);
      } else {
        setStaffError("Failed to sign in");
      }
    } catch (err: any) {
      setStaffError(err?.message || "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  const goRegister = () => router.push("/(auth)/register" as any);
  const goDemo = () => router.push("/(auth)/request-demo" as any);

  // Phase 1.3: WhatsApp onboarding deep-link.
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Soft brand glow behind the header (fixed; content scrolls over it) */}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.primarySoft, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 380,
        }}
      />
      <Screen
        keyboard
        scroll
        padded={false}
        bottomInset={true}
        edges={["top", "bottom"]}
        style={{ backgroundColor: "transparent" }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl }}
      >
        {/* Branding Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 20,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              borderCurve: "continuous",
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              ...shadow.primary,
            }}
          >
            <LinearGradient
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Heart size={20} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 19,
              color: colors.text,
              letterSpacing: -0.5,
              fontFamily: fontFamily.heavy,
              marginLeft: 10,
            }}
          >
            HealthHub
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.hairline,
              ...shadow.xs,
            }}
          >
            <Lock size={12} color={colors.success} strokeWidth={2.5} />
            <Text
              style={{
                fontSize: 12,
                color: colors.textMuted,
                fontFamily: fontFamily.bodySemibold,
              }}
            >
              Secure
            </Text>
          </View>
        </View>

        {/* Heading Section */}
        <View style={{ marginTop: 36, marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 12,
              color: colors.primary,
              fontFamily: fontFamily.bodyBold,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {staffMode ? "Staff sign in" : "Sign in"}
          </Text>
          <Text style={[typography.display.lg, { color: colors.text }]}>
            Welcome back
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textMuted,
              marginTop: 8,
              fontFamily: fontFamily.body,
              lineHeight: 22,
            }}
          >
            {staffMode
              ? "Use your work email and password to continue."
              : "Enter your mobile number and we'll text you a secure code."}
          </Text>
        </View>

        {/* Sign-in card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.hairline,
            padding: spacing.lg,
            ...shadow.card,
          }}
        >
          {/* Sign-in mode toggle */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.fill,
              borderRadius: 14,
              borderCurve: "continuous",
              padding: 3,
              marginBottom: 22,
            }}
          >
            {(
              [
                { key: "phone", label: "Mobile OTP", icon: Phone },
                { key: "staff", label: "Staff email", icon: Mail },
              ] as const
            ).map((opt) => {
              const active = staffMode === (opt.key === "staff");
              const Icon = opt.icon;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setStaffMode(opt.key === "staff")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 11,
                    borderCurve: "continuous",
                    backgroundColor: active
                      ? scheme === "dark"
                        ? colors.surfaceElevated
                        : colors.surface
                      : "transparent",
                    ...(active && scheme !== "dark" ? shadow.xs : shadow.none),
                  }}
                >
                  <Icon size={14} color={active ? colors.primary : colors.textMuted} />
                  <Text
                    style={{
                      fontSize: 13,
                      color: active ? colors.text : colors.textMuted,
                      fontFamily: fontFamily.bodyBold,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {staffMode ? (
            /* ─── Staff email + password sign-in ─── */
            <View style={{ gap: 16 }}>
              <Field
                label="Work email"
                icon={Mail}
                value={staffEmail}
                onChangeText={setStaffEmail}
                placeholder="you@clinic.lk"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Field
                label="Password"
                icon={Lock}
                value={staffPassword}
                onChangeText={setStaffPassword}
                placeholder="Enter your password"
                secure
                autoComplete="password"
                labelAction={
                  <Pressable
                    onPress={() => router.push("/(auth)/forgot-password" as any)}
                    hitSlop={8}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.primary,
                        fontFamily: fontFamily.bodySemibold,
                      }}
                    >
                      Forgot?
                    </Text>
                  </Pressable>
                }
              />

              {staffError ? <ErrorBanner message={staffError} /> : null}

              <PrimaryButton
                label="Sign in"
                onPress={submitStaff}
                loading={submitting}
              />

              {__DEV__ ? (
                <Pressable
                  onPress={() => {
                    setStaffEmail("admin@healthhub.local");
                    setStaffPassword("Admin#12345");
                  }}
                  hitSlop={8}
                  style={{ alignItems: "center", paddingVertical: 2 }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      fontFamily: fontFamily.bodySemibold,
                    }}
                  >
                    🛠️ Fill dev admin credentials
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            /* Phone number form */
            <View style={{ gap: 16 }}>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PhoneInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.phone?.message}
                  />
                )}
              />

              {errors.root?.message ? (
                <ErrorBanner message={errors.root.message} />
              ) : null}

              <PrimaryButton
                label="Send verification code"
                onPress={handleSubmit(onSubmit)}
                loading={submitting}
              />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <ShieldCheck size={13} color={colors.success} strokeWidth={2.5} />
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
                    fontFamily: fontFamily.body,
                  }}
                >
                  We'll text a 6-digit code to verify it's you.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: 28,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
          <Text
            style={{
              fontSize: 11,
              color: colors.textSubtle,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              fontFamily: fontFamily.bodySemibold,
            }}
          >
            or
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
        </View>

        {/* WhatsApp onboarding */}
        {waPhone ? (
          <Pressable
            onPress={openWhatsApp}
            accessibilityRole="button"
            accessibilityLabel="Continue with WhatsApp"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              height: 52,
              marginTop: spacing.lg,
              borderRadius: radius.button,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: "#25D366",
              backgroundColor: colors.surface,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <MessageCircle size={18} color="#25D366" />
            <Text
              style={{
                fontSize: 15,
                color: "#128C7E",
                fontFamily: fontFamily.bodyBold,
              }}
            >
              Continue with WhatsApp
            </Text>
          </Pressable>
        ) : null}

        {/* Create account — secondary action */}
        <Pressable
          onPress={goRegister}
          accessibilityRole="link"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 52,
            marginTop: waPhone ? spacing.sm : spacing.lg,
            borderRadius: radius.button,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.hairline,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.85 : 1,
            ...shadow.xs,
          })}
        >
          <Text
            style={{
              fontSize: 15,
              color: colors.textMuted,
              fontFamily: fontFamily.body,
            }}
          >
            New to HealthHub?
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.primary,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            Create account
          </Text>
        </Pressable>

        {/* Demo request link */}
        <Pressable
          onPress={goDemo}
          accessibilityRole="link"
          accessibilityLabel="Request a demo — opens a form for clinics and doctors"
          hitSlop={8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: spacing.sm,
            marginTop: spacing.md,
          }}
        >
          <Stethoscope size={14} color={colors.textMuted} />
          <Text
            style={{
              fontSize: 13,
              color: colors.textMuted,
              fontFamily: fontFamily.body,
            }}
          >
            Doctor or clinic?{" "}
            <Text style={{ color: colors.primary, fontFamily: fontFamily.bodySemibold }}>
              Request a demo
            </Text>
          </Text>
        </Pressable>

        <View style={{ flex: 1, minHeight: spacing.xl }} />

        {/* Quick Dev Login */}
        {__DEV__ ? (
          <View
            style={{
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.hairline,
              borderRadius: 16,
              borderCurve: "continuous",
              padding: spacing.md,
              gap: spacing.sm,
              marginBottom: spacing.lg,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: colors.textSubtle,
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: 1.2,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              🛠️ Dev quick login
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {(
                [
                  { label: "Doctor", phone: "0777313847", icon: Stethoscope, tint: colors.primary, soft: colors.primarySoft },
                  { label: "Patient", phone: "0771234567", icon: User, tint: colors.accent, soft: colors.accentSoft },
                ] as const
              ).map((d) => {
                const Icon = d.icon;
                return (
                  <Pressable
                    key={d.label}
                    onPress={() => quickLogin(d.phone)}
                    disabled={submitting}
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      height: 40,
                      borderRadius: 12,
                      borderCurve: "continuous",
                      backgroundColor: d.soft,
                      opacity: submitting ? 0.5 : pressed ? 0.8 : 1,
                    })}
                  >
                    <Icon size={14} color={d.tint} strokeWidth={2.5} />
                    <Text style={{ color: d.tint, fontSize: 13, fontFamily: fontFamily.bodyBold }}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </Screen>
    </View>
  );
}

// ─── Gradient primary button ───────────────────────────────
function PrimaryButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const { colors, fontFamily, radius, shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!loading, busy: !!loading }}
      style={({ pressed }) => ({
        borderRadius: radius.button,
        borderCurve: "continuous",
        marginTop: 4,
        opacity: loading ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        ...shadow.primary,
      })}
    >
      <LinearGradient
        colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height: 54,
          borderRadius: radius.button,
          borderCurve: "continuous",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Text
              style={{
                fontSize: 16,
                color: "#FFFFFF",
                fontFamily: fontFamily.bodyBold,
              }}
            >
              {label}
            </Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.25} />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ─── Inline error banner ───────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.dangerSoft,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderCurve: "continuous",
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
      >
        {message}
      </Text>
    </View>
  );
}

// ─── Labelled text field with focus ring ───────────────────
function Field({
  label,
  icon: Icon,
  secure,
  labelAction,
  ...inputProps
}: {
  label: string;
  icon: typeof Mail;
  secure?: boolean;
  labelAction?: ReactNode;
} & ComponentProps<typeof TextInput>) {
  const { colors, fontFamily, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          marginHorizontal: 2,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: colors.textMuted,
            fontFamily: fontFamily.bodySemibold,
          }}
        >
          {label}
        </Text>
        {labelAction}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: radius.field,
          borderCurve: "continuous",
          paddingHorizontal: 14,
          minHeight: 54,
          borderWidth: 1.5,
          borderColor: focused ? colors.primary : "transparent",
          backgroundColor: focused ? colors.surface : colors.fill,
        }}
      >
        <Icon
          size={18}
          color={focused ? colors.primary : colors.textSubtle}
          style={{ marginRight: 10 }}
        />
        <TextInput
          {...inputProps}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={secure && hidden}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={{
            flex: 1,
            fontSize: 16,
            color: colors.text,
            fontFamily: fontFamily.body,
            paddingVertical: 14,
          }}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            {hidden ? (
              <Eye size={18} color={colors.textSubtle} />
            ) : (
              <EyeOff size={18} color={colors.textSubtle} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Phone input with +94 prefix ───────────────────────────
function PhoneInput({
  value,
  onChangeText,
  onBlur,
  error,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const { colors, fontFamily, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text
        style={{
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fontFamily.bodySemibold,
          marginBottom: 8,
          marginLeft: 2,
        }}
      >
        Mobile number
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 56,
          paddingHorizontal: 14,
          borderRadius: radius.field,
          borderCurve: "continuous",
          backgroundColor: focused ? colors.surface : colors.fill,
          borderWidth: 1.5,
          borderColor: error
            ? colors.danger
            : focused
            ? colors.primary
            : "transparent",
        }}
      >
        {/* Country code */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 18 }}>🇱🇰</Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            +94
          </Text>
        </View>
        <View
          style={{
            width: 1,
            height: 24,
            backgroundColor: colors.separator,
            marginHorizontal: 12,
          }}
        />

        <TextInput
          value={value}
          onChangeText={(t) => {
            // Strip non-digits, allow + at start
            const clean = t.replace(/[^0-9+]/g, "");
            onChangeText(clean);
          }}
          placeholder="77 123 4567"
          placeholderTextColor={colors.textSubtle}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={15}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (onBlur) onBlur();
          }}
          style={{
            flex: 1,
            fontSize: 17,
            color: colors.text,
            fontFamily: fontFamily.bodySemibold,
            paddingVertical: 14,
            letterSpacing: 0.5,
          }}
        />
      </View>

      {error ? (
        <Text
          style={{
            fontSize: 12,
            color: colors.danger,
            marginTop: 6,
            marginLeft: 2,
            fontFamily: fontFamily.body,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

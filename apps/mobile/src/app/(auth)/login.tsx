import { useState } from "react";
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
} from "lucide-react-native";
import { api } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, useToast } from "@/components/ui";
import { LinearGradient } from "expo-linear-gradient";
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
  const { colors, spacing, typography, radius, fontFamily, scheme } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [staffMode, setStaffMode] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);
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
        setUser(verifyRes.user);
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
        setUser(res.user);
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
    <Screen
      keyboard
      scroll
      padded={false}
      bottomInset={true}
      edges={["top", "bottom"]}
      style={{ backgroundColor: colors.surface }}
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
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            borderCurve: "continuous",
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Heart size={22} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
        </View>
        <Text
          style={{
            fontSize: 20,
            color: colors.text,
            letterSpacing: -0.5,
            fontFamily: fontFamily.heavy,
            marginLeft: 12,
          }}
        >
          HealthHub
        </Text>
      </View>

      {/* Heading Section */}
      <View style={{ marginTop: 48, marginBottom: 32 }}>
        <Text
          style={[typography.display.lg, { color: colors.text }]}
        >
          Welcome back.
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: colors.textMuted,
            marginTop: 10,
            fontFamily: fontFamily.body,
            lineHeight: 22,
          }}
        >
          {staffMode
            ? "Sign in with your staff email and password."
            : "Enter your mobile number to receive a verification code."}
        </Text>
      </View>

      {/* Sign-in mode toggle */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.fill,
          borderRadius: 14,
          borderCurve: "continuous",
          padding: 3,
          marginBottom: 28,
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
                shadowColor: colors.shadow,
                shadowOpacity: active && scheme !== "dark" ? 0.1 : 0,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: active ? 2 : 0,
              }}
            >
              <Icon size={14} color={active ? colors.primary : colors.textMuted} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
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
        <View style={{ gap: 20 }}>
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
              Work email
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: radius.field,
                borderCurve: "continuous",
                paddingHorizontal: 14,
                minHeight: 54,
                backgroundColor: colors.fill,
              }}
            >
              <Mail size={18} color={colors.textSubtle} style={{ marginRight: 10 }} />
              <TextInput
                value={staffEmail}
                onChangeText={setStaffEmail}
                placeholder="you@clinic.lk"
                placeholderTextColor={colors.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.text,
                  fontFamily: fontFamily.body,
                  paddingVertical: 14,
                }}
              />
            </View>
          </View>

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
              Password
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: radius.field,
                borderCurve: "continuous",
                paddingHorizontal: 14,
                minHeight: 54,
                backgroundColor: colors.fill,
              }}
            >
              <Lock size={18} color={colors.textSubtle} style={{ marginRight: 10 }} />
              <TextInput
                value={staffPassword}
                onChangeText={setStaffPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textSubtle}
                secureTextEntry
                autoComplete="password"
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.text,
                  fontFamily: fontFamily.body,
                  paddingVertical: 14,
                }}
              />
            </View>
          </View>

          {staffError ? (
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
              >
                {staffError}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={submitStaff}
            disabled={submitting}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
              height: 54,
              borderRadius: radius.button,
              borderCurve: "continuous",
              overflow: "hidden",
              marginTop: 8,
              opacity: submitting ? 0.6 : pressed ? 0.88 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              gap: 8,
            })}
          >
            <LinearGradient
              pointerEvents="none"
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
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

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password" as any)}
            hitSlop={8}
            style={{ alignItems: "center", paddingVertical: spacing.xs }}
          >
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                fontFamily: fontFamily.body,
              }}
            >
              Forgot password?
            </Text>
          </Pressable>

          {__DEV__ ? (
            <Pressable
              onPress={() => {
                setStaffEmail("admin@healthhub.local");
                setStaffPassword("Admin#12345");
              }}
              hitSlop={8}
              style={{ alignItems: "center", paddingVertical: spacing.xs }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: colors.primary,
                  fontWeight: "700",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                🛠️ Fill dev admin credentials
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
      /* Phone number form */
      <View style={{ gap: 20 }}>
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
              marginTop: 4,
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

        {/* Send OTP Button */}
        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={submitting}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            height: 54,
            borderRadius: radius.button,
            borderCurve: "continuous",
            overflow: "hidden",
            marginTop: 8,
            opacity: submitting ? 0.6 : pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            gap: 8,
          })}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
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
            color: colors.textMuted,
            marginTop: 2,
            fontFamily: fontFamily.body,
            lineHeight: 18,
            textAlign: "center",
          }}
        >
          We'll text a 6-digit code to verify your identity.
        </Text>
      </View>
      )}

      {/* Divider */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginTop: 28,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: colors.surfaceMuted }} />
        <Text
          style={{
            fontSize: 12,
            color: colors.textMuted,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 1,
            fontFamily: fontFamily.body,
          }}
        >
          or
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.surfaceMuted }} />
      </View>

      {/* WhatsApp onboarding */}
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
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: "#25D366",
            backgroundColor: colors.surface,
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
        style={{
          alignItems: "center",
          paddingVertical: spacing.xs,
          marginTop: 20,
          marginBottom: 40,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            color: colors.textMuted,
            fontFamily: fontFamily.body,
          }}
        >
          New to HealthHub?{" "}
          <Text
            style={{
              color: colors.primary,
              fontWeight: "700",
              fontFamily: fontFamily.bodyBold,
            }}
          >
            Create account
          </Text>
        </Text>
      </Pressable>

      {/* Quick Dev Login Buttons */}
      {__DEV__ ? (
        <View style={{ gap: spacing.sm, marginVertical: spacing.md }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: colors.textMuted,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            🛠️ Dev Quick Login
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.md, justifyContent: "center" }}>
            <Pressable
              onPress={() => quickLogin("0777313847")}
              disabled={submitting}
              style={{
                flex: 1,
                backgroundColor: colors.fill,
                borderWidth: 1,
                borderColor: colors.primary,
                paddingVertical: spacing.md,
                borderRadius: 12,
                borderCurve: "continuous",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>
                As Doctor
              </Text>
            </Pressable>
            <Pressable
              onPress={() => quickLogin("0771234567")}
              disabled={submitting}
              style={{
                flex: 1,
                backgroundColor: colors.fill,
                borderWidth: 1,
                borderColor: colors.accent || "#008080",
                paddingVertical: spacing.md,
                borderRadius: 12,
                borderCurve: "continuous",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.accent || "#008080", fontWeight: "800", fontSize: 13 }}>
                As Patient
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Demo request link */}
      <Pressable
        onPress={goDemo}
        accessibilityRole="link"
        accessibilityLabel="Request a demo — opens a form for clinics and doctors"
        hitSlop={8}
        style={{
          alignItems: "center",
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            color: colors.primary,
            fontWeight: "700",
            fontFamily: fontFamily.bodyBold,
            textAlign: "center",
          }}
        >
          Are you a doctor or clinic? Request a demo →
        </Text>
      </Pressable>
    </Screen>
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
    <View style={{ marginBottom: 4 }}>
      {/* Label */}
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        <Text
          style={{
            fontSize: 13,
            color: colors.textMuted,
            fontFamily: fontFamily.bodySemibold,
            marginLeft: 2,
          }}
        >
          Mobile number
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: colors.danger || "#FF3B30",
            marginLeft: 2,
          }}
        >
          *
        </Text>
      </View>

      {/* Input Row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 56,
          paddingHorizontal: 14,
          borderRadius: radius.field,
          borderCurve: "continuous",
          backgroundColor: colors.fill,
          borderWidth: 1.5,
          borderColor: error
            ? colors.danger || "#FF3B30"
            : focused
            ? colors.primary
            : "transparent",
        }}
      >
        <Phone size={18} color={colors.textSubtle} style={{ marginRight: 10 }} />

        {/* Country code badge */}
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 9,
            borderCurve: "continuous",
            marginRight: 8,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            +94
          </Text>
        </View>

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
            fontSize: 18,
            color: colors.text,
            fontFamily: fontFamily.body,
            padding: 0,
            letterSpacing: 1,
          }}
        />
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
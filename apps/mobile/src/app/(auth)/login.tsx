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
  Phone,
  ArrowRight,
  Heart,
  ShieldCheck,
  MessageCircle,
} from "lucide-react-native";
import { api } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, useToast } from "@/components/ui";
import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";

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
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  const [submitting, setSubmitting] = useState(false);
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

      if (!res.otpSent || !res.devCode) {
        toast.show("Could not get dev verification code", "danger");
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
        const home = verifyRes.user?.role === "doctor" ? "/(doctor)" : "/(app)";
        router.replace(home as any);
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
      <View style={{ marginTop: 48, marginBottom: 32 }}>
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
          Enter your mobile number to receive a verification code.
        </Text>
      </View>

      {/* Phone number form */}
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
            backgroundColor: submitting
              ? `${colors.primary}80`
              : colors.primary,
            height: 52,
            borderRadius: 26,
            marginTop: 8,
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
            marginTop: 2,
            fontFamily: fontFamily.body,
            lineHeight: 18,
            textAlign: "center",
          }}
        >
          We'll text a 6-digit code to verify your identity.
        </Text>
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
            color: "#7F7B8C",
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
              color: "#7F7B8C",
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
                backgroundColor: "#F5F3FA",
                borderWidth: 1,
                borderColor: colors.primary,
                paddingVertical: spacing.md,
                borderRadius: 12,
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
                backgroundColor: "#F5F3FA",
                borderWidth: 1,
                borderColor: colors.accent || "#008080",
                paddingVertical: spacing.md,
                borderRadius: 12,
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
          paddingBottom: 8,
          borderBottomWidth: focused ? 2 : 1,
          borderBottomColor: error
            ? colors.danger || "#FF3B30"
            : focused
            ? colors.primary
            : "#E6E4EA",
        }}
      >
        <Phone size={18} color="#C4C0CC" style={{ marginRight: 10 }} />

        {/* Country code badge */}
        <View
          style={{
            backgroundColor: "#F5F3FA",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            marginRight: 8,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#1D1B20",
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
          placeholderTextColor="#C4C0CC"
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
            color: "#1D1B20",
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
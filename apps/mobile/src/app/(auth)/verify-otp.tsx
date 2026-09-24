import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, ChevronLeft, Heart, KeyRound, ShieldCheck } from "lucide-react-native";
import { api } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { homeForRole } from "@/hooks/useProtectedRoute";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, useToast } from "@/components/ui";
import { maskTarget } from "@/lib/format";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});
type FormData = z.infer<typeof schema>;

type Mode = "register" | "login";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId?: string;
    nic?: string;
    channel?: "mobile" | "email";
    target?: string;
    purpose?: string;
    mode?: Mode;
    preSent?: string;
    devCode?: string;
  }>();

  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  const toast = useToast();
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [otpHint, setOtpHint] = useState<string | null>(null); // dev-only copy from send-otp

  const channel: "mobile" | "email" = params.channel === "email" ? "email" : "mobile";
  const mode: Mode = params.mode === "login" ? "login" : "register";

  const codeRef = useRef<TextInput>(null);
  useEffect(() => {
    const t = setTimeout(() => codeRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
    mode: "onSubmit",
  });

  async function callSendOtp(): Promise<string | null> {
    try {
      const res = await api<{
        sent: boolean;
        target: string;
        devCode?: string;
      }>("/auth/send-otp", {
        method: "POST",
        body: {
          userId: params.userId,
          nic: params.nic,
          channel,
          purpose: mode === "login" ? "login" : "register",
        },
      });
      setSecondsLeft(60);
      return res.devCode ?? null;
    } catch (e: any) {
      toast.show(e?.message ?? "Could not send OTP", "danger");
      return null;
    }
  }

  useEffect(() => {
    // Auto-send on first mount so the user is not stuck on an empty screen.
    if (params.preSent === "true") {
      if (params.devCode) {
        setOtpHint(params.devCode);
      }
      return;
    }
    (async () => {
      const hint = await callSendOtp();
      if (hint) setOtpHint(hint);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (data: FormData) => {
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const res = await api<{
        user: any;
        session?: any;
        mfaRequired?: "enroll" | "verify";
        mfaToken?: string;
        expiresAt?: number;
      }>("/auth/verify-otp", {
        method: "POST",
        body: {
          userId: params.userId,
          nic: params.nic,
          channel,
          code: data.code,
        },
      });

      // Round 2 P0: doctors with MFA pending/enrolled get a short-lived
      // mfaToken instead of a session. Route to the MFA flow.
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
        toast.show(
          mode === "login" ? "Welcome back" : "Account verified",
          "success",
        );
        router.replace(homeForRole(res.user?.role) as any);
      } else {
        router.replace("/(auth)/login" as any);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Could not verify OTP";
      setError("root", { message: msg });
      toast.show(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  async function resend() {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    const hint = await callSendOtp();
    if (hint) {
      toast.show(`Code: ${hint} (dev only)`, "info");
    }
    setResending(false);
  }

  const masked = params.target ? maskTarget(params.target) : maskTarget("");

  return (
    <Screen
      keyboard
      scroll
      padded={false}
      edges={["top", "bottom"]}
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 40 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            backgroundColor: pressed ? colors.fillStrong : colors.fill,
          })}
        >
          <ChevronLeft size={22} color={colors.text} strokeWidth={2.25} />
        </Pressable>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
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
            style={StyleSheet.absoluteFill}
          />
          <Heart size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
        </View>
        <Text
          style={{
            fontSize: 18,
            color: colors.text,
            letterSpacing: -0.4,
            fontFamily: fontFamily.heavy,
            marginLeft: 10,
          }}
        >
          HealthHub
        </Text>
      </View>

      <View style={{ marginTop: 40, marginBottom: 32 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 17,
            borderCurve: "continuous",
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <KeyRound size={26} color={colors.primary} strokeWidth={2.1} />
        </View>
        <Text style={[typography.display.lg, { color: colors.text }]}>
          {mode === "login" ? "Verify it's you" : "Verify your account"}
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
          {`We sent a 6-digit code to ${masked || (channel === "mobile" ? "your phone" : "your email")}.`}
        </Text>
      </View>

      <View style={{ gap: 18 }}>
        <Controller
          control={control}
          name="code"
          render={({ field: { onChange, value } }) => (
            <View>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  fontFamily: fontFamily.bodySemibold,
                  marginLeft: 2,
                  marginBottom: 8,
                }}
              >
                6-digit code
              </Text>
              <View style={{ position: "relative" }}>
                {/* Visual OTP cells — the real TextInput sits transparently on top */}
                <View
                  pointerEvents="none"
                  style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}
                >
                  {Array.from({ length: 6 }).map((_, i) => {
                    const digit = (value || "")[i] ?? "";
                    const isActive =
                      i === Math.min((value || "").length, 5) && (value || "").length < 6;
                    const borderColor = errors.code
                      ? colors.danger
                      : isActive
                      ? colors.primary
                      : "transparent";
                    return (
                      <View
                        key={i}
                        style={{
                          flex: 1,
                          maxWidth: 56,
                          aspectRatio: 0.86,
                          borderRadius: radius.field,
                          borderCurve: "continuous",
                          backgroundColor: digit ? colors.primarySoft : colors.fill,
                          borderWidth: 2,
                          borderColor,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {digit ? (
                          <Text
                            style={[
                              typography.display.md,
                              { color: colors.text, fontVariant: ["tabular-nums"] },
                            ]}
                          >
                            {digit}
                          </Text>
                        ) : isActive && !errors.code ? (
                          <View
                            style={{
                              width: 2,
                              height: 24,
                              borderRadius: 1,
                              backgroundColor: colors.primary,
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: colors.borderStrong,
                            }}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
                <TextInput
                  ref={codeRef}
                  value={value}
                  onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  placeholderTextColor="transparent"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  caretHidden
                  selectionColor="transparent"
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    fontSize: 22,
                    letterSpacing: 8,
                    color: "transparent",
                    fontFamily: fontFamily.bodyBold,
                    opacity: 0.02,
                  }}
                />
              </View>
              {errors.code ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.danger,
                    marginTop: 6,
                    fontFamily: fontFamily.body,
                  }}
                >
                  {errors.code.message}
                </Text>
              ) : null}
            </View>
          )}
        />

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
            >
              {errors.root.message}
            </Text>
          </View>
        ) : null}

        {otpHint ? (
          <View
            style={{
              backgroundColor: colors.warningSoft ?? colors.primarySoft,
              paddingVertical: spacing.sm + 2,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderCurve: "continuous",
            }}
          >
            <Text style={[typography.caption, { color: colors.warning }]}>
              {`Dev mode: code is ${otpHint}. Auto-fills the field if you paste it.`}
            </Text>
          </View>
        ) : null}

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
            marginTop: 10,
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
                Verify
              </Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2} />
            </>
          )}
        </Pressable>

        <Pressable
          onPress={resend}
          disabled={secondsLeft > 0 || resending}
          style={{ alignItems: "center", paddingVertical: spacing.sm }}
        >
          <Text
            style={{
              fontSize: 14,
              color: secondsLeft > 0 ? colors.textSubtle : colors.primary,
              fontVariant: ["tabular-nums"],
              fontWeight: "700",
              fontFamily: fontFamily.bodyBold,
            }}
          >
            {resending
              ? "Sending..."
              : secondsLeft > 0
              ? `Resend code in ${secondsLeft}s`
              : "Resend code"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
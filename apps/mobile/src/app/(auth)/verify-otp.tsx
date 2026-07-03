import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, ChevronLeft, Heart, KeyRound, ShieldCheck } from "lucide-react-native";
import { api } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
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
      const res = await api<{ user: any; session?: any }>("/auth/verify-otp", {
        method: "POST",
        body: {
          userId: params.userId,
          nic: params.nic,
          channel,
          code: data.code,
        },
      });

      if (res.session?.access_token) {
        queryClient.clear();
        await SecureStore.setItemAsync("auth_token", res.session.access_token);
        setUser(res.user);
        toast.show(
          mode === "login" ? "Welcome back" : "Account verified",
          "success",
        );
        const home = res.user?.role === "doctor" ? "/(doctor)" : "/(app)";
        router.replace(home as any);
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
      style={{ backgroundColor: "#FFFFFF" }}
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
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
            marginLeft: -8,
          })}
        >
          <ChevronLeft size={24} color={colors.primary} />
        </Pressable>
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

      <View style={{ marginTop: 36, marginBottom: 32 }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: "800",
            color: "#1D1B20",
            fontFamily: fontFamily.displayBold,
            lineHeight: 40,
          }}
        >
          {mode === "login" ? "Verify it's you" : "Verify your account"}
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
                  fontSize: 11,
                  fontWeight: "800",
                  color: "#7F7B8C",
                  letterSpacing: 0.8,
                  fontFamily: fontFamily.displayBold,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                6-digit code
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: errors.code ? colors.danger : "#E6E4EA",
                  borderRadius: radius.md,
                  paddingHorizontal: 12,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <KeyRound size={18} color="#C4C0CC" style={{ marginRight: 10 }} />
                <TextInput
                  ref={codeRef}
                  value={value}
                  onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  placeholderTextColor="#C4C0CC"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  style={{
                    flex: 1,
                    fontSize: 22,
                    letterSpacing: 8,
                    color: "#1D1B20",
                    fontFamily: fontFamily.bodyBold,
                    paddingVertical: 14,
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
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
            }}
          >
            <Text style={[typography.caption, { color: colors.text }]}>
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
            backgroundColor: submitting ? `${colors.primary}80` : colors.primary,
            height: 52,
            borderRadius: 26,
            marginTop: 10,
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
              color: secondsLeft > 0 ? "#7F7B8C" : colors.primary,
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
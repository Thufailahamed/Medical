import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, ArrowRight, Heart, Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { api } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, useToast } from "@/components/ui";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  const goForgot = () => router.push("/(auth)/forgot-password");
  const goRegister = () => router.push("/(auth)/register" as any);

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
          Sign in to continue managing your health.
        </Text>
      </View>

      {/* Form Fields */}
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
      </View>
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
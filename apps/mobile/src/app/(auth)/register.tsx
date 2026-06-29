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
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  HeartPulse,
  Stethoscope,
  ChevronLeft,
  IdCard,
  Search,
  X,
  ShieldCheck,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { useSpecialties, useHospitals } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  Button,
  TextInput,
  FormField,
  IconButton,
  Pill,
  Skeleton,
  useToast,
} from "@/components/ui";

const schema = z
  .object({
    role: z.enum(["patient", "doctor"]),
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    nic: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
    doctorProfile: z
      .object({
        specialization: z.string().optional(),
        registrationNumber: z.string().optional(),
        hospitalId: z.string().optional(),
      })
      .optional(),
  })
  .refine((d) => !!d.email || !!d.phone, {
    message: "Email or phone is required",
    path: ["email"],
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  })
  .refine(
    (d) =>
      d.role !== "doctor" || !!(d.doctorProfile?.specialization || "").trim(),
    {
      message: "Specialization is required for doctor accounts",
      path: ["doctorProfile", "specialization"],
    }
  );

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, spacing, typography, radius, shadow } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [showOtherSpecialty, setShowOtherSpecialty] = useState(false);
  const debouncedHospitalQuery = useDebounce(hospitalQuery, 300);
  const { data: specialtiesData } = useSpecialties();
  const { data: hospitalsData, isLoading: hospitalsLoading } = useHospitals(
    role === "doctor" ? debouncedHospitalQuery : ""
  );
  const specialties: string[] = specialtiesData?.specialties || [];
  const hospitals: any[] = hospitalsData?.hospitals || [];
  const toast = useToast();
  const setUser = useAuthStore((s) => s.setUser);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "patient",
      name: "",
      email: "",
      phone: "",
      nic: "",
      password: "",
      confirm: "",
      doctorProfile: {
        specialization: "",
        registrationNumber: "",
        hospitalId: "",
      },
    },
    mode: "onBlur",
  });

  const selectedSpecialization = watch("doctorProfile.specialization");
  const selectedHospitalId = watch("doctorProfile.hospitalId");

  const onSubmit = async (data: FormData) => {
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const body: any = {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        nic: data.nic || undefined,
        password: data.password,
        role: data.role,
      };
      if (data.role === "doctor") {
        body.doctorProfile = {
          specialization: (data.doctorProfile?.specialization || "").trim(),
          registrationNumber:
            data.doctorProfile?.registrationNumber?.trim() || undefined,
          hospitalId: data.doctorProfile?.hospitalId || undefined,
        };
      }
      const res = await api<{ user: any; session?: any; message?: string }>(
        "/auth/register",
        {
          method: "POST",
          body,
        }
      );

      if (res.session?.access_token) {
        await SecureStore.setItemAsync("auth_token", res.session.access_token);
        setUser(res.user);
        toast.show("Account created", "success");
        // V3: route doctors straight to the portal.
        const home =
          (data.role as string) === "doctor" ? "/(app)/doctor" : "/(app)";
        router.replace(home as any);
      } else {
        toast.show(
          res.message || "Account created. Please sign in.",
          "success"
        );
        router.replace("/(auth)/login" as any);
      }
    } catch (err: any) {
      console.error("Registration error details:", err);
      let msg = "Could not create account.";
      if (err) {
        if (typeof err === "string") {
          msg = err;
        } else if (err.message && typeof err.message === "string" && err.message !== "{}" && err.message !== "[object Object]") {
          msg = err.message;
        } else {
          try {
            msg = JSON.stringify(err);
            if (msg === "{}" || msg === "[]" || !msg) {
              msg = err.toString ? err.toString() : "Could not create account.";
            }
          } catch {
            msg = "Could not create account.";
          }
        }
      }
      setError("root", { message: msg });
      toast.show(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      padded={false}
      keyboard
      scroll
      edges={["top", "bottom"]}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      {/* Compact hero band */}
      <View
        style={{
          position: "relative",
          overflow: "hidden",
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          paddingHorizontal: spacing.lg,
        }}
      >
        <LinearGradient
          colors={["#1E3B8B", "#0F766E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />


        {/* Top bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.lg,
          }}
        >
          <IconButton
            icon={ChevronLeft}
            onPress={() => router.back()}
            variant="ghost"
            accessibilityLabel="Go back"
            tint="#FFFFFF"
            style={{
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: 0,
            }}
          />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text
              style={[
                typography.overline,
                {
                  color: "#FFFFFF",
                  opacity: 0.85,
                  letterSpacing: 2,
                  fontWeight: "700",
                },
              ]}
            >
              HEALTHHUB
            </Text>
            <Text
              style={[
                typography.title.lg,
                { color: "#FFFFFF", fontWeight: "700" },
              ]}
            >
              {role === "doctor" ? "Join as a doctor" : "Create account"}
            </Text>
          </View>
        </View>

        {/* Logo */}
        <View style={{ alignItems: "center" }}>
          <View
            style={[
              {
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              },
              shadow.lg,
            ]}
          >
            <HeartPulse size={30} color={colors.primary} strokeWidth={2.25} />
          </View>
        </View>
      </View>

      {/* Form card overlapping hero */}
      <View
        style={{
          flex: 1,
          marginTop: -spacing.xl,
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
          {/* Subtitle */}
          <Text
            style={[typography.body.md, { color: colors.textMuted, marginTop: -spacing.xs }]}
          >
            {role === "doctor"
              ? "Set up your practice profile so patients can find and book you."
              : "Start managing your health today. It takes less than a minute."}
          </Text>

          {/* Segmented role selector */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surfaceMuted,
              borderRadius: radius.full,
              padding: 4,
            }}
          >
            {(
              [
                { value: "patient", label: "Patient", Icon: HeartPulse },
                { value: "doctor", label: "Doctor", Icon: Stethoscope },
              ] as const
            ).map(({ value, label, Icon }) => {
              const active = role === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    setRole(value);
                    setValue("role", value);
                    if (value === "patient") {
                      setValue("doctorProfile.specialization", "");
                      setValue("doctorProfile.registrationNumber", "");
                      setValue("doctorProfile.hospitalId", "");
                      setShowOtherSpecialty(false);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Register as ${label}`}
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.xs,
                    paddingVertical: 10,
                    borderRadius: radius.full,
                    backgroundColor: active ? colors.surface : "transparent",
                    ...(active ? shadow.sm : null),
                  }}
                >
                  <Icon
                    size={16}
                    color={active ? colors.primary : colors.textMuted}
                    strokeWidth={2.25}
                  />
                  <Text
                    style={[
                      typography.label.md,
                      {
                        color: active ? colors.text : colors.textMuted,
                        fontWeight: active ? "700" : "600",
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Identity */}
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
                  placeholderTextColor={colors.textSubtle}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  leadingIcon={User}
                  invalid={!!errors.name}
                  tone="soft"
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
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  leadingIcon={Phone}
                  tone="soft"
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
                  placeholderTextColor={colors.textSubtle}
                  autoCapitalize="characters"
                  leadingIcon={IdCard}
                  tone="soft"
                />
              </FormField>
            )}
          />

          {/* Security */}
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
                  placeholderTextColor={colors.textSubtle}
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType="newPassword"
                  leadingIcon={Lock}
                  showPasswordToggle
                  invalid={!!errors.password}
                  tone="soft"
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
                  placeholderTextColor={colors.textSubtle}
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType="newPassword"
                  leadingIcon={Lock}
                  showPasswordToggle
                  invalid={!!errors.confirm}
                  tone="soft"
                />
              </FormField>
            )}
          />

          {/* Doctor profile */}
          {role === "doctor" ? (
            <>
              {/* Section label */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
                <Stethoscope size={14} color={colors.primary} strokeWidth={2.5} />
                <Text
                  style={[
                    typography.overline,
                    { color: colors.primary, letterSpacing: 1.5, fontWeight: "700" },
                  ]}
                >
                  Practice details
                </Text>
              </View>

              <FormField
                label="Specialty"
                required
                error={errors.doctorProfile?.specialization?.message}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.xs,
                    marginBottom: spacing.xs,
                  }}
                >
                  {specialties.map((s) => (
                    <Pill
                      key={s}
                      label={s}
                      tone={selectedSpecialization === s ? "primary" : "neutral"}
                      onPress={() => {
                        setValue("doctorProfile.specialization", s, {
                          shouldValidate: true,
                        });
                        setShowOtherSpecialty(false);
                      }}
                    />
                  ))}
                  <Pill
                    label="Other"
                    tone={showOtherSpecialty ? "primary" : "neutral"}
                    onPress={() => {
                      setShowOtherSpecialty((v) => !v);
                      setValue("doctorProfile.specialization", "", {
                        shouldValidate: false,
                      });
                    }}
                  />
                </View>
                {showOtherSpecialty ? (
                  <Controller
                    control={control}
                    name="doctorProfile.specialization"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        value={value}
                        onChangeText={(t) => onChange(t, { shouldValidate: true })}
                        onBlur={onBlur}
                        placeholder="e.g., Cardiology"
                        placeholderTextColor={colors.textSubtle}
                        autoCapitalize="words"
                        leadingIcon={Stethoscope}
                        tone="soft"
                      />
                    )}
                  />
                ) : null}
              </FormField>

              <Controller
                control={control}
                name="doctorProfile.registrationNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField
                    label="SLMC registration number"
                    helper="Sri Lanka Medical Council ID"
                  >
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="e.g., 12345"
                      placeholderTextColor={colors.textSubtle}
                      autoCapitalize="characters"
                      leadingIcon={IdCard}
                      tone="soft"
                    />
                  </FormField>
                )}
              />

              <FormField
                label="Hospital (optional)"
                helper="You can update this later in your profile."
                error={errors.doctorProfile?.hospitalId?.message}
              >
                <TextInput
                  value={hospitalQuery}
                  onChangeText={setHospitalQuery}
                  placeholder="Search hospitals"
                  placeholderTextColor={colors.textSubtle}
                  leadingIcon={Search}
                  tone="soft"
                  autoCapitalize="none"
                />
                {selectedHospitalId ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      borderRadius: radius.md,
                      backgroundColor: colors.primarySoft,
                      marginTop: spacing.xs,
                      borderWidth: 1,
                      borderColor: colors.primary + "20",
                    }}
                  >
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.text, flex: 1, fontWeight: "600" },
                      ]}
                    >
                      {hospitals.find((h) => h.id === selectedHospitalId)?.name || "Selected hospital"}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setValue("doctorProfile.hospitalId", "");
                        setHospitalQuery("");
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Clear hospital"
                    >
                      <X size={16} color={colors.primary} />
                    </Pressable>
                  </View>
                ) : hospitalsLoading ? (
                  <View style={{ marginTop: spacing.xs }}>
                    <Skeleton height={48} radius={radius.md} />
                  </View>
                ) : hospitals.length > 0 ? (
                  <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                    {hospitals.slice(0, 5).map((h: any) => (
                      <Pressable
                        key={h.id}
                        onPress={() =>
                          setValue("doctorProfile.hospitalId", h.id, {
                            shouldValidate: true,
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${h.name}`}
                        style={({ pressed }) => ({
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                          borderRadius: radius.md,
                          backgroundColor: pressed ? colors.primarySoft : colors.surfaceMuted,
                          borderWidth: 1,
                          borderColor: colors.border,
                        })}
                      >
                        <Text style={[typography.body.sm, { color: colors.text, fontWeight: "600" }]}>
                          {h.name}
                        </Text>
                        {h.address ? (
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textMuted, marginTop: 2 },
                            ]}
                            numberOfLines={1}
                          >
                            {h.address}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </FormField>
            </>
          ) : null}

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
            title={role === "doctor" ? "Create doctor account" : "Create account"}
            onPress={handleSubmit(onSubmit)}
            loading={submitting}
            size="lg"
            iconRight={ArrowRight}
          />

          {/* Sign in link */}
          <Pressable
            onPress={() => router.push("/(auth)/login" as any)}
            accessibilityRole="link"
            hitSlop={8}
            style={{ alignItems: "center", paddingVertical: spacing.xs }}
          >
            <Text style={[typography.body.md, { color: colors.textMuted }]}>
              Already have an account?{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>
                Sign in
              </Text>
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
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
          By creating an account you agree to our Terms & Privacy Policy.
        </Text>
      </View>
    </Screen>
  );
}
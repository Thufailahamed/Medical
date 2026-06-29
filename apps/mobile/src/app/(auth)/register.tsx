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
  Stethoscope,
  ChevronLeft,
  IdCard,
  Stethoscope as DoctorIcon,
  Search,
  X,
} from "lucide-react-native";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { useSpecialties, useHospitals } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  Card,
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
  const { colors, spacing, typography } = useTheme();
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
          {role === "doctor" ? (
            <Stethoscope size={20} color={colors.primary} strokeWidth={2.25} />
          ) : (
            <HeartPulse size={20} color={colors.primary} strokeWidth={2.25} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.overline, { color: colors.textMuted }]}>
            HealthHub
          </Text>
          <Text style={[typography.title.lg, { color: colors.text }]}>
            {role === "doctor" ? "Join as a doctor" : "Create your account"}
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
          {role === "doctor"
            ? "Set up your practice profile so patients can find and book you."
            : "Start managing your health today. It takes less than a minute."}
        </Text>

        {/* Role selector */}
        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.xs,
          }}
        >
          <Pill
            label="Patient"
            tone={role === "patient" ? "primary" : "neutral"}
            onPress={() => {
              setRole("patient");
              setValue("role", "patient");
              setValue("doctorProfile.specialization", "");
              setValue("doctorProfile.registrationNumber", "");
              setValue("doctorProfile.hospitalId", "");
              setShowOtherSpecialty(false);
            }}
          />
          <Pill
            label="Doctor"
            tone={role === "doctor" ? "primary" : "neutral"}
            onPress={() => {
              setRole("doctor");
              setValue("role", "doctor");
            }}
          />
        </View>

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

        {role === "doctor" ? (
          <Card padded={false}>
            <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
              <Text
                style={[
                  typography.label.lg,
                  { color: colors.textMuted, letterSpacing: 0.6 },
                ]}
              >
                DOCTOR PROFILE
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: spacing.lg,
                gap: spacing.lg,
                paddingBottom: spacing.lg,
              }}
            >
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
                  }}
                >
                  {specialties.map((s) => (
                    <Pill
                      key={s}
                      label={s}
                      tone={
                        selectedSpecialization === s ? "primary" : "neutral"
                      }
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
                        onChangeText={(t) =>
                          onChange(t, { shouldValidate: true })
                        }
                        onBlur={onBlur}
                        placeholder="e.g., Cardiology"
                        autoCapitalize="words"
                        leadingIcon={DoctorIcon}
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
                      autoCapitalize="characters"
                      leadingIcon={IdCard}
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
                      borderRadius: 12,
                      backgroundColor: colors.primarySoft,
                    }}
                  >
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.text, flex: 1 },
                      ]}
                    >
                      {hospitals.find((h) => h.id === selectedHospitalId)
                        ?.name || "Selected hospital"}
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
                      <X size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ) : hospitalsLoading ? (
                  <Skeleton height={48} radius={12} />
                ) : hospitals.length > 0 ? (
                  <View style={{ gap: spacing.xs }}>
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
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: pressed
                            ? colors.primarySoft
                            : colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                        })}
                      >
                        <Text
                          style={[typography.body.sm, { color: colors.text }]}
                        >
                          {h.name}
                        </Text>
                        {h.address ? (
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textMuted },
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
            </View>
          </Card>
        ) : null}

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
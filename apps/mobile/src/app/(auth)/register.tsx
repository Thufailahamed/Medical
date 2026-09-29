import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
  TextInput,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  Heart,
  Stethoscope,
  ChevronLeft,
  IdCard,
  Search,
  X,
  ShieldCheck,
  Eye,
  EyeOff,
  Calendar,
} from "lucide-react-native";
import { api } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useSpecialties,
  useHospitals,
  useStaffInvitePreview,
} from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { Screen, Skeleton, useToast } from "@/components/ui";
import {
  isStructurallyValidNic,
  nicEncodedDob,
  nicMatchesDob,
  parseDob,
} from "@/lib/format";

// Mirror the server-side threshold (apps/api/src/lib/validators.ts).
const MINOR_NIC_THRESHOLD = 16;

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = parseDob(dob);
  if (!d) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const monthDelta = now.getMonth() - d.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < d.getDate())) {
    years--;
  }
  return years;
}

const schema = z
  .object({
    role: z.enum(["patient", "doctor", "hospital_staff"]),
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    nic: z.string().optional(),
    dob: z.string().optional(),
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
  )
  // DOB required for any patient, minor or adult.
  .refine(
    (d) => d.role !== "patient" || (!!d.dob && parseDob(d.dob) !== null),
    {
      message: "Enter a valid past date (YYYY-MM-DD)",
      path: ["dob"],
    },
  )
  // NIC structural validity — only enforced when NIC is provided AND the
  // user is not a minor. The UI hides the NIC field below the threshold,
  // so this branch is the safety net for edge cases (user typing into a
  // hidden field, race conditions, etc.).
  .refine(
    (d) => {
      if (d.role !== "patient") return true;
      if (!d.nic) return true;
      const age = ageFromDob(d.dob);
      if (age !== null && age < MINOR_NIC_THRESHOLD) return true;
      return isStructurallyValidNic(d.nic.trim());
    },
    {
      message: "NIC must be a valid Sri Lankan ID (old: 9 digits + V/X, new: 12 digits)",
      path: ["nic"],
    },
  )
  // NIC + DOB required for adult patients only.
  .refine(
    (d) => {
      if (d.role !== "patient") return true;
      const age = ageFromDob(d.dob);
      if (age !== null && age < MINOR_NIC_THRESHOLD) return true;
      return !!d.nic && !!d.dob;
    },
    {
      message: "NIC and date of birth are required for adult patient accounts",
      path: ["nic"],
    },
  )
  // DOB-NIC consistency — skipped for minors.
  .refine(
    (d) => {
      if (d.role !== "patient") return true;
      const age = ageFromDob(d.dob);
      if (age !== null && age < MINOR_NIC_THRESHOLD) return true;
      return !d.nic || !d.dob || nicMatchesDob(d.nic, d.dob);
    },
    {
      message: "Date of birth doesn't match the NIC. Please re-check both.",
      path: ["dob"],
    },
  );

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ invite?: string }>();
  const inviteToken = typeof routeParams.invite === "string" ? routeParams.invite : null;
  const invitePreview = useStaffInvitePreview(inviteToken);
  const inviteData = invitePreview.data;
  const { colors, spacing, typography, radius, fontFamily, shadow, scheme } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<"patient" | "doctor" | "hospital_staff">(
    inviteToken ? "hospital_staff" : "patient"
  );
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [showOtherSpecialty, setShowOtherSpecialty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const debouncedHospitalQuery = useDebounce(hospitalQuery, 300);
  const { data: specialtiesData } = useSpecialties();
  const { data: hospitalsData, isLoading: hospitalsLoading } = useHospitals(
    role === "doctor" ? debouncedHospitalQuery : ""
  );
  const specialties = useMemo<string[]>(() => {
    const raw = specialtiesData?.specialties || [];
    return raw.map((s: any) => {
      if (typeof s === "object" && s !== null) {
        return s.name || "";
      }
      return String(s || "");
    });
  }, [specialtiesData]);
  const hospitals: any[] = hospitalsData?.hospitals || [];
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

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
      dob: "",
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

  // Phase 3.1 slice 3: pre-fill from the staff-invite preview so the
  // user only needs to set a password. We lock role to "hospital_staff"
  // and submit `inviteToken` so the server consumes it inline.
  useEffect(() => {
    if (!inviteToken || !inviteData) return;
    setValue("role", "hospital_staff", { shouldValidate: true });
    setRole("hospital_staff");
    if (inviteData.fullName) {
      setValue("name", inviteData.fullName, { shouldValidate: true });
    }
    if (inviteData.email) {
      setValue("email", inviteData.email, { shouldValidate: true });
    }
  }, [inviteToken, inviteData, setValue]);

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
      // Phase 3.1 slice 3: when arriving via a staff invite, pass the
      // token so the server can consume it inline after the users row
      // is created. Mirrors apps/api/src/routes/auth.ts:152-164.
      if (inviteToken) {
        body.inviteToken = inviteToken;
      }
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
        queryClient.clear();
        await SecureStore.setItemAsync("auth_token", res.session.access_token);
        setUser(res.user);
        toast.show("Account created", "success");
        // Phase 3.1 slice 3: staff coming from an invite lands directly
        // on the hospital portal. The server already linked their staff
        // row to this user (apps/api/src/routes/auth.ts:147-164), so
        // we skip OTP and the patient home.
        if (data.role === "hospital_staff") {
          router.replace("/(app)/hospital/dashboard" as any);
          return;
        }
        // Phase 1.2: if patient gave a phone, route through OTP screen
        // for soft 2FA verification before reaching the home stack.
        if (data.role === "patient" && (data.phone || "").trim()) {
          router.replace({
            pathname: "/(auth)/verify-otp",
            params: {
              userId: res.user.id,
              channel: "mobile",
              target: data.phone,
              mode: "register",
            },
          } as any);
          return;
        }
        const home =
          (data.role as string) === "doctor" ? "/(doctor)" : "/(app)";
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

  const passwordValue = watch("password") || "";

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
          height: insets.top + 360,
        }}
      />
      <Screen
        padded={false}
        keyboard
        scroll
        edges={["top", "bottom"]}
        style={{ backgroundColor: "transparent" }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl }}
      >
        {/* Header: back + brand */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 16,
          }}
        >
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
              backgroundColor: colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.hairline,
              opacity: pressed ? 0.8 : 1,
              ...shadow.xs,
            })}
          >
            <ChevronLeft size={22} color={colors.text} strokeWidth={2.25} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", marginRight: 40 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
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
              <Heart size={14} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
            </View>
            <Text
              style={{
                fontSize: 16,
                color: colors.text,
                letterSpacing: -0.4,
                fontFamily: fontFamily.heavy,
                marginLeft: 8,
              }}
            >
              HealthHub
            </Text>
          </View>
        </View>

        {/* Heading Section */}
        <View style={{ marginTop: 32, marginBottom: 24 }}>
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
            {inviteToken ? "Staff invite" : role === "doctor" ? "For doctors" : "Get started"}
          </Text>
          <Text style={[typography.display.lg, { color: colors.text }]}>
            Create account
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
            {role === "doctor"
              ? "Set up your practice profile so patients can find and book you."
              : "Start managing your health today. It takes less than a minute."}
          </Text>
        </View>

        {/* Role selector — hidden for staff invites since role is forced to
            hospital_staff. The invite banner below stands in for it. */}
        {!inviteToken ? (
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: 28 }}>
            {(
              [
                { value: "patient", label: "Patient", hint: "Track my health", icon: User },
                { value: "doctor", label: "Doctor", hint: "Run my practice", icon: Stethoscope },
              ] as const
            ).map(({ value, label, hint, icon: Icon }) => {
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
                  style={({ pressed }) => ({
                    flex: 1,
                    padding: 14,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: colors.surface,
                    borderWidth: 1.5,
                    borderColor: active ? colors.primary : colors.hairline,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                    ...(active ? shadow.sm : shadow.xs),
                  })}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        borderCurve: "continuous",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? colors.primarySoft : colors.well,
                      }}
                    >
                      <Icon
                        size={18}
                        color={active ? colors.primary : colors.textMuted}
                        strokeWidth={2.25}
                      />
                    </View>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: active ? 6 : 1.5,
                        borderColor: active ? colors.primary : colors.borderStrong,
                        backgroundColor: colors.surface,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      color: colors.text,
                      fontFamily: fontFamily.bodyBold,
                      marginTop: 12,
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      fontFamily: fontFamily.body,
                      marginTop: 2,
                    }}
                  >
                    {hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          // Phase 3.1 slice 3: staff-invite banner replaces the role selector.
          // Tells the user what hospital they're joining and as which role.
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderCurve: "continuous",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.hairline,
              padding: spacing.lg,
              marginBottom: 28,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              ...shadow.xs,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primarySoft,
              }}
            >
              <ShieldCheck size={20} color={colors.primary} strokeWidth={2.25} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[typography.overline, { color: colors.primary, textTransform: "uppercase" }]}
              >
                {`Joining ${inviteData?.hospitalName || "your hospital"}`}
              </Text>
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {`Role: ${inviteData?.role || role}`}
              </Text>
            </View>
          </View>
        )}

        {/* ─── About you ─── */}
        <FormSection title="About you">
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Full name"
                required
                value={value || ""}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. Nimali Perera"
                icon={User}
                autoCapitalize="words"
                autoComplete="name"
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Email"
                required
                value={value || ""}
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

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Mobile number"
                optional
                value={value || ""}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="+94 77 123 4567"
                icon={Phone}
                keyboardType="phone-pad"
                autoComplete="tel"
                hint={role === "patient" ? "We'll text a code to verify it." : undefined}
                error={errors.phone?.message}
              />
            )}
          />
        </FormSection>

        {/* ─── Identity ─── */}
        {role !== "hospital_staff" ? (
          <FormSection title="Identity">
            {/* Phase 1.2b: NIC field hidden entirely when DOB indicates under 16.
                Most SL kids don't have an NIC issued yet at that age. Adults
                can register once their child outgrows the threshold and gets an
                NIC of their own, or a parent can manage them via the Family
                screen. */}
            {(() => {
              const dobValue = (watch("dob") || "").trim();
              const age = ageFromDob(dobValue);
              const isMinorSelfRegistering =
                role === "patient" && age !== null && age < MINOR_NIC_THRESHOLD;
              if (isMinorSelfRegistering) {
                return (
                  <View
                    style={{
                      backgroundColor: colors.primarySoft,
                      padding: spacing.md,
                      borderRadius: radius.md,
                      borderCurve: "continuous",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: spacing.sm,
                    }}
                  >
                    <Calendar size={16} color={colors.primary} strokeWidth={2.25} style={{ marginTop: 2 }} />
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.text, flex: 1, lineHeight: 18 },
                      ]}
                    >
                      {`Children under ${MINOR_NIC_THRESHOLD} can register without a NIC. A parent or guardian can manage your records from the Family screen once you're signed in.`}
                    </Text>
                  </View>
                );
              }

              // NIC hint — shows the DOB encoded in the NIC. Auto-fills the
              // DOB field if the user hasn't typed anything yet so they just
              // confirm.
              const nicValue = (watch("nic") || "").trim();
              let hint: string | undefined;
              let hintTone: "success" | "muted" = "muted";
              if (nicValue && isStructurallyValidNic(nicValue)) {
                const encoded = nicEncodedDob(nicValue);
                if (encoded) {
                  // Auto-fill once: only when DOB field is empty so we don't clobber.
                  if (!dobValue) {
                    setTimeout(() => setValue("dob", encoded, { shouldValidate: true }), 0);
                  }
                  const matches = dobValue && nicMatchesDob(nicValue, dobValue);
                  hint = matches
                    ? "✓ Date of birth matches this NIC."
                    : `This NIC encodes birthdate ${encoded}. Make sure the date below matches.`;
                  hintTone = matches ? "success" : "muted";
                }
              }

              return (
                <Controller
                  control={control}
                  name="nic"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <FormInput
                      label="National ID (NIC)"
                      required={role === "patient"}
                      optional={role !== "patient"}
                      value={value || ""}
                      onChangeText={(t) => onChange(t.toUpperCase())}
                      onBlur={onBlur}
                      placeholder="200012345678 or 123456789V"
                      icon={IdCard}
                      autoCapitalize="characters"
                      hint={hint}
                      hintTone={hintTone}
                      error={errors.nic?.message}
                    />
                  )}
                />
              );
            })()}

            {/* DOB (required for patient) */}
            {role === "patient" ? (
              <Controller
                control={control}
                name="dob"
                render={({ field: { onChange, value } }) => (
                  <FormDatePicker
                    label="Date of birth"
                    value={value || ""}
                    onChange={onChange}
                    placeholder="Select your birthday"
                    icon={Calendar}
                    error={errors.dob?.message}
                  />
                )}
              />
            ) : null}
          </FormSection>
        ) : null}

        {/* ─── Practice details (doctor) ─── */}
        {role === "doctor" ? (
          <FormSection title="Practice details">
            {/* Specialty */}
            <View>
              <FieldLabel label="Specialty" required />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {[...specialties, "__other__"].map((s) => {
                  const isOther = s === "__other__";
                  const active = isOther ? showOtherSpecialty : selectedSpecialization === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => {
                        if (isOther) {
                          setShowOtherSpecialty((v) => !v);
                          setValue("doctorProfile.specialization", "", {
                            shouldValidate: false,
                          });
                        } else {
                          setValue("doctorProfile.specialization", s, {
                            shouldValidate: true,
                          });
                          setShowOtherSpecialty(false);
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{
                        paddingHorizontal: 14,
                        height: 34,
                        justifyContent: "center",
                        borderRadius: radius.full,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : "transparent",
                        backgroundColor: active ? colors.primarySoft : colors.fill,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: active ? colors.primary : colors.textMuted,
                          fontFamily: fontFamily.bodyBold,
                        }}
                      >
                        {isOther ? "Other" : s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.doctorProfile?.specialization?.message && !showOtherSpecialty ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.danger,
                    marginTop: 6,
                    marginLeft: 2,
                    fontFamily: fontFamily.body,
                  }}
                >
                  {errors.doctorProfile.specialization.message}
                </Text>
              ) : null}
            </View>

            {showOtherSpecialty ? (
              <Controller
                control={control}
                name="doctorProfile.specialization"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Custom specialty"
                    required
                    value={value || ""}
                    onChangeText={(t) => onChange(t)}
                    onBlur={onBlur}
                    placeholder="e.g. Cardiology"
                    icon={Stethoscope}
                    error={errors.doctorProfile?.specialization?.message}
                  />
                )}
              />
            ) : null}

            <Controller
              control={control}
              name="doctorProfile.registrationNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormInput
                  label="SLMC registration number"
                  optional
                  value={value || ""}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g. 12345"
                  icon={IdCard}
                  autoCapitalize="characters"
                  error={errors.doctorProfile?.registrationNumber?.message}
                />
              )}
            />

            {/* Hospital Search */}
            <View>
              <FieldLabel label="Hospital" optional />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 54,
                  paddingHorizontal: 14,
                  borderRadius: radius.field,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                }}
              >
                <Search size={18} color={colors.textSubtle} style={{ marginRight: 10 }} />
                <TextInput
                  value={hospitalQuery}
                  onChangeText={setHospitalQuery}
                  placeholder="Search hospitals"
                  placeholderTextColor={colors.textSubtle}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: colors.text,
                    fontFamily: fontFamily.body,
                    paddingVertical: 14,
                  }}
                  autoCapitalize="none"
                />
              </View>

              {selectedHospitalId ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 12,
                    borderRadius: radius.md,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                    marginTop: spacing.sm,
                  }}
                >
                  <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]}>
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
                <Skeleton height={56} style={{ marginTop: spacing.sm, borderRadius: radius.md }} />
              ) : hospitals.length > 0 && hospitalQuery ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    borderRadius: radius.lg,
                    borderCurve: "continuous",
                    overflow: "hidden",
                    backgroundColor: colors.surface,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
                  }}
                >
                  {hospitals.slice(0, 5).map((h: any, idx: number) => (
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
                        paddingHorizontal: spacing.lg,
                        paddingVertical: 12,
                        minHeight: 56,
                        justifyContent: "center",
                        backgroundColor: pressed ? colors.fill : "transparent",
                        borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: colors.separator,
                      })}
                    >
                      <Text style={[typography.title.sm, { color: colors.text }]}>
                        {h.name}
                      </Text>
                      {h.address ? (
                        <Text
                          style={[
                            typography.body.sm,
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
            </View>
          </FormSection>
        ) : null}

        {/* ─── Security ─── */}
        <FormSection title="Security">
          <View>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormInput
                  label="Password"
                  required
                  value={value || ""}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="At least 8 characters"
                  icon={Lock}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  rightIcon={showPassword ? EyeOff : Eye}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                  error={errors.password?.message}
                />
              )}
            />
            {passwordValue && !errors.password ? (
              <PasswordStrength value={passwordValue} />
            ) : null}
          </View>

          <Controller
            control={control}
            name="confirm"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Confirm password"
                required
                value={value || ""}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Repeat password"
                icon={Lock}
                secureTextEntry={!showConfirmPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                rightIcon={showConfirmPassword ? EyeOff : Eye}
                onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
                error={errors.confirm?.message}
              />
            )}
          />
        </FormSection>

        {/* Error Banner */}
        {errors.root ? (
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
              marginBottom: spacing.md,
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

        {/* Register Button */}
        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={({ pressed }) => ({
            borderRadius: radius.button,
            borderCurve: "continuous",
            opacity: submitting ? 0.7 : 1,
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
            {submitting ? (
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
                  {role === "doctor" ? "Create doctor account" : "Create account"}
                </Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.25} />
              </>
            )}
          </LinearGradient>
        </Pressable>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: spacing.md,
          }}
        >
          <ShieldCheck size={13} color={colors.success} strokeWidth={2.5} />
          <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: fontFamily.body }}>
            Your health data is encrypted and private.
          </Text>
        </View>

        {/* Footer Link */}
        <Pressable
          onPress={() => router.push("/(auth)/login" as any)}
          accessibilityRole="link"
          hitSlop={8}
          style={{ alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm, marginBottom: spacing.xl }}
        >
          <Text style={{ fontSize: 15, color: colors.textMuted, fontFamily: fontFamily.body }}>
            Already have an account?{" "}
            <Text style={{ color: colors.primary, fontFamily: fontFamily.bodyBold }}>
              Sign in
            </Text>
          </Text>
        </Pressable>
      </Screen>
    </View>
  );
}

// ─── Section: overline title + floating card ───────────────
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors, fontFamily, spacing, shadow } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text
        style={{
          fontSize: 12,
          color: colors.textMuted,
          fontFamily: fontFamily.bodyBold,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          borderCurve: "continuous",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
          padding: spacing.lg,
          gap: 18,
          ...shadow.card,
        }}
      >
        {children}
      </View>
    </View>
  );
}

// ─── Field label with required dot / optional tag ──────────
function FieldLabel({
  label,
  required,
  optional,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
  const { colors, fontFamily } = useTheme();
  return (
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
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      {optional ? (
        <Text style={{ fontSize: 12, color: colors.textSubtle, fontFamily: fontFamily.body }}>
          Optional
        </Text>
      ) : null}
    </View>
  );
}

// ─── 4-step password strength meter ────────────────────────
function PasswordStrength({ value }: { value: string }) {
  const { colors, fontFamily } = useTheme();
  let score = 0;
  if (value.length >= 8) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value) || value.length >= 14) score++;
  const levels = [
    { label: "Too short", color: colors.danger },
    { label: "Weak", color: colors.danger },
    { label: "Fair", color: colors.warning },
    { label: "Good", color: colors.primary },
    { label: "Strong", color: colors.success },
  ];
  const level = levels[score];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, marginHorizontal: 2 }}>
      <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < score ? level.color : colors.fill,
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 12, color: level.color, fontFamily: fontFamily.bodySemibold, minWidth: 56, textAlign: "right" }}>
        {level.label}
      </Text>
    </View>
  );
}

function FormInput({
  label,
  required,
  optional,
  value,
  onChangeText,
  placeholder,
  icon: Icon,
  secureTextEntry,
  rightIcon: RightIcon,
  onRightIconPress,
  hint,
  hintTone = "muted",
  error,
  onBlur,
  ...props
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  icon: any;
  secureTextEntry?: boolean;
  rightIcon?: any;
  onRightIconPress?: () => void;
  hint?: string;
  hintTone?: "success" | "muted";
  error?: string;
  onBlur?: () => void;
  [key: string]: any;
}) {
  const { colors, fontFamily, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <FieldLabel label={label} required={required} optional={optional} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 54,
          paddingHorizontal: 14,
          borderRadius: radius.field,
          borderCurve: "continuous",
          backgroundColor: focused ? colors.surface : colors.fill,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : focused ? colors.primary : "transparent",
        }}
      >
        <Icon
          size={18}
          color={error ? colors.danger : focused ? colors.primary : colors.textSubtle}
          style={{ marginRight: 10 }}
        />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (onBlur) onBlur();
          }}
          style={{
            flex: 1,
            fontSize: 16,
            color: colors.text,
            fontFamily: fontFamily.body,
            paddingVertical: 14,
          }}
          {...props}
        />

        {RightIcon && (
          <Pressable
            onPress={onRightIconPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={secureTextEntry ? "Show password" : "Hide password"}
          >
            <RightIcon size={18} color={colors.textSubtle} />
          </Pressable>
        )}
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
      ) : hint ? (
        <Text
          style={{
            fontSize: 12,
            color: hintTone === "success" ? colors.success : colors.textMuted,
            marginTop: 6,
            marginLeft: 2,
            fontFamily: fontFamily.body,
            lineHeight: 17,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function FormDatePicker({
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: any;
  error?: string;
}) {
  const { colors, fontFamily, radius } = useTheme();
  const [show, setShow] = useState(false);

  // Open near a typical adult birth year rather than today.
  const [yy, mm, dd] = value.split("-").map(Number);
  const parsed = value && yy && mm && dd ? new Date(yy, mm - 1, dd) : null;
  const dateValue = parsed ?? new Date(2000, 0, 1);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShow(false);
    }
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const d = String(selectedDate.getDate()).padStart(2, "0");
      onChange(`${y}-${m}-${d}`);
    }
  };

  const display = parsed
    ? parsed.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : placeholder;

  return (
    <View>
      <FieldLabel label={label} required />

      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          setShow((s) => !s);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 54,
          paddingHorizontal: 14,
          borderRadius: radius.field,
          borderCurve: "continuous",
          backgroundColor: show ? colors.surface : colors.fill,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : show ? colors.primary : "transparent",
        }}
      >
        <Icon
          size={18}
          color={error ? colors.danger : show ? colors.primary : colors.textSubtle}
          style={{ marginRight: 10 }}
        />
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            color: value ? colors.text : colors.textSubtle,
            fontFamily: fontFamily.body,
            paddingVertical: 14,
          }}
        >
          {display}
        </Text>
      </Pressable>

      {show && (
        <View>
          <DateTimePicker
            value={dateValue}
            mode="date"
            onChange={handleDateChange}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
          />
          {Platform.OS === "ios" ? (
            <Pressable
              onPress={() => {
                if (!value) handleDateChange(null, dateValue);
                setShow(false);
              }}
              accessibilityRole="button"
              hitSlop={8}
              style={{ alignSelf: "flex-end", paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Text style={{ fontSize: 15, color: colors.primary, fontFamily: fontFamily.bodyBold }}>
                Done
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}

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

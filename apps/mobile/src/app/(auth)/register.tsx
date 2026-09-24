import { useState, useEffect, useMemo } from "react";
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

  return (
    <Screen
      padded={false}
      keyboard
      scroll
      edges={["top", "bottom"]}
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl }}
    >
      {/* Branding Header with Back button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 40,
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

      {/* Heading Section */}
      <View style={{ marginTop: 40, marginBottom: 28 }}>
        <Text style={[typography.display.lg, { color: colors.text }]}>
          Create account.
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

      {/* Segmented role selector — hidden for staff invites since role
          is forced to hospital_staff. The invite banner below stands
          in for it. */}
      {!inviteToken ? (
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
            { value: "patient", label: "Patient" },
            { value: "doctor", label: "Doctor" },
          ] as const
        ).map(({ value, label }) => {
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
                alignItems: "center",
                justifyContent: "center",
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
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: active ? colors.text : colors.textMuted,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {label}
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
            backgroundColor: colors.primarySoft,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            marginBottom: 28,
            gap: 4,
          }}
        >
          <Text
            style={[typography.overline, { color: colors.primary, textTransform: "uppercase" }]}
          >
            {`Joining ${inviteData?.hospitalName || "your hospital"}`}
          </Text>
          <Text style={[typography.title.sm, { color: colors.text }]}>
            {`Role: ${inviteData?.role || role}`}
          </Text>
        </View>
      )}

      {/* Form Fields */}
      <View style={{ gap: 16 }}>
        {/* Full Name */}
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomUnderlineInput
              label="Full name"
              value={value || ""}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="John Doe"
              icon={User}
              autoCapitalize="words"
              autoComplete="name"
              error={errors.name?.message}
            />
          )}
        />

        {/* Email */}
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomUnderlineInput
              label="Email"
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

        {/* Phone */}
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomUnderlineInput
              label="Phone (optional)"
              value={value || ""}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="+94 77 123 4567"
              icon={Phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              error={errors.phone?.message}
            />
          )}
        />

        {/* Phase 1.2b: NIC field hidden entirely when DOB indicates under 16.
            Most SL kids don't have an NIC issued yet at that age. Adults
            can register once their child outgrows the threshold and gets an
            NIC of their own, or a parent can manage them via the Family
            screen. */}
        {role !== "hospital_staff" ? (() => {
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
          return (
            <Controller
              control={control}
              name="nic"
              render={({ field: { onChange, onBlur, value } }) => (
                <CustomUnderlineInput
                  label={role === "patient" ? "National ID *" : "National ID (optional)"}
                  value={value || ""}
                  onChangeText={(t) => onChange(t.toUpperCase())}
                  onBlur={onBlur}
                  placeholder="200012345678 or 123456789V"
                  icon={IdCard}
                  autoCapitalize="characters"
                  error={errors.nic?.message}
                />
              )}
            />
          );
        })() : null}

        {/* NIC hint — shows the DOB encoded in the NIC. Auto-fills the
            DOB field if the user hasn't typed anything yet so they just
            confirm. Hidden for minors since their NIC field is hidden. */}
        {(() => {
          const nicValue = (watch("nic") || "").trim();
          const dobValue = (watch("dob") || "").trim();
          const age = ageFromDob(dobValue);
          if (age !== null && age < MINOR_NIC_THRESHOLD) return null;
          if (!nicValue || !isStructurallyValidNic(nicValue)) return null;
          const encoded = nicEncodedDob(nicValue);
          if (!encoded) return null;
          // Auto-fill once: only when DOB field is empty so we don't clobber.
          if (!dobValue) {
            setTimeout(() => setValue("dob", encoded, { shouldValidate: true }), 0);
          }
          const matches = dobValue && nicMatchesDob(nicValue, dobValue);
          return (
            <Text
              style={{
                fontSize: 12,
                marginTop: -10,
                color: matches ? colors.success : colors.textMuted,
                fontFamily: fontFamily.body,
              }}
            >
              {matches
                ? "✓ DOB matches the NIC."
                : `This NIC encodes birthdate ${encoded}. Make sure the date below matches.`}
            </Text>
          );
        })()}

        {/* DOB (required for patient) */}
        {role === "patient" ? (
          <Controller
            control={control}
            name="dob"
            render={({ field: { onChange, value } }) => (
              <CustomUnderlineDatePicker
                label="Date of birth *"
                value={value || ""}
                onChange={onChange}
                placeholder="YYYY-MM-DD"
                icon={Calendar}
                error={errors.dob?.message}
              />
            )}
          />
        ) : null}

        {/* Password */}
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomUnderlineInput
              label="Password"
              value={value || ""}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="At least 8 characters"
              icon={Lock}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? EyeOff : Eye}
              onRightIconPress={() => setShowPassword(!showPassword)}
              error={errors.password?.message}
            />
          )}
        />

        {/* Confirm Password */}
        <Controller
          control={control}
          name="confirm"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomUnderlineInput
              label="Confirm password"
              value={value || ""}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Repeat password"
              icon={Lock}
              secureTextEntry={!showConfirmPassword}
              rightIcon={showConfirmPassword ? EyeOff : Eye}
              onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
              error={errors.confirm?.message}
            />
          )}
        />

        {/* Doctor profile details */}
        {role === "doctor" ? (
          <View style={{ marginTop: 12, gap: 16 }}>
            {/* Specialty Field */}
            <View style={{ marginBottom: 4 }}>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  fontFamily: fontFamily.bodySemibold,
                  marginLeft: 2,
                  marginBottom: 8,
                }}
              >
                Specialty *
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                  marginBottom: spacing.sm,
                }}
              >
                {specialties.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setValue("doctorProfile.specialization", s, {
                        shouldValidate: true,
                      });
                      setShowOtherSpecialty(false);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      height: 34,
                      justifyContent: "center",
                      borderRadius: radius.full,
                      borderWidth: 1,
                      borderColor: selectedSpecialization === s ? colors.primary : "transparent",
                      backgroundColor: selectedSpecialization === s ? colors.primarySoft : colors.fill,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: selectedSpecialization === s ? colors.primary : colors.textMuted,
                      }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    setShowOtherSpecialty((v) => !v);
                    setValue("doctorProfile.specialization", "", {
                      shouldValidate: false,
                    });
                  }}
                  style={{
                    paddingHorizontal: 14,
                    height: 34,
                    justifyContent: "center",
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: showOtherSpecialty ? colors.primary : "transparent",
                    backgroundColor: showOtherSpecialty ? colors.primarySoft : colors.fill,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: showOtherSpecialty ? colors.primary : colors.textMuted,
                    }}
                  >
                    Other
                  </Text>
                </Pressable>
              </View>

              {showOtherSpecialty ? (
                <Controller
                  control={control}
                  name="doctorProfile.specialization"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <CustomUnderlineInput
                      label="Custom specialty"
                      value={value || ""}
                      onChangeText={(t) => onChange(t, { shouldValidate: true })}
                      onBlur={onBlur}
                      placeholder="e.g. Cardiology"
                      icon={Stethoscope}
                      error={errors.doctorProfile?.specialization?.message}
                    />
                  )}
                />
              ) : null}
            </View>

            {/* Registration number */}
            <Controller
              control={control}
              name="doctorProfile.registrationNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <CustomUnderlineInput
                  label="SLMC registration number"
                  value={value || ""}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g., 12345"
                  icon={IdCard}
                  autoCapitalize="characters"
                  error={errors.doctorProfile?.registrationNumber?.message}
                />
              )}
            />

            {/* Hospital Search */}
            <View style={{ marginBottom: 4 }}>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  fontFamily: fontFamily.bodySemibold,
                  marginLeft: 2,
                  marginBottom: 8,
                }}
              >
                Hospital (optional)
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 44,
                  paddingHorizontal: 12,
                  borderRadius: radius.md,
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
                    fontSize: 15,
                    color: colors.text,
                    fontFamily: fontFamily.body,
                    padding: 0,
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
                <View style={{ marginTop: spacing.sm, height: 56, backgroundColor: colors.fill, borderRadius: radius.md, borderCurve: "continuous" }} />
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
          </View>
        ) : null}

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

        {/* Register Button */}
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
            marginTop: 16,
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
                {role === "doctor" ? "Create doctor account" : "Create account"}
              </Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2} />
            </>
          )}
        </Pressable>

        {/* Footer Link */}
        <Pressable
          onPress={() => router.push("/(auth)/login" as any)}
          accessibilityRole="link"
          hitSlop={8}
          style={{ alignItems: "center", paddingVertical: spacing.xs, marginBottom: 60 }}
        >
          <Text style={{ fontSize: 15, color: colors.textMuted, fontFamily: fontFamily.body }}>
            Already have an account?{" "}
            <Text style={{ color: colors.primary, fontWeight: "700", fontFamily: fontFamily.bodyBold }}>
              Sign in
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
  const { colors, fontFamily, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 2 }}>
      {/* Label */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        <Text
          style={{
            fontSize: 13,
            color: colors.textMuted,
            fontFamily: fontFamily.bodySemibold,
            marginLeft: 2,
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
          minHeight: 54,
          paddingHorizontal: 14,
          borderRadius: radius.field,
          borderCurve: "continuous",
          backgroundColor: colors.fill,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : focused ? colors.primary : "transparent",
        }}
      >
        <Icon size={18} color={colors.textSubtle} style={{ marginRight: 10 }} />
        
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
          <Pressable onPress={onRightIconPress} hitSlop={8}>
            <RightIcon size={18} color={colors.textSubtle} />
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

function CustomUnderlineDatePicker({
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

  const dateValue = value ? new Date(value) : new Date();

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
          {label}
        </Text>
        <Text style={{ fontSize: 11, color: colors.danger || "#FF3B30", marginLeft: 2 }}>*</Text>
      </View>

      {/* Pressable Field Row */}
      <Pressable
        onPress={() => setShow(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 54,
          paddingHorizontal: 14,
          borderRadius: radius.field,
          borderCurve: "continuous",
          backgroundColor: colors.fill,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : show ? colors.primary : "transparent",
        }}
      >
        <Icon size={18} color={colors.textSubtle} style={{ marginRight: 10 }} />

        <Text
          style={{
            flex: 1,
            fontSize: 16,
            color: value ? colors.text : colors.textSubtle,
            fontFamily: fontFamily.body,
            paddingVertical: 14,
          }}
        >
          {value || placeholder}
        </Text>
      </Pressable>

      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          onChange={handleDateChange}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
        />
      )}

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
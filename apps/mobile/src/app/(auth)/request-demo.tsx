import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Building2,
  User,
  Phone,
  Mail,
  IdCard,
  Stethoscope,
  ChevronLeft,
  Send,
  ArrowRight,
  Check,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  FormField,
  TextInput,
  Button,
  IconButton,
  useToast,
} from "@/components/ui";
import { useRequestDemo } from "@/hooks/useApi";

// Local enum mirrors the API Zod schema in
// apps/api/src/lib/validators.ts (DEMO_CONTACT_ROLES,
// DEMO_CLINIC_SIZES, DEMO_SPECIALTIES). Keep in sync if new values
// are added server-side.
const CONTACT_ROLES = ["Doctor", "Receptionist", "Manager", "Other"] as const;
const CLINIC_SIZES = [
  "Solo",
  "2-5 doctors",
  "6+ doctors",
  "Polyclinic",
  "Hospital",
] as const;
const SPECIALTIES = [
  "General practice",
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "General surgery",
  "Internal medicine",
  "Neurology",
  "Obstetrics & gynaecology",
  "Oncology",
  "Ophthalmology",
  "Orthopaedics",
  "Paediatrics",
  "Psychiatry",
  "Radiology",
  "Urology",
  "Other",
] as const;

type FormState = {
  clinicName: string;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  nic: string;
  slmcRegistrationNo: string;
  specialty: string;
  clinicSize: string;
  message: string;
};

const EMPTY: FormState = {
  clinicName: "",
  contactName: "",
  contactRole: "",
  phone: "",
  email: "",
  nic: "",
  slmcRegistrationNo: "",
  specialty: "",
  clinicSize: "",
  message: "",
};

export default function RequestDemoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, shadow } = useTheme();
  const toast = useToast();
  const requestDemo = useRequestDemo();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {}
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    const contactName = form.contactName.trim();
    if (!contactName) {
      next.contactName = t("auth.requestDemo.errors.contactNameRequired");
    }
    const phoneDigits = form.phone.replace(/[^0-9+]/g, "");
    if (!phoneDigits) {
      next.phone = t("auth.requestDemo.errors.phoneRequired");
    } else if (phoneDigits.length < 7 || phoneDigits.length > 16) {
      next.phone = t("auth.requestDemo.errors.phoneInvalid");
    }
    if (!form.email.trim()) {
      next.email = t("auth.requestDemo.errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = t("auth.requestDemo.errors.emailInvalid");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit() {
    if (!validate()) return;
    try {
      await requestDemo.mutateAsync({
        clinicName: form.clinicName.trim() || undefined,
        contactName: form.contactName.trim(),
        contactRole: (form.contactRole || undefined) as any,
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        nic: form.nic.trim() || undefined,
        slmcRegistrationNo: form.slmcRegistrationNo.trim() || undefined,
        specialty: (form.specialty || undefined) as any,
        clinicSize: (form.clinicSize || undefined) as any,
        message: form.message.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error("Request demo error:", err);
      const msg =
        err?.message && err.message !== "{}" && err.message !== "[object Object]"
          ? err.message
          : "Could not send request. Please try again.";
      toast.show(msg, "danger");
    }
  }

  // Success card — same body slot as the form, swap content + send back
  // to /login rather than rendering the form again.
  if (submitted) {
    return (
      <Screen padded={false} edges={["top", "bottom"]}>
        <LinearGradient
          colors={["#EEF2FF", "transparent"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 240,
          }}
        />
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <IconButton
            icon={ChevronLeft}
            onPress={() => router.replace("/(auth)/login")}
            variant="ghost"
            accessibilityLabel="Go back"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                typography.overline,
                { color: colors.primary, letterSpacing: 1, fontWeight: "700" },
              ]}
            >
              HEALTHHUB
            </Text>
            <Text
              style={[
                typography.title.lg,
                { color: colors.text, fontWeight: "700" },
              ]}
            >
              {t("auth.requestDemo.title")}
            </Text>
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xxl,
            gap: spacing.lg,
          }}
        >
          <View
            style={[
              {
                backgroundColor: colors.surface,
                borderRadius: radius.xxl,
                padding: spacing.xl,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.lg,
                alignItems: "center",
              },
              shadow.lg,
            ]}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.xl,
                backgroundColor: colors.successSoft,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.success + "20",
              }}
            >
              <Check size={32} color={colors.success} strokeWidth={2.25} />
            </View>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, fontWeight: "700", textAlign: "center" },
              ]}
            >
              {t("auth.requestDemo.success.title")}
            </Text>
            <Text
              style={[
                typography.body.md,
                { color: colors.textMuted, textAlign: "center", lineHeight: 22 },
              ]}
            >
              {t("auth.requestDemo.success.body")}
            </Text>
            <Button
              title={t("auth.requestDemo.success.backToLogin")}
              onPress={() => router.replace("/(auth)/login")}
              iconRight={ArrowRight}
              size="lg"
              fullWidth
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#EEF2FF", "transparent"]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 240,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            zIndex: 10,
          }}
        >
          <IconButton
            icon={ChevronLeft}
            onPress={() => router.replace("/(auth)/login")}
            variant="ghost"
            accessibilityLabel="Go back"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                typography.overline,
                { color: colors.primary, letterSpacing: 1, fontWeight: "700" },
              ]}
            >
              HEALTHHUB · FOR CLINICS
            </Text>
            <Text
              style={[
                typography.title.lg,
                { color: colors.text, fontWeight: "700" },
              ]}
            >
              {t("auth.requestDemo.title")}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xxl,
            gap: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={[
              typography.body.md,
              { color: colors.textMuted, marginTop: -spacing.xs },
            ]}
          >
            {t("auth.requestDemo.subtitle")}
          </Text>

          <View
            style={[
              {
                backgroundColor: colors.surface,
                borderRadius: radius.xxl,
                padding: spacing.xl,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.lg,
              },
              shadow.lg,
            ]}
          >
            <FormField label={t("auth.requestDemo.field.clinicName")}>
              <TextInput
                value={form.clinicName}
                onChangeText={(v) => update("clinicName", v)}
                placeholder="Perera Clinic"
                leadingIcon={Building2}
                tone="soft"
              />
            </FormField>

            <FormField
              label={t("auth.requestDemo.field.contactName")}
              required
              error={errors.contactName}
            >
              <TextInput
                value={form.contactName}
                onChangeText={(v) => update("contactName", v)}
                placeholder="Dr Anika Perera"
                autoCapitalize="words"
                leadingIcon={User}
                tone="soft"
              />
            </FormField>

            <ChipRow
              label={t("auth.requestDemo.field.contactRole")}
              options={CONTACT_ROLES as unknown as string[]}
              value={form.contactRole}
              onChange={(v) => update("contactRole", v)}
            />

            <FormField
              label={t("auth.requestDemo.field.phone")}
              required
              error={errors.phone}
            >
              <TextInput
                value={form.phone}
                onChangeText={(v) => update("phone", v)}
                placeholder="+94 77 123 4567"
                keyboardType="phone-pad"
                leadingIcon={Phone}
                tone="soft"
              />
            </FormField>

            <FormField
              label={t("auth.requestDemo.field.email")}
              required
              error={errors.email}
            >
              <TextInput
                value={form.email}
                onChangeText={(v) => update("email", v)}
                placeholder="you@clinic.lk"
                autoCapitalize="none"
                keyboardType="email-address"
                leadingIcon={Mail}
                tone="soft"
              />
            </FormField>

            <FormField label={t("auth.requestDemo.field.nic")}>
              <TextInput
                value={form.nic}
                onChangeText={(v) => update("nic", v)}
                placeholder="XXXXXXXXXV"
                autoCapitalize="characters"
                leadingIcon={IdCard}
                tone="soft"
              />
            </FormField>

            <FormField
              label={t("auth.requestDemo.field.slmcRegistrationNo")}
              helper={t("auth.requestDemo.field.slmcHelper")}
            >
              <TextInput
                value={form.slmcRegistrationNo}
                onChangeText={(v) =>
                  update("slmcRegistrationNo", v.toUpperCase())
                }
                placeholder="12345"
                autoCapitalize="characters"
                leadingIcon={Stethoscope}
                tone="soft"
              />
            </FormField>

            <ChipRow
              label={t("auth.requestDemo.field.specialty")}
              options={SPECIALTIES as unknown as string[]}
              value={form.specialty}
              onChange={(v) => update("specialty", v)}
              scrollable
            />

            <ChipRow
              label={t("auth.requestDemo.field.clinicSize")}
              options={CLINIC_SIZES as unknown as string[]}
              value={form.clinicSize}
              onChange={(v) => update("clinicSize", v)}
            />

            <FormField label={t("auth.requestDemo.field.message")}>
              <TextInput
                value={form.message}
                onChangeText={(v) => update("message", v)}
                placeholder="…"
                multiline
                numberOfLines={4}
                tone="soft"
                style={{ minHeight: 96, textAlignVertical: "top" }}
              />
            </FormField>

            <Button
              title={t("auth.requestDemo.submit")}
              onPress={onSubmit}
              loading={requestDemo.isPending}
              iconRight={Send}
              size="lg"
              fullWidth
              disabled={requestDemo.isPending}
            />
            {requestDemo.isPending && (
              <View style={{ alignItems: "center", marginTop: -spacing.xs }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: spacing.xs },
                  ]}
                >
                  {t("auth.requestDemo.submitting")}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// Compact single-select chip row. Used for role/specialty/clinic-size
// choices; not pulled out as a project primitive because none of the
// auth screens need a multi-select chip group and this keeps the file
// self-contained.
function ChipRow({
  label,
  options,
  value,
  onChange,
  scrollable = false,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  scrollable?: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const inner = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(selected ? "" : opt)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 8,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primarySoft : colors.surface,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: selected ? colors.primary : colors.text,
              }}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  return (
    <View style={{ gap: spacing.xs }}>
      <Text
        style={[
          typography.label.md,
          { color: colors.text, fontWeight: "600" },
        ]}
      >
        {label}
      </Text>
      {scrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  );
}

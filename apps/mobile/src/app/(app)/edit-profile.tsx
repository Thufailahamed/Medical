import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  Ruler,
  Weight as WeightIcon,
  AlertCircle,
  Stethoscope,
  Save,
  Heart,
} from "lucide-react-native";
import { useUpdatePatientProfile, usePatientProfile } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  FormField,
  TextInput,
  ChipGroup,
  Card,
  Button,
  Pill,
  useToast,
} from "@/components/ui";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
  (v) => ({ value: v, label: v })
);

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data } = usePatientProfile();
  const updateProfile = useUpdatePatientProfile();
  const patient = data?.patient?.patients;

  const [bloodGroup, setBloodGroup] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (patient && !initialized) {
      setBloodGroup(patient.bloodGroup || "");
      setHeight(patient.height?.toString() || "");
      setWeight(patient.weight?.toString() || "");
      setGender(patient.gender || "");
      setAllergies(safeParse(patient.allergies));
      setConditions(safeParse(patient.medicalConditions));
      setInitialized(true);
    }
  }, [patient, initialized]);

  async function handleSave() {
    try {
      await updateProfile.mutateAsync({
        bloodGroup: bloodGroup || undefined,
        height: height ? parseFloat(height) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        gender: gender || undefined,
        allergies: allergies
          ? allergies.split(",").map((a) => a.trim()).filter(Boolean)
          : undefined,
        medicalConditions: conditions
          ? conditions.split(",").map((c) => c.trim()).filter(Boolean)
          : undefined,
      });
      toast.show("Profile updated", "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Could not save", "danger");
    }
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title="Edit profile" />

      {/* Hero strip with blood-group numeral */}
      <View
        style={{
          margin: spacing.lg,
          padding: spacing.lg,
          borderRadius: radius.glass,
          backgroundColor: colors.primarySoft,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.lg,
        }}
      >
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Text
            style={[
              typography.display.lg,
              {
                color: colors.primary,
                fontSize: 48,
                lineHeight: 52,
                letterSpacing: -1,
              },
            ]}
          >
            {bloodGroup || "—"}
          </Text>
          <Text
            style={[
              typography.overline,
              { color: colors.primary, marginTop: 4 },
            ]}
          >
            BLOOD
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[typography.title.md, { color: colors.text }]}
            numberOfLines={1}
          >
            {patient?.name || "Your profile"}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted },
            ]}
          >
            Keep this up to date so we can help in emergencies.
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: spacing.xs,
              flexWrap: "wrap",
              marginTop: 6,
            }}
          >
            <Pill
              icon={Heart}
              label="Trusted by your care team"
              tone="accent"
              size="sm"
            />
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <Card padded={false}>
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.sm,
            }}
          >
            <Text style={[typography.label.lg, { color: colors.textMuted }]}>
              BASICS
            </Text>
          </View>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label="Blood group">
              <ChipGroup
                options={BLOOD_GROUPS}
                value={bloodGroup}
                onChange={setBloodGroup}
              />
            </FormField>

            <FormField label="Gender">
              <ChipGroup
                options={GENDERS}
                value={gender}
                onChange={setGender}
              />
            </FormField>

            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <NumeralField
                  label="Height"
                  value={height}
                  onChange={setHeight}
                  unit="cm"
                  icon={Ruler}
                  placeholder="170"
                />
              </View>
              <View style={{ flex: 1 }}>
                <NumeralField
                  label="Weight"
                  value={weight}
                  onChange={setWeight}
                  unit="kg"
                  icon={WeightIcon}
                  placeholder="70"
                />
              </View>
            </View>
          </View>
        </Card>

        <Card padded={false}>
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.sm,
            }}
          >
            <Text style={[typography.label.lg, { color: colors.textMuted }]}>
              HEALTH NOTES
            </Text>
          </View>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label="Allergies" helper="Comma-separated">
              <TextInput
                value={allergies}
                onChangeText={setAllergies}
                placeholder="Penicillin, Peanuts"
                leadingIcon={AlertCircle}
                tone="soft"
                multiline
                numberOfLines={2}
              />
            </FormField>

            <FormField
              label="Medical conditions"
              helper="Comma-separated"
            >
              <TextInput
                value={conditions}
                onChangeText={setConditions}
                placeholder="Diabetes, Hypertension"
                leadingIcon={Stethoscope}
                tone="soft"
                multiline
                numberOfLines={2}
              />
            </FormField>
          </View>
        </Card>

        <Button
          title="Save changes"
          onPress={handleSave}
          loading={updateProfile.isPending}
          icon={Save}
          size="lg"
        />
      </View>
    </Screen>
  );
}

function NumeralField({
  label,
  value,
  onChange,
  unit,
  icon: Icon,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  icon: any;
  placeholder: string;
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
        }}
      >
        <Icon size={14} color={colors.textMuted} strokeWidth={2.25} />
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
          ]}
        >
          {label}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          marginTop: 4,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={placeholder}
          containerStyle={{ flex: 1, paddingHorizontal: 0 }}
          style={{
            fontSize: 28,
            fontFamily: typography.display.md.fontFamily,
            color: colors.text,
            paddingVertical: 0,
            minHeight: 36,
          }}
        />
        <Text
          style={[
            typography.title.sm,
            { color: colors.textMuted, marginLeft: 4 },
          ]}
        >
          {unit}
        </Text>
      </View>
    </View>
  );
}

function safeParse(v: any): string {
  if (!v) return "";
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.join(", ") : String(v);
  } catch {
    return String(v);
  }
}

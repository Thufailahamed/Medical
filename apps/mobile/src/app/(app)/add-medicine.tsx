// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Pill,
  Save,
  FileText,
  Hourglass,
  History,
  Sparkles,
  CornerDownLeft,
} from "lucide-react-native";
import {
  useAddMedicine,
  usePatientProfile,
  useMedicineSuggestions,
  type MedicineSuggestion,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  FormField,
  TextInput,
  ChipGroup,
  DateField,
  Button,
  Card,
  useToast,
} from "@/components/ui";

const FREQUENCIES = [
  { value: "Once daily", label: "Once daily" },
  { value: "Twice daily", label: "Twice daily" },
  { value: "Three times daily", label: "Three times" },
  { value: "Four times daily", label: "Four times" },
  { value: "As needed", label: "As needed" },
];

const TIMINGS = [
  { value: "Before food", label: "Before food" },
  { value: "After food", label: "After food" },
  { value: "With food", label: "With food" },
  { value: "Any time", label: "Any time" },
  { value: "Morning", label: "Morning" },
  { value: "Afternoon", label: "Afternoon" },
  { value: "Evening", label: "Evening" },
  { value: "Night", label: "Night" },
];

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Pick a frequency"),
  timing: z.string().min(1, "Pick a timing"),
  startDate: z.date(),
  endDate: z.date().optional(),
  notes: z.string().max(500).optional(),
});
type FormData = z.infer<typeof schema>;

type ApplyField = (name: keyof FormData, value: any) => void;

function SuggestionRow({
  s,
  onApply,
}: {
  s: MedicineSuggestion;
  onApply: (s: MedicineSuggestion) => void;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  const isHistory = s.source === "history";
  const topDosage = s.commonDosages[0];
  const topFreq = s.commonFrequencies[0];
  const topTiming = s.commonTimings[0];

  return (
    <Pressable
      onPress={() => onApply(s)}
      accessibilityRole="button"
      accessibilityLabel={`Use ${s.name}`}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isHistory ? colors.primarySoft : "rgba(14, 165, 183, 0.12)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isHistory ? (
          <History size={15} color={colors.primary} strokeWidth={2.25} />
        ) : (
          <Sparkles size={15} color="#0EA5B7" strokeWidth={2.25} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "700" },
          ]}
          numberOfLines={1}
        >
          {s.name}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, marginTop: 1 },
          ]}
          numberOfLines={1}
        >
          {s.category
            ? `${s.category} · `
            : isHistory
            ? "From your history · "
            : ""}
          {topDosage
            ? `${topDosage}${
                topFreq ? ` · ${topFreq}` : ""
              }${topTiming ? ` · ${topTiming}` : ""}`
            : "Tap to autofill"}
        </Text>
      </View>
      <CornerDownLeft
        size={14}
        color={colors.textSubtle}
        strokeWidth={2.25}
      />
    </Pressable>
  );
}

export default function AddMedicineScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const addMedicine = useAddMedicine();
  const { data: profileData } = usePatientProfile();

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      dosage: "",
      frequency: "",
      timing: "",
      startDate: new Date(),
      notes: "",
    },
    mode: "onChange",
  });

  const [nameQuery, setNameQuery] = useState("");
  const [nameFocused, setNameFocused] = useState(false);

  const { data: suggestData, isFetching } = useMedicineSuggestions(nameQuery, 6);
  const suggestions: MedicineSuggestion[] = suggestData?.suggestions || [];
  const showDropdown =
    nameFocused &&
    nameQuery.trim().length > 0 &&
    suggestions.length > 0;

  function applySuggestion(s: MedicineSuggestion) {
    setValue("name", s.name, { shouldValidate: true });
    if (s.commonDosages[0]) setValue("dosage", s.commonDosages[0], { shouldValidate: true });
    if (s.commonFrequencies[0]) setValue("frequency", s.commonFrequencies[0], { shouldValidate: true });
    if (s.commonTimings[0]) setValue("timing", s.commonTimings[0], { shouldValidate: true });
    setNameFocused(false);
    toast.show(`Autofilled from ${s.source === "history" ? "your history" : "catalog"}`, "success");
  }

  const onSubmit = async (data: FormData) => {
    const patientId = profileData?.patient?.patients?.id;
    if (!patientId) {
      setError("root", { message: "Patient profile not loaded" });
      return;
    }
    try {
      await addMedicine.mutateAsync({
        patientId,
        name: data.name,
        dosage: data.dosage,
        frequency: data.frequency,
        timing: data.timing,
        notes: data.notes || undefined,
        startDate: data.startDate.toISOString().slice(0, 10),
      });
      toast.show("Medicine added", "success");
      router.back();
    } catch (err: any) {
      setError("root", { message: err?.message || "Could not add medicine" });
      toast.show(err?.message || "Could not add medicine", "danger");
    }
  };

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title="Add medicine" />

      {/* Compact identity strip */}
      <View
        style={{
          margin: spacing.lg,
          padding: spacing.lg,
          borderRadius: radius.glass,
          backgroundColor: colors.primarySoft,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <Pill size={28} color={colors.primary} strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.overline, { color: colors.primary }]}>
            NEW MEDICINE
          </Text>
          <Text style={[typography.title.md, { color: colors.text }]}>
            Add to your routine
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 2 },
            ]}
          >
            Start typing — we'll suggest from your history and common medicines.
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Medicine name"
                  required
                  error={errors.name?.message}
                  helper={
                    !showDropdown && nameQuery.trim().length > 0 && !isFetching
                      ? suggestions.length === 0
                        ? "No matches. Type full name to add a custom medicine."
                        : undefined
                      : undefined
                  }
                >
                  <View style={{ position: "relative" }}>
                    <TextInput
                      value={value}
                      onChangeText={(t) => {
                        onChange(t);
                        setNameQuery(t);
                      }}
                      onFocus={() => setNameFocused(true)}
                      onBlur={(e) => {
                        onBlur(e);
                        // Delay so taps on suggestion rows register before dismiss.
                        setTimeout(() => setNameFocused(false), 120);
                      }}
                      placeholder="e.g., Amoxicillin"
                      autoCapitalize="words"
                      leadingIcon={Pill}
                      invalid={!!errors.name}
                      trailingIcon={
                        isFetching && nameQuery.trim().length > 0
                          ? undefined
                          : undefined
                      }
                    />
                    {isFetching && nameQuery.trim().length > 0 ? (
                      <View
                        style={{
                          position: "absolute",
                          right: spacing.md,
                          top: 0,
                          bottom: 0,
                          justifyContent: "center",
                        }}
                      >
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : null}
                  </View>
                  {showDropdown ? (
                    <View
                      style={{
                        marginTop: 6,
                        backgroundColor: colors.surface,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        overflow: "hidden",
                        maxHeight: 280,
                      }}
                    >
                      <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      >
                        {suggestions.map((s) => (
                          <SuggestionRow
                            key={`${s.source}-${s.name}`}
                            s={s}
                            onApply={applySuggestion}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="dosage"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Dosage"
                  required
                  error={errors.dosage?.message}
                >
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g., 500mg"
                    leadingIcon={Hourglass}
                    invalid={!!errors.dosage}
                  />
                </FormField>
              )}
            />

            <FormField
              label="Frequency"
              required
              error={errors.frequency?.message}
            >
              <Controller
                control={control}
                name="frequency"
                render={({ field: { onChange, value } }) => (
                  <ChipGroup
                    options={FREQUENCIES}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Timing"
              required
              error={errors.timing?.message}
            >
              <Controller
                control={control}
                name="timing"
                render={({ field: { onChange, value } }) => (
                  <ChipGroup
                    options={TIMINGS}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
            </FormField>

            <FormField label="Start date" required>
              <Controller
                control={control}
                name="startDate"
                render={({ field: { onChange, value } }) => (
                  <DateField
                    value={value}
                    onChange={onChange}
                    placeholder="When do you start?"
                  />
                )}
              />
            </FormField>
          </View>
        </Card>

        <FormField label="Notes" helper="Optional">
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Any additional instructions"
                multiline
                numberOfLines={3}
                leadingIcon={FileText}
                tone="soft"
              />
            )}
          />
        </FormField>

        {errors.root ? (
          <Text
            style={[
              typography.caption,
              { color: colors.danger, textAlign: "center" },
            ]}
          >
            {errors.root.message}
          </Text>
        ) : null}

        <Button
          title="Save medicine"
          onPress={handleSubmit(onSubmit)}
          loading={addMedicine.isPending}
          icon={Save}
          size="lg"
        />
      </View>
    </Screen>
  );
}
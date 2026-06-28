import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Pill,
  Save,
  FileText,
  Hourglass,
} from "lucide-react-native";
import { useAddMedicine, usePatientProfile } from "@/hooks/useApi";
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
  { value: "As needed", label: "As needed" },
];

const TIMINGS = [
  { value: "Before food", label: "Before food" },
  { value: "After food", label: "After food" },
  { value: "With food", label: "With food" },
  { value: "Any time", label: "Any time" },
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
            We'll send timely reminders.
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
                >
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g., Amoxicillin"
                    autoCapitalize="words"
                    leadingIcon={Pill}
                    invalid={!!errors.name}
                  />
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

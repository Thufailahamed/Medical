// @ts-nocheck

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Pill,
  Save,
  Power,
  History,
  Sparkles,
  CornerDownLeft,
} from "lucide-react-native";
import {
  useMedicine,
  useEditMedicine,
  useStopMedicine,
  useMedicineSuggestions,
  type MedicineSuggestion,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Button,
  Card,
  FormField,
  TextInput,
  ChipGroup,
  DateField,
  useToast,
} from "@/components/ui";

// M3: mirror of medicineUpdateSchema in apps/api/src/lib/validators.ts.
// Frequency + timing enums are duplicated rather than re-exported so the
// mobile bundle doesn't pull in API-only validators. Keep in sync if the
// server enum changes.
const FREQUENCY_VALUES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "As needed",
] as const;

const TIMING_VALUES = [
  "Before food",
  "After food",
  "With food",
  "Any time",
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
] as const;

// M3 + M4: Zod schema. Dates are coerced so RHF can hold Date objects
// while the server receives YYYY-MM-DD strings. active is required
// because the form owns the active toggle now.
const makeEditSchema = (t: (k: string) => string) => z.object({
  name: z.string().min(1, t("addMedicine.errors.nameRequired")).max(120),
  dosage: z.string().min(1, t("addMedicine.errors.dosageRequired")).max(60),
  frequency: z.enum(
    FREQUENCY_VALUES as unknown as [string, ...string[]]
  ),
  timing: z
    .enum(TIMING_VALUES as unknown as [string, ...string[]])
    .optional(),
  startDate: z.date({ required_error: t("addMedicine.errors.startRequired") }),
  endDate: z.date().optional(),
  notes: z.string().max(1000).optional(),
  active: z.boolean(),
});
type EditFormData = {
  name: string;
  dosage: string;
  frequency: string;
  timing?: string;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  active: boolean;
};

function toDateString(d: Date | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Suggestion row, mirrors add-medicine.tsx.
function SuggestionRow({
  s,
  onApply,
}: {
  s: MedicineSuggestion;
  onApply: (s: MedicineSuggestion) => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const isHistory = s.source === "history";
  const topDosage = s.commonDosages[0];
  const topFreq = s.commonFrequencies[0];
  const topTiming = s.commonTimings[0];

  return (
    <Pressable
      onPress={() => onApply(s)}
      accessibilityRole="button"
      accessibilityLabel={t("addMedicine.a11y.use", { name: s.name })}
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
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: isHistory
            ? colors.primarySoft
            : "rgba(14, 165, 183, 0.12)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isHistory ? (
          <History size={14} color={colors.primary} strokeWidth={2.25} />
        ) : (
          <Sparkles size={14} color="#0EA5B7" strokeWidth={2.25} />
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
          {s.category ? `${s.category} · ` : ""}
          {topDosage
            ? `${topDosage}${topFreq ? ` · ${topFreq}` : ""}${
                topTiming ? ` · ${topTiming}` : ""
              }`
            : t("editMedicine.actions.tapToUse")}
        </Text>
      </View>
      <CornerDownLeft size={14} color={colors.textSubtle} strokeWidth={2.25} />
    </Pressable>
  );
}

export default function EditMedicineScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = (params.id as string) || "";
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();

  const { data, isLoading, error } = useMedicine(id);
  const edit = useEditMedicine();
  const stop = useStopMedicine();

  const med = data?.medicine;

  const editSchema = makeEditSchema(t);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema) as any,
    defaultValues: {
      name: "",
      dosage: "",
      frequency: "Once daily",
      timing: undefined,
      startDate: new Date(),
      endDate: undefined,
      notes: "",
      active: true,
    },
    mode: "onChange",
  });

  const [hydrated, setHydrated] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  // M3: hydrate the form once the medicine is loaded.
  useEffect(() => {
    if (med && !hydrated) {
      const start = med.startDate ? new Date(`${med.startDate}T00:00:00`) : new Date();
      const end = med.endDate ? new Date(`${med.endDate}T00:00:00`) : undefined;
      reset({
        name: med.name ?? "",
        dosage: med.dosage ?? "",
        frequency: (med.frequency ?? "Once daily") as any,
        timing: (med.timing ?? undefined) as any,
        startDate: start,
        endDate: end,
        notes: med.notes ?? "",
        active: med.active !== false,
      });
      setHydrated(true);
    }
  }, [med, hydrated, reset]);

  const watchedName = watch("name") || "";
  const watchedFrequency = watch("frequency");
  const watchedTiming = watch("timing");
  const watchedStart = watch("startDate");
  const watchedEnd = watch("endDate");
  const watchedActive = watch("active");
  const watchedDosage = watch("dosage");
  const watchedNotes = watch("notes");

  const { data: suggestData, isFetching } = useMedicineSuggestions(
    watchedName,
    6
  );
  const suggestions: MedicineSuggestion[] = suggestData?.suggestions || [];
  const showDropdown =
    nameFocused &&
    watchedName.trim().length > 0 &&
    watchedName.trim().toLowerCase() !== (med?.name ?? "").trim().toLowerCase() &&
    suggestions.length > 0;

  const FREQUENCIES = FREQUENCY_VALUES.map((v) => ({
    value: v,
    label: t(`medicine.frequency.${v}`),
  }));
  const TIMINGS = TIMING_VALUES.map((v) => ({
    value: v,
    label: t(`medicine.timing.${v}`),
  }));

  function applySuggestion(s: MedicineSuggestion) {
    setValue("name", s.name, { shouldValidate: true, shouldDirty: true });
    if (s.commonDosages[0])
      setValue("dosage", s.commonDosages[0], {
        shouldValidate: true,
        shouldDirty: true,
      });
    if (s.commonFrequencies[0])
      setValue("frequency", s.commonFrequencies[0] as any, {
        shouldValidate: true,
        shouldDirty: true,
      });
    if (s.commonTimings[0])
      setValue("timing", s.commonTimings[0] as any, {
        shouldValidate: true,
        shouldDirty: true,
      });
    setNameFocused(false);
  }

  async function onSubmit(data: EditFormData) {
    if (!med) return;
    try {
      await edit.mutateAsync({
        id: med.id,
        name: data.name.trim(),
        dosage: data.dosage.trim(),
        frequency: data.frequency,
        timing: data.timing,
        startDate: toDateString(data.startDate),
        endDate: data.endDate ? toDateString(data.endDate) : undefined,
        notes: data.notes?.trim() || undefined,
        active: data.active,
      } as any);
      toast.show(t("editMedicine.toast.saved"), "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("editMedicine.toast.saveError"), "danger");
    }
  }

  async function onStop() {
    if (!med) return;
    try {
      await stop.mutateAsync(med.id);
      toast.show(t("editMedicine.toast.stopped", { name: med.name }), "info");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("editMedicine.toast.stopError"), "danger");
    }
  }

  if (isLoading || (!med && !error)) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <ScreenHeader title={t("editMedicine.title")} onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error || !med) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <ScreenHeader title={t("editMedicine.title")} onBack={() => router.back()} />
        <View style={{ padding: spacing.lg }}>
          <Card>
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {t("editMedicine.loadError.title")}
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, marginTop: 4 },
              ]}
            >
              {t("editMedicine.loadError.body")}
            </Text>
            <Button
              title={t("editMedicine.loadError.back")}
              variant="outline"
              onPress={() => router.back()}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("editMedicine.title")}
        subtitle={med.name}
        onBack={() => router.back()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 120,
          gap: spacing.lg,
        }}
      >
        {/* Active toggle (Controller) */}
        <Card>
          <Controller
            control={control}
            name="active"
            render={({ field: { value, onChange } }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, paddingRight: spacing.md }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "700" },
                    ]}
                  >
                    {value ? t("editMedicine.active.on") : t("editMedicine.active.off")}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {value
                      ? t("editMedicine.active.onSubtitle")
                      : t("editMedicine.active.offSubtitle")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onChange(!value)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !!value }}
                  accessibilityLabel={t("editMedicine.active.toggleA11y")}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    width: 52,
                    height: 30,
                    borderRadius: 16,
                    backgroundColor: value
                      ? colors.primary
                      : colors.surfaceMuted,
                    padding: 3,
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "#fff",
                      transform: [{ translateX: value ? 22 : 0 }],
                    }}
                  />
                </Pressable>
              </View>
            )}
          />
        </Card>

        {/* Name */}
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label={t("medicine.form.nameLabel")}
                  required
                  error={errors.name?.message}
                >
                  <View style={{ position: "relative" }}>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => {
                        onBlur();
                        setTimeout(() => setNameFocused(false), 120);
                      }}
                      placeholder={t("medicine.form.nameEditPlaceholder")}
                      leadingIcon={Pill}
                      invalid={!!errors.name}
                    />
                    {isFetching && value?.trim().length > 0 ? (
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
          </View>
        </Card>

        {/* Dosage */}
        <Card padded={false}>
          <View style={{ padding: spacing.lg }}>
            <Controller
              control={control}
              name="dosage"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label={t("medicine.form.dosageLabel")}
                  required
                  error={errors.dosage?.message}
                >
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t("medicine.form.dosagePlaceholder")}
                    invalid={!!errors.dosage}
                  />
                </FormField>
              )}
            />
          </View>
        </Card>

        {/* Frequency chips */}
        <Card padded={false}>
          <View style={{ padding: spacing.lg }}>
            <FormField
              label={t("medicine.form.frequencyLabel")}
              required
              error={errors.frequency?.message}
            >
              <Controller
                control={control}
                name="frequency"
                render={({ field: { onChange, value } }) => (
                  <ChipGroup
                    options={FREQUENCIES as any}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
            </FormField>
          </View>
        </Card>

        {/* Timing chips */}
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            <FormField
              label={t("medicine.form.timingLabel")}
              error={errors.timing?.message}
              helper={t("medicine.form.timingHelper")}
            >
              <Controller
                control={control}
                name="timing"
                render={({ field: { onChange, value } }) => (
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    <Pressable
                      onPress={() => onChange(undefined)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: !value }}
                      accessibilityLabel={t("editMedicine.a11y.noTiming")}
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing.md,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: !value
                          ? colors.primary
                          : colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: !value ? colors.primary : colors.border,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: !value ? colors.onPrimary : colors.text,
                        }}
                      >
                        {t("editMedicine.timingNone")}
                      </Text>
                    </Pressable>
                    {TIMINGS.map((tt) => {
                      const sel = tt.value === value;
                      return (
                        <Pressable
                          key={tt.value}
                          onPress={() => onChange(tt.value as any)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: sel }}
                          accessibilityLabel={tt.label}
                          style={({ pressed }) => ({
                            paddingHorizontal: spacing.md,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: sel
                              ? colors.primary
                              : colors.surfaceMuted,
                            borderWidth: 1,
                            borderColor: sel ? colors.primary : colors.border,
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: sel ? colors.onPrimary : colors.text,
                            }}
                          >
                            {tt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              />
            </FormField>
          </View>
        </Card>

        {/* M4: Date range — was free-text before. Now DateField picker. */}
        <Card padded={false}>
          <View
            style={{
              padding: spacing.lg,
              flexDirection: "row",
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="startDate"
                render={({ field: { onChange, value } }) => (
                  <DateField
                    label={t("medicine.form.startDateLabel")}
                    value={value}
                    onChange={onChange}
                    placeholder={t("medicine.form.startDateEditPlaceholder")}
                    error={errors.startDate?.message}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="endDate"
                render={({ field: { onChange, value } }) => (
                  <DateField
                    label={t("medicine.form.endDateLabel")}
                    value={value}
                    onChange={onChange}
                    placeholder={t("medicine.form.endDatePlaceholder")}
                    error={errors.endDate?.message}
                  />
                )}
              />
            </View>
          </View>
        </Card>

        {/* Notes */}
        <Card padded={false}>
          <View style={{ padding: spacing.lg }}>
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label={t("medicine.form.notesLabel")}
                  helper={t("medicine.form.notesHelperEdit")}
                  error={errors.notes?.message}
                >
                  <TextInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t("medicine.form.notesPlaceholderEdit")}
                    multiline
                    numberOfLines={3}
                    invalid={!!errors.notes}
                  />
                </FormField>
              )}
            />
          </View>
        </Card>

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

        {/* Actions */}
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Button
            title={t("editMedicine.actions.save")}
            icon={Save}
            onPress={handleSubmit(onSubmit)}
            loading={edit.isPending}
            disabled={!isDirty || edit.isPending}
            variant="primary"
          />
          {watchedActive ? (
            <Button
              title={t("editMedicine.actions.stop")}
              icon={Power}
              onPress={onStop}
              loading={stop.isPending}
              variant="danger"
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
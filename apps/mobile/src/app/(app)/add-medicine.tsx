// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
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
  AlertTriangle,
  ShieldAlert,
  X,
} from "lucide-react-native";
import {
  useAddMedicineWithConfirm,
  usePatientProfile,
  useMedicineSuggestions,
  useMedicineInteractions,
  type MedicineSuggestion,
  type InteractionsResponse,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useDebounce } from "@/hooks/useDebounce";
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

type FormData = {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  startDate: Date;
  endDate?: Date;
  notes?: string;
};

function SuggestionRow({
  s,
  onApply,
}: {
  s: MedicineSuggestion;
  onApply: (s: MedicineSuggestion) => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();
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
            ? t("addMedicine.suggestion.fromHistory")
            : ""}
          {topDosage
            ? `${topDosage}${
                topFreq ? ` · ${topFreq}` : ""
              }${topTiming ? ` · ${topTiming}` : ""}`
            : t("addMedicine.suggestion.tapAutofill")}
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
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const addMedicine = useAddMedicineWithConfirm();
  const { data: profileData } = usePatientProfile();

  const schema = z.object({
    name: z.string().min(2, t("addMedicine.errors.nameRequired")),
    dosage: z.string().min(1, t("addMedicine.errors.dosageRequired")),
    frequency: z.string().min(1, t("addMedicine.errors.frequencyRequired")),
    timing: z.string().min(1, t("addMedicine.errors.timingRequired")),
    startDate: z.date(),
    endDate: z.date().optional(),
    notes: z.string().max(500).optional(),
  });

  const FREQUENCIES = FREQUENCY_VALUES.map((v) => ({
    value: v,
    label: t(`medicine.frequency.${v}`),
  }));
  const TIMINGS = TIMING_VALUES.map((v) => ({
    value: v,
    label: t(`medicine.timing.${v}`),
  }));

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
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
  const [, setPendingWarnings] = useState<InteractionsResponse | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any | null>(null);

  const debouncedName = useDebounce(watch("name") || "", 350);
  const interactionsQuery = useMedicineInteractions(debouncedName);
  const interactions: InteractionsResponse | undefined = interactionsQuery.data;

  const hasBlockingWarning = useMemo(() => {
    if (!interactions) return false;
    return (
      interactions.allergies.some((a) => a.severity === "critical" || a.severity === "severe") ||
      interactions.interactions.some((i) => i.severity === "severe")
    );
  }, [interactions]);

  const hasSoftWarning = useMemo(() => {
    if (!interactions) return false;
    if (hasBlockingWarning) return false;
    return (
      interactions.allergies.length > 0 || interactions.interactions.length > 0
    );
  }, [interactions, hasBlockingWarning]);

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
    toast.show(s.source === "history" ? t("addMedicine.toast.autofillHistory") : t("addMedicine.toast.autofillCatalog"), "success");
  }

  const submitWithOverride = async (data: FormData, override: boolean) => {
    const patientId = profileData?.patient?.patients?.id;
    if (!patientId) {
      setError("root", { message: t("addMedicine.toast.profileMissing") });
      return;
    }
    try {
      await addMedicine.mutateAsync({
        data: {
          patientId,
          name: data.name,
          dosage: data.dosage,
          frequency: data.frequency,
          timing: data.timing,
          notes: data.notes || undefined,
          startDate: data.startDate.toISOString().slice(0, 10),
        },
        confirmOverride: override,
      });
      toast.show(t("addMedicine.toast.added"), "success");
      router.back();
    } catch (err: any) {
      if (err?.status === 409 && err?.body?.requiresConfirmation) {
        setPendingWarnings(err.body);
        setPendingPayload({ patientId, name: data.name, dosage: data.dosage, frequency: data.frequency, timing: data.timing, notes: data.notes, startDate: data.startDate });
        setShowConfirmModal(true);
      } else {
        const msg = err?.message || t("addMedicine.toast.error");
        setError("root", { message: msg });
        toast.show(msg, "danger");
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    if (interactions && hasBlockingWarning) {
      setPendingWarnings(interactions);
      setPendingPayload({ patientId: profileData?.patient?.patients?.id, name: data.name, dosage: data.dosage, frequency: data.frequency, timing: data.timing, notes: data.notes, startDate: data.startDate });
      setShowConfirmModal(true);
      return;
    }
    await submitWithOverride(data, false);
  };

  const confirmAnyway = async () => {
    if (!pendingPayload) return;
    setShowConfirmModal(false);
    await submitWithOverride(pendingPayload as any, true);
  };

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title={t("addMedicine.title", { defaultValue: "Add medicine" })} />

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
            {t("addMedicine.hero.label")}
          </Text>
          <Text style={[typography.title.md, { color: colors.text }]}>
            {t("addMedicine.hero.title")}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 2 },
            ]}
          >
            {t("addMedicine.hero.body")}
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
                  label={t("medicine.form.nameLabel")}
                  required
                  error={errors.name?.message}
                  helper={
                    !showDropdown && nameQuery.trim().length > 0 && !isFetching
                      ? suggestions.length === 0
                        ? t("addMedicine.noMatch")
                        : undefined
                      : undefined
                  }
                >
                  <View style={{ position: "relative" }}>
                    <TextInput
                      value={value}
                      onChangeText={(txt) => {
                        onChange(txt);
                        setNameQuery(txt);
                      }}
                      onFocus={() => setNameFocused(true)}
                      onBlur={(e) => {
                        onBlur(e);
                        setTimeout(() => setNameFocused(false), 120);
                      }}
                      placeholder={t("medicine.form.namePlaceholder")}
                      autoCapitalize="words"
                      leadingIcon={Pill}
                      invalid={!!errors.name}
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

            {/* V3: Inline interaction warnings */}
            {(hasBlockingWarning || hasSoftWarning) && interactions ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: hasBlockingWarning ? colors.dangerSoft : colors.warningSoft,
                  borderWidth: 1,
                  borderColor: hasBlockingWarning ? `${colors.danger}55` : `${colors.warning}55`,
                }}
                accessibilityRole="alert"
                accessibilityLabel={
                  hasBlockingWarning
                    ? t("addMedicine.a11y.criticalWarning")
                    : t("addMedicine.a11y.warningAlert")
                }
              >
                {hasBlockingWarning ? (
                  <ShieldAlert size={18} color={colors.danger} strokeWidth={2.25} />
                ) : (
                  <AlertTriangle size={18} color={colors.warning} strokeWidth={2.25} />
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={[
                      typography.label.md,
                      {
                        color: hasBlockingWarning ? colors.danger : colors.warning,
                        fontWeight: "800",
                      },
                    ]}
                  >
                    {hasBlockingWarning ? t("addMedicine.interaction.critical") : t("addMedicine.interaction.possible")}
                  </Text>
                  {interactions.allergies.map((a, i) => (
                    <Text
                      key={`a-${i}`}
                      style={[typography.body.sm, { color: colors.text }]}
                    >
                      {a.reaction
                        ? t("addMedicine.interaction.allergyWithReaction", {
                            substance: a.substance,
                            severity: a.severity,
                            reaction: a.reaction,
                          })
                        : t("addMedicine.interaction.allergyItem", {
                            substance: a.substance,
                            severity: a.severity,
                          })}
                    </Text>
                  ))}
                  {interactions.interactions.map((it, i) => (
                    <Text
                      key={`i-${i}`}
                      style={[typography.body.sm, { color: colors.text }]}
                    >
                      {t("addMedicine.interaction.interactionItem", {
                        medicines: it.medicines.join(" + "),
                        note: it.note,
                      })}
                    </Text>
                  ))}
                  {hasBlockingWarning ? (
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.danger, fontWeight: "700", marginTop: 2 },
                      ]}
                    >
                      {t("addMedicine.interaction.confirmPrompt")}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

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
                    leadingIcon={Hourglass}
                    invalid={!!errors.dosage}
                  />
                </FormField>
              )}
            />

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
                    options={FREQUENCIES}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
            </FormField>

            <FormField
              label={t("medicine.form.timingLabel")}
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

            <FormField label={t("medicine.form.startDateLabel")} required>
              <Controller
                control={control}
                name="startDate"
                render={({ field: { onChange, value } }) => (
                  <DateField
                    value={value}
                    onChange={onChange}
                    placeholder={t("medicine.form.startDatePlaceholder")}
                  />
                )}
              />
            </FormField>
          </View>
        </Card>

        <FormField label={t("medicine.form.notesLabel")} helper={t("medicine.form.notesHelper")}>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t("medicine.form.notesPlaceholder")}
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
          title={t("addMedicine.actions.save", { defaultValue: "Save medicine" })}
          onPress={handleSubmit(onSubmit)}
          loading={addMedicine.isPending}
          icon={Save}
          size="lg"
        />
      </View>

      {/* V3: Confirm-anyway modal for severe interactions */}
      <Modal
        visible={showConfirmModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: spacing.lg,
              paddingBottom: spacing.xl + 16,
              gap: spacing.md,
            }}
            accessibilityViewIsModal
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
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.dangerSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldAlert size={20} color={colors.danger} strokeWidth={2.25} />
                </View>
                <Text
                  style={[
                    typography.title.md,
                    { color: colors.text, fontWeight: "800" },
                  ]}
                >
                  {t("addMedicine.confirm.title")}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowConfirmModal(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("addMedicine.a11y.close")}
              >
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text
              style={[typography.body.md, { color: colors.text, lineHeight: 22 }]}
            >
              {(pendingWarnings as any)?.allergies?.[0]
                ? t("addMedicine.confirm.allergyConflict", {
                    substance: (pendingWarnings as any).allergies[0].substance,
                  })
                : (pendingWarnings as any)?.interactions?.[0]?.note ||
                  t("addMedicine.confirm.fallback")}
            </Text>

            <View style={{ gap: 6 }}>
              {(pendingWarnings as any)?.allergies?.map((a: any, i: number) => (
                <View
                  key={`ma-${i}`}
                  style={{
                    flexDirection: "row",
                    gap: spacing.xs,
                    alignItems: "flex-start",
                  }}
                >
                  <AlertTriangle size={14} color={colors.danger} />
                  <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
                    {t("addMedicine.confirm.allergyItem", {
                      substance: a.substance,
                      severity: a.severity,
                    })}
                  </Text>
                </View>
              ))}
              {(pendingWarnings as any)?.interactions?.map((it: any, i: number) => (
                <View
                  key={`mi-${i}`}
                  style={{
                    flexDirection: "row",
                    gap: spacing.xs,
                    alignItems: "flex-start",
                  }}
                >
                  <AlertTriangle size={14} color={colors.danger} />
                  <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
                    {t("addMedicine.interaction.interactionItem", {
                      medicines: it.medicines.join(" + "),
                      note: it.note,
                    })}
                  </Text>
                </View>
              ))}
            </View>

            <Text
              style={[
                typography.caption,
                { color: colors.textMuted, lineHeight: 18 },
              ]}
            >
              {t("addMedicine.confirm.warningFooter")}
            </Text>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title={t("addMedicine.confirm.cancel")}
                variant="outline"
                onPress={() => setShowConfirmModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={t("addMedicine.confirm.addAnyway")}
                variant="danger"
                onPress={confirmAnyway}
                loading={addMedicine.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
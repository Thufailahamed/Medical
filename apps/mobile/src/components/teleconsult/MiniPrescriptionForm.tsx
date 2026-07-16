// @ts-nocheck

/**
 * MiniPrescriptionForm — in-call e-Rx composer.
 *
 * Rendered inside a BottomSheet from DoctorSidePanel so the video stage
 * stays visible at the top. Single-medicine flow (no add/remove, no
 * templates, no draft persistence) — kept tight for mobile in-call
 * ergonomics. Reuses the full composer's safety contract: blocking
 * severity opens an override sheet that requires `X-Confirm-Warning: true`
 * on the POST (apps/mobile/src/app/(doctor)/prescription.tsx:343-376).
 */

import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Save,
  Pill as PillIcon,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Trash2,
} from "lucide-react-native";
import {
  useCreatePrescription,
  usePatientOverview,
  useSafetyCheck,
  type DrugWarning,
  type SafetyCheckCandidate,
} from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useTheme } from "@/theme/ThemeProvider";
import {
  BottomSheet,
  Card,
  FormField,
  TextInput,
  Button,
  Pill as PillCmp,
  ChipGroup,
  useToast,
} from "@/components/ui";

type Slots = {
  morning: boolean;
  noon: boolean;
  evening: boolean;
  night: boolean;
};

type MedicineEntry = {
  key: string;
  name: string;
  dosage: string;
  slots: Slots;
  timing: "" | "Before food" | "After food" | "With food" | "Any time";
  durationDays: number;
  ongoing: boolean;
  masterMedicineId: string | null;
};

const PRESET_MEDS = [
  "Amoxicillin",
  "Paracetamol",
  "Ibuprofen",
  "Metformin",
  "Amlodipine",
  "Atorvastatin",
  "Omeprazole",
  "Salbutamol",
];

const COMMON_DOSAGES = ["250mg", "500mg", "1g", "5mg", "10mg", "20mg"];

function emptyEntry(): MedicineEntry {
  return {
    key: Math.random().toString(36).slice(2, 10),
    name: "",
    dosage: "",
    slots: { morning: false, noon: false, evening: false, night: false },
    timing: "",
    durationDays: 7,
    ongoing: false,
    masterMedicineId: null,
  };
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function slotsToFrequency(s: Slots): string | null {
  const n =
    (s.morning ? 1 : 0) + (s.noon ? 1 : 0) + (s.evening ? 1 : 0) + (s.night ? 1 : 0);
  if (n === 0) return null;
  if (n === 1) return "Once daily";
  if (n === 2) return "Twice daily";
  if (n === 3) return "Three times daily";
  return "Four times daily";
}

type Props = {
  visible: boolean;
  patientId: string;
  appointmentId?: string;
  onSaved: (id: string, signed: boolean) => void;
  onCancel: () => void;
};

export default function MiniPrescriptionForm({
  visible,
  patientId,
  appointmentId,
  onSaved,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const createPrescription = useCreatePrescription();

  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [entry, setEntry] = useState<MedicineEntry>(() => emptyEntry());
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  function reset() {
    setDiagnosis("");
    setNotes("");
    setEntry(emptyEntry());
    setOverrideReason("");
  }

  function patchEntry(patch: Partial<MedicineEntry>) {
    setEntry((e) => ({ ...e, ...patch }));
  }

  function setSlot(key: keyof Slots) {
    setEntry((e) => ({ ...e, slots: { ...e.slots, [key]: !e.slots[key] } }));
  }

  // Live safety pre-flight mirrors the full composer's contract.
  const safetyEnabled = !!patientId && !!entry.name.trim() && !!entry.dosage.trim();
  const safetyPayload = useMemo(
    () =>
      safetyEnabled
        ? {
            patientId,
            candidate: [
              {
                name: entry.name.trim(),
                dosage: entry.dosage.trim() || undefined,
                masterMedicineId: entry.masterMedicineId || undefined,
              },
            ] as SafetyCheckCandidate[],
          }
        : null,
    [safetyEnabled, patientId, entry.name, entry.dosage, entry.masterMedicineId]
  );
  const { data: safetyResult, isFetching: safetyFetching } = useSafetyCheck(
    safetyPayload,
    safetyEnabled
  );
  const safetyWarnings: DrugWarning[] = safetyResult?.warnings || [];
  const topSeverity = safetyResult?.severity || null;

  async function handleCreate(force = false) {
    if (!entry.name.trim()) {
      toast.show(t("doctorPrescription.medicineErrorEmpty"), "warning");
      return;
    }
    if (!entry.dosage.trim()) {
      toast.show(t("doctorPrescription.medicineErrorDosage"), "warning");
      return;
    }
    const freq = slotsToFrequency(entry.slots);
    if (!freq) {
      toast.show(t("doctorPrescription.medicineErrorSlots"), "warning");
      return;
    }
    const blocking = topSeverity === "severe" || topSeverity === "critical";
    if (blocking && !force) {
      setOverrideOpen(true);
      return;
    }
    const startDate = todayISO();
    try {
      const res = await createPrescription.mutateAsync({
        data: {
          patientId,
          appointmentId: appointmentId ?? undefined,
          diagnosis: diagnosis.trim() || undefined,
          notes: notes.trim() || undefined,
          medicines: [
            {
              name: entry.name.trim(),
              dosage: entry.dosage.trim(),
              frequency: freq,
              timing: entry.timing || undefined,
              startDate,
              endDate: entry.ongoing ? undefined : addDays(startDate, Math.max(1, entry.durationDays || 1)),
              masterMedicineId: entry.masterMedicineId ?? null,
            },
          ],
        },
        headers: force ? { "X-Confirm-Warning": "true" } : undefined,
      });
      toast.show(t("doctorPrescription.savedToast"), "success");
      const savedId = res?.prescription?.id ?? "";
      const signed = res?.prescription?.status === "signed";
      reset();
      onSaved(savedId, signed);
    } catch (err: any) {
      toast.show(err?.message || t("doctorPrescription.saveError"), "danger");
    }
  }

  function handleDismiss() {
    if (createPrescription.isPending) return;
    reset();
    setOverrideOpen(false);
    onCancel();
  }

  const slotEntries: Array<{ key: keyof Slots; label: string }> = [
    { key: "morning", label: t("doctorPrescription.slotMorning") },
    { key: "noon", label: t("doctorPrescription.slotNoon") },
    { key: "evening", label: t("doctorPrescription.slotEvening") },
    { key: "night", label: t("doctorPrescription.slotNight") },
  ];

  const timingOptions = useMemo(
    () => [
      { value: "Before food", label: t("doctorPrescription.timingBefore") },
      { value: "After food", label: t("doctorPrescription.timingAfter") },
      { value: "With food", label: t("doctorPrescription.timingWith") },
      { value: "Any time", label: t("doctorPrescription.timingAny") },
    ],
    [t]
  );

  return (
    <BottomSheet
      visible={visible}
      onDismiss={handleDismiss}
      title={t("consult.newPrescription", "New prescription")}
      height={620}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.md }}
      >
        <Card padded={false}>
          <View style={{ padding: spacing.md, gap: spacing.md }}>
            <FormField label={t("doctorPrescription.assessment", "Assessment")}>
              <TextInput
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholder={t("doctorPrescription.diagnosisPlaceholder")}
                multiline
                numberOfLines={2}
              />
            </FormField>
            <FormField label={t("doctorPrescription.notes", "Notes")}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("doctorPrescription.notesPlaceholder")}
                multiline
                numberOfLines={2}
                tone="soft"
              />
            </FormField>
          </View>
        </Card>

        <Card padded={false}>
          <View style={{ padding: spacing.md, gap: spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("doctorPrescription.medicine")}
              </Text>
              <Pressable
                onPress={() => patchEntry({ name: "", dosage: "", masterMedicineId: null })}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("common.clear")}
              >
                <Trash2 size={16} color={colors.textMuted} strokeWidth={2.2} />
              </Pressable>
            </View>

            <FormField label={t("doctorPrescription.medicine")} required>
              <TextInput
                value={entry.name}
                onChangeText={(v) => patchEntry({ name: v, masterMedicineId: null })}
                placeholder={t("doctorPrescription.medicinePlaceholder")}
                leadingIcon={PillIcon}
              />
            </FormField>

            {entry.name.trim().length >= 2 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {PRESET_MEDS.filter((p) =>
                  p.toLowerCase().includes(entry.name.toLowerCase())
                )
                  .slice(0, 4)
                  .map((p) => (
                    <PillCmp
                      key={p}
                      label={p}
                      tone="neutral"
                      size="sm"
                      onPress={() => patchEntry({ name: p })}
                    />
                  ))}
              </View>
            ) : null}

            <FormField label={t("doctorPrescription.dosage")} required>
              <TextInput
                value={entry.dosage}
                onChangeText={(v) => patchEntry({ dosage: v })}
                placeholder={t("doctorPrescription.dosagePlaceholder")}
              />
            </FormField>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {COMMON_DOSAGES.map((d) => (
                <PillCmp
                  key={d}
                  label={d}
                  tone={entry.dosage === d ? "accent" : "neutral"}
                  size="sm"
                  onPress={() => patchEntry({ dosage: d })}
                />
              ))}
            </View>

            <FormField label={t("doctorPrescription.frequency", "Frequency")}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {slotEntries.map(({ key, label }) => {
                  const selected = entry.slots[key];
                  return (
                    <PillCmp
                      key={key}
                      label={label}
                      tone={selected ? "primary" : "neutral"}
                      size="sm"
                      onPress={() => setSlot(key)}
                    />
                  );
                })}
              </View>
              {slotsToFrequency(entry.slots) ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {slotsToFrequency(entry.slots)}
                </Text>
              ) : null}
            </FormField>

            <FormField label={t("doctorPrescription.timingFoodLabel")}>
              <ChipGroup
                options={timingOptions}
                value={entry.timing}
                onChange={(v) => patchEntry({ timing: v as MedicineEntry["timing"] })}
              />
            </FormField>
          </View>
        </Card>

        {safetyEnabled ? <SafetyMini warnings={safetyWarnings} severity={topSeverity} loading={safetyFetching} /> : null}

        <View style={{ gap: spacing.sm }}>
          <Button
            title={t("doctorPrescription.createPrescription")}
            onPress={() => handleCreate(false)}
            loading={createPrescription.isPending}
            icon={Save}
            size="lg"
            fullWidth
          />
          <Button
            title={t("common.cancel", "Cancel")}
            onPress={handleDismiss}
            variant="ghost"
            size="md"
            fullWidth
            disabled={createPrescription.isPending}
          />
        </View>
      </ScrollView>

      <OverrideSheet
        visible={overrideOpen}
        warnings={safetyWarnings}
        reason={overrideReason}
        setReason={setOverrideReason}
        onConfirm={() => {
          setOverrideOpen(false);
          handleCreate(true);
        }}
        onCancel={() => setOverrideOpen(false)}
        busy={createPrescription.isPending}
      />
    </BottomSheet>
  );
}

function SafetyMini({
  warnings,
  severity,
  loading,
}: {
  warnings: DrugWarning[];
  severity: string | null;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();

  if (loading && !warnings.length) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[typography.body.sm, { color: colors.textMuted }]}>
          {t("doctorPrescription.safetyTitle")}…
        </Text>
      </View>
    );
  }
  if (!warnings.length) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.successSoft,
        }}
      >
        <ShieldCheck size={18} color={colors.success} strokeWidth={2.25} />
        <Text style={[typography.body.sm, { color: colors.success, fontWeight: "600" }]}>
          {t("doctorPrescription.safetyEmpty")}
        </Text>
      </View>
    );
  }
  const blocking = severity === "severe" || severity === "critical";
  const bg = blocking ? colors.dangerSoft : colors.warningSoft;
  const fg = blocking ? colors.danger : colors.warning;
  return (
    <View
      style={{
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.sm,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: blocking ? colors.danger : colors.warning,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {blocking ? (
          <ShieldAlert size={18} color={fg} strokeWidth={2.25} />
        ) : (
          <AlertTriangle size={18} color={fg} strokeWidth={2.25} />
        )}
        <Text style={[typography.title.sm, { color: fg }]}>
          {t("doctorPrescription.safetyTitle")}
        </Text>
        <PillCmp
          label={t(`doctorPrescription.safetySeverity_${severity}`)}
          tone={blocking ? "danger" : "warning"}
          size="sm"
        />
      </View>
      {warnings.map((w, i) => (
        <View
          key={`${w.type}-${i}`}
          style={{
            padding: spacing.sm,
            borderRadius: radius.sm,
            backgroundColor: colors.bgElevated,
            gap: 4,
          }}
        >
          <Text style={[typography.body.sm, { color: colors.text }]}>{w.message}</Text>
          <Text style={[typography.body.xs, { color: colors.textMuted, fontStyle: "italic" }]}>
            {t("doctorPrescription.safetyRecommendation")}: {w.recommendation}
          </Text>
        </View>
      ))}
    </View>
  );
}

function OverrideSheet({
  visible,
  warnings,
  reason,
  setReason,
  onConfirm,
  onCancel,
  busy,
}: {
  visible: boolean;
  warnings: DrugWarning[];
  reason: string;
  setReason: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onDismiss={onCancel}
      title={t("doctorPrescription.safetyOverrideTitle")}
      height={420}
    >
      <View style={{ gap: spacing.md }}>
        <Text style={{ fontSize: 13, color: "#666" }}>
          {t("doctorPrescription.safetyOverrideBody")}
        </Text>
        {warnings.slice(0, 3).map((w, i) => (
          <Text key={i} style={{ fontSize: 12, color: "#444" }}>
            • {w.message}
          </Text>
        ))}
        <FormField label={t("doctorPrescription.safetyOverridePlaceholder")} required>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t("doctorPrescription.safetyOverridePlaceholder")}
            multiline
            numberOfLines={3}
            tone="soft"
          />
        </FormField>
        <Button
          title={t("doctorPrescription.safetyOverrideConfirm")}
          onPress={onConfirm}
          disabled={busy || !reason.trim()}
          loading={busy}
          icon={ShieldAlert}
          size="lg"
          fullWidth
        />
        <Button
          title={t("doctorPrescription.safetyOverrideCancel")}
          onPress={onCancel}
          variant="ghost"
          size="md"
          fullWidth
          disabled={busy}
        />
      </View>
    </BottomSheet>
  );
}
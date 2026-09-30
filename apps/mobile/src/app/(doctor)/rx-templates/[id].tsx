// @ts-nocheck

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Check,
  Pill,
  X,
  Stethoscope,
  StickyNote,
} from "lucide-react-native";
import {
  useDoctorRxTemplate,
  useUpdateRxTemplate,
  useDeleteRxTemplate,
  type MedicineEntry,
} from "@/hooks/useApi";
import { Screen, ScreenHeader } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";

type Draft = {
  name: string;
  diagnosis: string;
  notes: string;
  medicines: MedicineEntry[];
};

const emptyMed: MedicineEntry = {
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

export default function EditTemplateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";

  const { data, isLoading } = useDoctorRxTemplate(id);
  const updateMutation = useUpdateRxTemplate();
  const deleteMutation = useDeleteRxTemplate();

  const [draft, setDraft] = useState<Draft | null>(null);
  // Serialized server copy — lets Save stay disabled until something changes.
  const [baseline, setBaseline] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.template) return;
    const tpl = data.template;
    const initial: Draft = {
      name: tpl.name || "",
      diagnosis: tpl.diagnosis || "",
      notes: tpl.notes || "",
      medicines: Array.isArray(tpl.medicines) && tpl.medicines.length
        ? tpl.medicines
        : [{ ...emptyMed }],
    };
    setDraft(initial);
    setBaseline(JSON.stringify(initial));
  }, [data?.template]);

  const setMed = useCallback((idx: number, patch: Partial<MedicineEntry>) => {
    setDraft((d) => {
      if (!d) return d;
      const meds = d.medicines.slice();
      meds[idx] = { ...meds[idx], ...patch };
      return { ...d, medicines: meds };
    });
  }, []);

  const addMed = useCallback(() => {
    setDraft((d) => (d ? { ...d, medicines: [...d.medicines, { ...emptyMed }] } : d));
  }, []);

  const removeMed = useCallback((idx: number) => {
    setDraft((d) => {
      if (!d || d.medicines.length <= 1) return d;
      return { ...d, medicines: d.medicines.filter((_, i) => i !== idx) };
    });
  }, []);

  const save = useCallback(async () => {
    if (!id || !draft) return;
    const meds = draft.medicines.filter((m) => m.name.trim());
    if (!draft.name.trim()) {
      Alert.alert(t("rxTemplates.nameRequired"));
      return;
    }
    if (meds.length === 0) {
      Alert.alert(t("rxTemplates.atLeastOneMed"));
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id,
        name: draft.name.trim(),
        diagnosis: draft.diagnosis.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        medicines: meds,
      });
      router.back();
    } catch (err: any) {
      Alert.alert(err?.message || t("rxTemplates.saveFailed"));
    }
  }, [draft, id, updateMutation, router, t]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    Alert.alert(
      t("rxTemplates.deleteTitle"),
      t("rxTemplates.deleteMessage", { name: draft?.name || "" }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(id);
              router.back();
            } catch (err: any) {
              Alert.alert(err?.message || t("rxTemplates.deleteFailed"));
            }
          },
        },
      ]
    );
  }, [id, draft?.name, deleteMutation, router, t]);

  const dirty = !!draft && !!baseline && JSON.stringify(draft) !== baseline;

  const goBack = useCallback(() => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(
      t("rxTemplates.discardTitle", "Discard changes?"),
      t("rxTemplates.discardBody", "Your edits to this template haven't been saved."),
      [
        { text: t("rxTemplates.keepEditing", "Keep editing"), style: "cancel" },
        { text: t("rxTemplates.discard", "Discard"), style: "destructive", onPress: () => router.back() },
      ]
    );
  }, [dirty, router, t]);

  if (isLoading || !draft) {
    return (
      <Screen padded={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg, alignItems: "center", marginTop: 80 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const saving = updateMutation.isPending;
  const canSave = dirty && !saving;
  const filledMeds = draft.medicines.filter((m) => m.name.trim()).length;

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      <ScreenHeader
        back
        onBack={goBack}
        title={t("rxTemplates.editTitle")}
        subtitle={
          dirty
            ? t("rxTemplates.unsaved", "Unsaved changes")
            : draft.name || t("rxTemplates.editSubtitle")
        }
        right={
          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            style={({ pressed }) => ({
              height: 38,
              paddingHorizontal: 16,
              borderRadius: 19,
              borderCurve: "continuous",
              backgroundColor: canSave || saving ? colors.primary : colors.fill,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              opacity: pressed ? 0.85 : 1,
              ...(canSave && !isDark ? shadow.primary : {}),
            })}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <Check
                  size={15}
                  color={canSave ? colors.onPrimary : colors.textSubtle}
                  strokeWidth={2.6}
                />
                <Text
                  style={[
                    typography.label.md,
                    { color: canSave ? colors.onPrimary : colors.textSubtle },
                  ]}
                >
                  {t("common.save")}
                </Text>
              </>
            )}
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Details ─── */}
          <SectionLabel>{t("rxTemplates.sectionDetails", "Details")}</SectionLabel>
          <GroupCard>
            <LabeledInput
              label={t("rxTemplates.fieldName")}
              value={draft.name}
              onChangeText={(text) => setDraft((d) => (d ? { ...d, name: text } : d))}
              placeholder={t("rxTemplates.fieldNamePlaceholder")}
              emphasis
            />
            <LabeledInput
              icon={Stethoscope}
              label={t("rxTemplates.fieldDiagnosis")}
              value={draft.diagnosis}
              onChangeText={(text) => setDraft((d) => (d ? { ...d, diagnosis: text } : d))}
              placeholder={t("rxTemplates.fieldDiagnosisPlaceholder")}
            />
          </GroupCard>

          {/* ─── Medicines ─── */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: spacing.xl,
            }}
          >
            <SectionLabel style={{ marginTop: 0 }}>
              {t("rxTemplates.medicinesLabel")}
            </SectionLabel>
            <Text style={[typography.caption, { color: colors.textSubtle, marginBottom: spacing.sm }]}>
              {t("rxTemplates.medsShort", { count: filledMeds })}
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            {draft.medicines.map((m, idx) => (
              <MedicineCard
                key={idx}
                index={idx}
                med={m}
                canRemove={draft.medicines.length > 1}
                onChange={(patch) => setMed(idx, patch)}
                onRemove={() => removeMed(idx)}
              />
            ))}
          </View>

          <Pressable
            onPress={addMed}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: spacing.md,
              height: 50,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: radius.card,
              borderCurve: "continuous",
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: withOpacity(colors.primary, 0.45),
              backgroundColor: pressed ? colors.primarySoft : "transparent",
            })}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
              }}
            >
              <Plus size={14} color={colors.onPrimary} strokeWidth={2.8} />
            </View>
            <Text style={[typography.label.md, { color: colors.primary }]}>
              {t("rxTemplates.addMed")}
            </Text>
          </Pressable>

          {/* ─── Notes ─── */}
          <SectionLabel style={{ marginTop: spacing.xl }}>{t("rxTemplates.fieldNotes")}</SectionLabel>
          <GroupCard>
            <LabeledInput
              icon={StickyNote}
              label={t("rxTemplates.notesLabel", "Advice for the patient")}
              value={draft.notes}
              onChangeText={(text) => setDraft((d) => (d ? { ...d, notes: text } : d))}
              placeholder={t("rxTemplates.fieldNotesPlaceholder")}
              multiline
            />
          </GroupCard>

          {/* ─── Danger zone ─── */}
          <Pressable
            onPress={handleDelete}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: spacing.xxl,
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 40,
              paddingHorizontal: 16,
              borderRadius: 20,
              backgroundColor: pressed ? colors.dangerSoft : "transparent",
            })}
          >
            <Trash2 size={15} color={colors.danger} strokeWidth={2.2} />
            <Text style={[typography.label.md, { color: colors.danger }]}>
              {t("rxTemplates.deleteCta")}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const FREQUENCY_PRESETS = [
  { short: "OD", value: "Once daily" },
  { short: "BD", value: "Twice daily" },
  { short: "TDS", value: "Three times daily" },
  { short: "QID", value: "Four times daily" },
  { short: "Nocte", value: "At night" },
  { short: "PRN", value: "When needed" },
];

function MedicineCard({
  index,
  med,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  med: MedicineEntry;
  canRemove: boolean;
  onChange: (patch: Partial<MedicineEntry>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  const freq = (med.frequency || "").trim().toLowerCase();

  return (
    <GroupCard>
      {/* Name row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingLeft: spacing.md,
          paddingRight: spacing.sm,
          paddingVertical: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Pill size={15} color={colors.primary} strokeWidth={2.3} />
        </View>
        <TextInput
          value={med.name}
          onChangeText={(text) => onChange({ name: text })}
          placeholder={t("rxTemplates.medN", { n: index + 1 })}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={t("rxTemplates.medNamePlaceholder")}
          style={{
            flex: 1,
            height: 44,
            fontSize: 16.5,
            letterSpacing: -0.2,
            color: colors.text,
            fontFamily: fontFamily.bodyBold,
          }}
        />
        {canRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.delete")}
            style={({ pressed }) => ({
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.dangerSoft : colors.well,
            })}
          >
            {({ pressed }) => (
              <X size={15} color={pressed ? colors.danger : colors.textMuted} strokeWidth={2.5} />
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <MiniField
            label={t("rxTemplates.fieldDose", "Dose")}
            value={med.dosage || ""}
            onChangeText={(text) => onChange({ dosage: text })}
            placeholder={t("rxTemplates.dosagePlaceholder")}
          />
          <MiniField
            label={t("rxTemplates.fieldDuration", "Duration")}
            value={med.duration || ""}
            onChangeText={(text) => onChange({ duration: text })}
            placeholder={t("rxTemplates.durationPlaceholder")}
          />
        </View>

        <MiniField
          label={t("rxTemplates.fieldFrequency", "Frequency")}
          value={med.frequency || ""}
          onChangeText={(text) => onChange({ frequency: text })}
          placeholder={t("rxTemplates.frequencyPlaceholder")}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {FREQUENCY_PRESETS.map((p) => {
            const active = freq === p.value.toLowerCase();
            return (
              <Pressable
                key={p.short}
                onPress={() => onChange({ frequency: p.value })}
                accessibilityRole="button"
                accessibilityLabel={p.value}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  height: 28,
                  paddingHorizontal: 11,
                  justifyContent: "center",
                  borderRadius: 14,
                  borderCurve: "continuous",
                  backgroundColor: active ? colors.primary : pressed ? colors.primarySoft : colors.fill,
                })}
              >
                <Text
                  style={[
                    typography.label.xs,
                    { color: active ? colors.onPrimary : colors.textMuted, letterSpacing: 0.3 },
                  ]}
                >
                  {p.short}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <MiniField
          label={t("rxTemplates.fieldInstructions", "Instructions")}
          value={med.instructions || ""}
          onChangeText={(text) => onChange({ instructions: text })}
          placeholder={t("rxTemplates.instructionsPlaceholder")}
          multiline
        />
      </View>
    </GroupCard>
  );
}

function SectionLabel({ children, style }: { children: any; style?: any }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Text
      style={[
        typography.kicker,
        {
          color: colors.textSubtle,
          textTransform: "uppercase",
          marginTop: spacing.md,
          marginBottom: spacing.sm,
          marginLeft: 4,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function GroupCard({ children }: { children: any }) {
  const { colors, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  return (
    <View
      style={{
        borderRadius: radius.card,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.hairline,
        overflow: "hidden",
        ...(isDark ? {} : shadow.card),
      }}
    >
      {children}
    </View>
  );
}

/** Full-width row inside a GroupCard: small label above a borderless input. */
function LabeledInput({
  icon: Icon,
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  emphasis,
}: {
  icon?: any;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  emphasis?: boolean;
}) {
  const { colors, spacing, typography, fontFamily } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: multiline ? spacing.md : 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.separator,
        backgroundColor: focused ? withOpacity(colors.primary, 0.04) : "transparent",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {Icon ? <Icon size={12} color={focused ? colors.primary : colors.textSubtle} strokeWidth={2.3} /> : null}
        <Text style={[typography.caption, { color: focused ? colors.primary : colors.textSubtle }]}>
          {label}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 0,
          fontSize: emphasis ? 17 : 15.5,
          color: colors.text,
          fontFamily: emphasis ? fontFamily.bodySemibold : fontFamily.body,
          minHeight: multiline ? 64 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

/** Compact filled field used inside a medicine card. */
function MiniField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4,
        borderRadius: 14,
        borderCurve: "continuous",
        backgroundColor: focused ? colors.surface : colors.surfaceMuted,
        borderWidth: 1,
        borderColor: focused ? colors.primary : "transparent",
      }}
    >
      <Text style={[typography.caption, { fontSize: 11, color: focused ? colors.primary : colors.textSubtle }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        style={{
          paddingVertical: 4,
          paddingHorizontal: 0,
          fontSize: 15,
          color: colors.text,
          fontFamily: fontFamily.bodyMedium ?? fontFamily.body,
          minHeight: multiline ? 44 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

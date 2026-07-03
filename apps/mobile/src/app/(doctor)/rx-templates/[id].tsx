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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
} from "lucide-react-native";
import {
  useDoctorRxTemplate,
  useUpdateRxTemplate,
  useDeleteRxTemplate,
  type MedicineEntry,
} from "@/hooks/useApi";
import { Screen } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

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
  const { colors, spacing, typography, radius, fontFamily } = useTheme();

  const { data, isLoading } = useDoctorRxTemplate(id);
  const updateMutation = useUpdateRxTemplate();
  const deleteMutation = useDeleteRxTemplate();

  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (!data?.template) return;
    const tpl = data.template;
    setDraft({
      name: tpl.name || "",
      diagnosis: tpl.diagnosis || "",
      notes: tpl.notes || "",
      medicines: Array.isArray(tpl.medicines) && tpl.medicines.length
        ? tpl.medicines
        : [{ ...emptyMed }],
    });
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

  if (isLoading || !draft) {
    return (
      <Screen padded={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg, alignItems: "center", marginTop: 80 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} scroll edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          })}
        >
          <ChevronLeft size={22} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: colors.text,
              fontFamily: fontFamily.displayBold,
            }}
          >
            {draft.name || t("rxTemplates.editTitle")}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSubtle,
              marginTop: 2,
            }}
          >
            {t("rxTemplates.editSubtitle")}
          </Text>
        </View>
        <Pressable
          onPress={save}
          disabled={updateMutation.isPending}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: radius.full,
            backgroundColor: colors.primary,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Save size={14} color="#FFFFFF" strokeWidth={2.4} />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "700",
                  fontSize: 13,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {t("common.save")}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label={t("rxTemplates.fieldName")}
          value={draft.name}
          onChangeText={(text) => setDraft((d) => (d ? { ...d, name: text } : d))}
          placeholder={t("rxTemplates.fieldNamePlaceholder")}
        />
        <Field
          label={t("rxTemplates.fieldDiagnosis")}
          value={draft.diagnosis}
          onChangeText={(text) => setDraft((d) => (d ? { ...d, diagnosis: text } : d))}
          placeholder={t("rxTemplates.fieldDiagnosisPlaceholder")}
        />

        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: colors.textSubtle,
            fontFamily: fontFamily.displayBold,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
          }}
        >
          {t("rxTemplates.medicinesLabel")}
        </Text>
        {draft.medicines.map((m, idx) => (
          <View
            key={idx}
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginBottom: spacing.sm,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.text,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {t("rxTemplates.medN", { n: idx + 1 })}
              </Text>
              {draft.medicines.length > 1 && (
                <Pressable
                  onPress={() => removeMed(idx)}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: pressed ? colors.dangerSoft : "transparent",
                  })}
                >
                  <Trash2 size={16} color={colors.danger} />
                </Pressable>
              )}
            </View>
            <Field
              compact
              value={m.name}
              onChangeText={(text) => setMed(idx, { name: text })}
              placeholder={t("rxTemplates.medNamePlaceholder")}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Field
                  compact
                  value={m.dosage || ""}
                  onChangeText={(text) => setMed(idx, { dosage: text })}
                  placeholder={t("rxTemplates.dosagePlaceholder")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  compact
                  value={m.frequency || ""}
                  onChangeText={(text) => setMed(idx, { frequency: text })}
                  placeholder={t("rxTemplates.frequencyPlaceholder")}
                />
              </View>
            </View>
            <Field
              compact
              value={m.duration || ""}
              onChangeText={(text) => setMed(idx, { duration: text })}
              placeholder={t("rxTemplates.durationPlaceholder")}
            />
            <Field
              compact
              value={m.instructions || ""}
              onChangeText={(text) => setMed(idx, { instructions: text })}
              placeholder={t("rxTemplates.instructionsPlaceholder")}
              multiline
            />
          </View>
        ))}

        <Pressable
          onPress={addMed}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: colors.primary,
            backgroundColor: pressed ? colors.primarySoft : "transparent",
            gap: 6,
          })}
        >
          <Plus size={16} color={colors.primary} strokeWidth={2.4} />
          <Text
            style={{
              color: colors.primary,
              fontWeight: "700",
              fontFamily: fontFamily.bodyBold,
            }}
          >
            {t("rxTemplates.addMed")}
          </Text>
        </Pressable>

        <Field
          label={t("rxTemplates.fieldNotes")}
          value={draft.notes}
          onChangeText={(text) => setDraft((d) => (d ? { ...d, notes: text } : d))}
          placeholder={t("rxTemplates.fieldNotesPlaceholder")}
          multiline
          containerStyle={{ marginTop: spacing.lg }}
        />

        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => ({
            marginTop: spacing.xl,
            paddingVertical: 14,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.danger,
            alignItems: "center",
            backgroundColor: pressed ? colors.dangerSoft : "transparent",
          })}
        >
          <Text
            style={{
              color: colors.danger,
              fontWeight: "700",
              fontFamily: fontFamily.bodyBold,
            }}
          >
            {t("rxTemplates.deleteCta")}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  compact,
  containerStyle,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  compact?: boolean;
  containerStyle?: any;
}) {
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  return (
    <View style={[{ marginBottom: compact ? 6 : spacing.md }, containerStyle]}>
      {label && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: colors.textSubtle,
            fontFamily: fontFamily.displayBold,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        multiline={multiline}
        style={{
          borderRadius: radius.md,
          paddingHorizontal: 12,
          paddingVertical: multiline ? 12 : 10,
          fontSize: 15,
          color: colors.text,
          fontFamily: fontFamily.body,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
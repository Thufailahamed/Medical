// @ts-nocheck

import { useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react-native";

import { useCreateDoctorVital } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  FormField,
  TextInput,
  Button,
  Chip,
  useToast,
} from "@/components/ui";
import {
  VITAL_REGISTRY,
  VITAL_TYPES,
  type VitalType,
  type VitalContext,
} from "@healthcare/shared/vitals";

function usefulContextsFor(type: VitalType): VitalContext[] {
  switch (type) {
    case "blood_sugar":
      return ["fasting", "post_meal", "pre_meal", "random"];
    case "heart_rate":
      return ["resting", "exercise", "standing"];
    case "blood_pressure":
      return ["resting", "standing", "supine", "exercise"];
    case "temperature":
      return ["resting", "random"];
    case "pain_scale":
      return ["resting", "exercise", "post_medication"];
    default:
      return ["resting", "random"];
  }
}

export default function DoctorVitalRecordScreen() {
  const router = useRouter();
  const { spacing, typography, colors } = useTheme();
  const { t } = useTranslation();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const toast = useToast();

  const [type, setType] = useState<VitalType>("blood_pressure");
  const [value, setValue] = useState("");
  const [secondary, setSecondary] = useState("");
  const [context, setContext] = useState<VitalContext | null>(null);
  const [notes, setNotes] = useState("");

  const createVital = useCreateDoctorVital();
  const meta = VITAL_REGISTRY[type];

  async function save() {
    if (!patientId) return;
    const v = parseFloat(value);
    if (!v || Number.isNaN(v)) {
      toast.show(t("vitals.toast.invalidValue"), "warning");
      return;
    }
    if (type === "blood_pressure" && (!secondary || Number.isNaN(parseFloat(secondary)))) {
      toast.show(t("vitals.toast.invalidValue"), "warning");
      return;
    }
    try {
      await createVital.mutateAsync({
        patientId,
        type,
        value: v,
        secondaryValue: secondary ? parseFloat(secondary) : null,
        unit: meta.unit,
        context: context ?? null,
        notes: notes.trim() || null,
      });
      toast.show(
        t("vitals.toast.logged", { label: t(`vitals.type.${type}.label`) }),
        "success",
      );
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("vitals.toast.saveError"), "danger");
    }
  }

  if (!patientId) {
    return (
      <Screen padded>
        <ScreenHeader
          title={t("doctorVitalRecord.fallbackTitle")}
          back
          onBack={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorVitalRecord.title")}
        subtitle={t("doctorVitalRecord.subtitle")}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.label.md, { color: colors.textMuted }]}>
                {t("vitals.compose.typeLabel")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {VITAL_TYPES.map((vt) => (
                  <Chip
                    key={vt}
                    label={t(`vitals.type.${vt}.label`)}
                    selected={type === vt}
                    tone={type === vt ? "primary" : "neutral"}
                    onPress={() => {
                      setType(vt);
                      setContext(null);
                    }}
                  />
                ))}
              </View>
            </View>

            <FormField
              label={t("vitals.compose.valueLabel", { unit: meta.unit })}
              required
            >
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder={
                  type === "blood_pressure"
                    ? t("vitals.compose.valuePlaceholderBP")
                    : t("vitals.compose.valuePlaceholderDefault")
                }
                keyboardType="numeric"
              />
            </FormField>

            {type === "blood_pressure" ? (
              <FormField
                label={t("vitals.compose.diastolicLabel")}
                required
              >
                <TextInput
                  value={secondary}
                  onChangeText={setSecondary}
                  placeholder={t("vitals.compose.secondaryPlaceholder")}
                  keyboardType="numeric"
                />
              </FormField>
            ) : null}

            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.label.md, { color: colors.textMuted }]}>
                {t("vitals.compose.contextLabel")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {usefulContextsFor(type).map((ctx) => (
                  <Chip
                    key={ctx}
                    label={t(`vitals.context.${ctx}`)}
                    selected={context === ctx}
                    tone={context === ctx ? "info" : "neutral"}
                    onPress={() => setContext(context === ctx ? null : ctx)}
                  />
                ))}
              </View>
            </View>

            <FormField
              label={t("vitals.compose.notesLabel")}
              helper={t("vitals.compose.notesHelper")}
            >
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("vitals.compose.notesPlaceholder")}
                multiline
                numberOfLines={3}
                tone="soft"
              />
            </FormField>
          </View>
        </Card>

        <Button
          title={t("doctorVitalRecord.saveAction")}
          onPress={save}
          loading={createVital.isPending}
          icon={Save}
          size="lg"
          fullWidth
        />
      </ScrollView>
    </Screen>
  );
}

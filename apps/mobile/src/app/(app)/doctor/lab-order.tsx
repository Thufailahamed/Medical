// @ts-nocheck

import { useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { FlaskConical, Send, FileText } from "lucide-react-native";
import { useCreateLabOrder } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  FormField,
  TextInput,
  Pill as PillCmp,
  ChipGroup,
  Button,
  useToast,
} from "@/components/ui";

const COMMON_TESTS = [
  "CBC",
  "Lipid Profile",
  "Fasting Glucose",
  "HbA1c",
  "Liver Function (LFT)",
  "Kidney Function (RFT)",
  "Thyroid (TSH/T3/T4)",
  "Vitamin D",
  "Vitamin B12",
  "Iron Studies",
  "Urinalysis",
  "ECG",
  "Chest X-Ray",
  "Ultrasound Abdomen",
];

export default function LabOrderScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const toast = useToast();

  const PRIORITIES = [
    { value: "routine", label: t("doctorLabOrder.priorityRoutine") },
    { value: "urgent", label: t("doctorLabOrder.priorityUrgent") },
    { value: "stat", label: t("doctorLabOrder.priorityStat") },
  ];

  const [tests, setTests] = useState<string[]>([]);
  const [priority, setPriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [notes, setNotes] = useState("");
  const [customTest, setCustomTest] = useState("");

  const createOrder = useCreateLabOrder();

  function toggleTest(tt: string) {
    setTests((prev) =>
      prev.includes(tt) ? prev.filter((x) => x !== tt) : [...prev, tt]
    );
  }

  function addCustom() {
    const tt = customTest.trim();
    if (!tt) return;
    if (!tests.includes(tt)) setTests([...tests, tt]);
    setCustomTest("");
  }

  async function submit() {
    if (!patientId || tests.length === 0) {
      toast.show(t("doctorLabOrder.pickOneTest"), "warning");
      return;
    }
    try {
      await createOrder.mutateAsync({
        patientId,
        tests,
        priority,
        notes: notes.trim() || undefined,
      });
      toast.show(t("doctorLabOrder.placedToast"), "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("doctorLabOrder.placedError"), "danger");
    }
  }

  if (!patientId) {
    return (
      <Screen padded>
        <ScreenHeader title={t("doctorLabOrder.title")} back onBack={() => router.back()} />
      </Screen>
    );
  }

  const testsLabel = t("doctorLabOrder.testsLabel", { count: tests.length });

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorLabOrder.title")}
        subtitle={t("doctorLabOrder.subtitle")}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Text style={[typography.label.lg, { color: colors.textMuted }]}>
              {t("doctorLabOrder.priorityLabel")}
            </Text>
            <ChipGroup
              options={PRIORITIES}
              value={priority}
              onChange={(v) => setPriority(v as any)}
            />
          </View>
        </Card>

        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Text style={[typography.label.lg, { color: colors.textMuted }]}>
              {testsLabel} ({tests.length})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {COMMON_TESTS.map((tt) => (
                <PillCmp
                  key={tt}
                  label={tt}
                  tone={tests.includes(tt) ? "primary" : "neutral"}
                  size="sm"
                  onPress={() => toggleTest(tt)}
                />
              ))}
              {tests
                .filter((tt) => !COMMON_TESTS.includes(tt))
                .map((tt) => (
                  <PillCmp
                    key={tt}
                    label={tt}
                    tone="primary"
                    size="sm"
                    onPress={() => toggleTest(tt)}
                  />
                ))}
            </View>

            <FormField label={t("doctorLabOrder.customTest")}>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={customTest}
                    onChangeText={setCustomTest}
                    placeholder={t("doctorLabOrder.customTestPlaceholder")}
                    onSubmitEditing={addCustom}
                    returnKeyType="done"
                  />
                </View>
                <PillCmp
                  icon={FlaskConical}
                  label={t("doctorLabOrder.addAction")}
                  tone="primary"
                  onPress={addCustom}
                />
              </View>
            </FormField>
          </View>
        </Card>

        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <FormField label={t("doctorLabOrder.clinicalNotes")}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("doctorLabOrder.clinicalNotesPlaceholder")}
                leadingIcon={FileText}
                multiline
                numberOfLines={4}
                tone="soft"
              />
            </FormField>
          </View>
        </Card>

        <Button
          title={t("doctorLabOrder.orderAction", { count: tests.length })}
          onPress={submit}
          loading={createOrder.isPending}
          icon={Send}
          size="lg"
          disabled={tests.length === 0}
        />
      </View>
    </Screen>
  );
}

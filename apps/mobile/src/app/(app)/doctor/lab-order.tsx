import { useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

const PRIORITIES = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "stat", label: "STAT" },
];

export default function LabOrderScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const toast = useToast();

  const [tests, setTests] = useState<string[]>([]);
  const [priority, setPriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [notes, setNotes] = useState("");
  const [customTest, setCustomTest] = useState("");

  const createOrder = useCreateLabOrder();

  function toggleTest(t: string) {
    setTests((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function addCustom() {
    const t = customTest.trim();
    if (!t) return;
    if (!tests.includes(t)) setTests([...tests, t]);
    setCustomTest("");
  }

  async function submit() {
    if (!patientId || tests.length === 0) {
      toast.show("Pick at least one test", "warning");
      return;
    }
    try {
      await createOrder.mutateAsync({
        patientId,
        tests,
        priority,
        notes: notes.trim() || undefined,
      });
      toast.show("Lab order placed", "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Could not place order", "danger");
    }
  }

  if (!patientId) {
    return (
      <Screen padded>
        <ScreenHeader title="Order labs" back onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Order labs"
        subtitle="Pick tests and priority"
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Text style={[typography.label.lg, { color: colors.textMuted }]}>
              PRIORITY
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
              TESTS ({tests.length})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {COMMON_TESTS.map((t) => (
                <PillCmp
                  key={t}
                  label={t}
                  tone={tests.includes(t) ? "primary" : "neutral"}
                  size="sm"
                  onPress={() => toggleTest(t)}
                />
              ))}
              {tests
                .filter((t) => !COMMON_TESTS.includes(t))
                .map((t) => (
                  <PillCmp
                    key={t}
                    label={t}
                    tone="primary"
                    size="sm"
                    onPress={() => toggleTest(t)}
                  />
                ))}
            </View>

            <FormField label="Custom test">
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={customTest}
                    onChangeText={setCustomTest}
                    placeholder="Add a test not listed"
                    onSubmitEditing={addCustom}
                    returnKeyType="done"
                  />
                </View>
                <PillCmp
                  icon={FlaskConical}
                  label="Add"
                  tone="primary"
                  onPress={addCustom}
                />
              </View>
            </FormField>
          </View>
        </Card>

        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <FormField label="Clinical notes">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Indication, suspected diagnosis…"
                leadingIcon={FileText}
                multiline
                numberOfLines={4}
                tone="soft"
              />
            </FormField>
          </View>
        </Card>

        <Button
          title={`Order ${tests.length} test${tests.length === 1 ? "" : "s"}`}
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
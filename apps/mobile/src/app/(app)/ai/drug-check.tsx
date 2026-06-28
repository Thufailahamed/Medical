import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  Pill,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Info,
  Plus,
  X,
  Sparkles,
} from "lucide-react-native";
import {
  useAiDrugCheck,
  useMyMedicines,
  type DrugInteraction,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  Skeleton,
  Pill as PillCmp,
  FormField,
  TextInput,
  IconButton,
  useToast,
  ChipGroup,
} from "@/components/ui";

const SUGGESTIONS = [
  "Paracetamol",
  "Ibuprofen",
  "Aspirin",
  "Amoxicillin",
  "Metformin",
  "Atorvastatin",
  "Amlodipine",
  "Omeprazole",
];

function severityTone(s: string): any {
  switch (s) {
    case "severe":
      return "danger";
    case "moderate":
      return "warning";
    case "minor":
      return "info";
    default:
      return "neutral";
  }
}

function severityIcon(s: string) {
  switch (s) {
    case "severe":
      return AlertOctagon;
    case "moderate":
      return AlertTriangle;
    case "minor":
      return Info;
    default:
      return ShieldAlert;
  }
}

export default function DrugCheckScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const { data: medsData } = useMyMedicines();
  const aiDrugCheck = useAiDrugCheck();

  const [medicines, setMedicines] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<{
    interactions: DrugInteraction[];
    warnings?: string[];
  } | null>(null);
  const [mode, setMode] = useState<"pick" | "custom">("pick");

  function addMedicine(name: string) {
    const clean = name.trim();
    if (!clean) return;
    if (medicines.some((m) => m.toLowerCase() === clean.toLowerCase())) {
      toast.show("Already added", "warning");
      return;
    }
    setMedicines([...medicines, clean]);
    setDraft("");
  }

  function removeMedicine(name: string) {
    setMedicines(medicines.filter((m) => m !== name));
  }

  function loadActiveMeds() {
    const list = (medsData?.medicines || [])
      .filter((m: any) => m.active !== false)
      .map((m: any) => m.name);
    if (list.length === 0) {
      toast.show("No active medicines on file", "warning");
      return;
    }
    setMedicines(list);
    setMode("custom");
    toast.show(`Loaded ${list.length} medicines`, "success");
  }

  async function runCheck() {
    if (medicines.length < 2) {
      toast.show("Add at least 2 medicines", "warning");
      return;
    }
    try {
      const res = await aiDrugCheck.mutateAsync({ medicines });
      setResult(res);
    } catch (err: any) {
      toast.show(err?.message || "Check failed", "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Drug interaction check"
        subtitle="Check medicines for conflicts"
        right={<PillCmp icon={Sparkles} label="AI" tone="accent" size="sm" />}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <ChipGroup
          options={[
            { value: "pick", label: "Pick from list" },
            { value: "custom", label: "Custom" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as any)}
        />

        {mode === "pick" ? (
          <Card>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <Text
                style={[typography.label.md, { color: colors.textMuted }]}
              >
                Common medicines
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {SUGGESTIONS.map((m) => (
                  <PillCmp
                    key={m}
                    label={m}
                    tone={
                      medicines.includes(m) ? "primary" : "neutral"
                    }
                    size="sm"
                    onPress={() => addMedicine(m)}
                  />
                ))}
              </View>
              <Button
                title="Or load my active medicines"
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={loadActiveMeds}
              />
            </View>
          </Card>
        ) : (
          <Card>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <FormField label="Add a medicine">
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Medicine name"
                      onSubmitEditing={() => addMedicine(draft)}
                      returnKeyType="done"
                      leadingIcon={Pill}
                    />
                  </View>
                  <IconButton
                    icon={Plus}
                    onPress={() => addMedicine(draft)}
                    accessibilityLabel="Add medicine"
                    variant="soft"
                  />
                </View>
              </FormField>
            </View>
          </Card>
        )}

        {medicines.length > 0 ? (
          <Card>
            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <Text style={[typography.label.md, { color: colors.textMuted }]}>
                LIST ({medicines.length})
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {medicines.map((m) => (
                  <PillCmp
                    key={m}
                    label={m}
                    tone="primary"
                    size="sm"
                    icon={X}
                    onPress={() => removeMedicine(m)}
                  />
                ))}
              </View>
            </View>
          </Card>
        ) : null}

        <Button
          title={`Check ${medicines.length} medicine${medicines.length === 1 ? "" : "s"}`}
          onPress={runCheck}
          loading={aiDrugCheck.isPending}
          icon={ShieldAlert}
          size="lg"
          disabled={medicines.length < 2}
        />

        {aiDrugCheck.isPending ? (
          <Skeleton height={120} radius={20} />
        ) : result ? (
          <View style={{ gap: spacing.md }}>
            {result.interactions && result.interactions.length > 0 ? (
              result.interactions.map((it, idx) => {
                const Icon = severityIcon(it.severity);
                return (
                  <Card key={idx}>
                    <View
                      style={{
                        padding: spacing.lg,
                        gap: spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.sm,
                        }}
                      >
                        <Icon
                          size={18}
                          color={
                            it.severity === "severe"
                              ? colors.danger
                              : it.severity === "moderate"
                              ? colors.warning
                              : colors.info
                          }
                          strokeWidth={2.4}
                        />
                        <Text
                          style={[
                            typography.title.sm,
                            { color: colors.text, flex: 1 },
                          ]}
                          numberOfLines={2}
                        >
                          {it.medicines.join(" + ")}
                        </Text>
                        <PillCmp
                          label={it.severity}
                          tone={severityTone(it.severity)}
                          size="sm"
                        />
                      </View>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted },
                        ]}
                      >
                        {it.note}
                      </Text>
                      <PillCmp
                        label={
                          it.source === "curated"
                            ? "Verified database"
                            : "AI suggestion"
                        }
                        tone="neutral"
                        size="sm"
                      />
                    </View>
                  </Card>
                );
              })
            ) : (
              <Card>
                <View
                  style={{
                    padding: spacing.lg,
                    gap: spacing.sm,
                    alignItems: "center",
                  }}
                >
                  <Pill size={28} color={colors.success} strokeWidth={2.2} />
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, textAlign: "center" },
                    ]}
                  >
                    No interactions found
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, textAlign: "center" },
                    ]}
                  >
                    Of course, confirm with your doctor or pharmacist.
                  </Text>
                </View>
              </Card>
            )}

            {result.warnings && result.warnings.length > 0 ? (
              <Card>
                <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                  {result.warnings.map((w, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        gap: spacing.sm,
                      }}
                    >
                      <AlertTriangle
                        size={16}
                        color={colors.warning}
                        strokeWidth={2.4}
                        style={{ marginTop: 2 }}
                      />
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.text, flex: 1 },
                        ]}
                      >
                        {w}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}
          </View>
        ) : medicines.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="Add medicines to start"
            message="Use the suggestions or load your active list."
          />
        ) : null}
      </View>
    </Screen>
  );
}
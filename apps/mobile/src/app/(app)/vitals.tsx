import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import {
  Activity,
  Plus,
  Heart,
  Droplet,
  Scale,
  Ruler,
  Thermometer,
  TrendingUp,
  Trash2,
} from "lucide-react-native";
import {
  useVitals,
  useAddVital,
  useDeleteVital,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  TextInput,
  Button,
  Card,
  FormField,
  Chip,
  IconButton,
  Skeleton,
  EmptyState,
  useToast,
} from "@/components/ui";

const VITAL_TYPES = [
  { value: "blood_pressure", label: "Blood pressure", icon: Heart, unit: "mmHg" },
  { value: "blood_sugar", label: "Blood sugar", icon: Droplet, unit: "mg/dL" },
  { value: "weight", label: "Weight", icon: Scale, unit: "kg" },
  { value: "heart_rate", label: "Heart rate", icon: Heart, unit: "bpm" },
  { value: "temperature", label: "Temperature", icon: Thermometer, unit: "°C" },
  { value: "spo2", label: "SpO₂", icon: TrendingUp, unit: "%" },
  { value: "cholesterol", label: "Cholesterol", icon: Droplet, unit: "mg/dL" },
];

export default function VitalsScreen() {
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useVitals();
  const addVital = useAddVital();
  const deleteVital = useDeleteVital();

  const [composing, setComposing] = useState(false);
  const [type, setType] = useState("blood_pressure");
  const [value, setValue] = useState("");
  const [secondary, setSecondary] = useState(""); // diastolic for BP
  const [notes, setNotes] = useState("");

  const vitals: any[] = data?.vitals || [];

  const meta = VITAL_TYPES.find((v) => v.value === type)!;

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const v of vitals) {
      const date = new Date(v.recordedAt || v.createdAt);
      const key = isNaN(date.getTime())
        ? "RECENT"
        : date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }).toUpperCase();
      (map[key] ??= []).push(v);
    }
    return map;
  }, [vitals]);

  async function save() {
    const v = parseFloat(value);
    if (!v || Number.isNaN(v)) {
      toast.show("Enter a valid value", "warning");
      return;
    }
    try {
      await addVital.mutateAsync({
        type,
        value: v,
        secondaryValue: secondary ? parseFloat(secondary) : null,
        unit: meta.unit,
        notes: notes.trim() || null,
      });
      toast.show(`${meta.label} logged`, "success");
      setComposing(false);
      setValue("");
      setSecondary("");
      setNotes("");
    } catch (err: any) {
      toast.show(err?.message || "Could not log", "danger");
    }
  }

  function confirmDelete(id: string) {
    Alert.alert("Delete reading?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteVital.mutate(id),
      },
    ]);
  }

  if (composing) {
    return (
      <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => setComposing(false)}
          title="Log a vital"
        />
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.label.md, { color: colors.textMuted }]}>
              TYPE
            </Text>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}
            >
              {VITAL_TYPES.map((vt) => (
                <Chip
                  key={vt.value}
                  label={vt.label}
                  selected={type === vt.value}
                  tone={type === vt.value ? "primary" : "neutral"}
                  onPress={() => setType(vt.value)}
                />
              ))}
            </View>
          </View>

          <FormField label={`Value (${meta.unit})`} required>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={type === "blood_pressure" ? "120" : "72"}
              keyboardType="numeric"
            />
          </FormField>

          {type === "blood_pressure" ? (
            <FormField label="Diastolic (mmHg)" required>
              <TextInput
                value={secondary}
                onChangeText={setSecondary}
                placeholder="80"
                keyboardType="numeric"
              />
            </FormField>
          ) : null}

          <FormField label="Notes" helper="Optional">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="After walk, before meal, etc."
              multiline
              numberOfLines={3}
              tone="soft"
            />
          </FormField>

          <Button
            title="Save reading"
            onPress={save}
            loading={addVital.isPending}
            icon={Plus}
            size="lg"
            fullWidth
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScreenHeader
        title="Vitals"
        subtitle="Track trends over time"
        right={
          <IconButton
            icon={Plus}
            onPress={() => setComposing(true)}
            accessibilityLabel="Log vital"
          />
        }
      />
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
        </View>
      ) : vitals.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={Activity}
            title="No vitals yet"
            message="Log your first reading to start tracking trends."
            tone="neutral"
          />
          <View style={{ alignItems: "center", marginTop: spacing.lg }}>
            <Button
              title="Log first reading"
              onPress={() => setComposing(true)}
              icon={Plus}
            />
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: 120,
          }}
        >
          {Object.entries(grouped).map(([month, items]) => (
            <View key={month} style={{ gap: spacing.sm }}>
              <Text style={[typography.overline, { color: colors.textMuted }]}>
                {month}
              </Text>
              <Card padded={false}>
                {items.map((v: any, idx: number) => {
                  const tMeta =
                    VITAL_TYPES.find((vt) => vt.value === v.type) ||
                    VITAL_TYPES[0];
                  const Icon = tMeta.icon;
                  return (
                    <View
                      key={v.id}
                      style={{
                        padding: spacing.md,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        borderBottomWidth:
                          idx < items.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.primarySoft,
                        }}
                      >
                        <Icon size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[typography.title.sm, { color: colors.text }]}
                        >
                          {tMeta.label}
                          {v.secondaryValue != null
                            ? ` ${v.value}/${v.secondaryValue}`
                            : ` ${v.value}`}{" "}
                          <Text
                            style={[
                              typography.body.sm,
                              { color: colors.textMuted },
                            ]}
                          >
                            {v.unit}
                          </Text>
                        </Text>
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textMuted },
                          ]}
                        >
                          {new Date(
                            v.recordedAt || v.createdAt
                          ).toLocaleString()}
                        </Text>
                        {v.notes ? (
                          <Text
                            style={[
                              typography.body.sm,
                              { color: colors.textMuted, marginTop: 2 },
                            ]}
                            numberOfLines={2}
                          >
                            {v.notes}
                          </Text>
                        ) : null}
                      </View>
                      <IconButton
                        icon={Trash2}
                        size="sm"
                        onPress={() => confirmDelete(v.id)}
                        accessibilityLabel="Delete"
                        tint={colors.danger}
                      />
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
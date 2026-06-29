import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, Dimensions } from "react-native";
import {
  Activity,
  Plus,
  Heart,
  Droplet,
  Scale,
  Thermometer,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
} from "lucide-react-native";
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryScatter,
} from "victory";
import {
  useVitals,
  useAddVital,
  useDeleteVital,
  useVitalsSeries,
  type VitalsPoint,
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

const RANGES = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 365, label: "1y" },
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
  const [secondary, setSecondary] = useState("");
  const [notes, setNotes] = useState("");

  const [chartType, setChartType] = useState("blood_pressure");
  const [chartRange, setChartRange] = useState(30);
  const [showDiastolic, setShowDiastolic] = useState(false);

  const vitals: any[] = data?.vitals || [];

  const meta = VITAL_TYPES.find((v) => v.value === type)!;

  const rangeFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - chartRange);
    return d.toISOString();
  }, [chartRange]);

  const { data: series, isLoading: seriesLoading } = useVitalsSeries({
    type: chartType,
    from: rangeFrom,
    enabled: !composing,
  });

  const points: VitalsPoint[] = series?.points || [];
  const stats = series?.stats;
  const isBP = chartType === "blood_pressure";

  const chartPoints = useMemo(() => {
    return points.map((p, i) => ({
      x: i,
      y: p.value,
      _t: p.t,
    }));
  }, [points]);

  const chartPointsSecondary = useMemo(() => {
    if (!isBP) return [];
    return points
      .map((p, i) =>
        p.secondary != null ? { x: i, y: p.secondary, _t: p.t } : null
      )
      .filter(Boolean) as { x: number; y: number; _t: string }[];
  }, [points, isBP]);

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - spacing.lg * 2 - spacing.md * 2;

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const v of vitals) {
      const date = new Date(v.recordedAt || v.createdAt);
      const key = isNaN(date.getTime())
        ? "RECENT"
        : date
            .toLocaleDateString("en-US", { month: "long", year: "numeric" })
            .toUpperCase();
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

  const deltaIcon =
    stats?.delta == null
      ? Minus
      : stats.delta > 0
      ? TrendingUp
      : stats.delta < 0
      ? TrendingDown
      : Minus;

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
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: 120,
          }}
        >
          {/* V3: Trend chart card */}
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.sm,
                gap: spacing.xs,
              }}
            >
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.text, fontWeight: "800" },
                ]}
              >
                Trend
              </Text>
              {isBP && points.length > 0 && (
                <Pressable
                  onPress={() => setShowDiastolic((s) => !s)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showDiastolic ? "Hide diastolic" : "Show diastolic"
                  }
                >
                  <Chip
                    label={showDiastolic ? "S + D" : "S only"}
                    tone={showDiastolic ? "primary" : "neutral"}
                    size="sm"
                  />
                </Pressable>
              )}
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: spacing.xs,
                flexWrap: "wrap",
                marginBottom: spacing.sm,
              }}
            >
              {VITAL_TYPES.map((vt) => (
                <Chip
                  key={vt.value}
                  label={vt.label}
                  selected={chartType === vt.value}
                  tone={chartType === vt.value ? "primary" : "neutral"}
                  onPress={() => setChartType(vt.value)}
                  size="sm"
                />
              ))}
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: spacing.xs,
                marginBottom: spacing.sm,
              }}
            >
              {RANGES.map((r) => (
                <Chip
                  key={r.value}
                  label={r.label}
                  selected={chartRange === r.value}
                  tone={chartRange === r.value ? "info" : "neutral"}
                  onPress={() => setChartRange(r.value)}
                  size="sm"
                />
              ))}
            </View>

            {seriesLoading ? (
              <Skeleton height={220} radius={12} />
            ) : points.length === 0 ? (
              <View
                style={{
                  height: 180,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={[typography.body.sm, { color: colors.textMuted }]}
                >
                  No {VITAL_TYPES.find((v) => v.value === chartType)?.label}{" "}
                  readings in this range
                </Text>
              </View>
            ) : (
              <VictoryChart
                width={chartWidth}
                height={220}
                padding={{ top: 12, bottom: 32, left: 44, right: 12 }}
                scale={{ x: "linear", y: "linear" }}
                domainPadding={{ y: 10 }}
              >
                <VictoryAxis
                  dependentAxis
                  tickFormat={(n: number) => String(Math.round(n))}
                  style={{
                    axis: { stroke: colors.border },
                    tickLabels: {
                      fill: colors.textMuted,
                      fontSize: 10,
                    },
                    grid: { stroke: colors.border, strokeDasharray: "2,4" },
                  }}
                />
                <VictoryAxis
                  tickValues={chartPoints
                    .filter((_, i) => i % Math.max(1, Math.floor(chartPoints.length / 4)) === 0)
                    .map((p) => p.x)}
                  tickFormat={(x: number) => {
                    const p = chartPoints.find((cp) => cp.x === x);
                    if (!p) return "";
                    const d = new Date(p._t);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  style={{
                    axis: { stroke: colors.border },
                    tickLabels: {
                      fill: colors.textMuted,
                      fontSize: 10,
                    },
                  }}
                />
                <VictoryLine
                  data={chartPoints}
                  x="x"
                  y="y"
                  interpolation="monotoneX"
                  style={{
                    data: { stroke: colors.primary, strokeWidth: 2.5 },
                  }}
                />
                <VictoryScatter
                  data={chartPoints}
                  x="x"
                  y="y"
                  size={4}
                  style={{
                    data: { fill: colors.primary },
                  }}
                />
                {isBP && showDiastolic && (
                  <VictoryLine
                    data={chartPointsSecondary}
                    x="x"
                    y="y"
                    interpolation="monotoneX"
                    style={{
                      data: { stroke: colors.danger, strokeWidth: 2 },
                    }}
                  />
                )}
                {isBP && showDiastolic && (
                  <VictoryScatter
                    data={chartPointsSecondary}
                    x="x"
                    y="y"
                    size={3}
                    style={{
                      data: { fill: colors.danger },
                    }}
                  />
                )}
              </VictoryChart>
            )}

            {/* Stats row */}
            {stats && points.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: spacing.sm,
                  paddingTop: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  gap: spacing.xs,
                }}
              >
                <StatCell
                  label="Latest"
                  value={stats.latest != null ? String(Math.round(stats.latest)) : "—"}
                  unit={VITAL_TYPES.find((v) => v.value === chartType)?.unit}
                />
                <StatCell
                  label="Avg"
                  value={stats.avg != null ? String(Math.round(stats.avg)) : "—"}
                />
                <StatCell
                  label="Min"
                  value={stats.min != null ? String(Math.round(stats.min)) : "—"}
                />
                <StatCell
                  label="Max"
                  value={stats.max != null ? String(Math.round(stats.max)) : "—"}
                />
                <StatCell
                  label="Δ"
                  value={
                    stats.delta != null
                      ? `${stats.delta > 0 ? "+" : ""}${Math.round(stats.delta)}`
                      : "—"
                  }
                  valueColor={
                    stats.delta == null
                      ? colors.text
                      : stats.delta > 0
                      ? colors.warning
                      : stats.delta < 0
                      ? colors.success
                      : colors.text
                  }
                  Icon={deltaIcon}
                />
              </View>
            )}
          </Card>

          {/* Existing list of recent readings */}
          {vitals.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No vitals yet"
              message="Log your first reading to start tracking trends."
              tone="neutral"
            />
          ) : (
            Object.entries(grouped).map(([month, items]) => (
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
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function StatCell({
  label,
  value,
  unit,
  valueColor,
  Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  valueColor?: string;
  Icon?: any;
}) {
  const { spacing, colors, typography } = useTheme();
  return (
    <View style={{ alignItems: "center", flex: 1, gap: 2 }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
        }}
      >
        {Icon ? <Icon size={12} color={valueColor || colors.text} /> : null}
        <Text
          style={[
            typography.title.sm,
            { color: valueColor || colors.text, fontWeight: "800" },
          ]}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, fontSize: 10 },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

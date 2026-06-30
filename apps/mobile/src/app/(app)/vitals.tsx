import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, Dimensions } from "react-native";
import { useTranslation } from "react-i18next";
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

const VITAL_TYPES: { value: string; labelKey: string; icon: any; unit: string }[] = [
  { value: "blood_pressure", labelKey: "vitals.type.blood_pressure.label", icon: Heart, unit: "mmHg" },
  { value: "blood_sugar", labelKey: "vitals.type.blood_sugar.label", icon: Droplet, unit: "mg/dL" },
  { value: "weight", labelKey: "vitals.type.weight.label", icon: Scale, unit: "kg" },
  { value: "heart_rate", labelKey: "vitals.type.heart_rate.label", icon: Heart, unit: "bpm" },
  { value: "temperature", labelKey: "vitals.type.temperature.label", icon: Thermometer, unit: "°C" },
  { value: "spo2", labelKey: "vitals.type.spo2.label", icon: TrendingUp, unit: "%" },
  { value: "cholesterol", labelKey: "vitals.type.cholesterol.label", icon: Droplet, unit: "mg/dL" },
];

const RANGES = [7, 30, 90, 365];

export default function VitalsScreen() {
  const { t } = useTranslation();
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
      toast.show(t("vitals.toast.invalidValue"), "warning");
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
      toast.show(t("vitals.toast.logged", { label: t(meta.labelKey) }), "success");
      setComposing(false);
      setValue("");
      setSecondary("");
      setNotes("");
    } catch (err: any) {
      toast.show(err?.message || t("vitals.toast.saveError"), "danger");
    }
  }

  function confirmDelete(id: string) {
    Alert.alert(t("vitals.delete.title"), t("vitals.delete.body"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
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
          title={t("vitals.compose.title")}
        />
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.label.md, { color: colors.textMuted }]}>
              {t("vitals.compose.typeLabel")}
            </Text>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}
            >
              {VITAL_TYPES.map((vt) => (
                <Chip
                  key={vt.value}
                  label={t(vt.labelKey)}
                  selected={type === vt.value}
                  tone={type === vt.value ? "primary" : "neutral"}
                  onPress={() => setType(vt.value)}
                />
              ))}
            </View>
          </View>

          <FormField label={t("vitals.compose.valueLabel", { unit: meta.unit })} required>
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
            <FormField label={t("vitals.compose.diastolicLabel")} required>
              <TextInput
                value={secondary}
                onChangeText={setSecondary}
                placeholder={t("vitals.compose.secondaryPlaceholder")}
                keyboardType="numeric"
              />
            </FormField>
          ) : null}

          <FormField label={t("vitals.compose.notesLabel")} helper={t("vitals.compose.notesHelper")}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("vitals.compose.notesPlaceholder")}
              multiline
              numberOfLines={3}
              tone="soft"
            />
          </FormField>

          <Button
            title={t("vitals.compose.saveButton")}
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

  const chartTypeMeta = VITAL_TYPES.find((v) => v.value === chartType);

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScreenHeader
        title={t("vitals.title")}
        subtitle={t("vitals.subtitle")}
        right={
          <IconButton
            icon={Plus}
            onPress={() => setComposing(true)}
            accessibilityLabel={t("vitals.logLabel")}
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
                {t("vitals.chart.trendHeading")}
              </Text>
              {isBP && points.length > 0 && (
                <Pressable
                  onPress={() => setShowDiastolic((s) => !s)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showDiastolic
                      ? t("vitals.chart.hideDiastolic")
                      : t("vitals.chart.showDiastolic")
                  }
                >
                  <Chip
                    label={showDiastolic ? t("vitals.chart.systolicDiastolic") : t("vitals.chart.systolicOnly")}
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
                  label={t(vt.labelKey)}
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
                  key={r}
                  label={t(`vitals.range.${r}`)}
                  selected={chartRange === r}
                  tone={chartRange === r ? "info" : "neutral"}
                  onPress={() => setChartRange(r)}
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
                  {t("vitals.chart.noReadings", {
                    label: chartTypeMeta ? t(chartTypeMeta.labelKey) : "",
                  })}
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
                  label={t("vitals.chart.stats.latest")}
                  value={stats.latest != null ? String(Math.round(stats.latest)) : "—"}
                  unit={chartTypeMeta?.unit}
                />
                <StatCell
                  label={t("vitals.chart.stats.avg")}
                  value={stats.avg != null ? String(Math.round(stats.avg)) : "—"}
                />
                <StatCell
                  label={t("vitals.chart.stats.min")}
                  value={stats.min != null ? String(Math.round(stats.min)) : "—"}
                />
                <StatCell
                  label={t("vitals.chart.stats.max")}
                  value={stats.max != null ? String(Math.round(stats.max)) : "—"}
                />
                <StatCell
                  label={t("vitals.chart.stats.delta")}
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
              title={t("vitals.empty.title")}
              message={t("vitals.empty.message")}
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
                            {t(tMeta.labelKey)}
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
                          accessibilityLabel={t("common.delete")}
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
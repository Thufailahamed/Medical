import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, Dimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useLocaleStore } from "@/stores/locale";
import { fmtMonthYear, fmtDateTime } from "@/lib/format";
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
  Wind,
  Activity as PulseIcon,
  Percent,
  Ruler,
  Smile,
  Zap,
} from "lucide-react-native";
import {
  useVitals,
  useAddVital,
  useDeleteVital,
  useVitalsSeries,
  useVitalsDerived,
  useVitalsAlerts,
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
import { VitalsChart, AlertsCard, DerivedMetricsCard, ClassificationBadge } from "@/components/vitals";
import {
  VITAL_REGISTRY,
  VITAL_TYPES,
  VITAL_CONTEXTS,
  type VitalType,
  type VitalContext,
  defaultUnit,
  classifyReading,
} from "@healthcare/shared/vitals";

const ICON_BY_TYPE: Record<VitalType, any> = {
  blood_pressure: Heart,
  blood_sugar: Droplet,
  weight: Scale,
  height: Ruler,
  heart_rate: Heart,
  temperature: Thermometer,
  spo2: Activity,
  cholesterol: Droplet,
  respiratory_rate: Wind,
  hrv_rmssd: PulseIcon,
  body_fat_pct: Percent,
  waist_circumference: Ruler,
  hip_circumference: Ruler,
  pain_scale: Smile,
  peak_flow: Zap,
};

const RANGES = [7, 30, 90, 365];

export default function VitalsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading } = useVitals();
  const addVital = useAddVital();
  const deleteVital = useDeleteVital();
  const { data: derivedData } = useVitalsDerived();
  const { data: alertsData } = useVitalsAlerts(30);

  const [composing, setComposing] = useState(false);
  const [type, setType] = useState<VitalType>("blood_pressure");
  const [value, setValue] = useState("");
  const [secondary, setSecondary] = useState("");
  const [notes, setNotes] = useState("");
  const [context, setContext] = useState<VitalContext | null>(null);

  const [chartType, setChartType] = useState<VitalType>("blood_pressure");
  const [chartRange, setChartRange] = useState(30);
  const [showSecondary, setShowSecondary] = useState(false);

  const vitals: any[] = data?.vitals || [];
  const derived = derivedData?.derived ?? null;
  const latestByType = derivedData?.latestByType ?? [];
  const alerts = alertsData?.alerts ?? [];
  const alertsCount = alertsData?.count ?? 0;

  const meta = VITAL_REGISTRY[type];
  const Icon = ICON_BY_TYPE[type] ?? Activity;

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

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - spacing.lg * 2 - spacing.md * 2;

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const v of vitals) {
      const date = new Date(v.recordedAt || v.createdAt);
      const key = isNaN(date.getTime()) ? "RECENT" : fmtMonthYear(date, locale).toUpperCase();
      (map[key] ??= []).push(v);
    }
    return map;
  }, [vitals, locale]);

  async function save() {
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
      await addVital.mutateAsync({
        type,
        value: v,
        secondaryValue: secondary ? parseFloat(secondary) : null,
        unit: meta.unit,
        context: context ?? null,
        notes: notes.trim() || null,
      });
      toast.show(t("vitals.toast.logged", { label: t(`vitals.type.${type}.label`) }), "success");
      setComposing(false);
      setValue("");
      setSecondary("");
      setNotes("");
      setContext(null);
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {VITAL_TYPES.map((vt) => (
                <Chip
                  key={vt}
                  label={t(`vitals.type.${vt}.label`)}
                  selected={type === vt}
                  tone={type === vt ? "primary" : "neutral"}
                  onPress={() => setType(vt)}
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
              placeholder={type === "blood_pressure" ? "120" : "72"}
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
                placeholder="80"
                keyboardType="numeric"
              />
            </FormField>
          ) : null}

          {/* Context chips — optional, only show a useful subset per type */}
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

  const latestForChart = latestByType.find((l) => l.type === chartType);
  const chartTypeMeta = VITAL_REGISTRY[chartType];
  const isSecondaryCapable = chartTypeMeta?.hasSecondary;

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScreenHeader
        onBack={() => router.back()}
        title={t("vitals.title")}
        subtitle={t("vitals.subtitleWithCount", {
          count: latestByType.length,
          alerts: alertsCount,
        })}
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
          {/* ── Latest + classification ───────────────────────── */}
          {latestForChart?.latest ? (
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: spacing.sm,
                  marginBottom: spacing.xs,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.overline, { color: colors.textMuted }]}>
                    {t("vitals.latest")}
                  </Text>
                  <View
                    style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}
                  >
                    <Text
                      style={[typography.title.lg, { color: colors.text, fontWeight: "800" }]}
                    >
                      {latestForChart.latest.secondary != null
                        ? `${latestForChart.latest.value}/${latestForChart.latest.secondary}`
                        : latestForChart.latest.value}
                    </Text>
                    <Text style={[typography.body.md, { color: colors.textMuted }]}>
                      {latestForChart.latest.unit}
                    </Text>
                  </View>
                  {latestForChart.latest.note ? (
                    <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                      {latestForChart.latest.note}
                    </Text>
                  ) : null}
                </View>
                <ClassificationBadge
                  classification={latestForChart.latest.classification}
                />
              </View>

              {isBP ? (
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.md,
                    paddingTop: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  {derived?.map != null ? (
                    <DerivedLine
                      label={t("vitals.derived.map")}
                      value={`${derived.map}`}
                      unit="mmHg"
                    />
                  ) : null}
                  {derived?.pulsePressure != null ? (
                    <DerivedLine
                      label={t("vitals.derived.pulsePressure")}
                      value={`${derived.pulsePressure}`}
                      unit="mmHg"
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* ── Trend chart card ─────────────────────────────── */}
          <Card>
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
              ]}
            >
              {t("vitals.chart.trendHeading")}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.sm }}
            >
              {VITAL_TYPES.map((vt) => {
                const latest = latestByType.find((l) => l.type === vt);
                const cls = latest?.latest?.classification ?? "normal";
                return (
                  <Chip
                    key={vt}
                    label={t(`vitals.type.${vt}.label`)}
                    selected={chartType === vt}
                    tone={chartType === vt ? "primary" : "neutral"}
                    onPress={() => setChartType(vt)}
                    size="sm"
                    icon={
                      latest?.latest && cls !== "normal"
                        ? cls === "critical" || cls === "high"
                          ? undefined
                          : undefined
                        : undefined
                    }
                  />
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm }}>
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
              {isSecondaryCapable ? (
                <Chip
                  label={showSecondary ? t("vitals.chart.systolicDiastolic") : t("vitals.chart.systolicOnly")}
                  tone={showSecondary ? "primary" : "neutral"}
                  size="sm"
                  onPress={() => setShowSecondary((s) => !s)}
                />
              ) : null}
            </View>

            {seriesLoading ? (
              <Skeleton height={240} radius={12} />
            ) : (
              <VitalsChart
                type={chartType}
                points={points}
                stats={stats ?? null}
                width={chartWidth}
                height={240}
                showSecondary={showSecondary}
              />
            )}

            {stats && points.length > 0 ? (
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
            ) : null}
          </Card>

          {/* ── Alerts (only if any) ─────────────────────────── */}
          {alertsCount > 0 ? <AlertsCard alerts={alerts} /> : null}

          {/* ── Derived metrics card ─────────────────────────── */}
          <DerivedMetricsCard derived={derived} />

          {/* ── Recent readings list ─────────────────────────── */}
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
                    const vType = v.type as VitalType;
                    const tMeta = VITAL_REGISTRY[vType];
                    const VIcon = ICON_BY_TYPE[vType] ?? Activity;
                    const cls = classifyReading({
                      type: vType,
                      value: Number(v.value),
                      secondary: v.secondaryValue != null ? Number(v.secondaryValue) : null,
                      context: (v.context ?? null) as VitalContext,
                    });
                    return (
                      <View
                        key={v.id}
                        style={{
                          padding: spacing.md,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.md,
                          borderBottomWidth: idx < items.length - 1 ? 1 : 0,
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
                            backgroundColor: cls.classification === "normal" ? colors.primarySoft : colors.warningSoft,
                          }}
                        >
                          <VIcon
                            size={20}
                            color={
                              cls.classification === "normal"
                                ? colors.primary
                                : cls.classification === "critical"
                                ? colors.danger
                                : colors.warning
                            }
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[typography.title.sm, { color: colors.text }]}>
                              {t(`vitals.type.${vType}.label`)}{" "}
                              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                                {v.secondaryValue != null
                                  ? ` ${v.value}/${v.secondaryValue}`
                                  : ` ${v.value}`}{" "}
                                {v.unit}
                              </Text>
                            </Text>
                            <ClassificationBadge classification={cls.classification} />
                          </View>
                          <Text style={[typography.caption, { color: colors.textMuted }]}>
                            {fmtDateTime(new Date(v.recordedAt || v.createdAt), locale)}
                          </Text>
                          {v.context ? (
                            <Text style={[typography.caption, { color: colors.textMuted }]}>
                              {t(`vitals.context.${v.context}`)}
                            </Text>
                          ) : null}
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

function DerivedLine({ label, value, unit }: { label: string; value: string; unit: string }) {
  const { spacing, typography, colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[typography.overline, { color: colors.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
          {value}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{unit}</Text>
      </View>
    </View>
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
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
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
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Restrict the context chips shown in the compose form to the ones that
 * actually affect classification for the picked type. Falls back to
 * "random" + "resting" as universal fallbacks.
 */
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
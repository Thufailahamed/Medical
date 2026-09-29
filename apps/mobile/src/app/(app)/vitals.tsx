// @ts-nocheck

import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Alert, Dimensions, StyleSheet, TextInput as RNTextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
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
  AlertTriangle,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Check,
  Clock,
  Flame,
  Moon,
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
import { useTone } from "@/theme/tone";
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
  ErrorState,
  useToast,
  Pill as PillCmp,
  Pressable,
  IconTile,
  SectionHeader,
} from "@/components/ui";
import { fmtRelative } from "@/components/records/visual";
import {
  VitalsChart,
  AlertsCard,
  DerivedMetricsCard,
  ClassificationBadge,
  GlucoseChart,
  TrendComparison,
} from "@/components/vitals";
import {
  VITAL_REGISTRY,
  VITAL_TYPES,
  VITAL_CONTEXTS,
  type VitalType,
  type VitalContext,
  type LatestByType,
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

const CORE_VITALS: VitalType[] = [
  "blood_pressure",
  "blood_sugar",
  "heart_rate",
  "weight",
  "spo2",
  "temperature",
];

const BODY_METRICS: VitalType[] = [
  "height",
  "body_fat_pct",
  "waist_circumference",
  "hip_circumference",
];

const SPECIALTY_VITALS: VitalType[] = [
  "respiratory_rate",
  "cholesterol",
  "hrv_rmssd",
  "peak_flow",
  "pain_scale",
];

const VITAL_TARGETS: Record<VitalType, string> = {
  blood_pressure: "Normal: <120 / <80 mmHg",
  blood_sugar: "Fasting: 70–100 mg/dL",
  heart_rate: "Resting: 60–100 bpm",
  weight: "Healthy BMI: 18.5–24.9",
  spo2: "Normal: 95–100%",
  temperature: "Normal: 36.1–37.2 °C",
  height: "Standard body measure",
  cholesterol: "Desirable: <200 mg/dL",
  respiratory_rate: "Normal: 12–20 br/min",
  hrv_rmssd: "Healthy: >20 ms",
  body_fat_pct: "Essential: 10–25% (M) / 18–32% (F)",
  waist_circumference: "Target: <90 cm (M) / <80 cm (F)",
  hip_circumference: "Circumference measure",
  pain_scale: "Mild: 1–3, Moderate: 4–6, Severe: 7+",
  peak_flow: "Personal best baseline",
};

const CONTEXT_META: Record<string, { label: string; icon: any }> = {
  resting: { label: "Resting", icon: Heart },
  standing: { label: "Standing", icon: Activity },
  supine: { label: "Lying down", icon: Moon },
  exercise: { label: "After exercise", icon: Flame },
  fasting: { label: "Fasting", icon: Droplet },
  post_meal: { label: "After meal", icon: Sparkles },
  pre_meal: { label: "Before meal", icon: Clock },
  random: { label: "Random", icon: Clock },
  post_medication: { label: "Post-medication", icon: PillCmp },
};

const RANGES = [7, 30, 90, 365];

export default function VitalsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, scheme, shadow } = useTheme();
  const isDark = scheme === "dark";
  const cardSurface = {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous" as const,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? colors.borderStrong : colors.separator,
    ...(isDark ? {} : shadow.sm),
  };
  const overlineStyle = [typography.overline, { color: colors.textSubtle }];
  const fieldWell = {
    backgroundColor: colors.fill,
    borderRadius: 14,
    borderCurve: "continuous" as const,
  };
  const segOn = {
    backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
    ...(isDark ? {} : shadow.xs),
  };
  const toast = useToast();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading, isError, refetch } = useVitals();
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
  const [composeCategory, setComposeCategory] = useState<"core" | "body" | "specialty">("core");

  // User explicitly picked chart type, otherwise auto-select the first tracked vital
  const [userSelectedType, setUserSelectedType] = useState<VitalType | null>(null);
  const [chartRange, setChartRange] = useState(30);
  const [showSecondary, setShowSecondary] = useState(false);
  const [glucoseFocus, setGlucoseFocus] = useState(false);

  const vitals: any[] = data?.vitals || [];
  const derived = derivedData?.derived ?? null;
  const latestByType = derivedData?.latestByType ?? [];
  const alerts = alertsData?.alerts ?? [];
  const alertsCount = alertsData?.count ?? 0;

  // Auto-select the first type that actually has recorded data if user hasn't explicitly selected one
  const chartType: VitalType = useMemo(() => {
    if (userSelectedType) return userSelectedType;
    if (latestByType.length > 0) return latestByType[0].type;
    return "blood_pressure";
  }, [userSelectedType, latestByType]);

  // Prioritize vital types that have recorded points at the front of the chip list
  const sortedVitalTypes = useMemo(() => {
    const recordedSet = new Set(latestByType.map((l) => l.type));
    return [...VITAL_TYPES].sort((a, b) => {
      const aHas = recordedSet.has(a) ? 1 : 0;
      const bHas = recordedSet.has(b) ? 1 : 0;
      return bHas - aHas;
    });
  }, [latestByType]);

  // Previous period range for trend comparison
  const prevRangeFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - chartRange * 2);
    return d.toISOString();
  }, [chartRange]);
  const prevRangeTo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - chartRange);
    return d.toISOString();
  }, [chartRange]);

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

  // Previous period series for trend comparison
  const { data: prevSeries } = useVitalsSeries({
    type: chartType,
    from: prevRangeFrom,
    to: prevRangeTo,
    enabled: !composing && chartRange > 7,
  });

  const points: VitalsPoint[] = series?.points || [];
  const stats = series?.stats;
  const isBP = chartType === "blood_pressure";

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - spacing.lg * 4;

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
      toast.show(t("vitals.toast.invalidValue", "Invalid value"), "warning");
      return;
    }
    if (type === "blood_pressure" && (!secondary || Number.isNaN(parseFloat(secondary)))) {
      toast.show(t("vitals.toast.invalidValue", "Invalid value"), "warning");
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.show(t("vitals.toast.logged", { label: t(`vitals.type.${type}.label`, type) }), "success");
      setComposing(false);
      setValue("");
      setSecondary("");
      setNotes("");
      setContext(null);
    } catch (err: any) {
      toast.show(err?.message || t("vitals.toast.saveError", "Could not save reading"), "danger");
    }
  }

  function confirmDelete(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(t("vitals.delete.title", "Delete Reading"), t("vitals.delete.body", "Are you sure you want to delete this vital reading?"), [
      { text: t("common.cancel", "Cancel"), style: "cancel" },
      {
        text: t("common.delete", "Delete"),
        style: "destructive",
        onPress: () => {
          deleteVital.mutate(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        },
      },
    ]);
  }

  const liveClassification = useMemo(() => {
    if (!composing) return null;
    const val = parseFloat(value);
    if (!val || Number.isNaN(val)) return null;
    if (type === "blood_pressure") {
      const sec = parseFloat(secondary);
      if (!sec || Number.isNaN(sec)) return null;
      try {
        return classifyReading({
          type: "blood_pressure",
          value: val,
          secondary: sec,
          context: context ?? undefined,
        });
      } catch {
        return null;
      }
    }
    try {
      return classifyReading({
        type,
        value: val,
        context: context ?? undefined,
      });
    } catch {
      return null;
    }
  }, [composing, type, value, secondary, context]);

  if (composing) {
    const IconCmp = ICON_BY_TYPE[type] || Activity;
    const targetGuide = VITAL_TARGETS[type] || "Clinical reference measure";
    const availableContexts = usefulContextsFor(type);

    return (
      <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => setComposing(false)}
          title={t("vitals.compose.title", "Log Vital Reading")}
          subtitle={`Record your ${meta.label.toLowerCase()} reading`}
        />
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: 120,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Categorized Metric Selector */}
          <View style={{ gap: spacing.xs }}>
            <Text
              style={overlineStyle}
            >
              {t("vitals.compose.typeLabel", "SELECT METRIC").toUpperCase()}
            </Text>

            {/* Category Segmented Bar */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.fill,
                borderRadius: 12,
                borderCurve: "continuous",
                padding: 3,
                gap: 2,
                marginTop: spacing.xs,
              }}
            >
              {[
                { key: "core", label: "Core Vitals" },
                { key: "body", label: "Body & Shape" },
                { key: "specialty", label: "Specialty" },
              ].map((cat) => {
                const isActive = composeCategory === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => setComposeCategory(cat.key as any)}
                    style={{
                      flex: 1,
                      minHeight: 34,
                      paddingVertical: 7,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                      borderCurve: "continuous",
                      ...(isActive ? segOn : { backgroundColor: "transparent" }),
                    }}
                  >
                    <Text
                      style={[
                        typography.label.md,
                        { color: isActive ? colors.text : colors.textMuted },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Metric Chips with designated Icons */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
              {(composeCategory === "core"
                ? CORE_VITALS
                : composeCategory === "body"
                ? BODY_METRICS
                : SPECIALTY_VITALS
              ).map((vt) => {
                const VIcon = ICON_BY_TYPE[vt] || Activity;
                const isSelected = type === vt;
                return (
                  <Pressable
                    key={vt}
                    onPress={() => {
                      setType(vt);
                      setContext(null);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      minHeight: 36,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 7,
                      borderRadius: radius.full,
                      backgroundColor: isSelected ? colors.primary : colors.fill,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <VIcon
                      size={13}
                      color={isSelected ? colors.onPrimary : colors.primary}
                      strokeWidth={2.4}
                    />
                    <Text
                      style={[
                        typography.label.md,
                        { color: isSelected ? colors.onPrimary : colors.text },
                      ]}
                    >
                      {t(`vitals.type.${vt}.label`, VITAL_REGISTRY[vt]?.label || vt.replace(/_/g, " "))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Active Metric Reference Card */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: colors.primarySoft,
              borderRadius: radius.card,
              borderCurve: "continuous",
              padding: spacing.lg,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                borderCurve: "continuous",
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCmp size={22} color={colors.onPrimary} strokeWidth={2.2} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[typography.title.md, { color: colors.text }]}>
                  {meta.label}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.full,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text style={[typography.label.xs, { color: colors.primary }]}>
                    {meta.unit}
                  </Text>
                </View>
              </View>

              <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                {targetGuide}
              </Text>
            </View>
          </View>

          {/* Value Inputs: Side-by-side for BP, or Prominent Input for others */}
          {type === "blood_pressure" ? (
            <View
              style={{
                ...cardSurface,
                padding: spacing.lg,
              }}
            >
              <Text
                style={[
                  typography.overline,
                  { color: colors.textSubtle, marginBottom: spacing.md },
                ]}
              >
                BLOOD PRESSURE VALUES (MMHG) *
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
                {/* Systolic */}
                <View style={{ flex: 1 }}>
                  <Text style={[typography.label.xs, { color: colors.textSubtle, marginBottom: 6 }]}>
                    SYSTOLIC (TOP)
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      ...fieldWell,
                      paddingHorizontal: spacing.md,
                      height: 60,
                    }}
                  >
                    <RNTextInput
                      value={value}
                      onChangeText={setValue}
                      placeholder="120"
                      placeholderTextColor={colors.textSubtle}
                      keyboardType="numeric"
                      style={[
                        typography.display.md,
                        { flex: 1, color: colors.text, paddingVertical: 0 },
                      ]}
                    />
                    <Text style={[typography.label.sm, { color: colors.textMuted }]}>
                      mmHg
                    </Text>
                  </View>
                </View>

                {/* Slash Divider */}
                <View style={{ paddingTop: 18 }}>
                  <Text style={{ fontSize: 28, fontWeight: "300", color: colors.textSubtle }}>
                    /
                  </Text>
                </View>

                {/* Diastolic */}
                <View style={{ flex: 1 }}>
                  <Text style={[typography.label.xs, { color: colors.textSubtle, marginBottom: 6 }]}>
                    DIASTOLIC (BOTTOM)
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      ...fieldWell,
                      paddingHorizontal: spacing.md,
                      height: 60,
                    }}
                  >
                    <RNTextInput
                      value={secondary}
                      onChangeText={setSecondary}
                      placeholder="80"
                      placeholderTextColor={colors.textSubtle}
                      keyboardType="numeric"
                      style={[
                        typography.display.md,
                        { flex: 1, color: colors.text, paddingVertical: 0 },
                      ]}
                    />
                    <Text style={[typography.label.sm, { color: colors.textMuted }]}>
                      mmHg
                    </Text>
                  </View>
                </View>
              </View>

              {/* Real-time Live Classification evaluation strip */}
              {liveClassification && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: spacing.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 10,
                    borderRadius: 14,
                    borderCurve: "continuous",
                    backgroundColor:
                      liveClassification.classification === "normal"
                        ? colors.successSoft
                        : liveClassification.classification === "critical"
                        ? colors.dangerSoft
                        : colors.warningSoft,
                  }}
                >
                  {liveClassification.classification === "normal" ? (
                    <CheckCircle2 size={15} color={colors.success} />
                  ) : liveClassification.classification === "critical" ? (
                    <AlertCircle size={15} color={colors.danger} />
                  ) : (
                    <AlertTriangle size={15} color={colors.warning} />
                  )}
                  <Text
                    style={[
                      typography.label.sm,
                      {
                        flex: 1,
                        color:
                          liveClassification.classification === "normal"
                            ? colors.success
                            : liveClassification.classification === "critical"
                            ? colors.danger
                            : colors.warning,
                      },
                    ]}
                  >
                    {liveClassification.classification.toUpperCase()} · {liveClassification.note}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View
              style={{
                ...cardSurface,
                padding: spacing.lg,
              }}
            >
              <Text
                style={[
                  typography.overline,
                  { color: colors.textSubtle, marginBottom: spacing.sm },
                ]}
              >
                MEASURED VALUE ({meta.unit}) *
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  ...fieldWell,
                  paddingHorizontal: spacing.md,
                  height: 64,
                  marginTop: 4,
                }}
              >
                <RNTextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder={type === "blood_pressure" ? "120" : "72"}
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="numeric"
                  style={[
                    typography.display.md,
                    { flex: 1, color: colors.text, paddingVertical: 0 },
                  ]}
                />
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: radius.full,
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Text style={[typography.label.sm, { color: colors.primary }]}>
                    {meta.unit}
                  </Text>
                </View>
              </View>

              {/* Real-time Live Classification evaluation strip */}
              {liveClassification && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: spacing.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 10,
                    borderRadius: 14,
                    borderCurve: "continuous",
                    backgroundColor:
                      liveClassification.classification === "normal"
                        ? colors.successSoft
                        : liveClassification.classification === "critical"
                        ? colors.dangerSoft
                        : colors.warningSoft,
                  }}
                >
                  {liveClassification.classification === "normal" ? (
                    <CheckCircle2 size={15} color={colors.success} />
                  ) : liveClassification.classification === "critical" ? (
                    <AlertCircle size={15} color={colors.danger} />
                  ) : (
                    <AlertTriangle size={15} color={colors.warning} />
                  )}
                  <Text
                    style={[
                      typography.label.sm,
                      {
                        flex: 1,
                        color:
                          liveClassification.classification === "normal"
                            ? colors.success
                            : liveClassification.classification === "critical"
                            ? colors.danger
                            : colors.warning,
                      },
                    ]}
                  >
                    {liveClassification.classification.toUpperCase()} · {liveClassification.note}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Measurement Context Chips */}
          {availableContexts.length > 0 && (
            <View style={{ gap: spacing.xs }}>
              <Text
                style={overlineStyle}
              >
                {t("vitals.compose.contextLabel", "MEASUREMENT CONTEXT").toUpperCase()}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
                {availableContexts.map((ctx) => {
                  const metaCtx = CONTEXT_META[ctx] || { label: ctx, icon: Activity };
                  const CtxIcon = metaCtx.icon;
                  const isSelected = context === ctx;

                  return (
                    <Pressable
                      key={ctx}
                      onPress={() => setContext(isSelected ? null : ctx)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        minHeight: 34,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 6,
                        borderRadius: radius.full,
                        backgroundColor: isSelected ? colors.primarySoft : colors.fill,
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      <CtxIcon size={13} color={isSelected ? colors.primary : colors.textSubtle} />
                      <Text
                        style={[
                          typography.label.md,
                          { color: isSelected ? colors.primary : colors.text },
                        ]}
                      >
                        {t(`vitals.context.${ctx}`, metaCtx.label)}
                      </Text>
                      {isSelected && <Check size={12} color={colors.primary} strokeWidth={2.6} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Notes / Circumstances */}
          <View style={{ gap: spacing.xs }}>
            <Text
              style={overlineStyle}
            >
              {t("vitals.compose.notesLabel", "NOTES").toUpperCase()} (OPTIONAL)
            </Text>
            <RNTextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("vitals.compose.notesPlaceholder", "E.g. Feeling lightheaded, after morning walk")}
              placeholderTextColor={colors.textSubtle}
              multiline
              numberOfLines={3}
              style={{
                ...fieldWell,
                marginTop: spacing.xs,
                padding: spacing.md,
                ...typography.body.md,
                color: colors.text,
                minHeight: 88,
                textAlignVertical: "top",
              }}
            />
          </View>

          {/* Save Button */}
          <Button
            title={t("vitals.compose.saveButton", "Save reading")}
            onPress={save}
            loading={addVital.isPending}
            iconLeft={Check}
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
  const chartLabel = t(`vitals.type.${chartType}.label`, chartTypeMeta?.label ?? chartType.replace(/_/g, " "));
  const trackedLatest = latestByType.filter(
    (l): l is LatestByType & { latest: NonNullable<LatestByType["latest"]> } => l.latest != null
  );
  const attentionCount = trackedLatest.filter((l) => l.latest.classification !== "normal").length;
  const needsAttention = attentionCount > 0 || alertsCount > 0;
  const lastLoggedAt = trackedLatest.reduce<string | null>(
    (acc, l) => (!acc || l.latest.recordedAt > acc ? l.latest.recordedAt : acc),
    null
  );

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScreenHeader
        onBack={() => router.back()}
        title={t("vitals.title", "Vitals")}
        subtitle={t("vitals.subtitleWithCount", {
          count: latestByType.length,
          alerts: alertsCount,
          defaultValue: `${latestByType.length} tracked · ${alertsCount} alert${alertsCount === 1 ? "" : "s"}`,
        })}
        right={
          <IconButton
            icon={Plus}
            onPress={() => setComposing(true)}
            accessibilityLabel={t("vitals.logLabel", "Log reading")}
          />
        }
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={112} radius={28} />
          <Skeleton height={300} radius={radius.card} />
          <Skeleton height={120} radius={radius.card} />
        </View>
      ) : isError ? (
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load vitals")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry", "Retry")}
          onAction={() => refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.lg,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Status hero ─────────────────────────────────── */}
          <LinearGradient
            colors={
              needsAttention
                ? [colors.warning, colors.accent2]
                : [colors.primaryGradientStart, colors.primaryGradientEnd]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius.card,
              borderCurve: "continuous",
              padding: spacing.xl,
              gap: spacing.lg,
              overflow: "hidden",
              ...(isDark ? {} : shadow.hero),
            }}
          >
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 0.8 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <IconTile
                icon={needsAttention ? AlertTriangle : ShieldCheck}
                appearance="glass"
                size={48}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.kicker, { color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }]}>
                  {t("vitals.hero.kicker", "Health status")}
                </Text>
                <Text style={[typography.title.lg, { color: "#FFFFFF", marginTop: 2 }]} numberOfLines={2}>
                  {latestByType.length === 0
                    ? t("vitals.hero.emptyTitle", "Start tracking your vitals")
                    : needsAttention
                    ? t("vitals.hero.attentionTitle", {
                        count: attentionCount || alertsCount,
                        defaultValue:
                          (attentionCount || alertsCount) === 1
                            ? "1 reading needs attention"
                            : `${attentionCount || alertsCount} readings need attention`,
                      })
                    : t("vitals.hero.okTitle", "All readings in range")}
                </Text>
                {lastLoggedAt ? (
                  <Text style={[typography.body.sm, { color: "rgba(255,255,255,0.86)", marginTop: 2 }]}>
                    {t("vitals.hero.lastLogged", {
                      when: fmtRelative(lastLoggedAt, locale),
                      defaultValue: `Last logged ${fmtRelative(lastLoggedAt, locale)}`,
                    })}
                  </Text>
                ) : null}
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.24)",
                paddingVertical: spacing.md,
              }}
            >
              <HeroStat value={latestByType.length} label={t("vitals.hero.tracked", "Tracked")} />
              <View style={{ width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.3)" }} />
              <HeroStat value={attentionCount} label={t("vitals.hero.outOfRange", "Out of range")} />
              <View style={{ width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.3)" }} />
              <HeroStat value={alertsCount} label={t("vitals.hero.alerts", "Alerts · 30d")} />
            </View>
          </LinearGradient>

          {/* ── Latest readings grid ─────────────────────────── */}
          {trackedLatest.length > 0 ? (
            <View>
              <SectionHeader
                kicker={t("vitals.latestGrid.kicker", "Snapshot")}
                title={t("vitals.latestGrid.title", "Latest readings")}
                style={{ paddingTop: 0 }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                {trackedLatest.map((l) => (
                  <LatestTile
                    key={l.type}
                    entry={l}
                    locale={locale}
                    selected={chartType === l.type}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setUserSelectedType(l.type);
                    }}
                  />
                ))}
                {trackedLatest.length % 2 === 1 ? (
                  <Card
                    variant="outline"
                    padded={false}
                    onPress={() => setComposing(true)}
                    accessibilityLabel={t("vitals.logLabel", "Log reading")}
                    style={{ flexBasis: "47%", flexGrow: 1, minHeight: 132 }}
                  >
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md }}>
                      <IconTile icon={Plus} tone="primary" size={40} />
                      <Text style={[typography.label.md, { color: colors.textMuted, textAlign: "center" }]}>
                        {t("vitals.latestGrid.addAnother", "Track another vital")}
                      </Text>
                    </View>
                  </Card>
                ) : null}
              </View>

              {isBP && (derived?.map != null || derived?.pulsePressure != null) ? (
                <Card variant="muted" style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md, padding: spacing.lg }}>
                  {derived?.map != null ? (
                    <DerivedLine label={t("vitals.derived.map", "Mean Arterial Pressure")} value={`${derived.map}`} unit="mmHg" />
                  ) : null}
                  {derived?.pulsePressure != null ? (
                    <DerivedLine label={t("vitals.derived.pulsePressure", "Pulse Pressure")} value={`${derived.pulsePressure}`} unit="mmHg" />
                  ) : null}
                </Card>
              ) : null}
            </View>
          ) : null}

          {/* ── Trend chart card ─────────────────────────────── */}
          <Card style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm }}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={[typography.kicker, { color: colors.primary, textTransform: "uppercase" }]}>
                  {t("vitals.chart.kicker", "History")}
                </Text>
                <Text style={[typography.title.lg, { color: colors.text }]}>
                  {t("vitals.chart.trendHeading", "Trend")}
                </Text>
              </View>
              {points.length > 0 && (
                <PillCmp
                  label={t("vitals.chart.points", { count: points.length, defaultValue: `${points.length} points` })}
                  tone="neutral"
                  size="sm"
                />
              )}
            </View>

            {/* Vital selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -spacing.lg }}
              contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: 2 }}
            >
              {sortedVitalTypes.map((vt) => {
                const hasData = !!latestByType.find((l) => l.type === vt)?.latest;
                const isSelected = chartType === vt;
                const VIcon = ICON_BY_TYPE[vt] ?? Activity;
                return (
                  <Pressable
                    key={vt}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setUserSelectedType(vt);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      height: 34,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: isSelected ? colors.primary : colors.fill,
                      opacity: hasData || isSelected ? 1 : 0.7,
                    }}
                  >
                    <VIcon size={13} color={isSelected ? colors.onPrimary : hasData ? colors.primary : colors.textSubtle} strokeWidth={2.4} />
                    <Text style={[typography.label.md, { color: isSelected ? colors.onPrimary : hasData ? colors.text : colors.textMuted }]}>
                      {t(`vitals.type.${vt}.label`, vt.replace(/_/g, " "))}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Range segmented control */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.fill,
                borderRadius: 12,
                borderCurve: "continuous",
                padding: 3,
                gap: 2,
              }}
            >
              {RANGES.map((r) => {
                const on = chartRange === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setChartRange(r);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={{
                      flex: 1,
                      height: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                      borderCurve: "continuous",
                      ...(on ? segOn : null),
                    }}
                  >
                    <Text style={[typography.label.md, { color: on ? colors.text : colors.textMuted }]}>
                      {t(`vitals.range.${r}`, r === 365 ? "1y" : `${r}d`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isSecondaryCapable || chartType === "blood_sugar" ? (
              <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
                {isSecondaryCapable ? (
                  <Chip
                    label={showSecondary ? "Systolic + Diastolic" : "Systolic only"}
                    tone={showSecondary ? "primary" : "neutral"}
                    size="sm"
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setShowSecondary((s) => !s);
                    }}
                  />
                ) : null}
                {chartType === "blood_sugar" ? (
                  <Chip
                    label={t("vitals.chart.glucoseFocus", "Glucose focus")}
                    tone={glucoseFocus ? "primary" : "neutral"}
                    size="sm"
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setGlucoseFocus((s) => !s);
                    }}
                  />
                ) : null}
              </View>
            ) : null}

            {/* Chart Canvas */}
            {seriesLoading ? (
              <Skeleton height={240} radius={16} />
            ) : points.length === 0 ? (
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  paddingVertical: spacing.xl,
                  paddingHorizontal: spacing.lg,
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: 18,
                  borderCurve: "continuous",
                }}
              >
                <IconTile icon={ICON_BY_TYPE[chartType] ?? Activity} tone="neutral" size={44} />
                <Text style={[typography.title.sm, { color: colors.text, textAlign: "center" }]}>
                  {latestForChart?.latest
                    ? t("vitals.chart.emptyRangeTitle", "Nothing in this period")
                    : t("vitals.chart.emptyTypeTitle", {
                        label: chartLabel,
                        defaultValue: `No ${chartLabel.toLowerCase()} readings yet`,
                      })}
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
                  {latestForChart?.latest
                    ? t("vitals.chart.emptyRangeBody", {
                        when: fmtRelative(latestForChart.latest.recordedAt, locale),
                        defaultValue: `Your last reading was ${fmtRelative(latestForChart.latest.recordedAt, locale)}.`,
                      })
                    : t("vitals.chart.emptyTypeBody", "Log a reading to start building your trend.")}
                </Text>
                {latestForChart?.latest && chartRange !== 365 ? (
                  <Button
                    title={t("vitals.chart.showYear", "Show last year")}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setChartRange(365);
                    }}
                    style={{ marginTop: spacing.xs }}
                  />
                ) : !latestForChart?.latest ? (
                  <Button
                    title={t("vitals.logLabel", "Log reading")}
                    icon={Plus}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    onPress={() => {
                      setType(chartType);
                      setComposing(true);
                    }}
                    style={{ marginTop: spacing.xs }}
                  />
                ) : null}
              </View>
            ) : glucoseFocus && chartType === "blood_sugar" ? (
              <GlucoseChart
                points={points}
                stats={stats ?? null}
                width={chartWidth}
                height={240}
              />
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
                  marginTop: spacing.xs,
                  paddingTop: spacing.md,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.separator,
                  gap: spacing.xs,
                }}
              >
                <StatCell
                  label={t("vitals.chart.stats.latest", "Latest")}
                  value={stats.latest != null ? String(Math.round(stats.latest)) : "—"}
                  unit={chartTypeMeta?.unit}
                />
                <StatCell
                  label={t("vitals.chart.stats.avg", "Avg")}
                  value={stats.avg != null ? String(Math.round(stats.avg)) : "—"}
                />
                <StatCell
                  label={t("vitals.chart.stats.min", "Min")}
                  value={stats.min != null ? String(Math.round(stats.min)) : "—"}
                />
                <StatCell
                  label={t("vitals.chart.stats.max", "Max")}
                  value={stats.max != null ? String(Math.round(stats.max)) : "—"}
                />
                <StatCell
                  label={t("vitals.chart.stats.delta", "Trend")}
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

            {/* Trend comparison */}
            {!seriesLoading && prevSeries?.points && prevSeries.points.length > 0 && points.length > 0 ? (
              <View style={{ marginTop: spacing.xs }}>
                <TrendComparison
                  currentPoints={points}
                  currentStats={stats ?? null}
                  previousPoints={prevSeries.points}
                  previousStats={prevSeries.stats ?? null}
                  width={chartWidth}
                  height={80}
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
              title={t("vitals.empty.title", "No readings yet")}
              message={t("vitals.empty.message", "Tap the + button to log your first vital reading.")}
              tone="neutral"
            />
          ) : (
            Object.entries(grouped).map(([month, items]) => (
              <View key={month} style={{ gap: spacing.sm + 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 4 }}>
                  <Text style={[typography.overline, { color: colors.textSubtle }]}>
                    {month} · {items.length}
                  </Text>
                  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
                </View>

                <Card padded={false} style={{ overflow: "hidden" }}>
                  {items.map((v: any, idx: number) => {
                    const vType = v.type as VitalType;
                    const VIcon = ICON_BY_TYPE[vType] ?? Activity;
                    const cls = classifyReading({
                      type: vType,
                      value: Number(v.value),
                      secondary: v.secondaryValue != null ? Number(v.secondaryValue) : null,
                      context: (v.context ?? null) as VitalContext,
                    });

                    const isNormal = cls.classification === "normal";
                    const isCritical = cls.classification === "critical" || cls.classification === "high";

                    return (
                      <View
                        key={v.id}
                        style={{
                          paddingVertical: spacing.md,
                          paddingLeft: spacing.lg,
                          paddingRight: spacing.sm,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.md,
                          borderBottomWidth: idx < items.length - 1 ? StyleSheet.hairlineWidth : 0,
                          borderBottomColor: colors.separator,
                        }}
                      >
                        {/* 42x42 Soft Icon Avatar */}
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            borderCurve: "continuous",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isNormal
                              ? colors.primarySoft
                              : isCritical
                              ? colors.dangerSoft
                              : colors.warningSoft,
                          }}
                        >
                          <VIcon
                            size={20}
                            color={
                              isNormal
                                ? colors.primary
                                : isCritical
                                ? colors.danger
                                : colors.warning
                            }
                            strokeWidth={2.2}
                          />
                        </View>

                        {/* Middle Content */}
                        <View style={{ flex: 1, gap: 2 }}>
                          {/* Row 1: Title + Classification Badge */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: spacing.xs,
                            }}
                          >
                            <Text style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}>
                              {t(`vitals.type.${vType}.label`, vType.replace(/_/g, " "))}
                            </Text>
                            <ClassificationBadge classification={cls.classification} size="sm" />
                          </View>

                          {/* Row 2: Prominent Value + Unit + Context */}
                          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                            <Text style={[typography.display.sm, { color: colors.text, fontSize: 20, lineHeight: 25 }]}>
                              {v.secondaryValue != null
                                ? `${v.value}/${v.secondaryValue}`
                                : `${v.value}`}
                            </Text>
                            <Text style={[typography.label.sm, { color: colors.textMuted }]}>
                              {v.unit}
                            </Text>
                            {v.context ? (
                              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                                · {t(`vitals.context.${v.context}`, v.context)}
                              </Text>
                            ) : null}
                          </View>

                          {/* Row 3: Timestamp */}
                          <Text style={[typography.caption, { color: colors.textSubtle }]}>
                            {fmtDateTime(new Date(v.recordedAt || v.createdAt), locale)}
                          </Text>

                          {/* Optional notes */}
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

                        {/* Separate Delete Action */}
                        <IconButton
                          icon={Trash2}
                          size="sm"
                          onPress={() => confirmDelete(v.id)}
                          accessibilityLabel={t("common.delete", "Delete")}
                          tint={colors.textSubtle}
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

const CLASSIFICATION_TONE = {
  normal: "success",
  elevated: "warning",
  high: "danger",
  critical: "danger",
  low: "info",
} as const;

function HeroStat({ value, label }: { value: number; label: string }) {
  const { typography } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
      <Text style={[typography.title.lg, { color: "#FFFFFF" }]}>{value}</Text>
      <Text style={[typography.caption, { color: "rgba(255,255,255,0.82)" }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function LatestTile({
  entry,
  locale,
  selected,
  onPress,
}: {
  entry: LatestByType & { latest: NonNullable<LatestByType["latest"]> };
  locale: any;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const l = entry.latest;
  const tone = CLASSIFICATION_TONE[l.classification] ?? "neutral";
  const p = useTone(tone);
  const VIcon = ICON_BY_TYPE[entry.type] ?? Activity;
  const unit = l.unit || VITAL_REGISTRY[entry.type]?.unit || "";
  // Older API builds append "undefined" where the unit belongs.
  const note = l.classification !== "normal" && l.note ? l.note.replace(/\s*undefined$/, ` ${unit}`).trim() : null;

  return (
    <Card
      padded={false}
      onPress={onPress}
      accessibilityLabel={String(t(`vitals.type.${entry.type}.label`, entry.type))}
      style={{
        flexBasis: "47%",
        flexGrow: 1,
        minHeight: 132,
        borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
        borderColor: selected ? colors.primary : colors.hairline,
      }}
    >
      <View style={{ padding: spacing.md, gap: spacing.sm, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs }}>
          <IconTile icon={VIcon} tone={tone} size={34} />
          <ClassificationBadge classification={l.classification} size="sm" />
        </View>
        <Text style={[typography.label.md, { color: colors.textMuted }]} numberOfLines={1}>
          {t(`vitals.type.${entry.type}.label`, entry.type.replace(/_/g, " "))}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: -4 }}>
          <Text style={[typography.metric, { color: colors.text }]} numberOfLines={1}>
            {l.secondary != null ? `${l.value}/${l.secondary}` : l.value}
          </Text>
          <Text style={[typography.label.sm, { color: colors.textMuted }]}>{unit}</Text>
        </View>
        {note ? (
          <Text style={[typography.label.sm, { color: p.fg, marginTop: -4 }]} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: "auto" }}>
          <Clock size={11} color={colors.textSubtle} strokeWidth={2.2} />
          <Text style={[typography.caption, { color: colors.textSubtle, flexShrink: 1 }]} numberOfLines={1}>
            {fmtRelative(l.recordedAt, locale)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function DerivedLine({ label, value, unit }: { label: string; value: string; unit: string }) {
  const { spacing, typography, colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[typography.caption, { color: colors.textSubtle }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <Text style={[typography.title.lg, { color: colors.text }]}>
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
      <Text style={[typography.caption, { color: colors.textSubtle }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        {Icon ? <Icon size={12} color={valueColor || colors.text} /> : null}
        <Text
          style={[
            typography.title.md,
            { color: valueColor || colors.text },
          ]}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={[typography.caption, { color: colors.textSubtle, fontSize: 10 }]}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

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
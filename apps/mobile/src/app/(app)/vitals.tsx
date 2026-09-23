// @ts-nocheck

import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Alert, Dimensions, TextInput as RNTextInput } from "react-native";
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
} from "@/components/ui";
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
  const { spacing, colors, typography, radius, scheme } = useTheme();
  const isDark = scheme === "dark";
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
              style={[
                typography.caption,
                { color: colors.textMuted, fontWeight: "700", letterSpacing: 0.8 },
              ]}
            >
              {t("vitals.compose.typeLabel", "SELECT METRIC").toUpperCase()}
            </Text>

            {/* Category Segmented Bar */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.surfaceMuted,
                borderRadius: radius.lg,
                padding: 3,
                borderWidth: 1,
                borderColor: colors.border,
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
                      paddingVertical: 7,
                      alignItems: "center",
                      borderRadius: radius.md,
                      backgroundColor: isActive ? colors.surface : "transparent",
                      borderWidth: isActive ? 1 : 0,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? "800" : "600",
                        color: isActive ? colors.primary : colors.textMuted,
                      }}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Metric Chips with designated Icons */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>
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
                      paddingHorizontal: spacing.md,
                      paddingVertical: 7,
                      borderRadius: radius.full,
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <VIcon
                      size={13}
                      color={isSelected ? colors.onPrimary : colors.primary}
                      strokeWidth={2.4}
                    />
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: isSelected ? "700" : "600",
                        color: isSelected ? colors.onPrimary : colors.text,
                      }}
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
              backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : colors.primarySoft,
              borderRadius: radius.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: isDark ? "rgba(59, 130, 246, 0.25)" : "rgba(37, 99, 235, 0.18)",
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCmp size={22} color={colors.onPrimary} strokeWidth={2.2} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
                  {meta.label}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: radius.xs,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "800", color: colors.primary }}>
                    {meta.unit}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "500" }}>
                {targetGuide}
              </Text>
            </View>
          </View>

          {/* Value Inputs: Side-by-side for BP, or Prominent Input for others */}
          {type === "blood_pressure" ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : colors.border,
                padding: spacing.md,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0 : 0.03,
                shadowRadius: 5,
                elevation: 1,
              }}
            >
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, fontWeight: "700", letterSpacing: 0.8, marginBottom: spacing.sm },
                ]}
              >
                BLOOD PRESSURE VALUES (MMHG) *
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
                {/* Systolic */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSubtle, marginBottom: 4 }}>
                    SYSTOLIC (TOP)
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: spacing.md,
                      height: 54,
                    }}
                  >
                    <RNTextInput
                      value={value}
                      onChangeText={setValue}
                      placeholder="120"
                      placeholderTextColor={colors.textSubtle}
                      keyboardType="numeric"
                      style={{
                        flex: 1,
                        fontSize: 22,
                        fontWeight: "800",
                        color: colors.text,
                      }}
                    />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textMuted }}>
                      mmHg
                    </Text>
                  </View>
                </View>

                {/* Slash Divider */}
                <View style={{ paddingTop: 18 }}>
                  <Text style={{ fontSize: 26, fontWeight: "300", color: colors.textMuted }}>
                    /
                  </Text>
                </View>

                {/* Diastolic */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSubtle, marginBottom: 4 }}>
                    DIASTOLIC (BOTTOM)
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: spacing.md,
                      height: 54,
                    }}
                  >
                    <RNTextInput
                      value={secondary}
                      onChangeText={setSecondary}
                      placeholder="80"
                      placeholderTextColor={colors.textSubtle}
                      keyboardType="numeric"
                      style={{
                        flex: 1,
                        fontSize: 22,
                        fontWeight: "800",
                        color: colors.text,
                      }}
                    />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textMuted }}>
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
                    paddingVertical: 8,
                    borderRadius: radius.md,
                    backgroundColor:
                      liveClassification.classification === "normal"
                        ? colors.successSoft
                        : liveClassification.classification === "critical"
                        ? (colors.dangerSoft ?? "rgba(239, 68, 68, 0.15)")
                        : "rgba(245, 158, 11, 0.15)",
                  }}
                >
                  {liveClassification.classification === "normal" ? (
                    <CheckCircle2 size={15} color={colors.success} />
                  ) : liveClassification.classification === "critical" ? (
                    <AlertCircle size={15} color={colors.danger} />
                  ) : (
                    <AlertTriangle size={15} color="#D97706" />
                  )}
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color:
                        liveClassification.classification === "normal"
                          ? colors.success
                          : liveClassification.classification === "critical"
                          ? colors.danger
                          : "#D97706",
                    }}
                  >
                    {liveClassification.classification.toUpperCase()} · {liveClassification.note}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : colors.border,
                padding: spacing.md,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0 : 0.03,
                shadowRadius: 5,
                elevation: 1,
              }}
            >
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, fontWeight: "700", letterSpacing: 0.8, marginBottom: spacing.xs },
                ]}
              >
                MEASURED VALUE ({meta.unit}) *
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  height: 54,
                  marginTop: 4,
                }}
              >
                <RNTextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder={type === "blood_pressure" ? "120" : "72"}
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="numeric"
                  style={{
                    flex: 1,
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                />
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
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
                    paddingVertical: 8,
                    borderRadius: radius.md,
                    backgroundColor:
                      liveClassification.classification === "normal"
                        ? colors.successSoft
                        : liveClassification.classification === "critical"
                        ? (colors.dangerSoft ?? "rgba(239, 68, 68, 0.15)")
                        : "rgba(245, 158, 11, 0.15)",
                  }}
                >
                  {liveClassification.classification === "normal" ? (
                    <CheckCircle2 size={15} color={colors.success} />
                  ) : liveClassification.classification === "critical" ? (
                    <AlertCircle size={15} color={colors.danger} />
                  ) : (
                    <AlertTriangle size={15} color="#D97706" />
                  )}
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color:
                        liveClassification.classification === "normal"
                          ? colors.success
                          : liveClassification.classification === "critical"
                          ? colors.danger
                          : "#D97706",
                    }}
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
                style={[
                  typography.caption,
                  { color: colors.textMuted, fontWeight: "700", letterSpacing: 0.8 },
                ]}
              >
                {t("vitals.compose.contextLabel", "MEASUREMENT CONTEXT").toUpperCase()}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
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
                        paddingHorizontal: spacing.md,
                        paddingVertical: 6,
                        borderRadius: radius.full,
                        backgroundColor: isSelected ? colors.primarySoft : colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <CtxIcon size={12} color={isSelected ? colors.primary : colors.textSubtle} />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? "700" : "600",
                          color: isSelected ? colors.primary : colors.text,
                        }}
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
              style={[
                typography.caption,
                { color: colors.textMuted, fontWeight: "700", letterSpacing: 0.8 },
              ]}
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
                backgroundColor: colors.surfaceMuted,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                fontSize: 13.5,
                color: colors.text,
                minHeight: 70,
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
          <Skeleton height={96} radius={18} />
          <Skeleton height={260} radius={18} />
          <Skeleton height={120} radius={18} />
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
          {/* Health Overview Hero */}
          <LinearGradient
            colors={
              alertsCount > 0
                ? isDark
                  ? [colors.surfaceElevated, colors.surface]
                  : [colors.warningSoft, colors.surface]
                : isDark
                ? [colors.surfaceElevated, colors.surface]
                : [colors.primarySoft, colors.surface]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 20,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: alertsCount > 0 ? colors.warning + "40" : colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                backgroundColor: alertsCount > 0 ? colors.warning : colors.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: alertsCount > 0 ? colors.warning : colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {alertsCount > 0 ? (
                <AlertTriangle size={24} color={colors.onPrimary} />
              ) : (
                <Heart size={24} color={colors.onPrimary} />
              )}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
                {alertsCount > 0 ? "Vital Alerts Detected" : "Vitals Healthy"}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, lineHeight: 17 }]}>
                {alertsCount > 0
                  ? `${alertsCount} reading requires attention. Review recent trends below.`
                  : `${latestByType.length} biometric indicator${latestByType.length > 1 ? "s" : ""} monitored and up to date.`}
              </Text>
            </View>
          </LinearGradient>

          {/* ── Latest + classification ───────────────────────── */}
          {latestForChart?.latest ? (
            <Card style={{ padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
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
                  <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "600", textTransform: "uppercase" }]}>
                    Latest {t(`vitals.type.${chartType}.label`, chartType)}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
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
                      label={t("vitals.derived.map", "Mean Arterial Pressure")}
                      value={`${derived.map}`}
                      unit="mmHg"
                    />
                  ) : null}
                  {derived?.pulsePressure != null ? (
                    <DerivedLine
                      label={t("vitals.derived.pulsePressure", "Pulse Pressure")}
                      value={`${derived.pulsePressure}`}
                      unit="mmHg"
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* ── Trend chart card ─────────────────────────────── */}
          <Card style={{ padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border, gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.text, fontWeight: "800" },
                ]}
              >
                {t("vitals.chart.trendHeading", "Biometric Trends")}
              </Text>
              {points.length > 0 && (
                <PillCmp
                  label={`${points.length} points`}
                  tone="neutral"
                  size="sm"
                />
              )}
            </View>

            {/* Horizontally scrollable vital metric selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}
            >
              {sortedVitalTypes.map((vt) => {
                const latest = latestByType.find((l) => l.type === vt);
                const hasData = !!latest?.latest;
                const isSelected = chartType === vt;

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
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 18,
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    {hasData && (
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: isSelected ? colors.onPrimary : colors.primary,
                        }}
                      />
                    )}
                    <Text
                      style={[
                        typography.label.sm,
                        {
                          color: isSelected ? colors.onPrimary : colors.text,
                          fontWeight: isSelected ? "700" : "500",
                          fontSize: 12,
                        },
                      ]}
                    >
                      {t(`vitals.type.${vt}.label`, vt.replace(/_/g, " "))}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Time range selector chips */}
            <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center", flexWrap: "wrap", paddingTop: 4 }}>
              {RANGES.map((r) => (
                <Chip
                  key={r}
                  label={t(`vitals.range.${r}`, `${r}d`)}
                  selected={chartRange === r}
                  tone={chartRange === r ? "info" : "neutral"}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setChartRange(r);
                  }}
                  size="sm"
                />
              ))}

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

            {/* Chart Canvas */}
            {seriesLoading ? (
              <Skeleton height={240} radius={12} />
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
                  paddingTop: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
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
              <View key={month} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <Text style={[typography.overline, { color: colors.textMuted, fontWeight: "700" }]}>
                    {month} · {items.length}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border + "60" }} />
                </View>

                <Card padded={false} style={{ borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
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
                          padding: spacing.md,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.md,
                          borderBottomWidth: idx < items.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        }}
                      >
                        {/* 42x42 Soft Icon Avatar */}
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isNormal
                              ? colors.primarySoft
                              : isCritical
                              ? colors.dangerSoft
                              : colors.warningSoft,
                            borderWidth: 1,
                            borderColor: isNormal
                              ? colors.primary + "30"
                              : isCritical
                              ? colors.danger + "30"
                              : colors.warning + "30",
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
                            <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
                              {t(`vitals.type.${vType}.label`, vType.replace(/_/g, " "))}
                            </Text>
                            <ClassificationBadge classification={cls.classification} size="sm" />
                          </View>

                          {/* Row 2: Prominent Value + Unit + Context */}
                          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                            <Text style={[typography.title.md, { color: colors.text, fontWeight: "800" }]}>
                              {v.secondaryValue != null
                                ? `${v.value}/${v.secondaryValue}`
                                : `${v.value}`}
                            </Text>
                            <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "600" }]}>
                              {v.unit}
                            </Text>
                            {v.context ? (
                              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                                · {t(`vitals.context.${v.context}`, v.context)}
                              </Text>
                            ) : null}
                          </View>

                          {/* Row 3: Timestamp */}
                          <Text style={[typography.caption, { color: colors.textSubtle, fontSize: 11 }]}>
                            {fmtDateTime(new Date(v.recordedAt || v.createdAt), locale)}
                          </Text>

                          {/* Optional notes */}
                          {v.notes ? (
                            <Text
                              style={[
                                typography.body.sm,
                                { color: colors.textMuted, marginTop: 2, lineHeight: 17 },
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
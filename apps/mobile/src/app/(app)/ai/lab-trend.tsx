// @ts-nocheck

// Day 3 #6 mobile surface.
//
// Pick a test type (HbA1c, Lipid Panel, etc.) and a look-back window;
// the backend returns the structural cadence + an LLM narrative about
// whether the patient is overdue. Same Card / Pill / Button skeleton
// as the other AI screens — keeps the muscle memory consistent.
//
// Cost: bge-small embedding model + 1 Llama-70B call (capped at 250
// output tokens). Cached 6h server-side by (patientId, type, months).

import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  RefreshCcw,
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  Clock,
  Droplet,
  HeartPulse,
  Activity,
  Gauge,
  Bean,
  Search,
  CalendarClock,
  ArrowRight,
  Check,
  type LucideIcon,
} from "lucide-react-native";
import { useAiLabTrend, type LabTrend } from "@/hooks/useApi";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  Pill as PillCmp,
  TextInput,
  useToast,
} from "@/components/ui";

const MONTH_OPTIONS = [3, 6, 12, 24, 60];

// `value` is what the backend matches on; the label is display-only.
const COMMON_TESTS: { key: string; value: string; icon: LucideIcon; tone: Tone }[] = [
  { key: "hba1c", value: "HbA1c", icon: Droplet, tone: "danger" },
  { key: "lipid", value: "Lipid Panel", icon: HeartPulse, tone: "warning" },
  { key: "cbc", value: "CBC", icon: Activity, tone: "primary" },
  { key: "tsh", value: "TSH", icon: Gauge, tone: "accent2" },
  { key: "creatinine", value: "Creatinine", icon: Bean, tone: "info" },
  { key: "lft", value: "Liver Function", icon: FlaskConical, tone: "success" },
];

export default function AiLabTrendScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, scheme } = useTheme();
  const toast = useToast();
  const patient = useAuthStore((s) => s.patient);

  const labTrend = useAiLabTrend();
  const [testType, setTestType] = useState("");
  const [months, setMonths] = useState(24);
  const [trend, setTrend] = useState<LabTrend | null>(null);
  const [cached, setCached] = useState<boolean>(false);
  // What the current result was computed for — edits after that mark it stale.
  const [ranFor, setRanFor] = useState<{ type: string; months: number } | null>(null);

  async function run() {
    if (!patient?.id) {
      toast.show(t("aiLabTrend.noProfile"), "warning");
      return;
    }
    const type = testType.trim();
    if (!type) {
      toast.show(t("aiLabTrend.typeRequired"), "warning");
      return;
    }
    try {
      const res = await labTrend.mutateAsync({ patientId: patient.id, type, months });
      setTrend(res.trend);
      setCached(!!res.cached);
      setRanFor({ type, months });
    } catch (err: any) {
      toast.show(err?.message || t("aiLabTrend.loadError"), "danger");
    }
  }

  const surface = scheme === "dark" ? colors.surfaceElevated : colors.surface;
  const monthLabel = (m: number) =>
    m < 12
      ? t("aiLabTrend.v2.monthsShort", { count: m, defaultValue: "{{count}} mo" })
      : t("aiLabTrend.v2.yearsShort", { count: m / 12, defaultValue: "{{count}} yr" });
  const isFresh = ranFor && ranFor.type === testType.trim() && ranFor.months === months;
  const typeLabel = testType.trim();

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiLabTrend.title")}
        subtitle={t("aiLabTrend.subtitle")}
        right={<PillCmp icon={Sparkles} label={t("aiLabTrend.aiPill")} tone="accent" size="sm" />}
      />

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl }}
      >
        {/* ─── Result (shown on top once available) ─── */}
        {labTrend.isPending ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={96} radius={20} />
            <Skeleton height={84} radius={20} />
            <Skeleton height={120} radius={20} />
          </View>
        ) : trend && ranFor ? (
          <View style={{ gap: spacing.md }}>
            {/* Status hero */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: trend.overdue ? colors.warningSoft : colors.successSoft,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor: trend.overdue ? colors.warning : colors.success,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {trend.overdue ? (
                  <AlertCircle size={24} color="#FFFFFF" strokeWidth={2.3} />
                ) : (
                  <CheckCircle2 size={24} color="#FFFFFF" strokeWidth={2.3} />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.overline, { color: colors.textMuted, fontSize: 10 }]} numberOfLines={1}>
                  {ranFor.type} · {monthLabel(ranFor.months)}
                </Text>
                <Text style={[typography.title.lg, { color: colors.text }]}>
                  {trend.overdue ? t("aiLabTrend.overdue") : t("aiLabTrend.v2.onTrack", "On track")}
                </Text>
                {trend.intervalMonths ? (
                  <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                    {t("aiLabTrend.overdueInterval", { months: trend.intervalMonths })}
                  </Text>
                ) : null}
              </View>
              {cached ? <PillCmp label={t("aiClinicalNote.cached")} tone="neutral" size="sm" /> : null}
            </View>

            {/* Counts */}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {[
                { icon: FlaskConical, label: t("aiLabTrend.countTotal"), value: trend.count, color: colors.primary },
                { icon: CheckCircle2, label: t("aiLabTrend.countCompleted"), value: trend.completedCount, color: colors.success },
                { icon: Clock, label: t("aiLabTrend.countPending"), value: trend.pendingCount, color: colors.warning },
              ].map((st) => (
                <View
                  key={st.label}
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    gap: 4,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: surface,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.hairline,
                  }}
                >
                  <st.icon size={15} color={st.color} strokeWidth={2.4} />
                  <Text style={[typography.display.sm, { color: colors.text }]}>{st.value ?? 0}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {st.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Last → next */}
            <Card padded={false}>
              <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.caption, { color: colors.textSubtle }]}>{t("aiLabTrend.lastDate")}</Text>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {trend.lastDate ?? t("aiLabTrend.lastDate_never")}
                  </Text>
                </View>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: colors.well,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ArrowRight size={15} color={colors.textMuted} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1, gap: 2, alignItems: "flex-end" }}>
                  <Text style={[typography.caption, { color: colors.textSubtle }]}>
                    {t("aiLabTrend.v2.nextLabel", "Suggested next")}
                  </Text>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: trend.overdue ? colors.warning : colors.text, textAlign: "right" },
                    ]}
                  >
                    {trend.nextSuggestedDate ?? "—"}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Narrative */}
            <Card>
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Sparkles size={15} color={colors.accent} strokeWidth={2.4} />
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("aiLabTrend.sectionNarrative")}
                  </Text>
                </View>
                <Text style={[typography.body.md, { color: colors.text, lineHeight: 22 }]}>
                  {trend.narrative || t("aiSummary.emptySummary")}
                </Text>
              </View>
            </Card>

            <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center" }]}>
              {t("aiLabTrend.disclaimer")}
            </Text>
          </View>
        ) : null}

        {/* ─── Test picker ─── */}
        <View style={{ gap: 10 }}>
          <Text style={[typography.overline, { color: colors.textMuted, marginLeft: 4 }]}>
            {t("aiLabTrend.v2.pickTitle", "Which test?")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {COMMON_TESTS.map((ct) => {
              const sel = testType.trim().toLowerCase() === ct.value.toLowerCase();
              const pal = tonePalette(ct.tone, colors);
              return (
                <Pressable
                  key={ct.key}
                  onPress={() => setTestType(ct.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  style={({ pressed }) => ({
                    flexBasis: "47%",
                    flexGrow: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    padding: spacing.md,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: sel ? colors.primarySoft : surface,
                    borderWidth: sel ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: sel ? colors.primary : colors.hairline,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      borderCurve: "continuous",
                      backgroundColor: sel ? colors.primary : pal.bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {sel ? (
                      <Check size={17} color={colors.onPrimary} strokeWidth={3} />
                    ) : (
                      <ct.icon size={17} color={pal.fg} strokeWidth={2.3} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.title.xs, { color: sel ? colors.primary : colors.text }]} numberOfLines={1}>
                      {ct.value}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {t(`aiLabTrend.v2.testHint.${ct.key}`)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={testType}
            onChangeText={setTestType}
            placeholder={t("aiLabTrend.v2.otherPlaceholder", "Or type another test, e.g. Vitamin D")}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={run}
            leadingIcon={Search}
            tone="soft"
            containerStyle={{ marginTop: 2 }}
          />
        </View>

        {/* ─── Look-back ─── */}
        <View style={{ gap: 10 }}>
          <Text style={[typography.overline, { color: colors.textMuted, marginLeft: 4 }]}>
            {t("aiLabTrend.monthsLabel")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              padding: 4,
              gap: 4,
              borderRadius: 16,
              borderCurve: "continuous",
              backgroundColor: colors.fill,
            }}
          >
            {MONTH_OPTIONS.map((m) => {
              const active = months === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMonths(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    height: 38,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    borderCurve: "continuous",
                    backgroundColor: active ? surface : "transparent",
                  }}
                >
                  <Text style={[typography.label.md, { color: active ? colors.primary : colors.textMuted }]}>
                    {monthLabel(m)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky action */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          backgroundColor: surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
        }}
      >
        <Button
          title={
            !typeLabel
              ? t("aiLabTrend.v2.pickFirst", "Pick a test to check")
              : isFresh
                ? t("aiLabTrend.v2.rerun", "Re-run check")
                : t("aiLabTrend.v2.runFor", { name: typeLabel, defaultValue: "Check {{name}}" })
          }
          onPress={run}
          loading={labTrend.isPending}
          icon={isFresh ? RefreshCcw : CalendarClock}
          size="lg"
          disabled={!typeLabel}
        />
      </View>
    </Screen>
  );
}

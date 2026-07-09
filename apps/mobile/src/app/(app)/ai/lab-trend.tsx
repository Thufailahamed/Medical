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
import { View, Text, ScrollView, TextInput as RNTextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  RefreshCcw,
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react-native";
import { useAiLabTrend, type LabTrend } from "@/hooks/useApi";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  Skeleton,
  Pill as PillCmp,
  SectionHeader,
  useToast,
} from "@/components/ui";

const MONTH_OPTIONS = [3, 6, 12, 24, 60];

export default function AiLabTrendScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const patient = useAuthStore((s) => s.patient);

  const labTrend = useAiLabTrend();
  const [testType, setTestType] = useState("");
  const [months, setMonths] = useState(24);
  const [trend, setTrend] = useState<LabTrend | null>(null);
  const [cached, setCached] = useState<boolean>(false);

  async function run() {
    if (!patient?.id) {
      toast.show(t("aiLabTrend.noProfile"), "warning");
      return;
    }
    if (!testType.trim()) {
      toast.show(t("aiLabTrend.typeRequired"), "warning");
      return;
    }
    try {
      const res = await labTrend.mutateAsync({
        patientId: patient.id,
        type: testType.trim(),
        months,
      });
      setTrend(res.trend);
      setCached(!!res.cached);
    } catch (err: any) {
      toast.show(err?.message || t("aiLabTrend.loadError"), "danger");
    }
  }

  const commonKeys = ["hba1c", "lipid", "cbc", "tsh", "creatinine", "lft"] as const;

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiLabTrend.title")}
        subtitle={t("aiLabTrend.subtitle")}
        right={
          <PillCmp
            icon={Sparkles}
            label={t("aiLabTrend.aiPill")}
            tone="accent"
            size="sm"
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <Card>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...typography.label, color: colors.textMuted }}>
                {t("aiLabTrend.typeLabel")}
              </Text>
              <RNTextInput
                value={testType}
                onChangeText={setTestType}
                placeholder={t("aiLabTrend.typePlaceholder")}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: spacing.md,
                  color: colors.text,
                  backgroundColor: colors.surface,
                  fontSize: 15,
                }}
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...typography.label, color: colors.textMuted }}>
                {t("aiLabTrend.monthsLabel")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {MONTH_OPTIONS.map((m) => {
                  const active = months === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMonths(m)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          ...typography.caption,
                          color: active ? colors.onPrimary : colors.text,
                        }}
                      >
                        {m}m
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Button
              label={
                trend
                  ? t("aiClinicalNote.actionRegenerate") ?? "Re-run"
                  : t("aiLabTrend.run")
              }
              onPress={run}
              loading={labTrend.isPending}
              icon={trend ? RefreshCcw : FlaskConical}
              disabled={!testType.trim()}
            />
            {cached ? (
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                {t("aiClinicalNote.cached")}
              </Text>
            ) : null}
          </View>
        </Card>

        {!trend ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.label, color: colors.textMuted }}>
              {t("aiLabTrend.commonTestsTitle")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {commonKeys.map((k) => (
                <PillCmp
                  key={k}
                  label={t(`aiLabTrend.commonTests.${k}`)}
                  size="sm"
                  onPress={() => setTestType(t(`aiLabTrend.commonTests.${k}`))}
                />
              ))}
            </View>
            <EmptyState
              icon={FlaskConical}
              title={t("aiLabTrend.emptyTitle")}
              body={t("aiLabTrend.emptyBody")}
            />
          </View>
        ) : labTrend.isPending ? (
          <Card>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <Skeleton width="50%" height={18} />
              <Skeleton width="100%" height={14} />
              <Skeleton width="80%" height={14} />
            </View>
          </Card>
        ) : (
          <>
            <Card>
              <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                <SectionHeader title={t("aiLabTrend.sectionNarrative")} />
                <Text style={{ ...typography.body, color: colors.text }}>
                  {trend.narrative || t("aiSummary.emptySummary")}
                </Text>
                {trend.overdue ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                      marginTop: spacing.xs,
                    }}
                  >
                    <AlertCircle size={14} color={colors.warning} />
                    <Text style={{ ...typography.caption, color: colors.warning }}>
                      {t("aiLabTrend.overdue")}
                      {trend.intervalMonths
                        ? " — " +
                          t("aiLabTrend.overdueInterval", {
                            months: trend.intervalMonths,
                          })
                        : ""}
                    </Text>
                  </View>
                ) : null}
                {trend.nextSuggestedDate ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Clock size={14} color={colors.textMuted} />
                    <Text style={{ ...typography.caption, color: colors.textMuted }}>
                      {t("aiLabTrend.nextSuggested", {
                        date: trend.nextSuggestedDate,
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>

            <Card>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <SectionHeader title={t("aiLabTrend.sectionCounts")} />
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.md,
                  }}
                >
                  <Stat
                    icon={FlaskConical}
                    label={t("aiLabTrend.countTotal")}
                    value={trend.count}
                  />
                  <Stat
                    icon={CheckCircle2}
                    label={t("aiLabTrend.countCompleted")}
                    value={trend.completedCount}
                  />
                  <Stat
                    icon={Clock}
                    label={t("aiLabTrend.countPending")}
                    value={trend.pendingCount}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                  }}
                >
                  <Text style={{ ...typography.label, color: colors.textMuted }}>
                    {t("aiLabTrend.lastDate")}:
                  </Text>
                  <Text style={{ ...typography.body, color: colors.text }}>
                    {trend.lastDate ?? t("aiLabTrend.lastDate_never")}
                  </Text>
                </View>
              </View>
            </Card>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
              }}
            >
              <AlertCircle size={14} color={colors.textMuted} />
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                {t("aiLabTrend.disclaimer")}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: number;
}) {
  const { spacing, colors, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      <Icon size={16} color={colors.primary} />
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{label}:</Text>
      <Text style={{ ...typography.body, color: colors.text }}>{value}</Text>
    </View>
  );
}
// /records/trends — Tier 1 records: Vitals & Meds Trends.
//
// Three sections:
//   1. Vitals — picker (BP/HR/Glucose/Weight/SpO2/Temp) + Recharts-style
//      chart driven by the existing VitalsChart component
//   2. Meds — adherence strip (one row per active medicine)
//   3. Range — 7d / 30d / 90d / 1y / all
//
// Data: useHealthSnapshot().recentVitals for last 3 per type (cheap).
// Larger ranges will hit /me/canonical.vitals once we add a range
// param (deferred — last 3 is plenty for the at-a-glance use case).

import React, { useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, AppText, Pill, Skeleton } from "@/components/ui";
import { VitalsChart } from "@/components/vitals/VitalsChart";
import { MedicineAdherenceStrip } from "@/components/records/MedicineAdherenceStrip";
import {
  useHealthSnapshot,
  usePatientLabTrend,
  type PatientLabTrendPoint,
} from "@/hooks/useApi";
import type { VitalsPoint } from "@/hooks/useApi";

type VitalKey = "bp" | "hr" | "glucose" | "weight" | "spo2" | "temp";

const METRICS: { key: VitalKey; label: string; type: string }[] = [
  { key: "bp", label: "Blood Pressure", type: "blood_pressure" },
  { key: "hr", label: "Heart Rate", type: "heart_rate" },
  { key: "glucose", label: "Glucose", type: "blood_sugar" },
  { key: "weight", label: "Weight", type: "weight" },
  { key: "spo2", label: "SpO₂", type: "spo2" },
  { key: "temp", label: "Temperature", type: "temperature" },
];

const RANGES = [
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "1y", label: "1y", days: 365 },
  { key: "all", label: "All", days: null },
];

// Common HbA1c + Lipid panel tests surfaced as trend candidates.
// Backed by the structured-extraction pipeline (lab_test_results).
const LAB_TESTS = [
  { key: "HbA1c", label: "HbA1c" },
  { key: "LDL", label: "LDL" },
  { key: "HDL", label: "HDL" },
  { key: "Triglycerides", label: "Triglycerides" },
  { key: "Total Cholesterol", label: "Total Cholesterol" },
  { key: "Fasting Glucose", label: "Fasting Glucose" },
  { key: "Creatinine", label: "Creatinine" },
  { key: "TSH", label: "TSH" },
];

export default function TrendsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [metric, setMetric] = useState<VitalKey>("bp");
  const [range, setRange] = useState("30d");

  const { data: snapshot, isLoading } = useHealthSnapshot();

  const [labTest, setLabTest] = useState<string>("HbA1c");
  const monthsForRange = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || !r.days) return 60; // ~5y default
    return Math.max(1, Math.round(r.days / 30));
  }, [range]);

  const { data: labTrend, isLoading: labLoading } = usePatientLabTrend(
    undefined,
    labTest,
    monthsForRange,
  );

  const labPoints: { value: number; recordedAt: string; unit?: string | null; flag?: string }[] =
    useMemo(() => {
      const items = labTrend?.items ?? [];
      // API returns DESC by reportedAt — reverse for chronological chart.
      return items
        .slice()
        .reverse()
        .filter((r: any) => typeof r.value === "number")
        .map((r: any) => ({
          value: r.value,
          recordedAt: r.reportedAt || r.collectedAt,
          unit: r.unit,
          flag: r.flag,
        }));
    }, [labTrend]);

  const labSummary = useMemo(() => {
    const s = (labTrend?.summary ?? {})[labTest.toLowerCase()];
    return s
      ? {
          last: s.last,
          unit: s.unit,
          lastDate: s.lastDate,
          count: s.count,
        }
      : null;
  }, [labTrend, labTest]);

  const points: VitalsPoint[] = useMemo(() => {
    if (!snapshot) return [];
    const arr = (snapshot.recentVitals as any)[metric] ?? [];
    // Snapshot returns last 3 in desc order; reverse to chronological.
    return arr
      .slice()
      .reverse()
      .map((v: any) => ({
        value: v.value,
        recordedAt: v.recordedAt,
      }));
  }, [snapshot, metric]);

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: t("records.trends.title", "Trends") }} />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Metric chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {METRICS.map((m) => (
            <Pill
              key={m.key}
              tone={metric === m.key ? "info" : "neutral"}
              onPress={() => setMetric(m.key)}
            >
              {m.label}
            </Pill>
          ))}
        </ScrollView>

        {/* Range chips */}
        <View style={styles.row}>
          {RANGES.map((r) => (
            <Pill
              key={r.key}
              tone={range === r.key ? "info" : "neutral"}
              onPress={() => setRange(r.key)}
            >
              {r.label}
            </Pill>
          ))}
        </View>

        {/* Vitals chart */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {isLoading ? (
            <Skeleton height={200} radius={12} />
          ) : points.length > 0 ? (
            <VitalsChart
              type={METRICS.find((m) => m.key === metric)?.type as any}
              points={points}
              stats={null}
              width={320}
              showSecondary={metric === "bp"}
            />
          ) : (
            <AppText variant="body.sm" color="muted">
              {t(
                "records.trends.noData",
                "No data for this metric yet. Add a vital to see trends."
              )}
            </AppText>
          )}
        </View>

        {/* Lab trend (typed extraction, migration 0070) */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <AppText variant="title.sm" weight="700">
            {t("records.trends.labTitle", "Lab results trend")}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {LAB_TESTS.map((t2) => (
              <Pill
                key={t2.key}
                tone={labTest === t2.key ? "info" : "neutral"}
                onPress={() => setLabTest(t2.key)}
              >
                {t2.label}
              </Pill>
            ))}
          </ScrollView>
          {labLoading ? (
            <Skeleton height={160} radius={12} />
          ) : labPoints.length > 0 ? (
            <VitalsChart
              type={"cholesterol" as any}
              points={labPoints as any}
              stats={null}
              width={320}
              showSecondary={false}
            />
          ) : (
            <AppText variant="body.sm" color="muted">
              {t(
                "records.trends.noLabData",
                "No structured results for this test yet. Upload the relevant lab report to see the trend.",
              )}
            </AppText>
          )}
          {labSummary ? (
            <AppText variant="body.sm" color="muted">
              {t("records.trends.labLast", {
                defaultValue: "Last: {{value}}{{unit}} · {{count}} readings",
                value:
                  labSummary.last != null
                    ? String(labSummary.last)
                    : "—",
                unit: labSummary.unit ? ` ${labSummary.unit}` : "",
                count: labSummary.count,
              })}
            </AppText>
          ) : null}
        </View>

        {/* Med adherence */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <AppText variant="title.sm" weight="700">
            {t("records.trends.meds", "Medicine adherence")}
          </AppText>
          {snapshot?.activeMedicines?.length ? (
            <MedicineAdherenceStrip medicines={snapshot.activeMedicines as any} />
          ) : (
            <AppText variant="body.sm" color="muted">
              {t("records.trends.noMeds", "No active medicines.")}
            </AppText>
          )}
        </View>

        <Pressable
          onPress={() => router.back()}
          style={[styles.closeBtn, { borderColor: colors.border }]}
        >
          <AppText variant="body.sm" weight="600">
            {t("common.close", "Close")}
          </AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  chipRow: { gap: 8, paddingVertical: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  closeBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
});

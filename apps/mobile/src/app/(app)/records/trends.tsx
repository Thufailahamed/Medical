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
import { useHealthSnapshot } from "@/hooks/useApi";
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

export default function TrendsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [metric, setMetric] = useState<VitalKey>("bp");
  const [range, setRange] = useState("30d");

  const { data: snapshot, isLoading } = useHealthSnapshot();

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

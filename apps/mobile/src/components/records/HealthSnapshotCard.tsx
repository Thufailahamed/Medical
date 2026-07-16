// HealthSnapshotCard — Tier 1 records: Patient Health Snapshot surface.
//
// One-card-at-a-glance view. Renders the structure produced by
// apps/api/src/lib/snapshot.ts (useHealthSnapshot hook).
//
// Sections (only rendered when populated):
//   1. RedBanner — severe/critical active allergies
//   2. Drug allergy warnings — yellow strip
//   3. Chronic conditions — chip row
//   4. Active medicines — top 3 + see-all link
//   5. Recent vitals — 4 sparklines (BP/HR/Glucose/Weight)
//   6. Upcoming follow-ups — date list
//
// Tap-through targets are optional props so the same card works on the
// patient hub, the doctor patient-detail, and the portal pages.

import React, { useMemo } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import {
  ShieldAlert,
  AlertTriangle,
  Pill as PillIcon,
  Heart,
  Droplet,
  Scale,
  Thermometer,
  Calendar,
  ChevronRight,
  Activity,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { AppText } from "@/components/ui/AppText";
import { Sparkline } from "@/components/vitals/Sparkline";
import type { HealthSnapshot } from "@/hooks/useApi";

interface Props {
  snapshot?: HealthSnapshot;
  loading?: boolean;
  compact?: boolean;
  onJumpToTrends?: () => void;
  onJumpToAllergies?: () => void;
  onJumpToMeds?: () => void;
  onJumpToChronic?: (conditionId: string) => void;
}

export function HealthSnapshotCard({
  snapshot,
  loading,
  compact,
  onJumpToTrends,
  onJumpToAllergies,
  onJumpToMeds,
  onJumpToChronic,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (loading && !snapshot) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <AppText variant="body.sm" color="muted">
          {t("records.snapshot.loading", "Loading health snapshot…")}
        </AppText>
      </View>
    );
  }
  if (!snapshot) return null;

  const empty =
    !snapshot.redBanner.length &&
    !snapshot.drugAllergyWarnings.length &&
    !snapshot.chronicConditions.length &&
    !snapshot.activeMedicines.length &&
    !snapshot.upcomingFollowUps.length &&
    !Object.values(snapshot.recentVitals).some((arr) => arr.length > 0);
  if (empty) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* ─── Red banner — severe/critical allergies ─────────────── */}
      {snapshot.redBanner.length > 0 && (
        <Pressable
          onPress={onJumpToAllergies}
          style={[styles.redBanner, { backgroundColor: "#FEE2E2" }]}
        >
          <ShieldAlert size={18} color="#B91C1C" />
          <View style={styles.redBannerText}>
            <AppText variant="body.sm" weight="700" style={{ color: "#7F1D1D" }}>
              {t(
                "records.snapshot.allergyTitle",
                "Severe allergies"
              )}
            </AppText>
            <AppText variant="body.xs" style={{ color: "#7F1D1D" }} numberOfLines={2}>
              {snapshot.redBanner
                .map((a) => `${a.substance}${a.reaction ? ` — ${a.reaction}` : ""}`)
                .join(" • ")}
            </AppText>
          </View>
          <ChevronRight size={16} color="#7F1D1D" />
        </Pressable>
      )}

      {/* ─── Drug allergy warnings — yellow strip ────────────────── */}
      {snapshot.drugAllergyWarnings.length > 0 && (
        <View style={[styles.warningStrip, { backgroundColor: "#FEF3C7" }]}>
          <AlertTriangle size={16} color="#92400E" />
          <AppText
            variant="body.xs"
            style={{ color: "#78350F", flex: 1 }}
            numberOfLines={2}
          >
            {t(
              "records.snapshot.drugAllergyWarning",
              "Drug-allergy match: {{med}} ↔ {{allergen}}",
              {
                med: snapshot.drugAllergyWarnings[0].medicine,
                allergen: snapshot.drugAllergyWarnings[0].allergen,
              }
            )}
            {snapshot.drugAllergyWarnings.length > 1 &&
              ` +${snapshot.drugAllergyWarnings.length - 1}`}
          </AppText>
        </View>
      )}

      {/* ─── Chronic conditions chip row ─────────────────────────── */}
      {snapshot.chronicConditions.length > 0 && (
        <View style={styles.section}>
          <AppText variant="caption" weight="700" color="muted">
            {t("records.snapshot.chronic", "CHRONIC CONDITIONS")}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {snapshot.chronicConditions.slice(0, compact ? 4 : 8).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => onJumpToChronic?.(c.id)}
                style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <AppText variant="body.xs" weight="600">
                  {c.title}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ─── Active medicines — top 3 ───────────────────────────── */}
      {snapshot.activeMedicines.length > 0 && (
        <Pressable onPress={onJumpToMeds} style={styles.section}>
          <View style={styles.sectionHeader}>
            <PillIcon size={14} color={colors.textMuted} />
            <AppText variant="caption" weight="700" color="muted">
              {t(
                "records.snapshot.activeMeds",
                "{{count}} ACTIVE MEDICINES",
                { count: snapshot.activeMedicines.length }
              )}
            </AppText>
          </View>
          {snapshot.activeMedicines.slice(0, 3).map((m) => (
            <View key={m.id} style={styles.medRow}>
              <AppText variant="body.sm" weight="600">
                {m.name}
              </AppText>
              <AppText variant="body.xs" color="muted">
                {[m.dosage, m.frequency].filter(Boolean).join(" • ") || "—"}
              </AppText>
            </View>
          ))}
          {snapshot.activeMedicines.length > 3 && (
            <AppText
              variant="body.xs"
              weight="600"
              style={{ color: colors.primary, marginTop: 4 }}
            >
              {t(
                "records.snapshot.seeAll",
                "See all ({{count}})",
                { count: snapshot.activeMedicines.length }
              )}
              {" →"}
            </AppText>
          )}
        </Pressable>
      )}

      {/* ─── Recent vitals mini-grid ─────────────────────────────── */}
      <Pressable onPress={onJumpToTrends} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Activity size={14} color={colors.textMuted} />
          <AppText variant="caption" weight="700" color="muted">
            {t("records.snapshot.trends", "TRENDS")}
          </AppText>
        </View>
        <View style={styles.vitalsGrid}>
          <VitalTile
            label="BP"
            vital={
              snapshot.recentVitals.bp[0]
                ? {
                    value: snapshot.recentVitals.bp[0].value,
                    secondaryValue: snapshot.recentVitals.bp[0].secondaryValue,
                    unit: "mmHg",
                    points: snapshot.recentVitals.bp
                      .slice()
                      .reverse()
                      .map((v: any) => ({ value: v.value, recordedAt: v.recordedAt })),
                  }
                : null
            }
            icon={<Heart size={14} color="#DC2626" />}
          />
          <VitalTile
            label="HR"
            vital={
              snapshot.recentVitals.hr[0]
                ? {
                    value: snapshot.recentVitals.hr[0].value,
                    secondaryValue: null,
                    unit: snapshot.recentVitals.hr[0].unit ?? "bpm",
                    points: snapshot.recentVitals.hr
                      .slice()
                      .reverse()
                      .map((v: any) => ({ value: v.value, recordedAt: v.recordedAt })),
                  }
                : null
            }
            icon={<Heart size={14} color="#EF4444" />}
          />
          <VitalTile
            label="Glucose"
            vital={
              snapshot.recentVitals.glucose[0]
                ? {
                    value: snapshot.recentVitals.glucose[0].value,
                    secondaryValue: null,
                    unit: snapshot.recentVitals.glucose[0].unit ?? "mg/dL",
                    points: snapshot.recentVitals.glucose
                      .slice()
                      .reverse()
                      .map((v: any) => ({ value: v.value, recordedAt: v.recordedAt })),
                  }
                : null
            }
            icon={<Droplet size={14} color="#7C3AED" />}
          />
          <VitalTile
            label="Weight"
            vital={
              snapshot.recentVitals.weight[0]
                ? {
                    value: snapshot.recentVitals.weight[0].value,
                    secondaryValue: null,
                    unit: snapshot.recentVitals.weight[0].unit ?? "kg",
                    points: snapshot.recentVitals.weight
                      .slice()
                      .reverse()
                      .map((v: any) => ({ value: v.value, recordedAt: v.recordedAt })),
                  }
                : null
            }
            icon={<Scale size={14} color="#0D9488" />}
          />
        </View>
      </Pressable>

      {/* ─── Upcoming follow-ups ────────────────────────────────── */}
      {snapshot.upcomingFollowUps.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={14} color={colors.textMuted} />
            <AppText variant="caption" weight="700" color="muted">
              {t("records.snapshot.followUps", "UPCOMING FOLLOW-UPS")}
            </AppText>
          </View>
          {snapshot.upcomingFollowUps.slice(0, 3).map((f) => (
            <View key={f.id} style={styles.followRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="body.sm" weight="600">
                  {f.title}
                </AppText>
                {!!f.doctorName && (
                  <AppText variant="body.xs" color="muted">
                    {f.doctorName}
                  </AppText>
                )}
              </View>
              {!!f.date && (
                <AppText variant="body.xs" weight="600">
                  {new Date(f.date).toLocaleDateString()}
                </AppText>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Tiny vital tile (sparkline + label) ──────────────────────────

function VitalTile({
  label,
  vital,
  icon,
}: {
  label: string;
  vital: {
    value: number;
    secondaryValue: number | null;
    unit: string;
    points: { value: number; recordedAt: string }[];
  } | null;
  icon: React.ReactNode;
}) {
  const { colors } = useTheme();
  const last = vital;
  const points = vital?.points ?? [];
  return (
    <View style={[styles.vitalTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.vitalTileHeader}>
        {icon}
        <AppText variant="body.xs" weight="700" color="muted">
          {label}
        </AppText>
      </View>
      {last ? (
        <>
          <AppText variant="body.sm" weight="700">
            {Math.round(last.value)}
            {last.secondaryValue != null
              ? `/${Math.round(last.secondaryValue)}`
              : ""}
            <AppText variant="body.xs" color="muted">
              {" "}
              {last.unit}
            </AppText>
          </AppText>
          {points.length > 1 && (
            <Sparkline points={points as any} width={70} height={20} />
          )}
        </>
      ) : (
        <AppText variant="body.xs" color="muted">
          —
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  redBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
  },
  redBannerText: { flex: 1, gap: 2 },
  warningStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
  },
  section: { gap: 6 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  chipRow: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  medRow: { gap: 1 },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  vitalTile: {
    flexBasis: "48%",
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  vitalTileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  followRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 8,
  },
});

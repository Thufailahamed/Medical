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

function formatFrequency(freq: string | null | undefined): string | null {
  if (!freq) return null;
  const cleaned = freq.replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
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
  const { colors, spacing, radius, typography, fontFamily } = useTheme();
  const { t } = useTranslation();

  if (loading && !snapshot) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            padding: spacing.lg,
            borderRadius: radius.xl,
          },
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
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 24,
          padding: spacing.lg,
          gap: spacing.lg,
        },
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
                "records.snapshot.allergiesAlert",
                "{{count}} CRITICAL ALLERGIES DETECTED",
                { count: snapshot.redBanner.length }
              )}
            </AppText>
            <AppText variant="caption" style={{ color: "#991B1B", marginTop: 2 }}>
              {snapshot.redBanner.map((x) => x.substance).join(", ")}
            </AppText>
          </View>
          <ChevronRight size={16} color="#B91C1C" />
        </Pressable>
      )}

      {/* ─── Drug allergy warnings ──────────────────────────────── */}
      {snapshot.drugAllergyWarnings.length > 0 && (
        <View style={[styles.warningStrip, { backgroundColor: "#FEF3C7" }]}>
          <AlertTriangle size={16} color="#D97706" />
          <AppText variant="caption" weight="600" style={{ color: "#92400E", flex: 1 }}>
            {t("records.snapshot.drugWarning", "Potential allergy conflict found")}
          </AppText>
        </View>
      )}

      {/* ─── Chronic conditions ─────────────────────────────────── */}
      {snapshot.chronicConditions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ShieldAlert size={14} color={colors.primary} />
            <AppText
              style={[
                typography.label.xs,
                { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "800", fontFamily: fontFamily.bodyBold },
              ]}
            >
              {t("records.snapshot.conditions", "CHRONIC CONDITIONS")}
            </AppText>
          </View>
          <View style={styles.chipRow}>
            {snapshot.chronicConditions.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => onJumpToChronic?.(c.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.primarySoft,
                    borderColor: "transparent",
                  },
                ]}
              >
                <AppText variant="body.xs" weight="700" style={{ color: colors.primary }}>
                  {c.title}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* ─── Active medicines ───────────────────────────────────── */}
      {snapshot.activeMedicines.length > 0 && (
        <Pressable onPress={onJumpToMeds} style={styles.section}>
          <View style={styles.sectionHeader}>
            <PillIcon size={14} color={colors.primary} />
            <AppText
              style={[
                typography.label.xs,
                { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "800", fontFamily: fontFamily.bodyBold },
              ]}
            >
              {t(
                "records.snapshot.activeMeds",
                "{{count}} ACTIVE MEDICINES",
                { count: snapshot.activeMedicines.length }
              )}
            </AppText>
          </View>
          <View style={{ gap: 8 }}>
            {snapshot.activeMedicines.slice(0, 3).map((m) => (
              <View
                key={m.id}
                style={[
                  styles.medItem,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.medIconWrapper,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <PillIcon size={14} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[typography.body.sm, { fontWeight: "700", color: colors.text }]}>
                    {m.name}
                  </AppText>
                  <AppText style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                    {[m.dosage, formatFrequency(m.frequency)].filter(Boolean).join(" • ") || "—"}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
          {snapshot.activeMedicines.length > 3 && (
            <AppText
              variant="body.xs"
              weight="700"
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
          <Activity size={14} color={colors.primary} />
          <AppText
            style={[
              typography.label.xs,
              { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "800", fontFamily: fontFamily.bodyBold },
            ]}
          >
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
            icon={<Heart size={12} color="#DC2626" />}
            bgColor="#FEE2E2"
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
            icon={<Heart size={12} color="#EF4444" />}
            bgColor="#FFE4E6"
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
            icon={<Droplet size={12} color="#7C3AED" />}
            bgColor="#F3E8FF"
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
            icon={<Scale size={12} color="#0D9488" />}
            bgColor="#CCFBF1"
          />
        </View>
      </Pressable>

      {/* ─── Upcoming follow-ups ────────────────────────────────── */}
      {snapshot.upcomingFollowUps.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={14} color={colors.primary} />
            <AppText
              style={[
                typography.label.xs,
                { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "800", fontFamily: fontFamily.bodyBold },
              ]}
            >
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
  bgColor,
}: {
  label: string;
  vital: {
    value: number;
    secondaryValue: number | null;
    unit: string;
    points: { value: number; recordedAt: string }[];
  } | null;
  icon: React.ReactNode;
  bgColor: string;
}) {
  const { colors, spacing, typography } = useTheme();
  const last = vital;
  const points = vital?.points ?? [];
  return (
    <View
      style={[
        styles.vitalTile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.md,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: bgColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </View>
          <AppText style={[typography.label.xs, { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }]}>
            {label}
          </AppText>
        </View>
      </View>
      {last ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 }}>
          <AppText style={[typography.title.sm, { fontWeight: "800", color: colors.text }]}>
            {Math.round(last.value)}
            {last.secondaryValue != null ? `/${Math.round(last.secondaryValue)}` : ""}
            <AppText style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
              {" "}{last.unit}
            </AppText>
          </AppText>
          {points.length > 1 && (
            <Sparkline points={points as any} width={50} height={16} />
          )}
        </View>
      ) : (
        <AppText style={[typography.caption, { color: colors.textSubtle, fontStyle: "italic", marginTop: 4 }]}>
          No data
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "rgba(0, 0, 0, 0.03)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  redBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  redBannerText: { flex: 1, gap: 2 },
  warningStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipRow: { gap: 6, paddingVertical: 2, flexDirection: "row", flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  medItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  medIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  vitalTile: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  followRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
});

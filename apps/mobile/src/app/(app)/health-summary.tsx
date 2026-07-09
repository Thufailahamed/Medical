// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Share,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Share2,
  FileText,
  User,
  Pill,
  Activity,
  Heart,
  AlertTriangle,
  Calendar,
} from "lucide-react-native";
import { useHealthSummary } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  EmptyState,
  IconButton,
  ErrorState,
  Skeleton,
  useToast,
} from "@/components/ui";

export default function HealthSummaryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const { data, isLoading, isError, refetch, isFetching } = useHealthSummary();

  const summary = data;

  const text = useMemo(() => {
    if (!summary) return "";
    return renderText(t, summary);
  }, [summary, t]);

  async function onShare() {
    try {
      await Share.share({ message: text });
    } catch (e: any) {
      toast.show({ message: e?.message || t("healthSummary.shareFailed"), tone: "danger" });
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("healthSummary.title")}
        subtitle={t("healthSummary.subtitle")}
        onBack={() => router.back()}
        right={
          <IconButton
            icon={Share2}
            onPress={onShare}
            accessibilityLabel={t("healthSummary.a11yShare")}
          />
        }
      />

      {isLoading ? (
        <View
          style={{
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <Skeleton width="40%" height={24} radius={8} />
          <Skeleton width="100%" height={120} radius={16} />
          <Skeleton width="100%" height={120} radius={16} />
          <Skeleton width="100%" height={120} radius={16} />
          <Skeleton width="100%" height={120} radius={16} />
          <Skeleton width="100%" height={120} radius={16} />
        </View>
      ) : isError ? (
        <ErrorState
          title={t("common.errorTitle")}
          message={t("common.errorLoad")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : !summary ? (
        <EmptyState
          icon={FileText}
          title={t("healthSummary.emptyTitle")}
          message={t("healthSummary.emptyBody")}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Demographics */}
          <Card>
            <SectionHeader icon={User} title={t("healthSummary.sections.about")} />
            <Row label={t("healthSummary.rows.name")} value={summary.demographics.name} />
            <Row
              label={t("healthSummary.rows.age")}
              value={
                summary.demographics.age != null
                  ? `${summary.demographics.age}`
                  : null
              }
            />
            <Row label={t("healthSummary.rows.sex")} value={summary.demographics.sex} />
            <Row label={t("healthSummary.rows.bloodGroup")} value={summary.demographics.bloodGroup} />
            <Row
              label={t("healthSummary.rows.heightWeight")}
              value={
                summary.demographics.heightCm || summary.demographics.weightKg
                  ? t("healthSummary.heightWeightValue", {
                      height: summary.demographics.heightCm ?? "—",
                      weight: summary.demographics.weightKg ?? "—",
                    })
                  : null
              }
            />
            <Row
              label={t("healthSummary.rows.bmi")}
              value={
                summary.demographics.bmi != null
                  ? String(summary.demographics.bmi)
                  : null
              }
            />
          </Card>

          {/* Allergies */}
          <Card>
            <SectionHeader
              icon={AlertTriangle}
              title={t("healthSummary.sections.allergies")}
              tone="danger"
              count={summary.allergies.length}
            />
            {summary.allergies.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                {t("healthSummary.allergiesEmpty")}
              </Text>
            ) : (
              summary.allergies.map((a, i) => (
                <View
                  key={i}
                  style={{
                    paddingVertical: 6,
                    borderBottomWidth:
                      i < summary.allergies.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text
                    style={[
                      typography.body.md,
                      { color: colors.text, fontWeight: "600" },
                    ]}
                  >
                    {a.substance}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted },
                    ]}
                  >
                    {a.reaction
                      ? t("healthSummary.severityReaction", {
                          severity: a.severity,
                          reaction: a.reaction,
                        })
                      : a.severity}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {/* Conditions */}
          <Card>
            <SectionHeader
              icon={Heart}
              title={t("healthSummary.sections.conditions")}
              count={summary.conditions.length}
            />
            {summary.conditions.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                {t("healthSummary.conditionsEmpty")}
              </Text>
            ) : (
              summary.conditions.map((c, i) => (
                <View key={i} style={{ paddingVertical: 4 }}>
                  <Text style={[typography.body.md, { color: colors.text }]}>
                    {c.title}
                  </Text>
                  {c.diagnosedOn && (
                    <Text
                      style={[typography.caption, { color: colors.textMuted }]}
                    >
                      {c.diagnosedOn}
                    </Text>
                  )}
                </View>
              ))
            )}
          </Card>

          {/* Medicines */}
          <Card>
            <SectionHeader
              icon={Pill}
              title={t("healthSummary.sections.activeMedicines")}
              count={summary.activeMedicines.length}
            />
            {summary.activeMedicines.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                {t("healthSummary.medicinesEmpty")}
              </Text>
            ) : (
              summary.activeMedicines.map((m, i) => (
                <View
                  key={i}
                  style={{
                    paddingVertical: 4,
                    flexDirection: "row",
                    gap: spacing.xs,
                  }}
                >
                  <Text
                    style={[typography.body.md, { color: colors.text, flex: 1 }]}
                  >
                    {m.name}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                  >
                    {[m.dosage, m.frequency].filter(Boolean).join(" • ")}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {/* Vitals */}
          <Card>
            <SectionHeader
              icon={Activity}
              title={t("healthSummary.sections.vitals")}
            />
            {summary.recentVitals.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                {t("healthSummary.vitalsEmpty")}
              </Text>
            ) : (
              summary.recentVitals.map((v, i) => (
                <View
                  key={i}
                  style={{
                    paddingVertical: 4,
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={[typography.body.md, { color: colors.text }]}>
                    {v.type.replace(/_/g, " ")}
                  </Text>
                  <Text
                    style={[typography.body.sm, { color: colors.textMuted }]}
                  >
                    {v.latest
                      ? `${v.latest.value}${v.latest.secondary != null ? "/" + v.latest.secondary : ""} ${v.latest.unit || ""}`
                      : "—"}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {/* Follow-ups */}
          <Card>
            <SectionHeader
              icon={Calendar}
              title={t("healthSummary.sections.followUps")}
              count={summary.followUps.length}
            />
            {summary.followUps.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                {t("healthSummary.followUpsEmpty")}
              </Text>
            ) : (
              summary.followUps.map((f, i) => (
                <View key={i} style={{ paddingVertical: 4 }}>
                  <Text style={[typography.body.md, { color: colors.text }]}>
                    {f.title}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                  >
                    {f.scheduledAt}
                    {f.provider ? " • " + f.provider : ""}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {/* Text preview */}
          <Card>
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, marginBottom: 4 },
              ]}
            >
              {t("healthSummary.plainText")}
            </Text>
            <Text
              selectable
              style={[
                typography.body.sm,
                {
                  color: colors.text,
                  fontFamily: "Courier",
                  lineHeight: 20,
                },
              ]}
            >
              {text}
            </Text>
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  tone,
  count,
}: {
  icon: any;
  title: string;
  tone?: "primary" | "danger" | "info";
  count?: number;
}) {
  const { spacing, colors, typography } = useTheme();
  const fg =
    tone === "danger"
      ? colors.danger
      : tone === "info"
      ? colors.info
      : colors.primary;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: spacing.sm,
      }}
    >
      <Icon size={18} color={fg} strokeWidth={2.25} />
      <Text
        style={[
          typography.title.sm,
          { color: colors.text, fontWeight: "800", flex: 1 },
        ]}
      >
        {title}
      </Text>
      {typeof count === "number" && (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {count}
        </Text>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const { spacing, colors, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 4,
        gap: spacing.sm,
      }}
    >
      <Text style={[typography.body.sm, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[
          typography.body.md,
          {
            color: colors.text,
            fontWeight: "600",
            textAlign: "right",
            flexShrink: 1,
          },
        ]}
        numberOfLines={1}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

function renderText(t: (k: string, opts?: any) => string, s: any): string {
  const lines: string[] = [];
  lines.push(t("healthSummary.plainTitle"));
  lines.push(t("healthSummary.plainGenerated", { when: s.generatedAt }));
  lines.push("");
  const d = s.demographics;
  if (d.name)
    lines.push(t("healthSummary.plainPatient", { name: d.name }));
  const demo = [
    d.age != null ? t("healthSummary.plainAge", { age: d.age }) : null,
    d.sex,
    d.bloodGroup ? t("healthSummary.plainBlood", { group: d.bloodGroup }) : null,
    d.heightCm ? t("healthSummary.plainCm", { n: d.heightCm }) : null,
    d.weightKg ? t("healthSummary.plainKg", { n: d.weightKg }) : null,
    d.bmi ? t("healthSummary.plainBmi", { n: d.bmi }) : null,
  ]
    .filter(Boolean)
    .join(" • ");
  if (demo) lines.push(demo);
  lines.push("");
  lines.push(t("healthSummary.plainAllergiesTitle"));
  if (s.allergies.length === 0) lines.push(t("healthSummary.plainAllergiesNone"));
  for (const a of s.allergies)
    lines.push(
      a.reaction
        ? t("healthSummary.plainAllergyRowReaction", {
            substance: a.substance,
            severity: a.severity,
            reaction: a.reaction,
          })
        : t("healthSummary.plainAllergyRow", {
            substance: a.substance,
            severity: a.severity,
          })
    );
  lines.push("");
  lines.push(t("healthSummary.plainConditionsTitle"));
  if (s.conditions.length === 0)
    lines.push(t("healthSummary.plainConditionsNone"));
  for (const c of s.conditions)
    lines.push(
      c.diagnosedOn
        ? t("healthSummary.plainConditionRowDate", {
            title: c.title,
            date: c.diagnosedOn,
          })
        : t("healthSummary.plainConditionRow", { title: c.title })
    );
  lines.push("");
  lines.push(t("healthSummary.plainMedsTitle"));
  if (s.activeMedicines.length === 0) lines.push(t("healthSummary.plainMedsNone"));
  for (const m of s.activeMedicines) {
    if (m.dosage && m.frequency)
      lines.push(
        t("healthSummary.plainMedRowAll", {
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
        })
      );
    else if (m.dosage)
      lines.push(
        t("healthSummary.plainMedRowDosage", { name: m.name, dosage: m.dosage })
      );
    else lines.push(t("healthSummary.plainMedRow", { name: m.name }));
  }
  lines.push("");
  lines.push(t("healthSummary.plainVitalsTitle"));
  if (s.recentVitals.length === 0) lines.push(t("healthSummary.plainVitalsNone"));
  for (const v of s.recentVitals) {
    const l = v.latest;
    if (!l) continue;
    lines.push(
      t("healthSummary.plainVitalRow", {
        type: v.type.replace(/_/g, " "),
        value: l.value,
        secondary: l.secondary != null ? "/" + l.secondary : "",
        unit: l.unit || "",
      })
    );
  }
  lines.push("");
  lines.push(t("healthSummary.plainFollowUpsTitle"));
  if (s.followUps.length === 0)
    lines.push(t("healthSummary.plainFollowUpsNone"));
  for (const f of s.followUps)
    lines.push(
      f.provider
        ? t("healthSummary.plainFollowUpRowProvider", {
            title: f.title,
            when: f.scheduledAt,
            provider: f.provider,
          })
        : t("healthSummary.plainFollowUpRow", {
            title: f.title,
            when: f.scheduledAt,
          })
    );
  return lines.join("\n");
}
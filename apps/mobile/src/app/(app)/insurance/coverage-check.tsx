// @ts-nocheck
// Pre-treatment coverage check. Procedure + hospital → out-of-pocket estimate.

import { useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Chip,
  ChipGroup,
  SectionHeader,
  Pill,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useCoverageCheck, useMyInsuranceEnrollments } from "@/hooks/useApi";

const TREATMENT_TYPES = [
  "hospitalization",
  "day_care",
  "opd",
  "dental",
  "diagnostic",
  "maternity",
];

export default function CoverageCheck() {
  const { t } = useTranslation();
  const { colors, typography, radius } = useTheme();
  const fieldStyle = {
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    borderCurve: "continuous" as const,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.text,
    ...typography.body.md,
  };
  const [enrollmentId, setEnrollmentId] = useState("");
  const [treatmentType, setTreatmentType] = useState("hospitalization");
  const [hospital, setHospital] = useState("");
  const [estimated, setEstimated] = useState("");

  const enrollmentsQ = useMyInsuranceEnrollments();
  const activeEnrollments =
    enrollmentsQ.data?.enrollments?.filter((e) => e.status === "active") ?? [];
  const effectiveEnrollmentId =
    enrollmentId || activeEnrollments[0]?.id || "";

  const mut = useCoverageCheck();

  const onCheck = async () => {
    if (!estimated || !effectiveEnrollmentId) return;
    await mut.mutateAsync({
      enrollmentId: effectiveEnrollmentId,
      treatmentType,
      estimatedAmountLkr: Number(estimated),
      hospitalName: hospital || undefined,
    });
  };

  const result = mut.data;

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.coverage.title")}
        subtitle={t("insurance.coverage.subtitle")}
        kicker={t("insurance.coverage.kicker")}
      />

      <ScrollView contentContainerStyle={{ paddingVertical: 12, gap: 16, paddingBottom: 40 }}>
        <SectionHeader title={t("insurance.coverage.planned")} />
        <Card style={{ padding: 20, gap: 18 }}>
          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.coverage.policy", "Policy")}
            </AppText>
            <ChipGroup>
              {activeEnrollments.map((e) => (
                <Chip
                  key={e.id}
                  label={e.planName || e.policyNumber || e.id.slice(0, 8)}
                  selected={effectiveEnrollmentId === e.id}
                  onPress={() => setEnrollmentId(e.id)}
                />
              ))}
            </ChipGroup>
            {activeEnrollments.length === 0 ? (
              <AppText size="xs" color="muted">
                {t("insurance.coverage.noPolicy", "No active policy found.")}
              </AppText>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.coverage.procedure")}
            </AppText>
            <ChipGroup>
              {TREATMENT_TYPES.map((p) => (
                <Chip
                  key={p}
                  label={t(`insurance.coverage.procedures.${p}`, p)}
                  selected={treatmentType === p}
                  onPress={() => setTreatmentType(p)}
                />
              ))}
            </ChipGroup>
          </View>

          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.coverage.hospital")}
            </AppText>
            <TextInput
              value={hospital}
              onChangeText={setHospital}
              placeholder={t("insurance.coverage.hospitalPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={fieldStyle}
            />
          </View>

          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.coverage.estimatedAmount")}
            </AppText>
            <TextInput
              value={estimated}
              onChangeText={setEstimated}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSubtle}
              style={{ ...fieldStyle, ...typography.title.md, color: colors.text }}
            />
          </View>

          <Button
            label={t("insurance.coverage.check")}
            icon={Activity}
            onPress={onCheck}
            loading={mut.isPending}
            disabled={!estimated || !effectiveEnrollmentId}
          />
        </Card>

        {result ? (
          <Card
            style={{
              padding: 20,
              gap: 12,
              backgroundColor: result.covered
                ? colors.surface
                : colors.dangerSoft,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: result.covered ? colors.accentSoft : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {result.covered ? (
                  <CheckCircle2 size={18} color={colors.accent} strokeWidth={2.3} />
                ) : (
                  <AlertCircle size={18} color={colors.danger} strokeWidth={2.3} />
                )}
              </View>
              <AppText weight="700" size="md">
                {result.covered
                  ? t("insurance.coverage.coveredTitle")
                  : t("insurance.coverage.notCoveredTitle")}
              </AppText>
            </View>
            <Pill tone={result.covered ? "accent" : "danger"}>
              {t(`insurance.coverage.procedures.${treatmentType}`, treatmentType)}
            </Pill>
            {result.planName ? (
              <AppText size="xs" color="muted">
                {result.planName} · {result.coverageType ?? ""}
              </AppText>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                backgroundColor: result.covered ? colors.surfaceMuted : colors.surface,
                borderRadius: 16,
                borderCurve: "continuous",
                padding: 14,
              }}
            >
              <View style={{ flex: 1 }}>
                <AppText size="xs" color="subtle">
                  {t("insurance.coverage.outOfPocket")}
                </AppText>
                <AppText weight="700" size="xl" style={{ color: colors.danger, marginTop: 2 }}>
                  LKR {result.estimatedOutOfPocketLkr.toLocaleString()}
                </AppText>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <AppText size="xs" color="subtle">
                  Copay {result.copayPct}% · Deductible
                </AppText>
                <AppText weight="700" size="lg" style={{ color: colors.accent, marginTop: 4 }}>
                  LKR {result.deductibleLkr.toLocaleString()}
                </AppText>
              </View>
            </View>
            {!result.enrolled ? (
              <Pill tone="neutral">
                {t("insurance.coverage.notEnrolled", "Not enrolled")}
              </Pill>
            ) : null}
            {result.notes?.length ? (
              <AppText size="sm" color="muted">
                {result.notes.join(" ")}
              </AppText>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// Theme-aware text used by this screen: maps the terse size/weight/color
// props onto typography tokens + theme colours so text stays legible in dark
// mode (the shared AppText hard-codes light-mode hex colours).
function AppText({
  size,
  weight,
  color,
  style,
  ...rest
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  weight?: string;
  color?: "muted" | "subtle" | "primary" | "accent" | "danger" | "text";
  style?: any;
  [key: string]: any;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const tone =
    color === "muted"
      ? colors.textMuted
      : color === "subtle"
        ? colors.textSubtle
        : color === "primary"
          ? colors.primary
          : color === "accent"
            ? colors.accent
            : color === "danger"
              ? colors.danger
              : colors.text;
  const bold = weight === "700" || weight === "800" || weight === "900" || weight === "bold";
  const semi = weight === "600" || weight === "500";
  const base =
    size === "2xl"
      ? typography.display.md
      : size === "xl"
        ? typography.display.sm
        : size === "lg"
          ? bold
            ? typography.title.lg
            : typography.body.lg
          : size === "md"
            ? bold
              ? typography.title.md
              : typography.body.md
            : size === "xs"
              ? typography.caption
              : bold
                ? typography.title.xs
                : typography.body.sm;
  const family = bold
    ? size === "xl" || size === "2xl" || size === "lg" || size === "md"
      ? base.fontFamily
      : fontFamily.bodyBold
    : semi
      ? fontFamily.bodySemibold
      : base.fontFamily;
  return (
    <Text
      {...rest}
      style={[{ ...base, fontFamily: family, color: tone }, style]}
    />
  );
}

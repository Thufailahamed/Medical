// @ts-nocheck
// Pre-treatment coverage check. Procedure + hospital → out-of-pocket estimate.

import { useState } from "react";
import { View, Text, ScrollView, TextInput, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { Activity, AlertCircle, Building2, CheckCircle2, Info } from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  SectionHeader,
  Pill,
  IconTile,
  Pressable,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useCoverageCheck, useMyInsuranceEnrollments } from "@/hooks/useApi";
import { PolicyPicker, TreatmentGrid, formatLkr } from "@/components/insurance/ClaimFormParts";

const QUICK_AMOUNTS = [25000, 50000, 100000, 250000];

export default function CoverageCheck() {
  const { t } = useTranslation();
  const { colors, typography, radius, shadow } = useTheme();
  const [enrollmentId, setEnrollmentId] = useState("");
  const [treatmentType, setTreatmentType] = useState("hospitalization");
  const [hospital, setHospital] = useState("");
  const [estimated, setEstimated] = useState("");

  const enrollmentsQ = useMyInsuranceEnrollments();
  const activeEnrollments =
    enrollmentsQ.data?.enrollments?.filter((e) => e.status === "active") ?? [];
  const effectiveEnrollmentId =
    enrollmentId || activeEnrollments[0]?.id || "";
  const noPolicy = !enrollmentsQ.isLoading && activeEnrollments.length === 0;

  const mut = useCoverageCheck();
  const amount = Number(estimated) || 0;
  const canCheck = amount > 0 && !!effectiveEnrollmentId;

  const onCheck = async () => {
    if (!canCheck) return;
    await mut.mutateAsync({
      enrollmentId: effectiveEnrollmentId,
      treatmentType,
      estimatedAmountLkr: amount,
      hospitalName: hospital || undefined,
    });
  };

  const onAmountChange = (text: string) => {
    setEstimated(text.replace(/[^0-9]/g, "").slice(0, 10));
  };

  const result = mut.data;
  const fieldShell = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    borderCurve: "continuous" as const,
    paddingHorizontal: 14,
    minHeight: 52,
  };

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.coverage.title")}
        subtitle={t("insurance.coverage.subtitle")}
        kicker={t("insurance.coverage.kicker")}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* ── Policy ─────────────────────────────────────────── */}
        <SectionHeader
          kicker={t("insurance.coverage.step", { n: 1, defaultValue: "Step {{n}}" })}
          title={t("insurance.coverage.policy", "Policy")}
        />
        <PolicyPicker
          enrollments={activeEnrollments}
          selectedId={effectiveEnrollmentId}
          onSelect={setEnrollmentId}
          loading={enrollmentsQ.isLoading}
          emptyMessage={t("insurance.coverage.noPolicy", "You need an active policy to use this tool.")}
        />

        {/* ── Procedure ──────────────────────────────────────── */}
        <SectionHeader
          kicker={t("insurance.coverage.step", { n: 2, defaultValue: "Step {{n}}" })}
          title={t("insurance.coverage.procedure")}
        />
        <TreatmentGrid
          value={treatmentType}
          onChange={setTreatmentType}
          labelFor={(k) => t(`insurance.coverage.procedures.${k}`, k)}
        />

        {/* ── Details ────────────────────────────────────────── */}
        <SectionHeader
          kicker={t("insurance.coverage.step", { n: 3, defaultValue: "Step {{n}}" })}
          title={t("insurance.coverage.details", "Treatment details")}
        />
        <Card style={{ padding: 18, gap: 18 }}>
          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.coverage.estimatedAmount")}
            </AppText>
            <View style={[fieldShell, { minHeight: 64 }]}>
              <AppText weight="700" size="md" color="subtle">
                LKR
              </AppText>
              <TextInput
                value={estimated ? formatLkr(amount) : ""}
                onChangeText={onAmountChange}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textSubtle}
                style={{ flex: 1, ...typography.display.sm, color: colors.text, paddingVertical: 0 }}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {QUICK_AMOUNTS.map((q) => {
                const selected = amount === q;
                return (
                  <Pressable
                    key={q}
                    haptic="light"
                    onPress={() => setEstimated(String(q))}
                    wrapperStyle={{ flex: 1 }}
                    style={{
                      alignItems: "center",
                      paddingVertical: 8,
                      borderRadius: radius.pill,
                      backgroundColor: selected ? colors.primary : colors.well,
                    }}
                  >
                    <AppText
                      size="xs"
                      weight="600"
                      style={{ color: selected ? "#FFFFFF" : colors.textMuted }}
                    >
                      {q >= 1000 ? `${q / 1000}K` : q}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />

          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.coverage.hospital")}
            </AppText>
            <View style={fieldShell}>
              <Building2 size={18} color={colors.textSubtle} strokeWidth={2} />
              <TextInput
                value={hospital}
                onChangeText={setHospital}
                placeholder={t("insurance.coverage.hospitalPlaceholder")}
                placeholderTextColor={colors.textSubtle}
                style={{ flex: 1, ...typography.body.md, color: colors.text, paddingVertical: 0 }}
              />
            </View>
          </View>
        </Card>

        <Button
          title={t("insurance.coverage.check")}
          icon={Activity}
          size="lg"
          fullWidth
          onPress={onCheck}
          loading={mut.isPending}
          disabled={!canCheck}
          style={{ marginTop: 20 }}
        />
        {!canCheck && !noPolicy ? (
          <AppText size="xs" color="subtle" style={{ textAlign: "center", marginTop: 10 }}>
            {t("insurance.coverage.enterAmountHint", "Enter an estimated bill to see your share.")}
          </AppText>
        ) : null}

        {/* ── Result ─────────────────────────────────────────── */}
        {result ? <ResultCard result={result} amount={amount} treatmentType={treatmentType} /> : null}
      </ScrollView>
    </Screen>
  );
}

function ResultCard({ result, amount, treatmentType }) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const covered = !!result.covered;
  const bill = amount || 0;
  const youPay = Math.max(0, Math.min(bill || Infinity, result.estimatedOutOfPocketLkr ?? 0));
  const insurerPays = Math.max(0, bill - youPay);
  const insurerShare = bill > 0 ? insurerPays / bill : 0;

  return (
    <View style={{ marginTop: 8 }}>
      <SectionHeader
        kicker={t("insurance.coverage.resultKicker", "Estimate")}
        title={t("insurance.coverage.resultTitle", "Your coverage")}
      />
      <Card variant="elevated" style={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconTile
            icon={covered ? CheckCircle2 : AlertCircle}
            tone={covered ? "accent" : "danger"}
            size={44}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText weight="700" size="lg">
              {covered
                ? t("insurance.coverage.coveredTitle")
                : t("insurance.coverage.notCoveredTitle")}
            </AppText>
            {result.planName ? (
              <AppText size="xs" color="muted" numberOfLines={1}>
                {result.planName}
                {result.coverageType ? ` · ${result.coverageType}` : ""}
              </AppText>
            ) : null}
          </View>
          <Pill tone={covered ? "accent" : "danger"}>
            {t(`insurance.coverage.procedures.${treatmentType}`, treatmentType)}
          </Pill>
        </View>

        <View
          style={{
            backgroundColor: covered ? colors.accentSoft : colors.dangerSoft,
            borderRadius: radius.card,
            borderCurve: "continuous",
            padding: 16,
            gap: 4,
          }}
        >
          <AppText size="xs" weight="600" color="muted">
            {t("insurance.coverage.outOfPocket")}
          </AppText>
          <AppText weight="700" size="2xl" style={{ color: covered ? colors.accentMuted : colors.danger }}>
            LKR {formatLkr(result.estimatedOutOfPocketLkr)}
          </AppText>
          {bill > 0 ? (
            <AppText size="xs" color="muted">
              {t("insurance.coverage.ofBill", {
                amount: formatLkr(bill),
                defaultValue: "of an estimated LKR {{amount}} bill",
              })}
            </AppText>
          ) : null}
        </View>

        {bill > 0 ? (
          <View style={{ gap: 8 }}>
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.dangerSoft,
                overflow: "hidden",
                flexDirection: "row",
              }}
            >
              <View style={{ flex: insurerShare, backgroundColor: colors.accent }} />
              <View style={{ flex: 1 - insurerShare, backgroundColor: colors.danger, opacity: 0.55 }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Legend color={colors.accent} label={t("insurance.coverage.insurerPays", "Insurer pays")} value={insurerPays} />
              <Legend color={colors.danger} label={t("insurance.coverage.youPay", "You pay")} value={youPay} align="right" />
            </View>
          </View>
        ) : null}

        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />

        <View style={{ flexDirection: "row" }}>
          <Stat label={t("insurance.coverage.copay", "Co-pay")} value={`${result.copayPct ?? 0}%`} />
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
          <Stat
            label={t("insurance.coverage.deductible", "Deductible")}
            value={`LKR ${formatLkr(result.deductibleLkr)}`}
          />
        </View>

        {!result.enrolled ? (
          <Pill tone="neutral">{t("insurance.coverage.notEnrolled", "Not enrolled")}</Pill>
        ) : null}

        {result.notes?.length ? (
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              backgroundColor: colors.well,
              borderRadius: radius.field,
              borderCurve: "continuous",
              padding: 12,
            }}
          >
            <Info size={16} color={colors.textMuted} strokeWidth={2.2} style={{ marginTop: 2 }} />
            <AppText size="sm" color="muted" style={{ flex: 1 }}>
              {result.notes.join(" ")}
            </AppText>
          </View>
        ) : null}

        <AppText size="xs" color="subtle">
          {t(
            "insurance.coverage.disclaimer",
            "Estimate only — the final amount is confirmed when your claim is assessed.",
          )}
        </AppText>
      </Card>
    </View>
  );
}

function Legend({ color, label, value, align = "left" }) {
  return (
    <View style={{ gap: 2, alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <AppText size="xs" color="muted">
          {label}
        </AppText>
      </View>
      <AppText weight="700" size="sm">
        LKR {formatLkr(value)}
      </AppText>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <AppText size="xs" color="subtle">
        {label}
      </AppText>
      <AppText weight="700" size="md">
        {value}
      </AppText>
    </View>
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

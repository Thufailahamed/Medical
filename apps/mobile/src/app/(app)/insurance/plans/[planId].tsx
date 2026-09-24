// @ts-nocheck
// Insurance plan detail. Coverage table + buy CTA + monthly/annual toggle.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from "react-native";
import { insurancePlanImage } from "@/components/insurance/PlanCard";
import { useTranslation } from "react-i18next";
import {
  Check,
  X,
  ShieldCheck,
  HeartPulse,
  Clock,
  Wallet,
  Users,
} from "lucide-react-native";
import { useInsurancePlan } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  Skeleton,
  EmptyState,
  SectionHeader,
  Chip,
  ChipGroup,
} from "@/components/ui";
import { AppText } from "@/components/ui/AppText";
import { useInsuranceStore } from "@/stores/insurance-store";

export default function PlanDetail() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, typography, radius, shadow, scheme } = useTheme();
  const { data, isLoading } = useInsurancePlan(planId ?? "");
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");
  const setPlan = useInsuranceStore((s) => s.setPlan);
  const setBillingCycle = useInsuranceStore((s) => s.setBillingCycle);

  const plan = data?.plan;
  const coverage = (data?.coverageDetailsJson ?? {}) as Record<string, unknown>;

  const rows = useMemo(() => {
    if (!plan) return [];
    return [
      {
        icon: <Wallet size={16} color={colors.primary} strokeWidth={2.3} />,
        label: t("insurance.plan.coverageLabel", {
          amount: plan.coverageSummaryLkr.toLocaleString(),
        }),
      },
      {
        icon: <HeartPulse size={16} color={colors.primary} strokeWidth={2.3} />,
        label: t("insurance.plan.copayPct", { pct: plan.copayPct }),
      },
      {
        icon: <ShieldCheck size={16} color={colors.primary} strokeWidth={2.3} />,
        label: t("insurance.plan.deductibleLabel", {
          amount: plan.deductibleLkr.toLocaleString(),
        }),
      },
      {
        icon: <Clock size={16} color={colors.primary} strokeWidth={2.3} />,
        label: t("insurance.plan.waiting", { days: plan.waitingPeriodDays }),
      },
      {
        icon: <Users size={16} color={colors.primary} strokeWidth={2.3} />,
        label: t("insurance.plan.networks", { count: plan.networkHospitalCount }),
      },
    ];
  }, [plan, colors.primary, t]);

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={200} radius={radius.card} />
          <Skeleton height={240} radius={radius.card} />
          <Skeleton height={120} radius={radius.card} />
        </View>
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16 }}>
          <EmptyState title={t("insurance.plan.notFound")} />
        </View>
      </Screen>
    );
  }

  const onBuy = () => {
    setPlan({ id: plan.id, name: plan.name, monthlyPremiumLkr: plan.monthlyPremiumLkr, annualPremiumLkr: plan.annualPremiumLkr });
    setBillingCycle(cycle);
    router.push("/insurance/quote");
  };

  const listRow = (i: number) => ({
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  });
  const rowText = { ...typography.body.md, color: colors.text, flex: 1 };

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={plan.name}
        subtitle={plan.providerName ?? t("insurance.provider.label")}
        kicker={t(`insurance.planTypes.${plan.planType}`)}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ margin: 16, marginTop: 8, padding: 20, gap: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                <Pill tone="primary">{t(`insurance.planTypes.${plan.planType}`)}</Pill>
                {plan.isFeatured ? <Pill tone="accent">Featured</Pill> : null}
              </View>

              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, flexWrap: "wrap" }}>
                <Text style={{ ...typography.display.md, color: colors.text }}>
                  <Text style={{ ...typography.title.sm, color: colors.textMuted }}>
                    LKR{" "}
                  </Text>
                  {(cycle === "monthly"
                    ? plan.monthlyPremiumLkr
                    : plan.annualPremiumLkr
                  ).toLocaleString()}
                </Text>
                <Text style={{ ...typography.label.md, color: colors.textMuted, paddingBottom: 5 }}>
                  / {cycle === "monthly" ? "month" : "year"}
                </Text>
              </View>
            </View>

            {insurancePlanImage(plan.planType) ? (
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 20,
                  borderCurve: "continuous",
                  overflow: "hidden",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.separator,
                  backgroundColor: colors.surfaceMuted,
                  flexShrink: 0,
                }}
              >
                <Image
                  source={insurancePlanImage(plan.planType)}
                  resizeMode="cover"
                  style={{ width: "100%", height: "100%" }}
                />
              </View>
            ) : null}
          </View>

          {plan.annualDiscountPct > 0 ? (
            <Text
              style={{
                ...typography.label.sm,
                color: colors.success,
                alignSelf: "flex-start",
                backgroundColor: colors.successSoft,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                overflow: "hidden",
                marginTop: -4,
              }}
            >
              {t("insurance.plan.save", { pct: plan.annualDiscountPct.toFixed(0) })}
            </Text>
          ) : null}

          {/* Billing cycle — segmented control */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.fill,
              borderRadius: 12,
              borderCurve: "continuous",
              padding: 3,
            }}
          >
            {[
              {
                key: "monthly",
                label: t("insurance.plan.monthly", {
                  amount: plan.monthlyPremiumLkr.toLocaleString(),
                }),
                onPress: () => setCycle("monthly"),
              },
              {
                key: "annual",
                label: t("insurance.plan.annual", {
                  amount: plan.annualPremiumLkr.toLocaleString(),
                }),
                onPress: () => setCycle("annual"),
              },
            ].map((seg) => {
              const selected = cycle === seg.key;
              return (
                <Pressable
                  key={seg.key}
                  onPress={seg.onPress}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{
                    flex: 1,
                    minHeight: 38,
                    paddingHorizontal: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: selected ? colors.surface : "transparent",
                    ...(selected && scheme !== "dark" ? shadow.xs : {}),
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{
                      ...(selected ? typography.label.md : typography.body.sm),
                      color: selected ? colors.text : colors.textMuted,
                    }}
                  >
                    {seg.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <SectionHeader
          title={t("insurance.plan.coverage")}
          style={{ paddingHorizontal: 16, paddingTop: 8 }}
        />
        <Card style={{ marginHorizontal: 16, paddingVertical: 4, paddingHorizontal: 16 }}>
          {rows.map((r, i) => (
            <View key={i} style={listRow(i)}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {r.icon}
              </View>
              <Text style={rowText}>{r.label}</Text>
            </View>
          ))}
        </Card>

        {Array.isArray(plan.keyFeatures) && plan.keyFeatures.length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.plan.features")}
              style={{ paddingHorizontal: 16, paddingTop: 24 }}
            />
            <Card style={{ marginHorizontal: 16, paddingVertical: 4, paddingHorizontal: 16 }}>
              {plan.keyFeatures.map((f: string, i: number) => (
                <View key={i} style={{ ...listRow(i), minHeight: 46 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.successSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={13} color={colors.success} strokeWidth={3} />
                  </View>
                  <Text style={rowText}>{f}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {Array.isArray(plan.exclusions) && plan.exclusions.length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.plan.exclusions")}
              style={{ paddingHorizontal: 16, paddingTop: 24 }}
            />
            <Card style={{ marginHorizontal: 16, paddingVertical: 4, paddingHorizontal: 16 }}>
              {plan.exclusions.map((x: string, i: number) => (
                <View key={i} style={{ ...listRow(i), minHeight: 46 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.dangerSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={13} color={colors.danger} strokeWidth={3} />
                  </View>
                  <Text style={{ ...rowText, color: colors.textMuted }}>{x}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {coverage && Object.keys(coverage).length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.plan.details")}
              style={{ paddingHorizontal: 16, paddingTop: 24 }}
            />
            <Card style={{ marginHorizontal: 16, paddingVertical: 4, paddingHorizontal: 16 }}>
              {Object.entries(coverage).map(([k, v], i) => (
                <View
                  key={k}
                  style={{
                    paddingVertical: 12,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                  }}
                >
                  <Text style={{ ...typography.caption, color: colors.textSubtle }}>
                    {k}
                  </Text>
                  <Text style={{ ...typography.body.md, color: colors.text, marginTop: 2 }}>
                    {String(v)}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 28,
          backgroundColor: colors.bgElevated ?? colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <Button
          label={t("insurance.plan.getQuote")}
          onPress={onBuy}
          size="lg"
          style={{ width: "100%" }}
        />
      </View>
    </Screen>
  );
}

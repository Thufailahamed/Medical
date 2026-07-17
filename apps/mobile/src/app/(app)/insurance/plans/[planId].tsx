// @ts-nocheck
// Insurance plan detail. Coverage table + buy CTA + monthly/annual toggle.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View, ScrollView } from "react-native";
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
  const { colors } = useTheme();
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
        icon: <Wallet size={16} color={colors.primary} />,
        label: t("insurance.plan.coverageLabel", {
          amount: plan.coverageSummaryLkr.toLocaleString(),
        }),
      },
      {
        icon: <HeartPulse size={16} color={colors.primary} />,
        label: t("insurance.plan.copayPct", { pct: plan.copayPct }),
      },
      {
        icon: <ShieldCheck size={16} color={colors.primary} />,
        label: t("insurance.plan.deductibleLabel", {
          amount: plan.deductibleLkr.toLocaleString(),
        }),
      },
      {
        icon: <Clock size={16} color={colors.primary} />,
        label: t("insurance.plan.waiting", { days: plan.waitingPeriodDays }),
      },
      {
        icon: <Users size={16} color={colors.primary} />,
        label: t("insurance.plan.networks", { count: plan.networkHospitalCount }),
      },
    ];
  }, [plan, colors.primary, t]);

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={160} radius={16} />
          <Skeleton height={120} radius={16} />
          <Skeleton height={120} radius={16} />
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

  return (
    <Screen>
      <ScreenHeader
        title={plan.name}
        subtitle={plan.providerName ?? t("insurance.provider.label")}
        kicker={t(`insurance.planTypes.${plan.planType}`)}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ margin: 16, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill tone="primary">{t(`insurance.planTypes.${plan.planType}`)}</Pill>
            {plan.isFeatured ? <Pill tone="accent">Featured</Pill> : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <AppText weight="700" size="xl" style={{ color: colors.primary }}>
              LKR{" "}
              {(cycle === "monthly"
                ? plan.monthlyPremiumLkr
                : plan.annualPremiumLkr
              ).toLocaleString()}
            </AppText>
            <AppText size="sm" color="muted" style={{ paddingBottom: 4 }}>
              / {cycle === "monthly" ? "month" : "year"}
            </AppText>
          </View>

          {plan.annualDiscountPct > 0 ? (
            <AppText size="xs" style={{ color: colors.accent }}>
              {t("insurance.plan.save", { pct: plan.annualDiscountPct.toFixed(0) })}
            </AppText>
          ) : null}

          <ChipGroup>
            <Chip
              label={t("insurance.plan.monthly", {
                amount: plan.monthlyPremiumLkr.toLocaleString(),
              })}
              selected={cycle === "monthly"}
              onPress={() => setCycle("monthly")}
            />
            <Chip
              label={t("insurance.plan.annual", {
                amount: plan.annualPremiumLkr.toLocaleString(),
              })}
              selected={cycle === "annual"}
              onPress={() => setCycle("annual")}
            />
          </ChipGroup>
        </Card>

        <SectionHeader
          title={t("insurance.plan.coverage")}
          style={{ paddingHorizontal: 16 }}
        />
        <Card style={{ marginHorizontal: 16, padding: 16, gap: 10 }}>
          {rows.map((r, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              {r.icon}
              <AppText size="sm" style={{ flex: 1 }}>
                {r.label}
              </AppText>
            </View>
          ))}
        </Card>

        {Array.isArray(plan.keyFeatures) && plan.keyFeatures.length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.plan.features")}
              style={{ paddingHorizontal: 16, paddingTop: 16 }}
            />
            <Card style={{ marginHorizontal: 16, padding: 16, gap: 10 }}>
              {plan.keyFeatures.map((f: string, i: number) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <Check size={16} color={colors.accent} />
                  <AppText size="sm" style={{ flex: 1 }}>
                    {f}
                  </AppText>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {Array.isArray(plan.exclusions) && plan.exclusions.length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.plan.exclusions")}
              style={{ paddingHorizontal: 16, paddingTop: 16 }}
            />
            <Card style={{ marginHorizontal: 16, padding: 16, gap: 10 }}>
              {plan.exclusions.map((x: string, i: number) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <X size={16} color={colors.danger} />
                  <AppText size="sm" style={{ flex: 1 }}>
                    {x}
                  </AppText>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {coverage && Object.keys(coverage).length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.plan.details")}
              style={{ paddingHorizontal: 16, paddingTop: 16 }}
            />
            <Card style={{ marginHorizontal: 16, padding: 16, gap: 8 }}>
              {Object.entries(coverage).map(([k, v]) => (
                <View key={k}>
                  <AppText size="xs" color="muted">
                    {k}
                  </AppText>
                  <AppText size="sm">{String(v)}</AppText>
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
          padding: 16,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button
          label={t("insurance.plan.getQuote")}
          onPress={onBuy}
          style={{ width: "100%" }}
        />
      </View>
    </Screen>
  );
}
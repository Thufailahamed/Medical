// @ts-nocheck
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Pressable } from "@/components/ui/Pressable";
import { useTheme } from "@/theme/ThemeProvider";
import type { InsurancePlan } from "@healthcare/shared";

export interface InsurancePlanCardProps {
  plan: InsurancePlan;
  onPress?: () => void;
}

export function InsurancePlanCard({ plan, onPress }: InsurancePlanCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Card style={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pill tone="primary">
            {t(`insurance.planTypes.${plan.planType}`)}
          </Pill>
          {plan.isFeatured ? <Pill tone="accent">Featured</Pill> : null}
        </View>

        <AppText weight="700" size="md" color="text">
          {plan.name}
        </AppText>

        <AppText size="sm" color="muted">
          {t("insurance.plan.coverageLabel", {
            amount: plan.coverageSummaryLkr.toLocaleString(),
          })}
        </AppText>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
            marginTop: 4,
          }}
        >
          <AppText weight="700" size="lg" style={{ color: colors.primary }}>
            {t("insurance.plan.monthly", {
              amount: plan.monthlyPremiumLkr.toLocaleString(),
            })}
          </AppText>
          <AppText size="xs" color="muted" style={{ paddingBottom: 4 }}>
            {t("insurance.plan.annual", {
              amount: plan.annualPremiumLkr.toLocaleString(),
            })}
          </AppText>
        </View>

        {plan.annualDiscountPct > 0 ? (
          <AppText size="xs" style={{ color: colors.accent }}>
            {t("insurance.plan.save", {
              pct: plan.annualDiscountPct.toFixed(0),
            })}
          </AppText>
        ) : null}

        <AppText size="xs" color="muted">
          {plan.networkHospitalCount}{" "}
          {t("insurance.plan.networks", { count: plan.networkHospitalCount })} ·{" "}
          {plan.copayPct}% {t("insurance.plan.copay")}
        </AppText>
      </Card>
    </Pressable>
  );
}
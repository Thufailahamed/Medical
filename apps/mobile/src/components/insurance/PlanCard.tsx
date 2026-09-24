// @ts-nocheck
import { useTranslation } from "react-i18next";
import { View, Text, Image, StyleSheet } from "react-native";
import { ChevronRight, Hospital, Percent } from "lucide-react-native";
import { Pressable } from "@/components/ui/Pressable";
import { Pill } from "@/components/ui/Pill";
import { useTheme } from "@/theme/ThemeProvider";
import { INSURANCE_PLAN_BASE64 } from "@/constants/package-assets";
import type { InsurancePlan } from "@healthcare/shared";

export function insurancePlanImage(planType?: string): { uri: string } | null {
  if (!planType) return null;
  const key = planType.toLowerCase().replace(/[-\s]/g, "_");
  if (INSURANCE_PLAN_BASE64[key]) {
    return { uri: INSURANCE_PLAN_BASE64[key] };
  }
  if (key.includes("critic")) return { uri: INSURANCE_PLAN_BASE64.critical_illness };
  if (key.includes("fam")) return { uri: INSURANCE_PLAN_BASE64.family_floater };
  if (key.includes("sen")) return { uri: INSURANCE_PLAN_BASE64.senior };
  if (key.includes("canc")) return { uri: INSURANCE_PLAN_BASE64.cancer };
  if (key.includes("dent")) return { uri: INSURANCE_PLAN_BASE64.dental };
  if (key.includes("mat")) return { uri: INSURANCE_PLAN_BASE64.maternity };
  return { uri: INSURANCE_PLAN_BASE64.individual };
}

export const CURATED_INSURANCE_PLANS = [
  {
    id: "plan-critical-plus",
    name: "Critical Cover Plus",
    planType: "critical_illness",
    tag: "CRITICAL CARE",
    monthlyPremiumLkr: 4600,
    annualPremiumLkr: 51000,
    coverageSummaryLkr: 3500000,
    annualDiscountPct: 8,
    networkHospitalCount: 90,
    copayPct: 0,
    providerName: "Ceylinco Insurance",
    description: "High-sum protection against 37 critical illnesses and heart ailments with zero copay.",
  },
  {
    id: "plan-family-floater",
    name: "Family Floater Plus",
    planType: "family_floater",
    tag: "FAMILY CARE",
    monthlyPremiumLkr: 7800,
    annualPremiumLkr: 85000,
    coverageSummaryLkr: 7500000,
    annualDiscountPct: 9,
    networkHospitalCount: 220,
    copayPct: 15,
    providerName: "Ceylinco Insurance",
    description: "Comprehensive medical cover for up to 4 family members with cashless hospital admissions.",
  },
  {
    id: "plan-health-individual",
    name: "Health Individual",
    planType: "individual",
    tag: "POPULAR",
    monthlyPremiumLkr: 3200,
    annualPremiumLkr: 35000,
    coverageSummaryLkr: 2500000,
    annualDiscountPct: 8,
    networkHospitalCount: 220,
    copayPct: 10,
    providerName: "Ceylinco Insurance",
    description: "Affordable personal healthcare plan with instant digital claims and emergency room coverage.",
  },
  {
    id: "plan-senior-shield",
    name: "Senior Shield 55+",
    planType: "senior",
    tag: "SENIOR CARE",
    monthlyPremiumLkr: 5400,
    annualPremiumLkr: 60000,
    coverageSummaryLkr: 4000000,
    annualDiscountPct: 10,
    networkHospitalCount: 220,
    copayPct: 20,
    providerName: "Ceylinco Insurance",
    description: "Geriatric wellness and hospitalization support for seniors with pre-existing coverage.",
  },
];

export interface InsurancePlanCardProps {
  plan: InsurancePlan;
  onPress?: () => void;
}

export function InsurancePlanCard({ plan, onPress }: InsurancePlanCardProps) {
  const { t } = useTranslation();
  const { colors, fontFamily, typography, radius, shadow, scheme } = useTheme();
  const imgSrc = insurancePlanImage(plan.planType);

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      style={({ pressed }) => ({
        padding: 18,
        gap: 12,
        borderRadius: radius.card,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
        ...(scheme === "dark" ? {} : shadow.sm),
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <Pill tone="primary" label={t(`insurance.planTypes.${plan.planType}`)} />
            {plan.isFeatured ? <Pill tone="success" label="Featured" /> : null}
          </View>

          <Text
            style={{
              ...typography.title.md,
              color: colors.text,
            }}
          >
            {plan.name}
          </Text>

          <Text style={{ ...typography.body.sm, color: colors.textMuted, marginTop: 3 }}>
            {t("insurance.plan.coverageLabel", {
              amount: plan.coverageSummaryLkr.toLocaleString(),
            })}
          </Text>
        </View>

        {/* Thumbnail Image Container */}
        {imgSrc ? (
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              borderCurve: "continuous",
              overflow: "hidden",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.separator,
              backgroundColor: colors.surfaceMuted,
              flexShrink: 0,
            }}
          >
            <Image
              source={imgSrc}
              resizeMode="cover"
              style={{ width: "100%", height: "100%" }}
            />
          </View>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <View>
          <Text
            style={{
              ...typography.display.sm,
              color: colors.text,
            }}
          >
            {t("insurance.plan.monthly", {
              amount: plan.monthlyPremiumLkr.toLocaleString(),
            })}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSubtle, marginTop: 2 }}>
            {t("insurance.plan.annual", {
              amount: plan.annualPremiumLkr.toLocaleString(),
            })}
          </Text>
        </View>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            borderCurve: "continuous",
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={15} color={colors.primary} strokeWidth={2.5} />
        </View>
      </View>

      {plan.annualDiscountPct > 0 ? (
        <Text
          style={{
            ...typography.label.sm,
            color: colors.success,
            alignSelf: "flex-start",
            backgroundColor: colors.successSoft,
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          {t("insurance.plan.save", {
            pct: plan.annualDiscountPct.toFixed(0),
          })}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Meta
          icon={<Hospital size={11} color={colors.textMuted} />}
          label={`${plan.networkHospitalCount} hospitals`}
          colors={colors}
        />
        <Meta
          icon={<Percent size={11} color={colors.textMuted} />}
          label={`${plan.copayPct}% ${t("insurance.plan.copay")}`}
          colors={colors}
        />
      </View>
    </Pressable>
  );
}

function Meta({
  icon,
  label,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  colors: any;
}) {
  const { typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: colors.fill,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderCurve: "continuous",
      }}
    >
      {icon}
      <Text style={{ ...typography.label.xs, color: colors.textMuted }}>
        {label}
      </Text>
    </View>
  );
}

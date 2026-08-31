// @ts-nocheck
import { useTranslation } from "react-i18next";
import { View, Text, Image } from "react-native";
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
  const { colors, fontFamily } = useTheme();
  const imgSrc = insurancePlanImage(plan.planType);

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      style={({ pressed }) => ({
        padding: 16,
        gap: 10,
        borderRadius: 18,
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
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
              fontWeight: "800",
              fontSize: 16,
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
              letterSpacing: -0.3,
            }}
          >
            {plan.name}
          </Text>

          <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600", marginTop: 4 }}>
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
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
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
          marginTop: 2,
        }}
      >
        <View>
          <Text
            style={{
              fontWeight: "800",
              fontSize: 18,
              color: colors.primary,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            {t("insurance.plan.monthly", {
              amount: plan.monthlyPremiumLkr.toLocaleString(),
            })}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600" }}>
            {t("insurance.plan.annual", {
              amount: plan.annualPremiumLkr.toLocaleString(),
            })}
          </Text>
        </View>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={15} color={colors.primary} strokeWidth={2.5} />
        </View>
      </View>

      {plan.annualDiscountPct > 0 ? (
        <Text style={{ fontSize: 12, color: "#059669", fontWeight: "700" }}>
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
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
      }}
    >
      {icon}
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>
        {label}
      </Text>
    </View>
  );
}

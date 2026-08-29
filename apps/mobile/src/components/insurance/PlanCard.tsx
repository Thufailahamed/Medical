// @ts-nocheck
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";
import { ChevronRight, Hospital, Percent } from "lucide-react-native";
import { Pressable } from "@/components/ui/Pressable";
import { Pill } from "@/components/ui/Pill";
import { useTheme } from "@/theme/ThemeProvider";
import type { InsurancePlan } from "@healthcare/shared";

export interface InsurancePlanCardProps {
  plan: InsurancePlan;
  onPress?: () => void;
}

export function InsurancePlanCard({ plan, onPress }: InsurancePlanCardProps) {
  const { t } = useTranslation();
  const { colors, fontFamily } = useTheme();

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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
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

      <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600" }}>
        {t("insurance.plan.coverageLabel", {
          amount: plan.coverageSummaryLkr.toLocaleString(),
        })}
      </Text>

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

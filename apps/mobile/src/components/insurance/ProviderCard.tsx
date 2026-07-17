// @ts-nocheck
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Building2, ShieldCheck, Star } from "lucide-react-native";
import { AppText } from "@/components/ui/AppText";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Pressable } from "@/components/ui/Pressable";
import { useTheme } from "@/theme/ThemeProvider";

export interface InsuranceProviderCardProps {
  slug: string;
  name: string;
  tagline?: string | null;
  logoUrl?: string | null;
  claimSettlementRatioPct?: number | null;
  cashlessHospitalCount?: number | null;
  ratingAvg: number;
  ratingCount: number;
  planCount: number;
  onPress?: () => void;
}

export function InsuranceProviderCard(props: InsuranceProviderCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable onPress={props.onPress}>
      <Card style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="700" size="md" color="text">
              {props.name}
            </AppText>
            {props.tagline ? (
              <AppText size="xs" color="muted" numberOfLines={2}>
                {props.tagline}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Pill tone="primary" icon={<Star size={12} />}>
            {t("insurance.provider.rating", {
              avg: props.ratingAvg.toFixed(1),
              count: props.ratingCount,
            })}
          </Pill>
          <Pill tone="accent" icon={<ShieldCheck size={12} />}>
            {t("insurance.provider.planCount", { count: props.planCount })}
          </Pill>
          {typeof props.claimSettlementRatioPct === "number" ? (
            <Pill tone="neutral">
              {t("insurance.provider.claimRatio", {
                pct: props.claimSettlementRatioPct.toFixed(0),
              })}
            </Pill>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
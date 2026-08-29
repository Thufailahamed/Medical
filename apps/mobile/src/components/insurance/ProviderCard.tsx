// @ts-nocheck
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";
import { Building2, ShieldCheck, Star, ChevronRight } from "lucide-react-native";
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
  const { colors, fontFamily } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      haptic="light"
      style={({ pressed }) => ({
        padding: 16,
        gap: 12,
        borderRadius: 18,
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Building2 size={22} color={colors.primary} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontWeight: "800",
              fontSize: 16,
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {props.name}
          </Text>
          {props.tagline ? (
            <Text
              style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "500" }}
              numberOfLines={2}
            >
              {props.tagline}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
      </View>

      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <Pill
          tone="primary"
          icon={Star}
          label={t("insurance.provider.rating", {
            avg: props.ratingAvg.toFixed(1),
            count: props.ratingCount,
          })}
        />
        <Pill
          tone="success"
          icon={ShieldCheck}
          label={t("insurance.provider.planCount", { count: props.planCount })}
        />
        {typeof props.claimSettlementRatioPct === "number" ? (
          <Pill
            tone="neutral"
            label={t("insurance.provider.claimRatio", {
              pct: props.claimSettlementRatioPct.toFixed(0),
            })}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

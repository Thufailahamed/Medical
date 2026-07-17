// @ts-nocheck
// E-card full-screen view. Shows provider + policy number + QR + validity.

import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Shield, Share2 } from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/theme/ThemeProvider";
import { useInsuranceEcard } from "@/hooks/useApi";

export default function Ecard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading } = useInsuranceEcard(id ?? "");

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16 }}>
          <Skeleton height={220} radius={20} />
        </View>
      </Screen>
    );
  }

  if (!data?.ecard) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16 }}>
          <EmptyState title={t("insurance.ecard.notFound")} />
        </View>
      </Screen>
    );
  }

  const card = data.ecard;
  const valid = new Date(card.validUntil).getTime() > Date.now();

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.ecard.title")}
        subtitle={card.providerName ?? t("insurance.provider.label")}
        kicker={t("insurance.ecard.kicker")}
      />

      <View style={{ padding: 16, gap: 16 }}>
        <Card
          style={{
            padding: 20,
            gap: 14,
            backgroundColor: colors.primary,
            borderRadius: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Shield size={18} color="#FFFFFF" />
              <AppText weight="700" size="md" style={{ color: "#FFFFFF" }}>
                {t("insurance.ecard.healthCard")}
              </AppText>
            </View>
            <Pill tone={valid ? "accent" : "danger"}>
              {valid ? t("insurance.ecard.valid") : t("insurance.ecard.expired")}
            </Pill>
          </View>

          <AppText weight="700" size="lg" style={{ color: "#FFFFFF" }}>
            {card.providerName ?? t("insurance.provider.label")}
          </AppText>
          <AppText size="md" style={{ color: "#FFFFFF", letterSpacing: 2 }}>
            {card.cardNumber}
          </AppText>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <AppText size="xs" style={{ color: "#FFFFFFAA" }}>
                {t("insurance.ecard.holder")}
              </AppText>
              <AppText size="sm" weight="700" style={{ color: "#FFFFFF" }}>
                {card.holderName ?? ""}
              </AppText>
            </View>
            <View>
              <AppText size="xs" style={{ color: "#FFFFFFAA" }}>
                {t("insurance.ecard.validUntil")}
              </AppText>
              <AppText size="sm" weight="700" style={{ color: "#FFFFFF" }}>
                {new Date(card.validUntil).toLocaleDateString()}
              </AppText>
            </View>
          </View>

          <View
            style={{
              alignItems: "center",
              paddingVertical: 10,
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
            }}
          >
            <AppText weight="700" size="lg" style={{ color: colors.text }}>
              {card.qrToken.slice(0, 12).toUpperCase()}
            </AppText>
            <AppText size="xs" color="muted">
              {t("insurance.ecard.scan")}
            </AppText>
          </View>
        </Card>

        <Button
          label={t("insurance.ecard.share")}
          leftIcon={<Share2 size={14} />}
          onPress={() => {
            // share card details — use native Share API when implemented
          }}
        />
      </View>
    </Screen>
  );
}
// @ts-nocheck
// E-card full-screen view. Renders a real QR (react-native-qrcode-svg) of the
// secure qrToken, shows provider + plan + holder + validity, and lets the
// patient share the card.

import { useMemo } from "react";
import { View, Share, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { ShieldCheck, Share2, Copy, Phone } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import QRCodeImpl from "react-native-qrcode-svg";

// react-native-qrcode-svg hasn't shipped React 19-compatible types yet.
const QRCode = QRCodeImpl as unknown as React.ComponentType<{
  value: string;
  size: number;
  backgroundColor?: string;
  color?: string;
  ecl?: "L" | "M" | "Q" | "H";
}>;

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
  const { colors, spacing, radius } = useTheme();
  const { data, isLoading } = useInsuranceEcard(id ?? "");

  const card = data?.ecard;
  const valid = useMemo(
    () => (card ? new Date(card.validUntil).getTime() > Date.now() : false),
    [card],
  );

  const onShare = async () => {
    if (!card) return;
    try {
      await Share.share({
        title: t("insurance.ecard.shareTitle", "Insurance E-card"),
        message: [
          t("insurance.ecard.healthCard"),
          `${card.providerName ?? ""}`,
          card.planName ?? "",
          `${t("insurance.policy.policyNumber")}: ${card.policyNumber ?? ""}`,
          `${t("insurance.ecard.cardNumber")}: ${card.cardNumber}`,
          `${t("insurance.ecard.validUntil")}: ${new Date(card.validUntil).toLocaleDateString()}`,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } catch (err: any) {
      Alert.alert(t("common.error") || "Error", err?.message || "Share failed");
    }
  };

  const onCopy = async () => {
    if (!card) return;
    await Clipboard.setStringAsync(card.cardNumber);
    Alert.alert(
      t("insurance.ecard.copied") || "Copied",
      t("insurance.ecard.copiedDetail", "Card number copied to clipboard"),
    );
  };

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

  if (!card) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16 }}>
          <EmptyState title={t("insurance.ecard.notFound")} />
        </View>
      </Screen>
    );
  }

  // Brand colour as gradient. Fallback to a single-color gradient.
  const gradA = colors.primary ?? "#0B1F3A";
  const gradB = colors.primaryStrong ?? "#1E3A8A";

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.ecard.title")}
        subtitle={card.providerName ?? t("insurance.provider.label")}
        kicker={t("insurance.ecard.kicker")}
      />

      <View style={{ padding: 16, gap: 16 }}>
        <LinearGradient
          colors={[gradA, gradB]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 20,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }}
        >
          {/* Decorative blobs */}
          <View
            style={{
              position: "absolute",
              top: -50,
              right: -50,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -80,
              left: -40,
              width: 220,
              height: 220,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.05)",
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <ShieldCheck size={20} color="#FFFFFF" />
              <AppText weight="700" size="md" style={{ color: "#FFFFFF" }}>
                {t("insurance.ecard.healthCard")}
              </AppText>
            </View>
            <Pill tone={valid ? "accent" : "danger"}>
              {valid
                ? t("insurance.ecard.valid")
                : t("insurance.ecard.expired")}
            </Pill>
          </View>

          <View style={{ marginTop: 14, gap: 4 }}>
            <AppText
              weight="700"
              size="lg"
              style={{ color: "#FFFFFF" }}
            >
              {card.providerName ?? t("insurance.provider.label")}
            </AppText>
            {card.planName ? (
              <AppText size="sm" style={{ color: "#FFFFFFCC" }}>
                {card.planName}
              </AppText>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 16,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText size="xs" style={{ color: "#FFFFFFAA" }}>
                {t("insurance.policy.policyNumber")}
              </AppText>
              <AppText
                size="sm"
                weight="700"
                style={{ color: "#FFFFFF", letterSpacing: 1 }}
              >
                {card.policyNumber ?? "—"}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText size="xs" style={{ color: "#FFFFFFAA" }}>
                {t("insurance.policy.coverage")}
              </AppText>
              <AppText size="sm" weight="700" style={{ color: "#FFFFFF" }}>
                LKR{" "}
                {(card.coverageAmountLkr ?? 0).toLocaleString()}
              </AppText>
            </View>
          </View>

          <View
            style={{
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 12,
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              marginTop: 18,
            }}
          >
            <QRCode
              value={JSON.stringify({
                t: card.qrToken,
                p: card.policyNumber,
                c: card.cardNumber,
              })}
              size={180}
              backgroundColor="#FFFFFF"
              color="#0B1F3A"
              ecl="M"
            />
            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AppText
                weight="700"
                size="md"
                style={{ color: colors.text, letterSpacing: 2 }}
              >
                {card.cardNumber}
              </AppText>
            </View>
            <AppText size="xs" color="muted" style={{ marginTop: 4 }}>
              {t("insurance.ecard.scan")}
            </AppText>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 14,
            }}
          >
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
        </LinearGradient>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button
            label={t("insurance.ecard.share")}
            leftIcon={<Share2 size={14} />}
            onPress={onShare}
            style={{ flex: 1 }}
          />
          <Button
            variant="outline"
            label={t("insurance.ecard.copy") || "Copy"}
            leftIcon={<Copy size={14} />}
            onPress={onCopy}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Screen>
  );
}

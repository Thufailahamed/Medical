// @ts-nocheck
// E-card full-screen view. Renders a real QR (react-native-qrcode-svg) of the
// secure qrToken, shows provider + plan + holder + validity, and lets the
// patient share the card.

import { useMemo } from "react";
import { View, Text, Share, Alert, StyleSheet } from "react-native";
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
  const { colors, spacing, radius, typography, shadow, scheme } = useTheme();
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
          <Skeleton height={440} radius={radius.xxl} />
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

  // Wallet-style card: a fixed deep brand gradient so the card reads the
  // same (and keeps white-text contrast) in both light and dark mode.
  const gradA = "#0B1F3A";
  const gradB = "#0B4F6C";
  const gradC = "#0E7490";
  const labelStyle = {
    ...typography.overline,
    fontSize: 10,
    color: "rgba(255,255,255,0.62)",
    textTransform: "uppercase" as const,
  };
  const valueStyle = {
    ...typography.title.sm,
    color: "#FFFFFF",
    marginTop: 3,
  };

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.ecard.title")}
        subtitle={card.providerName ?? t("insurance.provider.label")}
        kicker={t("insurance.ecard.kicker")}
      />

      <View style={{ paddingVertical: 8, gap: 20 }}>
        <View
          style={{
            borderRadius: radius.xxl,
            ...(scheme === "dark" ? {} : shadow.hero),
          }}
        >
        <LinearGradient
          colors={[gradA, gradB, gradC]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xxl,
            borderCurve: "continuous",
            padding: 22,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.14)",
          }}
        >
          {/* Decorative sheen + orbs */}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 200,
              height: 200,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.07)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -90,
              left: -50,
              width: 240,
              height: 240,
              borderRadius: 999,
              backgroundColor: "rgba(20,184,166,0.16)",
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
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.28)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={18} color="#FFFFFF" strokeWidth={2.3} />
              </View>
              <Text style={{ ...typography.label.lg, color: "#FFFFFF" }}>
                {t("insurance.ecard.healthCard")}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: valid ? "#34D399" : "#F87171",
                }}
              />
              <Text style={{ ...typography.label.xs, color: "#FFFFFF" }}>
                {valid
                  ? t("insurance.ecard.valid")
                  : t("insurance.ecard.expired")}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 22, gap: 2 }}>
            <Text
              style={{ ...typography.display.sm, color: "#FFFFFF" }}
              numberOfLines={2}
            >
              {card.providerName ?? t("insurance.provider.label")}
            </Text>
            {card.planName ? (
              <Text
                style={{ ...typography.body.sm, color: "rgba(255,255,255,0.78)" }}
              >
                {card.planName}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 20,
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>
                {t("insurance.policy.policyNumber")}
              </Text>
              <Text style={{ ...valueStyle, letterSpacing: 1 }}>
                {card.policyNumber ?? "—"}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={labelStyle}>
                {t("insurance.policy.coverage")}
              </Text>
              <Text style={valueStyle}>
                LKR{" "}
                {(card.coverageAmountLkr ?? 0).toLocaleString()}
              </Text>
            </View>
          </View>

          <View
            style={{
              alignItems: "center",
              paddingTop: 18,
              paddingBottom: 14,
              paddingHorizontal: 12,
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              borderCurve: "continuous",
              marginTop: 20,
            }}
          >
            <QRCode
              value={JSON.stringify({
                t: card.qrToken,
                p: card.policyNumber,
                c: card.cardNumber,
              })}
              size={188}
              backgroundColor="#FFFFFF"
              color="#0B1F3A"
              ecl="M"
            />
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text
                style={{
                  ...typography.title.md,
                  color: "#0B1F3A",
                  letterSpacing: 2.4,
                }}
              >
                {card.cardNumber}
              </Text>
            </View>
            <Text style={{ ...typography.caption, color: "#64748B", marginTop: 2 }}>
              {t("insurance.ecard.scan")}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 18,
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>
                {t("insurance.ecard.holder")}
              </Text>
              <Text style={valueStyle} numberOfLines={1}>
                {card.holderName ?? ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={labelStyle}>
                {t("insurance.ecard.validUntil")}
              </Text>
              <Text style={valueStyle}>
                {new Date(card.validUntil).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </LinearGradient>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Button
            label={t("insurance.ecard.share")}
            icon={Share2}
            onPress={onShare}
            style={{ flex: 1 }}
          />
          <Button
            variant="secondary"
            label={t("insurance.ecard.copy") || "Copy"}
            icon={Copy}
            onPress={onCopy}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Screen>
  );
}

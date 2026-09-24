// @ts-nocheck
// PayHere redirect for insurance premium. Polls enrollment status until active.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { View, Text, ActivityIndicator, Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { CreditCard, ShieldCheck } from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Pill,
  Skeleton,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { usePayInsurancePremium, useInsuranceEnrollment } from "@/hooks/useApi";

export default function InsurancePayment() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading, refetch } = useInsuranceEnrollment(enrollmentId ?? "");
  const pay = usePayInsurancePremium();

  const enrollment = data?.enrollment;
  const isActive = enrollment?.status === "active";
  const isFailed = enrollment?.status === "cancelled";

  useEffect(() => {
    if (!isActive) {
      const interval = setInterval(() => {
        refetch();
      }, 3000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isActive, refetch]);

  useEffect(() => {
    if (enrollment && !isActive && !isFailed) {
      pay
        .mutateAsync(enrollment.id)
        .then((res) => {
          if (res.checkoutUrl && typeof res.checkoutUrl === "string") {
            Linking.openURL(res.checkoutUrl).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [enrollment?.id]);

  if (isLoading || !enrollment) {
    return (
      <Screen>
        <ScreenHeader title={t("insurance.payment.title")} subtitle="" />
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={160} radius={22} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.payment.title")}
        subtitle={enrollment.policyNumber ?? t("insurance.policy.policyNumber")}
        kicker={t("insurance.payment.kicker")}
      />

      <Card style={{ marginVertical: 12, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              borderCurve: "continuous",
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CreditCard size={20} color={colors.primary} strokeWidth={2.3} />
          </View>
          <AppText weight="700" size="lg" style={{ flex: 1 }}>
            {t("insurance.payment.amount", {
              amount: enrollment.premiumAmountLkr.toLocaleString(),
            })}
          </AppText>
        </View>
        <AppText size="sm" color="muted" style={{ marginTop: -6, marginLeft: 52 }}>
          {t("insurance.payment.billingCycle", {
            cycle: enrollment.billingCycle,
          })}
        </AppText>

        {isActive ? (
          <Pill tone="accent" icon={<ShieldCheck size={12} />}>
            {t("insurance.payment.active")}
          </Pill>
        ) : isFailed ? (
          <Pill tone="danger">{t("insurance.payment.failed")}</Pill>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: colors.surfaceMuted,
              borderRadius: 14,
              borderCurve: "continuous",
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <ActivityIndicator color={colors.primary} />
            <AppText size="sm" color="muted">
              {t("insurance.payment.waiting")}
            </AppText>
          </View>
        )}
      </Card>

      {isActive ? (
        <View>
          <Button
            label={t("insurance.payment.viewPolicy")}
            size="lg"
            onPress={() =>
              router.replace(`/insurance/policy/${enrollment.id}`)
            }
          />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Button
            label={t("insurance.payment.openCheckout")}
            size="lg"
            loading={pay.isPending}
            onPress={async () => {
              const res = await pay.mutateAsync(enrollment.id);
              if (res.checkoutUrl && typeof res.checkoutUrl === "string") {
                Linking.openURL(res.checkoutUrl).catch(() => {});
              }
            }}
          />
          <Button
            variant="ghost"
            label={t("insurance.payment.cancel")}
            onPress={() => router.back()}
          />
        </View>
      )}
    </Screen>
  );
}

// Theme-aware text used by this screen: maps the terse size/weight/color
// props onto typography tokens + theme colours so text stays legible in dark
// mode (the shared AppText hard-codes light-mode hex colours).
function AppText({
  size,
  weight,
  color,
  style,
  ...rest
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  weight?: string;
  color?: "muted" | "subtle" | "primary" | "accent" | "danger" | "text";
  style?: any;
  [key: string]: any;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const tone =
    color === "muted"
      ? colors.textMuted
      : color === "subtle"
        ? colors.textSubtle
        : color === "primary"
          ? colors.primary
          : color === "accent"
            ? colors.accent
            : color === "danger"
              ? colors.danger
              : colors.text;
  const bold = weight === "700" || weight === "800" || weight === "900" || weight === "bold";
  const semi = weight === "600" || weight === "500";
  const base =
    size === "2xl"
      ? typography.display.md
      : size === "xl"
        ? typography.display.sm
        : size === "lg"
          ? bold
            ? typography.title.lg
            : typography.body.lg
          : size === "md"
            ? bold
              ? typography.title.md
              : typography.body.md
            : size === "xs"
              ? typography.caption
              : bold
                ? typography.title.xs
                : typography.body.sm;
  const family = bold
    ? size === "xl" || size === "2xl" || size === "lg" || size === "md"
      ? base.fontFamily
      : fontFamily.bodyBold
    : semi
      ? fontFamily.bodySemibold
      : base.fontFamily;
  return (
    <Text
      {...rest}
      style={[{ ...base, fontFamily: family, color: tone }, style]}
    />
  );
}

// @ts-nocheck
// PayHere redirect for insurance premium. Polls enrollment status until active.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator, Linking } from "react-native";
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
import { AppText } from "@/components/ui/AppText";
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
          <Skeleton height={120} radius={16} />
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

      <Card style={{ margin: 16, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <CreditCard size={20} color={colors.primary} />
          <AppText weight="700" size="md">
            {t("insurance.payment.amount", {
              amount: enrollment.premiumAmountLkr.toLocaleString(),
            })}
          </AppText>
        </View>
        <AppText size="sm" color="muted">
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color={colors.primary} />
            <AppText size="sm" color="muted">
              {t("insurance.payment.waiting")}
            </AppText>
          </View>
        )}
      </Card>

      {isActive ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Button
            label={t("insurance.payment.viewPolicy")}
            onPress={() =>
              router.replace(`/insurance/policy/${enrollment.id}`)
            }
          />
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <Button
            label={t("insurance.payment.openCheckout")}
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
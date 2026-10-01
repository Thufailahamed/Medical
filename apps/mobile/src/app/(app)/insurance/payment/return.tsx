// @ts-nocheck
// payments.lk success callback. Polls my enrollments until one turns active,
// mirroring web `patient/(app)/insurance/payment/return`.

import { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, XCircle, ShieldCheck } from "lucide-react-native";
import { Screen, ScreenHeader, Card, Button, Skeleton } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useMyInsuranceEnrollments } from "@/hooks/useApi";

export default function InsurancePaymentReturn() {
  const { order } = useLocalSearchParams<{ order?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

  const q = useMyInsuranceEnrollments();
  const enrollments = q.data?.enrollments ?? [];
  const active = enrollments.filter((e: any) => e.status === "active");
  const pending = enrollments.filter((e: any) => e.status === "payment_pending");
  const failed = enrollments.filter((e: any) =>
    ["grace", "lapsed", "cancelled"].includes(e.status)
  );

  // Poll every 5s until an active enrollment appears (web parity).
  useEffect(() => {
    if (q.isLoading || active.length > 0) return;
    const id = setInterval(() => q.refetch(), 5000);
    return () => clearInterval(id);
  }, [q.isLoading, active.length]);

  const state = q.isLoading
    ? "checking"
    : active.length > 0
      ? "success"
      : failed.length > 0 && pending.length === 0
        ? "failed"
        : "pending";

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("insurance.payment.returnTitle")}
        subtitle={order ? `${t("insurance.payment.order", { defaultValue: "Order" })} ${order}` : ""}
        kicker="INSURANCE"
        back={true}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {state === "checking" ? (
          <Skeleton height={180} radius={22} />
        ) : state === "success" ? (
          <Card style={{ padding: spacing.xl, gap: spacing.md, alignItems: "center" }}>
            <CheckCircle2 size={48} color={colors.success} strokeWidth={2} />
            <Text style={[typography.title.md, { color: colors.text, textAlign: "center" }]}>
              {t("insurance.payment.returnSuccess")}
            </Text>
            <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
              {active[0]?.policyNumber ?? active[0]?.planName ?? ""}
            </Text>
            <Button
              title={t("insurance.payment.viewPolicy")}
              icon={ShieldCheck}
              size="lg"
              onPress={() => router.replace(`/(app)/insurance/policy/${active[0].id}` as any)}
            />
          </Card>
        ) : state === "failed" ? (
          <Card style={{ padding: spacing.xl, gap: spacing.md, alignItems: "center" }}>
            <XCircle size={48} color={colors.danger} strokeWidth={2} />
            <Text style={[typography.title.md, { color: colors.text, textAlign: "center" }]}>
              {t("insurance.payment.returnFailed")}
            </Text>
            <Button
              title={t("insurance.payment.backToPlans")}
              size="lg"
              onPress={() => router.replace("/(app)/insurance/marketplace" as any)}
            />
          </Card>
        ) : (
          <Card style={{ padding: spacing.xl, gap: spacing.md, alignItems: "center" }}>
            <Loader2 size={48} color={colors.primary} strokeWidth={2} />
            <Text style={[typography.title.md, { color: colors.text, textAlign: "center" }]}>
              {t("insurance.payment.returnPending")}
            </Text>
            <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
              {t("insurance.payment.returnPendingBody")}
            </Text>
            <View style={{ width: "100%", gap: spacing.sm }}>
              <Button
                title={t("insurance.payment.viewPolicy")}
                size="lg"
                disabled={active.length === 0}
                onPress={() => active[0] && router.replace(`/(app)/insurance/policy/${active[0].id}` as any)}
              />
              <Button
                title={t("insurance.payment.backToPlans")}
                variant="secondary"
                onPress={() => router.replace("/(app)/insurance/marketplace" as any)}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

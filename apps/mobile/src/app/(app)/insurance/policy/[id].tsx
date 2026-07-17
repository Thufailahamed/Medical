// @ts-nocheck
// Policy detail. Premium status, payment-due banner, coverage, dependents, claims summary, ECARD link.

import { useEffect, useMemo } from "react";
import { Linking, View, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Shield,
  CreditCard,
  CalendarClock,
  FilePlus,
  Wallet,
  AlertTriangle,
  X,
  CheckCircle2,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  useInsuranceEnrollment,
  useRenewInsuranceEnrollment,
  useCancelInsuranceEnrollment,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  Skeleton,
  EmptyState,
  SectionHeader,
} from "@/components/ui";
import { AppText } from "@/components/ui/AppText";

const DAY_MS = 1000 * 60 * 60 * 24;

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / DAY_MS);
}

export default function PolicyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading } = useInsuranceEnrollment(id ?? "");

  const renewMut = useRenewInsuranceEnrollment();
  const cancelMut = useCancelInsuranceEnrollment();

  const e = data?.enrollment;

  const dueIn = useMemo(() => daysUntil(e?.nextPremiumDueAt), [e?.nextPremiumDueAt]);
  const isOverdue = dueIn !== null && dueIn < 0;
  const isDueSoon = dueIn !== null && dueIn >= 0 && dueIn <= 7;
  const showPaymentBanner = e?.status === "active" && (isDueSoon || isOverdue);

  // Auto-open PayHere checkout when renew mutation returns a checkoutUrl.
  useEffect(() => {
    const url = (renewMut.data as any)?.checkoutUrl;
    if (url && typeof url === "string") {
      Linking.openURL(url).catch(() => {
        // Ignore — user can retry from banner button.
      });
    }
  }, [renewMut.data]);

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={140} radius={16} />
          <Skeleton height={120} radius={16} />
        </View>
      </Screen>
    );
  }

  if (!e) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16 }}>
          <EmptyState title={t("insurance.policy.notFound")} />
        </View>
      </Screen>
    );
  }

  const onRenew = () => {
    renewMut.mutate(e.id, {
      onError: (err: any) => {
        Alert.alert(t("common.error") || "Error", err?.message || "Renewal failed");
      },
    });
  };

  const onCancel = () => {
    Alert.alert(
      t("insurance.policy.cancelTitle") || "Cancel policy",
      t("insurance.policy.cancelConfirm") ||
        "This will end your coverage. This action cannot be undone.",
      [
        { text: t("common.cancel") || "Cancel", style: "cancel" },
        {
          text: t("insurance.policy.cancelConfirmYes") || "Yes, cancel",
          style: "destructive",
          onPress: () =>
            cancelMut.mutate(
              { id: e.id },
              {
                onSuccess: () => router.replace("/insurance"),
                onError: (err: any) =>
                  Alert.alert(
                    t("common.error") || "Error",
                    err?.message || "Cancellation failed",
                  ),
              },
            ),
        },
      ],
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title={e.policyNumber ?? t("insurance.policy.policyNumber")}
        subtitle={`LKR ${e.coverageAmountLkr.toLocaleString()} coverage`}
        kicker={t("insurance.policy.kicker")}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {showPaymentBanner ? (
          <Card
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              padding: 14,
              gap: 10,
              borderWidth: 1.5,
              borderColor: colors.warning,
              backgroundColor: colors.warningSoft,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.warning,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertTriangle size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="700" size="sm">
                  {isOverdue
                    ? t("insurance.policy.overdue") || "Payment overdue"
                    : t("insurance.policy.dueSoon") || "Premium due soon"}
                </AppText>
                <AppText size="xs" color="muted">
                  LKR {e.premiumAmountLkr.toLocaleString()} ·{" "}
                  {isOverdue
                    ? `${-dueIn}d overdue`
                    : `due in ${dueIn}d`}
                </AppText>
              </View>
            </View>
            <Button
              label={
                renewMut.isPending
                  ? t("common.loading") || "Loading…"
                  : t("insurance.payNow") || "Pay now"
              }
              leftIcon={<Wallet size={14} />}
              onPress={onRenew}
              loading={renewMut.isPending}
            />
          </Card>
        ) : null}

        {e.status !== "active" && e.status !== "grace" ? (
          <Card
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              padding: 14,
              gap: 10,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} color={colors.success} />
              <AppText size="sm" weight="600">
                {t(`insurance.status.${e.status}`)}
              </AppText>
            </View>
            <AppText size="xs" color="muted">
              {t("insurance.policy.statusNote") ||
                "Coverage is not active. Renew to restore benefits."}
            </AppText>
            <Button
              label={t("insurance.renew") || "Renew"}
              variant="outline"
              leftIcon={<Wallet size={14} />}
              onPress={onRenew}
              loading={renewMut.isPending}
            />
          </Card>
        ) : null}

        <Card style={{ margin: 16, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Shield size={20} color={colors.primary} />
            <AppText weight="700" size="md">
              {t("insurance.policy.summary")}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill tone={e.status === "active" ? "accent" : "neutral"}>
              {t(`insurance.status.${e.status}`)}
            </Pill>
            <Pill tone="primary">{e.billingCycle}</Pill>
            {e.planName ? <Pill tone="neutral">{e.planName}</Pill> : null}
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText size="xs" color="muted">
                {t("insurance.policy.premium")}
              </AppText>
              <AppText weight="700" size="md">
                LKR {e.premiumAmountLkr.toLocaleString()}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText size="xs" color="muted">
                {t("insurance.policy.coverage")}
              </AppText>
              <AppText weight="700" size="md">
                LKR {e.coverageAmountLkr.toLocaleString()}
              </AppText>
            </View>
          </View>

          {e.nextPremiumDueAt ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CalendarClock size={14} color={colors.textSubtle} />
              <AppText size="sm" color="muted">
                {t("insurance.policy.nextPremium")}:{" "}
                {new Date(e.nextPremiumDueAt).toLocaleDateString()}
              </AppText>
            </View>
          ) : null}
          {e.lastPremiumPaidAt ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={14} color={colors.success} />
              <AppText size="sm" color="muted">
                {t("insurance.policy.lastPaid") || "Last paid"}:{" "}
                {new Date(e.lastPremiumPaidAt).toLocaleDateString()}
              </AppText>
            </View>
          ) : null}
        </Card>

        <SectionHeader
          title={t("insurance.policy.actions")}
          style={{ paddingHorizontal: 16 }}
        />
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            paddingHorizontal: 16,
            flexWrap: "wrap",
          }}
        >
          <Button
            label={t("insurance.ecard.view")}
            leftIcon={<CreditCard size={14} />}
            onPress={() => router.push(`/insurance/ecard/${e.id}`)}
            style={{ flex: 1, minWidth: 140 }}
          />
          <Button
            label={t("insurance.renew")}
            variant="outline"
            leftIcon={<Wallet size={14} />}
            onPress={onRenew}
            loading={renewMut.isPending}
            style={{ flex: 1, minWidth: 140 }}
          />
          <Button
            label={t("insurance.submitClaim")}
            variant="outline"
            leftIcon={<FilePlus size={14} />}
            onPress={() => router.push("/insurance/claims/new")}
            style={{ flex: 1, minWidth: 140 }}
          />
        </View>

        <SectionHeader
          title={t("insurance.policy.coverageDetails")}
          style={{ paddingHorizontal: 16, paddingTop: 16 }}
        />
        <Card style={{ marginHorizontal: 16, padding: 16, gap: 8 }}>
          <AppText size="sm">
            {t("insurance.policy.startDate")}:{" "}
            {new Date(e.startDate).toLocaleDateString()}
          </AppText>
          {e.endDate ? (
            <AppText size="sm">
              {t("insurance.policy.endDate")}:{" "}
              {new Date(e.endDate).toLocaleDateString()}
            </AppText>
          ) : null}
          {Array.isArray(e.dependents) && e.dependents.length > 0 ? (
            <>
              <AppText size="xs" color="muted" style={{ marginTop: 8 }}>
                {t("insurance.policy.dependents")}
              </AppText>
              {e.dependents.map((d: any, i: number) => (
                <AppText key={i} size="sm">
                  · {d.name} ({d.relation}, {d.age})
                </AppText>
              ))}
            </>
          ) : null}
        </Card>

        {e.status === "active" ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Button
              label={t("insurance.policy.cancelPolicy") || "Cancel policy"}
              variant="ghost"
              leftIcon={<X size={14} />}
              onPress={onCancel}
              loading={cancelMut.isPending}
              textStyle={{ color: colors.danger }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
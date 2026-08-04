// @ts-nocheck
// Policy detail. Premium status banner, coverage ring, dependents, ECARD link.

import { useEffect, useMemo } from "react";
import { Linking, View, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Shield,
  CreditCard,
  CalendarClock,
  FilePlus,
  Wallet,
  AlertTriangle,
  X,
  CheckCircle2,
  Building2,
  User2,
  Cake,
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
  const { colors, spacing, radius } = useTheme();
  const { data, isLoading } = useInsuranceEnrollment(id ?? "");

  const renewMut = useRenewInsuranceEnrollment();
  const cancelMut = useCancelInsuranceEnrollment();

  const e = data?.enrollment;

  const dueIn = useMemo(
    () => daysUntil(e?.nextPremiumDueAt),
    [e?.nextPremiumDueAt],
  );
  const isOverdue = dueIn !== null && dueIn < 0;
  const isDueSoon = dueIn !== null && dueIn >= 0 && dueIn <= 7;
  const showPaymentBanner = e?.status === "active" && (isDueSoon || isOverdue);

  // Auto-open PayHere checkout when renew mutation returns a checkoutUrl.
  useEffect(() => {
    const url = (renewMut.data as any)?.checkoutUrl;
    if (url && typeof url === "string") {
      Linking.openURL(url).catch(() => {});
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
        Alert.alert(
          t("common.error") || "Error",
          err?.message || "Renewal failed",
        );
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

  const statusTone: "accent" | "warning" | "danger" | "neutral" =
    e.status === "active"
      ? "accent"
      : e.status === "grace"
        ? "warning"
        : e.status === "lapsed" || e.status === "expired"
          ? "danger"
          : "neutral";

  return (
    <Screen>
      <ScreenHeader
        title={e.policyNumber ?? t("insurance.policy.policyNumber")}
        subtitle={e.providerName ?? t("insurance.provider.label")}
        kicker={t("insurance.policy.kicker")}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ─── Gradient hero ─── */}
        <LinearGradient
          colors={[colors.primary, colors.primaryStrong ?? colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            margin: 16,
            borderRadius: 22,
            padding: 18,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 200,
              height: 200,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -90,
              left: -30,
              width: 240,
              height: 240,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.05)",
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="700" size="md" style={{ color: "#FFFFFF" }}>
                {e.planName ?? t("insurance.policy.summary")}
              </AppText>
              <AppText size="xs" style={{ color: "#FFFFFFCC" }}>
                {e.planType
                  ? t(`insurance.planTypes.${e.planType}`, e.planType)
                  : ""}
              </AppText>
            </View>
            <Pill
              tone={statusTone}
              style={{ backgroundColor: "rgba(255,255,255,0.95)" }}
            >
              {t(`insurance.status.${e.status}`)}
            </Pill>
          </View>

          <View
            style={{
              flexDirection: "row",
              marginTop: 18,
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText size="xs" style={{ color: "#FFFFFFAA" }}>
                {t("insurance.policy.coverage")}
              </AppText>
              <AppText
                weight="700"
                size="lg"
                style={{ color: "#FFFFFF", marginTop: 2 }}
              >
                LKR {e.coverageAmountLkr.toLocaleString()}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText size="xs" style={{ color: "#FFFFFFAA" }}>
                {t("insurance.policy.premium")}
              </AppText>
              <AppText
                weight="700"
                size="lg"
                style={{ color: "#FFFFFF", marginTop: 2 }}
              >
                LKR {e.premiumAmountLkr.toLocaleString()}
              </AppText>
              <AppText size="xs" style={{ color: "#FFFFFFCC" }}>
                / {e.billingCycle}
              </AppText>
            </View>
          </View>

          {e.nextPremiumDueAt ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                backgroundColor: "rgba(255,255,255,0.12)",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
              }}
            >
              <CalendarClock size={14} color="#FFFFFF" />
              <AppText size="sm" style={{ color: "#FFFFFF" }}>
                {t("insurance.policy.nextPremium")}:{" "}
                {new Date(e.nextPremiumDueAt).toLocaleDateString()}
              </AppText>
            </View>
          ) : null}
        </LinearGradient>

        {showPaymentBanner ? (
          <Card
            style={{
              marginHorizontal: 16,
              marginTop: 4,
              padding: 14,
              gap: 10,
              borderWidth: 1.5,
              borderColor: colors.warning,
              backgroundColor: colors.warningSoft,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
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

        <SectionHeader
          title={t("insurance.policy.actions")}
          style={{ paddingHorizontal: 16, paddingTop: 16 }}
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

        {/* Provider card */}
        <SectionHeader
          title={t("insurance.provider.label")}
          style={{ paddingHorizontal: 16, paddingTop: 16 }}
        />
        <Card
          style={{
            marginHorizontal: 16,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: colors.primaryMuted ?? colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="700" size="md">
              {e.providerName ?? t("insurance.provider.label")}
            </AppText>
            <AppText size="xs" color="muted">
              {e.planName ?? t("insurance.policy.summary")}
            </AppText>
          </View>
        </Card>

        {/* Schedule card */}
        <SectionHeader
          title={t("insurance.policy.schedule", "Schedule")}
          style={{ paddingHorizontal: 16, paddingTop: 16 }}
        />
        <Card style={{ marginHorizontal: 16, padding: 16, gap: 10 }}>
          <Detail
            icon={<CalendarClock size={14} />}
            label={t("insurance.policy.startDate")}
            value={
              e.startDate ? new Date(e.startDate).toLocaleDateString() : "—"
            }
          />
          {e.endDate ? (
            <Detail
              icon={<CalendarClock size={14} />}
              label={t("insurance.policy.endDate")}
              value={new Date(e.endDate).toLocaleDateString()}
            />
          ) : null}
          {e.lastPremiumPaidAt ? (
            <Detail
              icon={<CheckCircle2 size={14} />}
              label={t("insurance.policy.lastPaid") || "Last paid"}
              value={new Date(e.lastPremiumPaidAt).toLocaleDateString()}
            />
          ) : null}
        </Card>

        {/* Nominee */}
        {e.nomineeName ? (
          <>
            <SectionHeader
              title={t("insurance.policy.nominee", "Nominee")}
              style={{ paddingHorizontal: 16, paddingTop: 16 }}
            />
            <Card
              style={{
                marginHorizontal: 16,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <User2 size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="700">{e.nomineeName}</AppText>
                <AppText size="xs" color="muted">
                  {e.nomineeRelation}
                  {e.nomineeDob
                    ? ` · ${new Date(e.nomineeDob).toLocaleDateString()}`
                    : ""}
                </AppText>
              </View>
            </Card>
          </>
        ) : null}

        {/* Dependents */}
        {Array.isArray(e.dependents) && e.dependents.length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.policy.dependents")}
              style={{ paddingHorizontal: 16, paddingTop: 16 }}
            />
            <View
              style={{
                paddingHorizontal: 16,
                gap: 8,
              }}
            >
              {e.dependents.map((d: any) => (
                <Card
                  key={d.id ?? d.name}
                  style={{
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      backgroundColor: colors.surfaceMuted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AppText weight="700" size="sm">
                      {(d.name ?? "?").charAt(0).toUpperCase()}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight="600">{d.name}</AppText>
                    <AppText size="xs" color="muted">
                      {d.relation}
                      {d.dob
                        ? ` · ${new Date(d.dob).toLocaleDateString()}`
                        : ""}
                    </AppText>
                  </View>
                  {d.dob ? (
                    <Cake size={14} color={colors.textMuted} />
                  ) : null}
                </Card>
              ))}
            </View>
          </>
        ) : null}

        {e.status === "active" ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
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

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <AppText size="sm" color="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText weight="600">{value}</AppText>
    </View>
  );
}
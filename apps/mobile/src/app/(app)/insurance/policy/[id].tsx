// @ts-nocheck
// Policy detail. Premium status banner, coverage ring, dependents, ECARD link.

import { useEffect, useMemo } from "react";
import { Linking, View, Text, ScrollView, Alert, StyleSheet } from "react-native";
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
  const { colors, spacing, radius, typography, shadow, scheme } = useTheme();
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

  // Auto-open payments.lk checkout when renew mutation returns a checkoutUrl.
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
          <Skeleton height={220} radius={radius.xxl} />
          <Skeleton height={120} radius={radius.card} />
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

  const hairline = scheme === "dark" ? colors.borderStrong : colors.separator;
  const heroLabel = {
    ...typography.overline,
    fontSize: 10,
    color: "rgba(255,255,255,0.66)",
    textTransform: "uppercase" as const,
  };

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={e.policyNumber ?? t("insurance.policy.policyNumber")}
        subtitle={e.providerName ?? t("insurance.provider.label")}
        kicker={t("insurance.policy.kicker")}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ─── Gradient hero ─── */}
        <View
          style={{
            margin: 16,
            marginTop: 8,
            borderRadius: radius.xxl,
            ...(scheme === "dark" ? {} : shadow.hero),
          }}
        >
        <LinearGradient
          colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xxl,
            borderCurve: "continuous",
            padding: 20,
            overflow: "hidden",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 200,
              height: 200,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -90,
              left: -30,
              width: 240,
              height: 240,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                borderCurve: "continuous",
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={21} color="#FFFFFF" strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ ...typography.title.md, color: "#FFFFFF" }}
                numberOfLines={2}
              >
                {e.planName ?? t("insurance.policy.summary")}
              </Text>
              <Text
                style={{
                  ...typography.caption,
                  color: "rgba(255,255,255,0.8)",
                  marginTop: 1,
                }}
              >
                {e.planType
                  ? t(`insurance.planTypes.${e.planType}`, e.planType)
                  : ""}
              </Text>
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
              marginTop: 22,
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={heroLabel}>{t("insurance.policy.coverage")}</Text>
              <Text
                style={{
                  ...typography.display.sm,
                  color: "#FFFFFF",
                  marginTop: 4,
                }}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                LKR {e.coverageAmountLkr.toLocaleString()}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={heroLabel}>{t("insurance.policy.premium")}</Text>
              <Text
                style={{
                  ...typography.title.lg,
                  color: "#FFFFFF",
                  marginTop: 4,
                }}
              >
                LKR {e.premiumAmountLkr.toLocaleString()}
              </Text>
              <Text
                style={{
                  ...typography.caption,
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                / {e.billingCycle}
              </Text>
            </View>
          </View>

          {e.nextPremiumDueAt ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: 18,
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 12,
                borderCurve: "continuous",
              }}
            >
              <CalendarClock size={14} color="#FFFFFF" strokeWidth={2.3} />
              <Text style={{ ...typography.label.md, color: "#FFFFFF" }}>
                {t("insurance.policy.nextPremium")}:{" "}
                {new Date(e.nextPremiumDueAt).toLocaleDateString()}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
        </View>

        {showPaymentBanner ? (
          <Card
            elevated={false}
            style={{
              marginHorizontal: 16,
              marginTop: 4,
              padding: 16,
              gap: 12,
              borderWidth: 0,
              backgroundColor: colors.warningSoft,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.warning,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertTriangle size={18} color="#fff" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.title.sm, color: colors.text }}>
                  {isOverdue
                    ? t("insurance.policy.overdue") || "Payment overdue"
                    : t("insurance.policy.dueSoon") || "Premium due soon"}
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textMuted,
                    marginTop: 1,
                  }}
                >
                  LKR {e.premiumAmountLkr.toLocaleString()} ·{" "}
                  {isOverdue
                    ? `${-dueIn}d overdue`
                    : `due in ${dueIn}d`}
                </Text>
              </View>
            </View>
            <Button
              label={
                renewMut.isPending
                  ? t("common.loading") || "Loading…"
                  : t("insurance.payNow") || "Pay now"
              }
              icon={Wallet}
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
              padding: 16,
              gap: 10,
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
              <Text style={{ ...typography.title.sm, color: colors.text }}>
                {t(`insurance.status.${e.status}`)}
              </Text>
            </View>
            <Text style={{ ...typography.body.sm, color: colors.textMuted }}>
              {t("insurance.policy.statusNote") ||
                "Coverage is not active. Renew to restore benefits."}
            </Text>
            <Button
              label={t("insurance.renew") || "Renew"}
              variant="secondary"
              icon={Wallet}
              onPress={onRenew}
              loading={renewMut.isPending}
            />
          </Card>
        ) : null}

        <SectionHeader
          title={t("insurance.policy.actions")}
          style={{ paddingHorizontal: 16, paddingTop: 24 }}
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
            icon={CreditCard}
            onPress={() => router.push(`/insurance/ecard/${e.id}`)}
            style={{ flex: 1, minWidth: 140 }}
          />
          <Button
            label={t("insurance.renew")}
            variant="secondary"
            icon={Wallet}
            onPress={onRenew}
            loading={renewMut.isPending}
            style={{ flex: 1, minWidth: 140 }}
          />
          <Button
            label={t("insurance.submitClaim")}
            variant="secondary"
            icon={FilePlus}
            onPress={() => router.push("/insurance/claims/new")}
            style={{ flex: 1, minWidth: 140 }}
          />
        </View>

        {/* Provider card */}
        <SectionHeader
          title={t("insurance.provider.label")}
          style={{ paddingHorizontal: 16, paddingTop: 24 }}
        />
        <Card
          style={{
            marginHorizontal: 16,
            padding: 16,
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
              borderCurve: "continuous",
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={21} color={colors.primary} strokeWidth={2.3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.title.md, color: colors.text }}>
              {e.providerName ?? t("insurance.provider.label")}
            </Text>
            <Text
              style={{
                ...typography.body.sm,
                color: colors.textMuted,
                marginTop: 1,
              }}
            >
              {e.planName ?? t("insurance.policy.summary")}
            </Text>
          </View>
        </Card>

        {/* Schedule card */}
        <SectionHeader
          title={t("insurance.policy.schedule", "Schedule")}
          style={{ paddingHorizontal: 16, paddingTop: 24 }}
        />
        <Card style={{ marginHorizontal: 16, paddingVertical: 4, paddingHorizontal: 16 }}>
          <Detail
            icon={<CalendarClock size={15} color={colors.primary} strokeWidth={2.3} />}
            label={t("insurance.policy.startDate")}
            value={
              e.startDate ? new Date(e.startDate).toLocaleDateString() : "—"
            }
          />
          {e.endDate ? (
            <Detail
              icon={<CalendarClock size={15} color={colors.primary} strokeWidth={2.3} />}
              label={t("insurance.policy.endDate")}
              value={new Date(e.endDate).toLocaleDateString()}
              divider
            />
          ) : null}
          {e.lastPremiumPaidAt ? (
            <Detail
              icon={<CheckCircle2 size={15} color={colors.success} strokeWidth={2.3} />}
              label={t("insurance.policy.lastPaid") || "Last paid"}
              value={new Date(e.lastPremiumPaidAt).toLocaleDateString()}
              divider
            />
          ) : null}
        </Card>

        {/* Nominee */}
        {e.nomineeName ? (
          <>
            <SectionHeader
              title={t("insurance.policy.nominee", "Nominee")}
              style={{ paddingHorizontal: 16, paddingTop: 24 }}
            />
            <Card
              style={{
                marginHorizontal: 16,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <User2 size={19} color={colors.primary} strokeWidth={2.3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.title.sm, color: colors.text }}>
                  {e.nomineeName}
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textMuted,
                    marginTop: 1,
                    textTransform: "capitalize",
                  }}
                >
                  {e.nomineeRelation}
                  {e.nomineeDob
                    ? ` · ${new Date(e.nomineeDob).toLocaleDateString()}`
                    : ""}
                </Text>
              </View>
            </Card>
          </>
        ) : null}

        {/* Dependents */}
        {Array.isArray(e.dependents) && e.dependents.length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.policy.dependents")}
              style={{ paddingHorizontal: 16, paddingTop: 24 }}
            />
            <Card
              style={{
                marginHorizontal: 16,
                paddingVertical: 4,
                paddingHorizontal: 16,
              }}
            >
              {e.dependents.map((d: any, di: number) => (
                <View
                  key={d.id ?? d.name}
                  style={{
                    minHeight: 60,
                    paddingVertical: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderTopWidth: di === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      backgroundColor: colors.fill,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ ...typography.label.md, color: colors.text }}>
                      {(d.name ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.title.xs, fontSize: 15, color: colors.text }}>
                      {d.name}
                    </Text>
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.textMuted,
                        marginTop: 1,
                        textTransform: "capitalize",
                      }}
                    >
                      {d.relation}
                      {d.dob
                        ? ` · ${new Date(d.dob).toLocaleDateString()}`
                        : ""}
                    </Text>
                  </View>
                  {d.dob ? (
                    <Cake size={15} color={colors.textSubtle} />
                  ) : null}
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {e.status === "active" ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 28 }}>
            <Button
              label={t("insurance.policy.cancelPolicy") || "Cancel policy"}
              variant="danger"
              icon={X}
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
  divider,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  divider?: boolean;
}) {
  const { colors, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 52,
        paddingVertical: 10,
        borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
        borderTopColor: colors.separator,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          borderCurve: "continuous",
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <Text style={{ ...typography.body.md, color: colors.textMuted, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ ...typography.label.lg, color: colors.text }}>{value}</Text>
    </View>
  );
}

// @ts-nocheck
// Insurance plan detail. Photo hero + detail card + monthly/annual pick + CTA.

import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  Check,
  X,
  ShieldCheck,
  HeartPulse,
  Clock,
  ArrowRight,
  BadgePercent,
  Sparkles,
  ChevronLeft,
  Hospital,
  CalendarClock,
  Wallet,
  CreditCard,
  FileCheck2,
  FileSignature,
  Info,
  Hourglass,
} from "lucide-react-native";
import { useInsurancePlan } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { insurancePlanImage } from "@/components/insurance/PlanCard";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { useInsuranceStore } from "@/stores/insurance-store";

const humanize = (k: string) =>
  k
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());

export default function PlanDetail() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useInsurancePlan(planId ?? "");
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");
  const setPlan = useInsuranceStore((s) => s.setPlan);
  const setBillingCycle = useInsuranceStore((s) => s.setBillingCycle);
  const kicker = { ...typography.kicker, color: colors.primary, textTransform: "uppercase" } as const;

  const plan = data?.plan;
  const coverage = (plan?.coverageDetails ?? {}) as Record<string, unknown>;

  const detailRows = useMemo(() => {
    if (!plan) return [];
    const rows = [
      {
        icon: Hourglass,
        label: t("insurance.plan.preExistingWait"),
        value: t("insurance.plan.daysValue", { days: plan.preExistingWaitingDays ?? 0 }),
      },
      {
        icon: CalendarClock,
        label: t("insurance.plan.policyTerm"),
        value: t("insurance.plan.monthsValue", { months: plan.termMonths ?? 12 }),
      },
      {
        icon: Hospital,
        label: t("insurance.plan.networks"),
        value: String(plan.networkHospitalCount),
      },
    ];
    if (plan.coPaymentCapLkr > 0) {
      rows.push({
        icon: Wallet,
        label: t("insurance.plan.copayCap"),
        value: `LKR ${plan.coPaymentCapLkr.toLocaleString()}`,
      });
    }
    Object.entries(coverage).forEach(([k, v]) => {
      if (v === null || v === undefined || typeof v === "object") return;
      rows.push({ icon: FileCheck2, label: humanize(k), value: String(v) });
    });
    return rows;
  }, [plan, coverage, t]);

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ paddingTop: 8, gap: 12 }}>
          <Skeleton height={260} radius={radius.card} />
          <Skeleton height={200} radius={radius.card} />
        </View>
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16 }}>
          <EmptyState title={t("insurance.plan.notFound")} />
        </View>
      </Screen>
    );
  }

  const onBuy = () => {
    setPlan({ id: plan.id, name: plan.name, monthlyPremiumLkr: plan.monthlyPremiumLkr, annualPremiumLkr: plan.annualPremiumLkr });
    setBillingCycle(cycle);
    router.push("/insurance/quote");
  };
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/insurance/marketplace"));

  const savings = Math.max(0, plan.monthlyPremiumLkr * 12 - plan.annualPremiumLkr);
  const savingsPct = plan.annualDiscountPct > 0
    ? Math.round(plan.annualDiscountPct)
    : Math.round((savings / Math.max(1, plan.monthlyPremiumLkr * 12)) * 100);
  const price = cycle === "monthly" ? plan.monthlyPremiumLkr : plan.annualPremiumLkr;
  const heroImage = insurancePlanImage(plan.planType);
  const providerName = plan.providerName ?? t("insurance.provider.label");

  const billingOptions = [
    {
      key: "monthly" as const,
      title: t("insurance.plan.payMonthly"),
      amount: plan.monthlyPremiumLkr,
      per: t("insurance.plan.perMonth"),
      sub: t("insurance.plan.flexible"),
    },
    {
      key: "annual" as const,
      title: t("insurance.plan.payAnnual"),
      amount: plan.annualPremiumLkr,
      per: t("insurance.plan.perYear"),
      sub: t("insurance.plan.equivMonthly", { amount: Math.round(plan.annualPremiumLkr / 12).toLocaleString() }),
    },
  ];

  const steps = [
    { icon: FileSignature, label: t("insurance.plan.steps.quote"), sub: t("insurance.plan.steps.quoteSub") },
    { icon: CreditCard, label: t("insurance.plan.steps.pay"), sub: t("insurance.plan.steps.paySub") },
    { icon: ShieldCheck, label: t("insurance.plan.steps.covered"), sub: t("insurance.plan.steps.coveredSub") },
  ];

  return (
    <Screen padded={false} edges={[]} bottomInset={false}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 132 + insets.bottom }}
      >
        {/* Photo hero */}
        <View style={{ height: 296, backgroundColor: colors.primarySoft }}>
          {heroImage ? (
            <Image source={heroImage} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}
          <LinearGradient
            colors={["rgba(4,18,32,0.55)", "rgba(4,18,32,0.08)", "rgba(4,18,32,0.72)"]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              position: "absolute",
              top: insets.top + 14,
              left: 68,
              backgroundColor: "rgba(255,255,255,0.92)",
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 999,
              borderCurve: "continuous",
            }}
          >
            <Text style={{ ...typography.label.xs, fontSize: 10.5, color: colors.primary, letterSpacing: 0.8, textTransform: "uppercase" }}>
              {t(`insurance.planTypes.${plan.planType}`)}
            </Text>
          </View>
          {plan.isFeatured ? (
            <View
              style={{
                position: "absolute",
                top: insets.top + 14,
                right: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: "rgba(255,255,255,0.92)",
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 999,
                borderCurve: "continuous",
              }}
            >
              <Sparkles size={12} color={colors.primary} strokeWidth={2.6} />
              <Text style={{ ...typography.label.xs, fontSize: 11, color: colors.primary }}>
                {t("insurance.plan.featured")}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Detail card, overlapping the hero */}
        <Card variant="elevated" style={{ marginHorizontal: 16, marginTop: -52, padding: 20 }}>
          <Text style={{ ...typography.display.sm, fontSize: 21, lineHeight: 26, color: colors.text }}>
            {plan.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 }}>
            <ShieldCheck size={14} color={colors.primary} strokeWidth={2.4} />
            <Text numberOfLines={1} style={{ ...typography.body.sm, color: colors.textMuted, flexShrink: 1 }}>
              {providerName}
            </Text>
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: 16 }} />

          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ ...typography.overline, color: colors.textSubtle, marginBottom: 2, textTransform: "uppercase" }}>
                {t("insurance.plan.sumInsured")}
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ ...typography.display.lg, fontSize: 28, lineHeight: 32, color: colors.text }}>
                LKR {plan.coverageSummaryLkr.toLocaleString()}
              </Text>
            </View>
            {savingsPct > 0 ? (
              <View style={{ backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderCurve: "continuous" }}>
                <Text style={{ ...typography.label.md, color: colors.success }}>
                  {t("insurance.plan.savePct", { pct: savingsPct })}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <MetaPill
              icon={<Hospital size={13} color={colors.info} strokeWidth={2.4} />}
              label={t("insurance.plan.networks_other", { count: plan.networkHospitalCount })}
              bg={colors.infoSoft}
              fg={colors.info}
            />
            <MetaPill
              icon={<HeartPulse size={13} color={colors.success} strokeWidth={2.4} />}
              label={t("insurance.plan.copayPct", { pct: plan.copayPct })}
              bg={colors.successSoft}
              fg={colors.success}
            />
            {plan.waitingPeriodDays > 0 ? (
              <MetaPill
                icon={<Clock size={13} color={colors.warning} strokeWidth={2.4} />}
                label={t("insurance.plan.waiting", { days: plan.waitingPeriodDays })}
                bg={colors.warningSoft}
                fg={colors.warning}
              />
            ) : null}
            <MetaPill
              icon={<Wallet size={13} color={colors.textMuted} strokeWidth={2.4} />}
              label={t("insurance.plan.deductible", { amount: plan.deductibleLkr.toLocaleString() })}
              bg={colors.fill}
              fg={colors.textMuted}
            />
          </View>
        </Card>

        {/* How it works */}
        <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 18, paddingVertical: 16 }}>
          <Text style={{ ...kicker, marginBottom: 14 }}>{t("insurance.plan.howItWorks")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {steps.map((step, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong, marginHorizontal: 4, marginBottom: 24 }} />
                )}
                <View style={{ alignItems: "center", width: 72 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 7,
                    }}
                  >
                    <step.icon size={20} color={colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={{ ...typography.label.sm, color: colors.text }}>{step.label}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ ...typography.caption, fontSize: 10.5, color: colors.textSubtle, marginTop: 1 }}>
                    {step.sub}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </Card>

        {/* Billing pick */}
        <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 18 }}>
          <Text style={{ ...kicker, marginBottom: 12 }}>{t("insurance.plan.choosePayment")}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {billingOptions.map((opt) => {
              const selected = cycle === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setCycle(opt.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
                    padding: 14,
                    paddingTop: 16,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ ...typography.label.md, color: selected ? colors.primary : colors.textMuted }}>
                      {opt.title}
                    </Text>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: selected ? 0 : 1.5,
                        borderColor: colors.borderStrong,
                        backgroundColor: selected ? colors.primary : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selected ? <Check size={12} color={colors.onPrimary} strokeWidth={3.2} /> : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 10 }}>
                    <Text style={{ ...typography.label.sm, color: colors.textMuted }}>LKR</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ ...typography.title.lg, color: colors.text, flexShrink: 1 }}>
                      {opt.amount.toLocaleString()}
                    </Text>
                  </View>
                  <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 1 }}>{opt.per}</Text>
                  <Text numberOfLines={1} style={{ ...typography.caption, fontSize: 11, color: colors.textSubtle, marginTop: 8 }}>
                    {opt.sub}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {savings > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14 }}>
              <BadgePercent size={15} color={cycle === "annual" ? colors.success : colors.accent2} strokeWidth={2.4} />
              <Text style={{ ...typography.label.sm, color: cycle === "annual" ? colors.success : colors.textMuted }}>
                {cycle === "annual"
                  ? t("insurance.plan.yearlySavings", { amount: savings.toLocaleString() })
                  : t("insurance.plan.save", { pct: savingsPct })}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* What's covered */}
        {Array.isArray(plan.keyFeatures) && plan.keyFeatures.length > 0 ? (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 18, paddingBottom: 8 }}>
            <Text style={{ ...kicker, marginBottom: 10 }}>{t("insurance.plan.whatsCovered")}</Text>
            {plan.keyFeatures.map((f: string, i: number) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 50,
                  paddingVertical: 10,
                  borderBottomWidth: i < plan.keyFeatures.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: colors.separator,
                }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 10, borderCurve: "continuous", backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Check size={16} color={colors.success} strokeWidth={2.6} />
                </View>
                <Text style={{ ...typography.title.xs, fontSize: 14, color: colors.text, flex: 1 }}>{f}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Plan details */}
        {detailRows.length > 0 ? (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 18, paddingBottom: 8 }}>
            <Text style={{ ...kicker, marginBottom: 6 }}>{t("insurance.plan.details")}</Text>
            {detailRows.map((r, i) => (
              <View
                key={r.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 52,
                  paddingVertical: 10,
                  gap: 12,
                  borderBottomWidth: i < detailRows.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: colors.separator,
                }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 10, borderCurve: "continuous", backgroundColor: colors.well, alignItems: "center", justifyContent: "center" }}>
                  <r.icon size={16} color={colors.textMuted} strokeWidth={2.2} />
                </View>
                <Text numberOfLines={2} style={{ ...typography.body.md, color: colors.textMuted, flex: 1 }}>
                  {r.label}
                </Text>
                <Text numberOfLines={2} style={{ ...typography.label.md, color: colors.text, maxWidth: "48%", textAlign: "right" }}>
                  {r.value}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Exclusions */}
        {Array.isArray(plan.exclusions) && plan.exclusions.length > 0 ? (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 18, paddingBottom: 8 }}>
            <Text style={{ ...kicker, marginBottom: 10 }}>{t("insurance.plan.exclusions")}</Text>
            {plan.exclusions.map((x: string, i: number) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 50,
                  paddingVertical: 10,
                  borderBottomWidth: i < plan.exclusions.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: colors.separator,
                }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 10, borderCurve: "continuous", backgroundColor: colors.dangerSoft, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <X size={16} color={colors.danger} strokeWidth={2.6} />
                </View>
                <Text style={{ ...typography.body.sm, color: colors.textMuted, flex: 1 }}>{x}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Disclaimer */}
        <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 20, marginTop: 20 }}>
          <Info size={14} color={colors.textSubtle} strokeWidth={2.2} style={{ marginTop: 2 }} />
          <Text style={{ ...typography.body.xs, color: colors.textSubtle, flex: 1 }}>
            {t("insurance.plan.disclaimer")}
          </Text>
        </View>
      </ScrollView>

      {/* Glass back button over the hero */}
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={t("common.back", "Back")}
        hitSlop={10}
        style={{
          position: "absolute",
          top: insets.top + 14,
          left: 16,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(8,24,40,0.34)",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255,255,255,0.35)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: -2 }} />
      </Pressable>

      {/* Bottom CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.bgElevated,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12) + 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {cycle === "monthly" ? t("insurance.plan.payMonthly") : t("insurance.plan.payAnnual")}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ ...typography.title.lg, color: colors.text }}>
              LKR {price.toLocaleString()}
            </Text>
          </View>
          <Button
            label={t("insurance.plan.getQuoteShort")}
            accessibilityLabel={t("insurance.plan.getQuote")}
            onPress={onBuy}
            iconRight={ArrowRight}
            size="lg"
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Screen>
  );
}

function MetaPill({
  icon,
  label,
  bg,
  fg,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  fg: string;
}) {
  const { typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        gap: 6,
      }}
    >
      {icon}
      <Text style={{ ...typography.label.sm, color: fg }}>{label}</Text>
    </View>
  );
}

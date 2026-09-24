// @ts-nocheck
import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  Calendar,
  CheckCircle2,
  Clock,
} from "lucide-react-native";
import {
  useDoctorEarningsSummary,
  useDoctorEarningsTimeseries,
  useDoctorPayouts,
} from "@/hooks/useApi";
import { Screen, ErrorState } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

const PERIODS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
] as const;

function fmtLkr(n: number): string {
  if (!isFinite(n)) return "LKR 0";
  if (n >= 1_000_000) return `LKR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `LKR ${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `LKR ${Math.round(n)}`;
}

function BarChart({
  series,
}: {
  series: { bucket: string; total: number; count: number }[];
}) {
  const { colors, radius, fontFamily } = useTheme();
  const max = Math.max(1, ...series.map((s) => s.total));
  if (!series.length) return null;
  // Show last 14 buckets max for legibility.
  const visible = series.slice(-14);
  const barWidthPct = 100 / visible.length;
  const labelStride = Math.max(1, Math.floor(visible.length / 5));
  return (
    <View style={{ height: 140, marginTop: 12 }}>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
        {visible.map((s, idx) => {
          const heightPct = Math.max(4, (s.total / max) * 100);
          return (
            <View
              key={`${s.bucket}-${idx}`}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: `${heightPct}%`,
                  backgroundColor: idx === visible.length - 1 ? colors.primary : colors.primarySoft,
                  borderRadius: 5,
                  borderCurve: "continuous",
                }}
              />
            </View>
          );
        })}
      </View>
      <View
        style={{
          flexDirection: "row",
          marginTop: 4,
          paddingHorizontal: 2,
        }}
      >
        {visible.map((s, idx) => (
          <View
            key={`lbl-${s.bucket}-${idx}`}
            style={{
              flex: 1,
              alignItems: "center",
            }}
          >
            {idx % labelStride === 0 || idx === visible.length - 1 ? (
              <Text
                style={{
                  fontSize: 10,
                  color: colors.textSubtle,
                  fontFamily: fontFamily.bodyMedium ?? fontFamily.body,
                  fontVariant: ["tabular-nums"],
                }}
                numberOfLines={1}
              >
                {s.bucket.slice(5)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function EarningsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, fontFamily, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.separator;
  const card = {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous" as const,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    ...(isDark ? {} : shadow.sm),
  };
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");

  const { data: summary, isLoading, isError, refetch } = useDoctorEarningsSummary(period);
  const { data: payoutData, isLoading: payoutsLoading } = useDoctorPayouts(20);

  const from = summary?.start || "";
  const to = summary?.end || "";
  const bucket: "day" | "week" = period === "year" ? "week" : period === "quarter" ? "week" : "day";
  const { data: tsData } = useDoctorEarningsTimeseries({
    from,
    to,
    bucket,
  });

  const trend = summary?.trendPct ?? 0;
  const trendPositive = trend >= 0;

  const payouts = payoutData?.payouts || [];

  const handlePeriod = useCallback((p: typeof PERIODS[number]["key"]) => {
    setPeriod(p);
  }, []);

  if (isError) {
    return (
      <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load earnings")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
          }}
        >
          <Text style={[typography.display.lg, { color: colors.text }]}>
            {t("earnings.title")}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 2 },
            ]}
          >
            {t("earnings.subtitle")}
          </Text>
        </View>

        {/* Period chips */}
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: spacing.lg,
            padding: 3,
            gap: 2,
            borderRadius: 12,
            borderCurve: "continuous",
            backgroundColor: colors.fill,
            marginBottom: spacing.lg,
          }}
        >
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => handlePeriod(p.key)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 9,
                  borderCurve: "continuous",
                  backgroundColor: active ? colors.surface : "transparent",
                  opacity: pressed && !active ? 0.6 : 1,
                  ...(active ? shadow.xs : shadow.none),
                })}
              >
                <Text
                  style={[
                    active ? typography.label.md : typography.body.sm,
                    { color: active ? colors.text : colors.textMuted },
                  ]}
                >
                  {t(`earnings.period.${p.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Hero card */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            borderRadius: radius.xxl,
            borderCurve: "continuous",
            padding: spacing.xl,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.22)",
            ...(isDark ? {} : shadow.hero),
          }}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -60,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: "rgba(255,255,255,0.8)",
              fontFamily: fontFamily.displayBold,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            {t("earnings.totalThisPeriod")}
          </Text>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginTop: 8 }} />
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                typography.display.lg,
                {
                  fontSize: 40,
                  lineHeight: 46,
                  color: "#FFFFFF",
                  marginTop: 6,
                  letterSpacing: -1.4,
                  fontVariant: ["tabular-nums"],
                },
              ]}
            >
              {fmtLkr(summary?.totalLkr ?? 0)}
            </Text>
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              marginTop: 10,
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.28)",
            }}
          >
            {trendPositive ? (
              <TrendingUp size={14} color="#FFFFFF" strokeWidth={2.4} />
            ) : (
              <TrendingDown size={14} color="#FFFFFF" strokeWidth={2.4} />
            )}
            <Text
              style={{
                fontSize: 13,
                color: "#FFFFFF",
                fontFamily: fontFamily.bodyBold,
                fontWeight: "700",
              }}
            >
              {trendPositive ? "+" : ""}
              {trend.toFixed(1)}%
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                marginLeft: 4,
              }}
            >
              {t("earnings.vsPrevious")}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              marginTop: spacing.lg,
              paddingTop: spacing.md,
              gap: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: "rgba(255,255,255,0.24)",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: fontFamily.displayBold,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {t("earnings.visits")}
              </Text>
              <Text
                style={[
                  typography.display.sm,
                  { color: "#FFFFFF", marginTop: 2, fontVariant: ["tabular-nums"] },
                ]}
              >
                {summary?.visitCount ?? 0}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: fontFamily.displayBold,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {t("earnings.avgPerVisit")}
              </Text>
              <Text
                style={[
                  typography.display.sm,
                  { color: "#FFFFFF", marginTop: 2, fontVariant: ["tabular-nums"] },
                ]}
              >
                {fmtLkr(summary?.avgPerVisitLkr ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
            padding: spacing.lg,
            ...card,
          }}
        >
          <Text style={[typography.title.md, { color: colors.text }]}>
            {t("earnings.chart")}
          </Text>
          {tsData?.series && tsData.series.length > 0 ? (
            <BarChart series={tsData.series} />
          ) : (
            <View style={{ paddingVertical: spacing.lg, alignItems: "center" }}>
              <Text style={[typography.body.sm, { color: colors.textSubtle }]}>
                {t("earnings.noChart")}
              </Text>
            </View>
          )}
        </View>

        {/* Pending payout banner */}
        {summary?.pendingPayoutLkr ? (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.md,
              padding: spacing.md,
              borderRadius: 16,
              borderCurve: "continuous",
              backgroundColor: colors.warningSoft,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Clock size={20} color={colors.warning} strokeWidth={2.2} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[typography.label.md, { color: colors.text }]}>
                {t("earnings.pendingTitle", { amount: fmtLkr(summary.pendingPayoutLkr) })}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Payout history */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xxl }}>
          <Text
            style={[
              typography.title.lg,
              { color: colors.text, marginBottom: spacing.md, paddingHorizontal: 4 },
            ]}
          >
            {t("earnings.payoutsTitle")}
          </Text>

          {payoutsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : payouts.length === 0 ? (
            <View
              style={{
                padding: spacing.xl,
                alignItems: "center",
                ...card,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Wallet size={24} color={colors.textMuted} strokeWidth={1.8} />
              </View>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, marginTop: spacing.md, textAlign: "center" },
                ]}
              >
                {t("earnings.noPayouts")}
              </Text>
            </View>
          ) : (
            <View style={{ ...card, overflow: "hidden" }}>
            {payouts.map((p, pIdx) => {
              const isPaid = p.status === "paid";
              const isFailed = p.status === "failed";
              return (
                <View
                  key={p.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 64,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                  }}
                >
                  {pIdx < payouts.length - 1 ? (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        left: spacing.lg + 36 + spacing.md,
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: colors.separator,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      backgroundColor: isPaid
                        ? colors.successSoft
                        : isFailed
                        ? colors.dangerSoft
                        : colors.warningSoft,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: spacing.md,
                    }}
                  >
                    {isPaid ? (
                      <CheckCircle2 size={18} color={colors.success} strokeWidth={2} />
                    ) : isFailed ? (
                      <Receipt size={18} color={colors.danger} strokeWidth={2} />
                    ) : (
                      <Calendar size={18} color={colors.warning} strokeWidth={2} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontVariant: ["tabular-nums"] },
                      ]}
                    >
                      {fmtLkr(p.amountLkr)}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                      {t(`earnings.payoutStatus.${p.status}`)} · {p.eventCount} {t("earnings.events")}
                    </Text>
                    <Text style={[typography.caption, { fontSize: 11, color: colors.textSubtle, marginTop: 1 }]}>
                      {p.periodStart} → {p.periodEnd}
                    </Text>
                  </View>
                  <Text
                    style={[
                      typography.label.xs,
                      {
                        overflow: "hidden",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        color: isPaid
                          ? colors.success
                          : isFailed
                          ? colors.danger
                          : colors.warning,
                        backgroundColor: isPaid
                          ? colors.successSoft
                          : isFailed
                          ? colors.dangerSoft
                          : colors.warningSoft,
                      },
                    ]}
                  >
                    {p.status.toUpperCase()}
                  </Text>
                </View>
              );
            })}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

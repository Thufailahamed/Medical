// @ts-nocheck
import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
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
                  backgroundColor: colors.primary,
                  opacity: 0.85,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
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
                  fontSize: 9,
                  color: colors.textSubtle,
                  fontFamily: fontFamily.bodyBold,
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
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
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
          <Text
            style={[
              typography.display.lg,
              {
                color: colors.text,
                fontFamily: fontFamily.displayBold,
                fontSize: 28,
                lineHeight: 34,
              },
            ]}
          >
            {t("earnings.title")}
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.textSubtle, marginTop: 4 },
            ]}
          >
            {t("earnings.subtitle")}
          </Text>
        </View>

        {/* Period chips */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: spacing.lg,
            gap: 8,
            marginBottom: spacing.md,
          }}
        >
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => handlePeriod(p.key)}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: radius.full,
                  backgroundColor: active
                    ? colors.primary
                    : pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                })}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: active ? "#FFFFFF" : colors.text,
                    fontFamily: fontFamily.bodyBold,
                  }}
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
            borderRadius: 20,
            padding: spacing.lg,
            backgroundColor: colors.primary,
            overflow: "hidden",
          }}
        >
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
              style={{
                fontSize: 36,
                fontWeight: "800",
                color: "#FFFFFF",
                fontFamily: fontFamily.displayBold,
                marginTop: 6,
                letterSpacing: -1,
              }}
            >
              {fmtLkr(summary?.totalLkr ?? 0)}
            </Text>
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 8,
              gap: 6,
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
              marginTop: spacing.md,
              gap: spacing.md,
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
                style={{
                  fontSize: 20,
                  fontWeight: "800",
                  color: "#FFFFFF",
                  fontFamily: fontFamily.displayBold,
                  marginTop: 2,
                }}
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
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: "#FFFFFF",
                  fontFamily: fontFamily.displayBold,
                  marginTop: 2,
                }}
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
            marginTop: spacing.md,
            borderRadius: 16,
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "800",
              color: colors.textSubtle,
              fontFamily: fontFamily.displayBold,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            {t("earnings.chart")}
          </Text>
          {tsData?.series && tsData.series.length > 0 ? (
            <BarChart series={tsData.series} />
          ) : (
            <View style={{ paddingVertical: spacing.lg, alignItems: "center" }}>
              <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
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
              borderRadius: radius.md,
              backgroundColor: colors.warningSoft || colors.primarySoft,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Clock size={20} color={colors.text} strokeWidth={2} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.text,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {t("earnings.pendingTitle", { amount: fmtLkr(summary.pendingPayoutLkr) })}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Payout history */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "800",
              color: colors.textSubtle,
              fontFamily: fontFamily.displayBold,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: spacing.sm,
            }}
          >
            {t("earnings.payoutsTitle")}
          </Text>

          {payoutsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : payouts.length === 0 ? (
            <View
              style={{
                padding: spacing.lg,
                alignItems: "center",
                backgroundColor: colors.surfaceMuted,
                borderRadius: radius.md,
              }}
            >
              <Wallet size={28} color={colors.textSubtle} strokeWidth={1.5} />
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSubtle,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                {t("earnings.noPayouts")}
              </Text>
            </View>
          ) : (
            payouts.map((p) => {
              const isPaid = p.status === "paid";
              const isFailed = p.status === "failed";
              return (
                <View
                  key={p.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: isPaid
                        ? "rgba(16, 185, 129, 0.12)"
                        : isFailed
                        ? "rgba(244, 63, 94, 0.12)"
                        : "rgba(245, 158, 11, 0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: spacing.md,
                    }}
                  >
                    {isPaid ? (
                      <CheckCircle2 size={18} color="#10B981" strokeWidth={2} />
                    ) : isFailed ? (
                      <Receipt size={18} color="#F43F5E" strokeWidth={2} />
                    ) : (
                      <Calendar size={18} color="#F59E0B" strokeWidth={2} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: colors.text,
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
                      {fmtLkr(p.amountLkr)}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSubtle, marginTop: 2 }}>
                      {t(`earnings.payoutStatus.${p.status}`)} · {p.eventCount} {t("earnings.events")}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSubtle, marginTop: 2 }}>
                      {p.periodStart} → {p.periodEnd}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: isPaid
                        ? "#10B981"
                        : isFailed
                        ? "#F43F5E"
                        : "#F59E0B",
                      fontFamily: fontFamily.displayBold,
                      letterSpacing: 0.6,
                    }}
                  >
                    {p.status.toUpperCase()}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

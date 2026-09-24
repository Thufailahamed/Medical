// @ts-nocheck
import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
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
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Skeleton,
  ErrorState,
} from "@/components/ui";
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

function lkrParts(n: number): { currency: string; value: string } {
  if (!isFinite(n)) return { currency: "LKR", value: "0" };
  if (n >= 1_000_000) return { currency: "LKR", value: `${(n / 1_000_000).toFixed(1)}M` };
  if (n >= 1_000) return { currency: "LKR", value: `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k` };
  return { currency: "LKR", value: `${Math.round(n)}` };
}

function BarChart({
  series,
}: {
  series: { bucket: string; total: number; count: number }[];
}) {
  const { colors, fontFamily } = useTheme();
  const max = Math.max(1, ...series.map((s) => s.total));
  if (!series.length) return null;
  // Show last 14 buckets max for legibility.
  const visible = series.slice(-14);
  const labelStride = Math.max(1, Math.floor(visible.length / 5));
  return (
    <View style={{ height: 164 }}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        {[0.25, 0.5, 0.75].map((line) => (
          <View
            key={line}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: `${line * 100}%`,
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.separator,
            }}
          />
        ))}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 6,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.separator,
          }}
        >
          {visible.map((s, idx) => {
            const heightPct = Math.max(5, (s.total / max) * 100);
            const latest = idx === visible.length - 1;
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
                    width: "72%",
                    height: `${heightPct}%`,
                    minHeight: 6,
                    backgroundColor: latest ? colors.primary : colors.primarySoft,
                    borderRadius: 7,
                    borderCurve: "continuous",
                    opacity: latest ? 1 : 0.88,
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          marginTop: 6,
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
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");
  const [refreshing, setRefreshing] = useState(false);

  const { data: summary, isLoading, isError, refetch } = useDoctorEarningsSummary(period);
  const {
    data: payoutData,
    isLoading: payoutsLoading,
    refetch: refetchPayouts,
  } = useDoctorPayouts(20);

  const from = summary?.start || "";
  const to = summary?.end || "";
  const bucket: "day" | "week" = period === "year" ? "week" : period === "quarter" ? "week" : "day";
  const {
    data: tsData,
    isLoading: trendLoading,
    refetch: refetchTrend,
  } = useDoctorEarningsTimeseries({
    from,
    to,
    bucket,
  });

  const trend = summary?.trendPct ?? 0;
  const trendPositive = trend >= 0;

  const payouts = payoutData?.payouts || [];
  const amount = lkrParts(summary?.totalLkr ?? 0);

  const handlePeriod = useCallback((p: typeof PERIODS[number]["key"]) => {
    setPeriod(p);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchTrend(), refetchPayouts()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchTrend, refetchPayouts]);

  if (isError) {
    return (
      <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.surfaceSubtle }}>
        <ScreenHeader
          variant="hero"
          back
          title={t("earnings.title")}
          subtitle={t("earnings.subtitle")}
          style={{ backgroundColor: "transparent" }}
        />
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
    <Screen
      padded={false}
      scroll={false}
      edges={["top"]}
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <ScreenHeader
        variant="hero"
        back
        title={t("earnings.title")}
        subtitle={t("earnings.subtitle")}
        style={{ backgroundColor: "transparent" }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Period chips */}
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: spacing.lg,
            padding: 4,
            gap: 3,
            borderRadius: radius.full,
            borderCurve: "continuous",
            backgroundColor: colors.fill,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.separator,
            marginBottom: spacing.lg,
          }}
        >
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => handlePeriod(p.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.full - 4,
                  borderCurve: "continuous",
                  backgroundColor: active ? colors.surface : "transparent",
                  opacity: pressed && !active ? 0.65 : 1,
                  ...(active ? shadow.xs : shadow.none),
                })}
              >
                <Text
                  style={[
                    active ? typography.label.md : typography.body.sm,
                    { color: active ? colors.primary : colors.textMuted },
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
              top: -72,
              right: -48,
              width: 190,
              height: 190,
              borderRadius: 95,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -56,
              left: -44,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: "rgba(255,255,255,0.07)",
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: "rgba(255,255,255,0.82)",
                  fontFamily: fontFamily.displayBold,
                  letterSpacing: 1.15,
                  textTransform: "uppercase",
                }}
              >
                {t("earnings.totalThisPeriod")}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.72)",
                  marginTop: 4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {summary?.start && summary?.end
                  ? `${summary.start} → ${summary.end}`
                  : t(`earnings.period.${period}`)}
              </Text>
            </View>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.26)",
              }}
            >
              <Wallet size={21} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </View>

          {isLoading ? (
            <View
              style={{
                width: 190,
                height: 44,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.22)",
                marginTop: spacing.md,
              }}
            />
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 16,
                  color: "rgba(255,255,255,0.78)",
                  fontFamily: fontFamily.bodyBold,
                  fontWeight: "800",
                  letterSpacing: 0.8,
                }}
              >
                {amount.currency}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  typography.display.lg,
                  {
                    fontSize: 44,
                    lineHeight: 50,
                    color: "#FFFFFF",
                    marginTop: -2,
                    letterSpacing: -1.6,
                    fontVariant: ["tabular-nums"],
                  },
                ]}
              >
                {amount.value}
              </Text>
            </View>
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              marginTop: spacing.md,
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.28)",
            }}
          >
            {trendPositive ? (
              <TrendingUp size={14} color="#FFFFFF" strokeWidth={2.5} />
            ) : (
              <TrendingDown size={14} color="#FFFFFF" strokeWidth={2.5} />
            )}
            <Text
              style={{
                fontSize: 13,
                color: "#FFFFFF",
                fontFamily: fontFamily.bodyBold,
                fontWeight: "800",
              }}
            >
              {trendPositive ? "+" : ""}
              {trend.toFixed(1)}%
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.84)",
                marginLeft: 2,
              }}
            >
              {t("earnings.vsPrevious")}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              marginTop: spacing.xl,
              paddingTop: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: "rgba(255,255,255,0.24)",
            }}
          >
            <HeroMetric
              label={t("earnings.visits")}
              value={`${summary?.visitCount ?? 0}`}
            />
            <HeroMetric
              label={t("earnings.avgPerVisit")}
              value={fmtLkr(summary?.avgPerVisitLkr ?? 0)}
              last
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
          }}
        >
          <EarningsStatCard
            icon={Wallet}
            label={t("earnings.consultationFee", "Consultation fee")}
            value={fmtLkr(summary?.consultationFee ?? 0)}
            tone="primary"
          />
          <EarningsStatCard
            icon={Clock}
            label={t("earnings.pendingPayout", "Pending payout")}
            value={fmtLkr(summary?.pendingPayoutLkr ?? 0)}
            tone={summary?.pendingPayoutLkr ? "warning" : "neutral"}
          />
        </View>

        {/* Revenue trend */}
        <Card padded={false} style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primarySoft,
              }}
            >
              <TrendingUp size={20} color={colors.primary} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {t("earnings.chart")}
              </Text>
              <Text
                style={[typography.body.xs, { color: colors.textMuted, marginTop: 2 }]}
                numberOfLines={1}
              >
                {summary?.start && summary?.end
                  ? `${summary.start} → ${summary.end}`
                  : t(`earnings.period.${period}`)}
              </Text>
            </View>
            <Pill label={t(`earnings.period.${period}`)} tone="neutral" size="sm" />
          </View>
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
            }}
          >
            {trendLoading ? (
              <Skeleton height={164} radius={18} />
            ) : tsData?.series && tsData.series.length > 0 ? (
              <BarChart series={tsData.series} />
            ) : (
              <TrendEmptyState />
            )}
          </View>
        </Card>

        {/* Payout history */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing.sm,
              paddingHorizontal: 4,
            }}
          >
            <Text style={[typography.title.lg, { color: colors.text }]}>
              {t("earnings.payoutsTitle")}
            </Text>
            {payouts.length ? (
              <Pill label={`${payouts.length}`} tone="neutral" size="sm" />
            ) : null}
          </View>

          {payoutsLoading ? (
            <Card padded={false}>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <Skeleton height={54} radius={14} />
                <Skeleton height={54} radius={14} />
              </View>
            </Card>
          ) : payouts.length === 0 ? (
            <Card padded={false}>
              <PayoutEmptyState />
            </Card>
          ) : (
            <Card padded={false}>
              {payouts.map((p, pIdx) => (
                <PayoutRow
                  key={p.id}
                  payout={p}
                  last={pIdx === payouts.length - 1}
                />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function EarningsStatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "neutral" | "primary" | "warning" | "success" | "danger" | "info";
}) {
  const { colors, spacing, typography } = useTheme();
  const palette =
    tone === "warning"
      ? { bg: colors.warningSoft, fg: colors.warning }
      : tone === "success"
      ? { bg: colors.successSoft, fg: colors.success }
      : tone === "danger"
      ? { bg: colors.dangerSoft, fg: colors.danger }
      : tone === "info"
      ? { bg: colors.infoSoft, fg: colors.info }
      : tone === "primary"
      ? { bg: colors.primarySoft, fg: colors.primary }
      : { bg: colors.fill, fg: colors.textMuted };

  return (
    <Card padded={false} style={{ flex: 1 }}>
      <View
        style={{
          minHeight: 104,
          padding: spacing.md,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.bg,
          }}
        >
          <Icon size={19} color={palette.fg} strokeWidth={2.2} />
        </View>
        <View>
          <Text
            numberOfLines={1}
            style={[
              typography.title.md,
              { color: colors.text, fontVariant: ["tabular-nums"] },
            ]}
          >
            {value}
          </Text>
          <Text
            numberOfLines={1}
            style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
          >
            {label}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function HeroMetric({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { typography, fontFamily } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        paddingRight: last ? 0 : 12,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "800",
          color: "rgba(255,255,255,0.68)",
          fontFamily: fontFamily.displayBold,
          letterSpacing: 0.9,
          textTransform: "uppercase",
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          typography.title.lg,
          {
            color: "#FFFFFF",
            marginTop: 3,
            fontVariant: ["tabular-nums"],
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function TrendEmptyState() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.md,
      }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 19,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.fill,
          marginBottom: spacing.md,
        }}
      >
        <TrendingUp size={26} color={colors.textMuted} strokeWidth={1.9} />
      </View>
      <Text style={[typography.title.sm, { color: colors.text, textAlign: "center" }]}>
        {t("earnings.noChart")}
      </Text>
      <Text
        style={[
          typography.body.xs,
          { color: colors.textMuted, textAlign: "center", marginTop: 4 },
        ]}
      >
        {t("earnings.noChartBody", "Completed visits and paid consultations will appear here.")}
      </Text>
    </View>
  );
}

function PayoutEmptyState() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xxl,
      }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 20,
          borderCurve: "continuous",
          backgroundColor: colors.fill,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.md,
        }}
      >
        <Wallet size={28} color={colors.textMuted} strokeWidth={1.8} />
      </View>
      <Text style={[typography.title.sm, { color: colors.text, textAlign: "center" }]}>
        {t("earnings.noPayoutsTitle", "No payouts yet")}
      </Text>
      <Text
        style={[
          typography.body.sm,
          {
            color: colors.textMuted,
            marginTop: spacing.xs,
            textAlign: "center",
            maxWidth: 280,
          },
        ]}
      >
        {t("earnings.noPayouts")}
      </Text>
    </View>
  );
}

function PayoutRow({
  payout,
  last,
}: {
  payout: {
    id: string;
    amountLkr: number;
    eventCount: number;
    status: "pending" | "paid" | "failed";
    periodStart: string;
    periodEnd: string;
  };
  last?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const isPaid = payout.status === "paid";
  const isFailed = payout.status === "failed";
  const Icon = isPaid ? CheckCircle2 : isFailed ? Receipt : Calendar;
  const iconColor = isPaid ? colors.success : isFailed ? colors.danger : colors.warning;
  const iconBg = isPaid ? colors.successSoft : isFailed ? colors.dangerSoft : colors.warningSoft;
  const tone = isPaid ? "success" : isFailed ? "danger" : "warning";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 72,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
      }}
    >
      {!last ? (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            left: spacing.lg + 42 + spacing.md,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
          }}
        />
      ) : null}
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          borderCurve: "continuous",
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        }}
      >
        <Icon size={19} color={iconColor} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            typography.title.md,
            { color: colors.text, fontVariant: ["tabular-nums"] },
          ]}
        >
          {fmtLkr(payout.amountLkr)}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          {t(`earnings.payoutStatus.${payout.status}`)} · {payout.eventCount} {t("earnings.events")}
        </Text>
        <Text
          style={[
            typography.caption,
            { fontSize: 11, color: colors.textSubtle, marginTop: 2 },
          ]}
          numberOfLines={1}
        >
          {payout.periodStart} → {payout.periodEnd}
        </Text>
      </View>
      <Pill
        label={t(`earnings.payoutStatus.${payout.status}`)}
        tone={tone}
        size="sm"
      />
    </View>
  );
}

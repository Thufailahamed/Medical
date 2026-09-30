// @ts-nocheck
import { useState, useCallback, useMemo } from "react";
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
  Minus,
  Stethoscope,
  Users,
  BarChart3,
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
  SectionHeader,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

const PERIODS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Thousands-separated below 1M ("12,450"), compact above ("1.2M"). */
function fmtAmount(n: number): string {
  if (!isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtLkr(n: number): string {
  return `LKR ${fmtAmount(n)}`;
}

/** Compact axis/label form: 950, 12k, 1.2M. */
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

/** "2026-08-30" → "30 Aug". */
function fmtDay(iso?: string): string {
  if (!iso) return "";
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

function fmtRange(start?: string, end?: string): string {
  if (!start || !end) return "";
  const sy = start.slice(0, 4);
  const ey = end.slice(0, 4);
  return sy === ey
    ? `${fmtDay(start)} – ${fmtDay(end)} ${ey}`
    : `${fmtDay(start)} ${sy} – ${fmtDay(end)} ${ey}`;
}

function BarChart({
  series,
}: {
  series: { bucket: string; total: number; count: number }[];
}) {
  const { colors, fontFamily } = useTheme();
  // Show last 14 buckets max for legibility.
  const visible = series.slice(-14);
  const max = Math.max(1, ...visible.map((s) => s.total));
  const peakIdx = visible.reduce((best, s, i) => (s.total > visible[best].total ? i : best), 0);
  if (!visible.length) return null;
  const labelStride = Math.max(1, Math.ceil(visible.length / 4));
  return (
    <View style={{ height: 176 }}>
      <View style={{ flex: 1, paddingTop: 18 }}>
        {[0.33, 0.66, 1].map((line) => (
          <View
            key={line}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: `${line * 90}%`,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderStyle: "dashed",
              borderColor: colors.separator,
            }}
          />
        ))}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 5,
          }}
        >
          {visible.map((s, idx) => {
            const empty = s.total <= 0;
            const heightPct = empty ? 0 : Math.max(6, (s.total / max) * 100);
            const peak = idx === peakIdx && !empty;
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
                {peak ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      position: "absolute",
                      bottom: `${heightPct}%`,
                      marginBottom: 4,
                      width: 60,
                      textAlign: "center",
                      fontSize: 10.5,
                      color: colors.primary,
                      fontFamily: fontFamily.bodyBold,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {fmtShort(s.total)}
                  </Text>
                ) : null}
                {empty ? (
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.separator,
                    }}
                  />
                ) : (
                  <LinearGradient
                    colors={
                      peak
                        ? [colors.primaryGradientStart, colors.primaryGradientEnd]
                        : [colors.primarySoft, colors.primarySoft]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                      width: "78%",
                      maxWidth: 22,
                      height: `${heightPct}%`,
                      borderTopLeftRadius: 7,
                      borderTopRightRadius: 7,
                      borderBottomLeftRadius: 3,
                      borderBottomRightRadius: 3,
                    }}
                  />
                )}
              </View>
            );
          })}
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          marginTop: 8,
          paddingTop: 6,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        {visible.map((s, idx) => (
          <View key={`lbl-${s.bucket}-${idx}`} style={{ flex: 1, alignItems: "center" }}>
            {idx % labelStride === 0 || idx === visible.length - 1 ? (
              <Text
                style={{
                  width: 48,
                  textAlign: "center",
                  fontSize: 10,
                  color: colors.textSubtle,
                  fontFamily: fontFamily.bodyMedium ?? fontFamily.body,
                  fontVariant: ["tabular-nums"],
                }}
                numberOfLines={1}
              >
                {fmtDay(s.bucket)}
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

  const total = summary?.totalLkr ?? 0;
  const trend = summary?.trendPct ?? 0;
  const trendFlat = Math.abs(trend) < 0.05;
  const trendPositive = trend > 0;
  const pending = summary?.pendingPayoutLkr ?? 0;
  const rangeLabel = fmtRange(summary?.start, summary?.end) || t(`earnings.period.${period}`);

  const payouts = payoutData?.payouts || [];
  const hasSeries = useMemo(
    () => (tsData?.series ?? []).some((s) => s.total > 0),
    [tsData]
  );

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
      <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
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

  const trendChip = trendFlat
    ? { Icon: Minus, fg: "rgba(255,255,255,0.85)", bg: "rgba(255,255,255,0.14)", border: "rgba(255,255,255,0.26)" }
    : trendPositive
      ? { Icon: TrendingUp, fg: "#A7F3D0", bg: "rgba(52,211,153,0.16)", border: "rgba(52,211,153,0.45)" }
      : { Icon: TrendingDown, fg: "#FECACA", bg: "rgba(248,113,113,0.16)", border: "rgba(248,113,113,0.45)" };

  return (
    <Screen
      padded={false}
      scroll={false}
      edges={["top"]}
      style={{ backgroundColor: colors.bg }}
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
        {/* Period segmented control */}
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: spacing.lg,
            padding: 3,
            borderRadius: radius.full,
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
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 34,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.full,
                  borderCurve: "continuous",
                  backgroundColor: active ? colors.surface : "transparent",
                  opacity: pressed && !active ? 0.6 : 1,
                  ...(active && !isDark ? shadow.xs : shadow.none),
                })}
              >
                <Text
                  style={[
                    typography.label.md,
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
            borderRadius: 28,
            borderCurve: "continuous",
            padding: spacing.xl,
            paddingBottom: spacing.lg,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.22)",
            ...(isDark ? {} : shadow.hero),
          }}
        >
          <LinearGradient
            colors={["#082247", "#0A4874", "#0C7888"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0)", "rgba(94,234,212,0.10)"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -70,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: 100,
              borderWidth: 28,
              borderColor: "rgba(255,255,255,0.05)",
            }}
          />

          {/* Label + range */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.sm,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: "rgba(255,255,255,0.72)",
                fontSize: 11,
                letterSpacing: 1.2,
                fontFamily: fontFamily.displayBold,
                textTransform: "uppercase",
              }}
            >
              {t("earnings.totalThisPeriod")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            >
              <Calendar size={11} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
              <Text
                numberOfLines={1}
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 11.5,
                  fontFamily: fontFamily.bodySemibold ?? fontFamily.bodyBold,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {rangeLabel}
              </Text>
            </View>
          </View>

          {/* Amount */}
          {isLoading ? (
            <View
              style={{
                width: 200,
                height: 52,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.16)",
                marginTop: spacing.md,
              }}
            />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: spacing.md }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 16,
                  lineHeight: 20,
                  paddingBottom: 9,
                  fontFamily: fontFamily.bodyBold,
                  letterSpacing: 0.4,
                }}
              >
                LKR
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{
                  flexShrink: 1,
                  color: "#FFFFFF",
                  fontSize: 48,
                  lineHeight: 54,
                  letterSpacing: -1.8,
                  fontFamily: fontFamily.heavy ?? fontFamily.displayBold,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {fmtAmount(total)}
              </Text>
            </View>
          )}

          {/* Trend chip */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              marginTop: spacing.sm,
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: trendChip.bg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: trendChip.border,
            }}
          >
            <trendChip.Icon size={13} color={trendChip.fg} strokeWidth={2.6} />
            <Text style={{ fontSize: 12.5, color: trendChip.fg, fontFamily: fontFamily.bodyBold }}>
              {trendFlat
                ? t("earnings.noChange", "No change")
                : `${trendPositive ? "+" : ""}${trend.toFixed(1)}%`}
            </Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              {t("earnings.vsPrevious")}
            </Text>
          </View>

          {/* Metrics strip */}
          <View
            style={{
              flexDirection: "row",
              marginTop: spacing.xl,
              paddingTop: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: "rgba(255,255,255,0.18)",
            }}
          >
            <HeroMetric
              icon={Users}
              label={t("earnings.visits")}
              value={`${summary?.visitCount ?? 0}`}
            />
            <HeroDivider />
            <HeroMetric
              icon={BarChart3}
              label={t("earnings.avgPerVisit")}
              value={fmtShort(summary?.avgPerVisitLkr ?? 0)}
            />
            <HeroDivider />
            <HeroMetric
              icon={Stethoscope}
              label={t("earnings.feeShort", "Your fee")}
              value={fmtShort(summary?.consultationFee ?? 0)}
            />
          </View>
        </View>

        {/* Pending payout */}
        <PendingPayoutCard amount={pending} />

        {/* Revenue trend */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md }}>
          <SectionHeader
            kicker={t(`earnings.period.${period}`)}
            title={t("earnings.chart")}
            style={{ paddingTop: 0, paddingBottom: 0 }}
          />
          <Card padded={false}>
            <View style={{ padding: spacing.lg }}>
              {trendLoading ? (
                <Skeleton height={176} radius={18} />
              ) : hasSeries ? (
                <BarChart series={tsData?.series ?? []} />
              ) : (
                <TrendEmptyState />
              )}
            </View>
          </Card>
        </View>

        {/* Payout history */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md }}>
          <SectionHeader
            kicker={t("earnings.payoutsKicker", "Payouts")}
            title={t("earnings.payoutsTitle")}
            count={payouts.length || undefined}
            style={{ paddingTop: 0, paddingBottom: 0 }}
          />

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
            <Card padded={false} style={{ paddingVertical: 4 }}>
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

function PendingPayoutCard({ amount }: { amount: number }) {
  const { t } = useTranslation();
  const { colors, spacing, typography, fontFamily } = useTheme();
  const has = amount > 0;
  const fg = has ? colors.warning : colors.success;
  const bg = has ? colors.warningSoft : colors.successSoft;
  const Icon = has ? Clock : CheckCircle2;

  return (
    <Card padded={false} style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          paddingRight: spacing.lg,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
          }}
        >
          <Icon size={20} color={fg} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text }]}>
            {t("earnings.pendingPayout", "Pending payout")}
          </Text>
          <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
            {has
              ? t("earnings.pendingSub", "Awaiting settlement")
              : t("earnings.nothingPending", "You're all settled up")}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fontFamily.heavy ?? fontFamily.displayBold,
            fontSize: 18,
            letterSpacing: -0.4,
            color: has ? colors.text : colors.textSubtle,
            fontVariant: ["tabular-nums"],
          }}
        >
          {fmtLkr(amount)}
        </Text>
      </View>
    </Card>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  const { fontFamily } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon size={13} color="rgba(255,255,255,0.75)" strokeWidth={2.4} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            color: "#FFFFFF",
            fontSize: 18,
            lineHeight: 22,
            fontFamily: fontFamily.displayBold,
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{ color: "rgba(255,255,255,0.68)", fontSize: 11, fontFamily: fontFamily.bodySemibold ?? fontFamily.body }}
      >
        {label}
      </Text>
    </View>
  );
}

function HeroDivider() {
  return (
    <View
      style={{
        width: StyleSheet.hairlineWidth,
        marginVertical: 4,
        backgroundColor: "rgba(255,255,255,0.22)",
      }}
    />
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
          {payout.eventCount} {t("earnings.events")}
        </Text>
        <Text
          style={[
            typography.caption,
            { fontSize: 11, color: colors.textSubtle, marginTop: 2 },
          ]}
          numberOfLines={1}
        >
          {fmtRange(payout.periodStart, payout.periodEnd)}
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

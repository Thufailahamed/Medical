// @ts-nocheck

import { useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Pill,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Send,
} from "lucide-react-native";
import { useRefillDue } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong } from "@/lib/format";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  Skeleton,
  IconTile,
  SectionHeader,
  useToast,
} from "@/components/ui";

function formatFrequency(raw?: string | null): string {
  if (!raw) return "As needed";
  const map: Record<string, string> = {
    three_times_daily: "Three times daily",
    twice_daily: "Twice daily",
    once_daily: "Once daily",
    four_times_daily: "Four times daily",
    as_needed: "As needed",
    at_bedtime: "At bedtime",
    every_morning: "Every morning",
    with_meals: "With meals",
  };
  // Accept "three_times_daily", "Three Times Daily" and "three-times daily" alike.
  const normalized = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (map[normalized]) return map[normalized];
  const words = raw.replace(/_/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatDate(iso: string, locale: any): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return fmtDateLong(d, locale);
}

/** Fraction of the prescribed course that has elapsed (1 once it has ended). */
function courseProgress(startIso: string, endIso: string, daysRemaining: number): number {
  if (daysRemaining < 0) return 1;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 0.85;
  return Math.min(1, Math.max(0.04, (Date.now() - start) / (end - start)));
}

export default function RefillScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, radius } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();

  const { data, isLoading, refetch, isRefetching } = useRefillDue();
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const candidates = data?.refills ?? [];
  const overdue = useMemo(
    () => candidates.filter((c) => c.daysRemaining < 0).sort((a, b) => a.daysRemaining - b.daysRemaining),
    [candidates]
  );
  const dueSoon = useMemo(
    () =>
      candidates
        .filter((c) => c.daysRemaining >= 0 && c.daysRemaining <= 14)
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [candidates]
  );

  function handleRenew(id: string, name: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setRequestedIds((prev) => new Set(prev).add(id));
    toast.show(t("refill.renewSentFor", { name, defaultValue: `Renewal request sent for ${name}` }), "success");
  }

  function handleRequestAll() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setRequestedIds(new Set(candidates.map((c) => c.id)));
    toast.show(t("refill.renewSent", "Renewal request sent to your doctor"), "success");
  }

  const header = (
    <ScreenHeader
      back
      onBack={() => router.back()}
      title={t("refill.title", "Refills")}
      subtitle={t("refill.subtitle", "Medicines that need a renewal soon")}
    />
  );

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        {header}
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="100%" height={210} radius={radius.card} />
          <Skeleton width="100%" height={170} radius={radius.card} />
          <Skeleton width="100%" height={170} radius={radius.card} />
        </View>
      </Screen>
    );
  }

  const requestedCount = candidates.filter((c) => requestedIds.has(c.id)).length;
  const unrequestedCount = candidates.length - requestedCount;

  const renderCard = (c: (typeof candidates)[number], isOverdue: boolean) => (
    <RefillCard
      key={c.id}
      candidate={c}
      locale={locale}
      isOverdue={isOverdue}
      isRequested={requestedIds.has(c.id)}
      onRenew={() => handleRenew(c.id, c.name)}
    />
  );

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      {header}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxl * 2,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        {candidates.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t("refill.emptyTitle", "Nothing to refill")}
            message={t("refill.emptyBody", "All your active medicines are well-stocked.")}
          />
        ) : (
          <>
            <SummaryHero
              total={candidates.length}
              overdueCount={overdue.length}
              soonCount={dueSoon.length}
              requestedCount={requestedCount}
              unrequestedCount={unrequestedCount}
              onRequestAll={handleRequestAll}
            />

            {overdue.length > 0 && (
              <>
                <SectionHeader
                  kicker={t("refill.kickerUrgent", "Needs attention")}
                  title={t("refill.overdueTitle", "Overdue")}
                  count={overdue.length}
                />
                <View style={{ gap: spacing.md }}>{overdue.map((c) => renderCard(c, true))}</View>
              </>
            )}

            {dueSoon.length > 0 && (
              <>
                <SectionHeader
                  kicker={t("refill.kickerUpcoming", "Next 2 weeks")}
                  title={t("refill.soonTitle", "Due soon")}
                  count={dueSoon.length}
                />
                <View style={{ gap: spacing.md }}>{dueSoon.map((c) => renderCard(c, false))}</View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function SummaryHero({
  total,
  overdueCount,
  soonCount,
  requestedCount,
  unrequestedCount,
  onRequestAll,
}: {
  total: number;
  overdueCount: number;
  soonCount: number;
  requestedCount: number;
  unrequestedCount: number;
  onRequestAll: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography, scheme } = useTheme();
  const isDark = scheme === "dark";
  const allSent = unrequestedCount === 0;
  const tone = allSent ? "success" : overdueCount > 0 ? "warning" : "primary";
  const p = useTone(tone);

  return (
    <Card variant="floating" padded={false}>
      <LinearGradient
        pointerEvents="none"
        colors={[p.bg, isDark ? "rgba(0,0,0,0)" : colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconTile icon={allSent ? CheckCircle2 : Pill} tone={tone} appearance="solid" size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.kicker, { color: p.fg, textTransform: "uppercase" }]} numberOfLines={1}>
              {t("refill.heroKicker", "Renewal status")}
            </Text>
            {allSent ? (
              <>
                <Text style={[typography.title.lg, { color: colors.text, marginTop: 2 }]}>
                  {t("refill.allSent", "All renewals requested")}
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                  {t("refill.allSentBody", "Your doctor has been notified.")}
                </Text>
              </>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: 2 }}>
                <Text style={[typography.display.md, { color: colors.text }]}>{unrequestedCount}</Text>
                <Text style={[typography.body.md, { color: colors.textMuted, flex: 1 }]} numberOfLines={2}>
                  {t("refill.heroCount", {
                    count: unrequestedCount,
                    defaultValue: unrequestedCount === 1 ? "medicine needs renewal" : "medicines need renewal",
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            backgroundColor: isDark ? colors.well : colors.surface,
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? colors.borderStrong : colors.hairline,
            paddingVertical: spacing.md,
          }}
        >
          <HeroStat value={overdueCount} label={t("refill.statOverdue", "Overdue")} dot={colors.warning} />
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
          <HeroStat value={soonCount} label={t("refill.statSoon", "Due soon")} dot={colors.primary} />
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
          <HeroStat value={requestedCount} label={t("refill.statSent", "Requested")} dot={colors.success} />
        </View>

        {!allSent && (
          <Button
            title={
              unrequestedCount === total && total > 1
                ? t("refill.requestAll", { count: unrequestedCount, defaultValue: `Request all (${unrequestedCount})` })
                : unrequestedCount > 1
                ? t("refill.requestRemaining", {
                    count: unrequestedCount,
                    defaultValue: `Request remaining (${unrequestedCount})`,
                  })
                : t("refill.renew", "Request renewal")
            }
            icon={Send}
            size="md"
            onPress={onRequestAll}
          />
        )}
      </View>
    </Card>
  );
}

function HeroStat({ value, label, dot }: { value: number; label: string; dot: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={[typography.title.lg, { color: value > 0 ? colors.text : colors.textSubtle }]}>{value}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function RefillCard({
  candidate,
  locale,
  isOverdue,
  isRequested,
  onRenew,
}: {
  candidate: {
    id: string;
    name: string;
    dosage: string;
    frequency: string | null;
    startDate: string;
    expectedEndDate: string;
    daysRemaining: number;
    source: string;
  };
  locale: any;
  isOverdue: boolean;
  isRequested: boolean;
  onRenew: () => void;
}) {
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const tone = isRequested ? "success" : isOverdue ? "warning" : "primary";
  const p = useTone(tone);

  const days = Math.abs(candidate.daysRemaining);
  const progress = courseProgress(candidate.startDate, candidate.expectedEndDate, candidate.daysRemaining);
  const endLabel = isOverdue ? t("refill.ended", "Ended") : t("refill.ends", "Ends");

  return (
    <Card padded={false}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {/* Identity + countdown */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconTile icon={Pill} tone={tone} size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
              {candidate.name}
            </Text>
            <Text style={[typography.body.sm, { color: colors.textMuted }]} numberOfLines={1}>
              {[candidate.dosage, formatFrequency(candidate.frequency)].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View
            style={{
              alignItems: "center",
              minWidth: 60,
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
              borderRadius: 14,
              borderCurve: "continuous",
              backgroundColor: p.bg,
            }}
          >
            <Text style={[typography.title.lg, { color: p.fg, fontVariant: ["tabular-nums"] }]}>{days}</Text>
            <Text style={[typography.label.xs, { color: p.fg, opacity: 0.85 }]} numberOfLines={1}>
              {isOverdue ? t("refill.unitOverdue", "days over") : t("refill.unitLeft", "days left")}
            </Text>
          </View>
        </View>

        {/* Course progress */}
        <View style={{ gap: 6 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.well, overflow: "hidden" }}>
            <View
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: "100%",
                borderRadius: 3,
                backgroundColor: p.fg,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
            <MetaItem icon={Clock} text={`${t("refill.started", "Started")} ${formatDate(candidate.startDate, locale)}`} />
            <MetaItem
              icon={isOverdue ? AlertTriangle : CalendarClock}
              text={`${endLabel} ${formatDate(candidate.expectedEndDate, locale)}`}
              color={isOverdue && !isRequested ? colors.warning : undefined}
            />
          </View>
        </View>

        {/* Action */}
        {isRequested ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: 38,
              borderRadius: 999,
              backgroundColor: colors.successSoft,
            }}
          >
            <CheckCircle2 size={16} color={colors.success} strokeWidth={2.4} />
            <Text style={[typography.label.md, { color: colors.success }]} numberOfLines={1}>
              {t("refill.requested", "Requested · Doctor notified")}
            </Text>
          </View>
        ) : (
          <Button
            title={t("refill.renew", "Request renewal")}
            variant={isOverdue ? "secondary" : "outline"}
            onPress={onRenew}
            icon={RefreshCw}
            size="sm"
          />
        )}
      </View>
    </Card>
  );
}

function MetaItem({ icon: Icon, text, color }: { icon: any; text: string; color?: string }) {
  const { colors, typography } = useTheme();
  const c = color ?? colors.textSubtle;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
      <Icon size={12} color={c} strokeWidth={2.2} />
      <Text style={[typography.caption, { color: c }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

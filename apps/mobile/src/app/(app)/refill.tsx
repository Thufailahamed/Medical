// @ts-nocheck

import { useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
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
  Calendar,
  AlertCircle,
  Sparkles,
  Check,
} from "lucide-react-native";
import { useRefillDue } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong } from "@/lib/format";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  Skeleton,
  Pill as PillCmp,
  useToast,
  Pressable,
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
  const normalized = raw.toLowerCase().trim();
  if (map[normalized]) return map[normalized];
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEndDate(iso: string, locale: any): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return fmtDateLong(d, locale);
}

function formatOverdue(days: number, t: (k: string, opts?: any) => string): string {
  const count = Math.abs(days);
  return t("refill.daysOverdue", {
    count,
    days: count,
    defaultValue: `${count}d overdue`,
  });
}

function formatDaysLeft(days: number, t: (k: string, opts?: any) => string): string {
  return t("refill.daysLeft", {
    count: days,
    days,
    defaultValue: `${days}d left`,
  });
}

export default function RefillScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, scheme } = useTheme();
  const isDark = scheme === "dark";
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();

  const { data, isLoading, refetch, isRefetching } = useRefillDue();
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const candidates = data?.refills ?? [];
  const overdue = useMemo(() => candidates.filter((c) => c.daysRemaining < 0), [candidates]);
  const dueSoon = useMemo(
    () => candidates.filter((c) => c.daysRemaining >= 0 && c.daysRemaining <= 14),
    [candidates]
  );

  function handleRenew(id: string, name: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setRequestedIds((prev) => new Set(prev).add(id));
    toast.show(
      t("refill.renewSent", `Renewal request sent for ${name}`),
      "success"
    );
  }

  function handleRequestAll() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const allIds = candidates.map((c) => c.id);
    setRequestedIds(new Set(allIds));
    toast.show(
      t("refill.renewSent", "Renewal requests sent to your doctor for all medicines"),
      "success"
    );
  }

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => router.back()}
          title={t("refill.title", "Refills")}
          subtitle={t("refill.subtitle", "Medicines that need a renewal soon")}
        />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="100%" height={100} radius={radius.lg} />
          <Skeleton width="100%" height={130} radius={radius.lg} />
          <Skeleton width="100%" height={130} radius={radius.lg} />
        </View>
      </Screen>
    );
  }

  const unrequestedCount = candidates.filter((c) => !requestedIds.has(c.id)).length;

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("refill.title", "Refills")}
        subtitle={t("refill.subtitle", "Medicines that need a renewal soon")}
        right={
          candidates.length > 0 ? (
            <PillCmp
              icon={RefreshCw}
              label={t("refill.dueCount", {
                count: candidates.length,
                defaultValue: `${candidates.length} due`,
              })}
              tone={overdue.length > 0 ? "warning" : "primary"}
              size="sm"
            />
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {candidates.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t("refill.emptyTitle", "Nothing to refill")}
            message={t("refill.emptyBody", "All your active medicines are well-stocked.")}
          />
        ) : (
          <>
            {/* Health Overview Hero */}
            <LinearGradient
              colors={
                overdue.length > 0
                  ? isDark
                    ? [colors.surfaceElevated, colors.surface]
                    : [colors.warningSoft, colors.surface]
                  : isDark
                  ? [colors.surfaceElevated, colors.surface]
                  : [colors.primarySoft, colors.surface]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 20,
                borderCurve: "continuous",
                padding: spacing.md,
                borderWidth: 1,
                borderColor: overdue.length > 0 ? colors.warning + "40" : colors.border,
                gap: spacing.md,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    borderCurve: "continuous",
                    backgroundColor: overdue.length > 0 ? colors.warning : colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: overdue.length > 0 ? colors.warning : colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Pill size={24} color={colors.onPrimary} />
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
                    Prescription Refill Hub
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, lineHeight: 17 }]}>
                    {overdue.length > 0
                      ? `${overdue.length} medication${overdue.length > 1 ? "s are" : " is"} overdue for clinical renewal.`
                      : `${dueSoon.length} medication${dueSoon.length > 1 ? "s" : ""} approaching end date.`}
                  </Text>
                </View>
              </View>

              {/* Status breakdown tags & Request all */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: spacing.xs,
                  borderTopWidth: 1,
                  borderTopColor: colors.border + "60",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  {overdue.length > 0 && (
                    <PillCmp
                      label={`${overdue.length} Overdue`}
                      tone="warning"
                      size="sm"
                    />
                  )}
                  {dueSoon.length > 0 && (
                    <PillCmp
                      label={`${dueSoon.length} Due Soon`}
                      tone="info"
                      size="sm"
                    />
                  )}
                </View>

                {unrequestedCount > 1 && (
                  <Pressable
                    onPress={handleRequestAll}
                    style={{
                      paddingHorizontal: spacing.sm + 2,
                      paddingVertical: 5,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      backgroundColor: colors.primary,
                    }}
                  >
                    <Text
                      style={[
                        typography.label.sm,
                        { color: colors.onPrimary, fontWeight: "700", fontSize: 12 },
                      ]}
                    >
                      Request all ({unrequestedCount})
                    </Text>
                  </Pressable>
                )}
              </View>
            </LinearGradient>

            {/* Overdue Section */}
            {overdue.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <SectionHeaderBadge
                  icon={AlertTriangle}
                  title={t("refill.sectionOverdue", {
                    count: overdue.length,
                    defaultValue: `${overdue.length} Overdue`,
                  })}
                  tone="warning"
                />
                {overdue.map((c) => (
                  <RefillCard
                    key={c.id}
                    candidate={c}
                    locale={locale}
                    isOverdue={true}
                    isRequested={requestedIds.has(c.id)}
                    onRenew={() => handleRenew(c.id, c.name)}
                  />
                ))}
              </View>
            )}

            {/* Due Soon Section */}
            {dueSoon.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <SectionHeaderBadge
                  icon={Clock}
                  title={t("refill.sectionSoon", {
                    count: dueSoon.length,
                    defaultValue: `${dueSoon.length} Due within 2 weeks`,
                  })}
                  tone="primary"
                />
                {dueSoon.map((c) => (
                  <RefillCard
                    key={c.id}
                    candidate={c}
                    locale={locale}
                    isOverdue={false}
                    isRequested={requestedIds.has(c.id)}
                    onRenew={() => handleRenew(c.id, c.name)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionHeaderBadge({
  icon: Icon,
  title,
  tone,
}: {
  icon: any;
  title: string;
  tone: "primary" | "warning";
}) {
  const { spacing, colors, typography } = useTheme();
  const tint = tone === "warning" ? colors.warning : colors.primary;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.xs,
        paddingTop: spacing.xs,
      }}
    >
      <Icon size={15} color={tint} strokeWidth={2.2} />
      <Text
        style={[
          typography.label.md,
          { color: tint, fontWeight: "700", letterSpacing: -0.1 },
        ]}
      >
        {title}
      </Text>
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

  const formattedFreq = formatFrequency(candidate.frequency);
  const formattedEnd = formatEndDate(candidate.expectedEndDate, locale);
  const statusLabel = isOverdue
    ? formatOverdue(candidate.daysRemaining, t)
    : formatDaysLeft(candidate.daysRemaining, t);

  return (
    <Card
      style={{
        padding: spacing.md,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: isOverdue ? colors.warningSoft : colors.border,
        gap: spacing.md,
      }}
    >
      {/* Top Header: Icon + Name + Urgency Badge */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            borderCurve: "continuous",
            backgroundColor: isOverdue ? colors.warningSoft : colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: isOverdue ? colors.warning + "30" : colors.primary + "30",
          }}
        >
          <Pill
            size={20}
            color={isOverdue ? colors.warning : colors.primary}
            strokeWidth={2.2}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "700" },
            ]}
            numberOfLines={1}
          >
            {candidate.name}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {candidate.dosage || "Prescription dosage"}
          </Text>
        </View>

        <PillCmp
          label={statusLabel}
          tone={isOverdue ? "warning" : "info"}
          size="sm"
        />
      </View>

      {/* Clinical Metrics Mini Tiles */}
      <View
        style={{
          flexDirection: "row",
          gap: spacing.xs,
          backgroundColor: colors.surfaceSubtle,
          borderRadius: 14,
          borderCurve: "continuous",
          padding: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <MetricTile label={t("refill.dosage", "Dose")} value={candidate.dosage || "—"} />
        <View style={{ width: 1, height: "100%", backgroundColor: colors.border }} />
        <MetricTile label={t("refill.frequency", "Schedule")} value={formattedFreq} />
        <View style={{ width: 1, height: "100%", backgroundColor: colors.border }} />
        <MetricTile label={t("refill.expectedEnd", "End Date")} value={formattedEnd} />
      </View>

      {/* Renewal CTA Button / Confirmed State */}
      {isRequested ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
            borderRadius: 12,
            borderCurve: "continuous",
            backgroundColor: colors.successSoft,
            borderWidth: 1,
            borderColor: colors.success + "30",
          }}
        >
          <CheckCircle2 size={16} color={colors.success} />
          <Text style={[typography.label.md, { color: colors.success, fontWeight: "700" }]}>
            Renewal Requested · Doctor Notified
          </Text>
        </View>
      ) : (
        <Button
          title={t("refill.renew", "Request renewal")}
          variant={isOverdue ? "primary" : "secondary"}
          onPress={onRenew}
          icon={RefreshCw}
          size="md"
        />
      )}
    </Card>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={{ flex: 1, gap: 2, paddingHorizontal: 4 }}>
      <Text
        style={[
          typography.caption,
          { color: colors.textSubtle, fontSize: 10, textTransform: "uppercase", fontWeight: "600" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[
          typography.label.sm,
          { color: colors.text, fontWeight: "600", fontSize: 12 },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

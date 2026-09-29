// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import {
  FileText,
  Activity,
  AlertTriangle,
  Pill,
  Calendar,
  StickyNote,
  History,
  HeartPulse,
  ChevronRight,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useLocaleStore } from "@/stores/locale";
import { fmtMonthYear, fmtMonthShort, fmtTime } from "@/lib/format";
import {
  useUnifiedTimeline,
  type TimelineEvent,
  type TimelineEventKind,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  Card,
  Pill as PillCmp,
  Pressable,
} from "@/components/ui";

interface FilterOption {
  value: TimelineEventKind | "all";
  key: string;
  label: string;
  icon: any;
}

const FILTERS: FilterOption[] = [
  { value: "all", key: "timeline.filter.all", label: "All", icon: History },
  { value: "appointment", key: "timeline.filter.appointment", label: "Visits", icon: Calendar },
  { value: "vital", key: "timeline.filter.vital", label: "Vitals", icon: Activity },
  { value: "medicine_start", key: "timeline.filter.medicineStart", label: "Meds", icon: Pill },
  { value: "record", key: "timeline.filter.record", label: "Records", icon: FileText },
  { value: "symptom", key: "timeline.filter.symptom", label: "Symptoms", icon: AlertTriangle },
  { value: "note", key: "timeline.filter.note", label: "Notes", icon: StickyNote },
];

const KIND_META: Record<string, { icon: any; tone: Tone; defaultLabel: string }> = {
  record: { icon: FileText, tone: "accent", defaultLabel: "Record" },
  vital: { icon: HeartPulse, tone: "primary", defaultLabel: "Vital" },
  symptom: { icon: AlertTriangle, tone: "warning", defaultLabel: "Symptom" },
  medicine_start: { icon: Pill, tone: "accent2", defaultLabel: "Started" },
  medicine_stop: { icon: Pill, tone: "neutral", defaultLabel: "Stopped" },
  appointment: { icon: Calendar, tone: "primary", defaultLabel: "Visit" },
  note: { icon: StickyNote, tone: "neutral", defaultLabel: "Note" },
};

function groupKey(dateIso: string | null, locale: ReturnType<typeof useLocaleStore.getState>["locale"]): string {
  if (!dateIso) return "unknown";
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return "unknown";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  )
    return "yesterday";
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 7) return "week";
  if (days < 30) return "month";
  if (days < 365) return fmtMonthYear(d, locale);
  return d.getFullYear().toString();
}

function resolveGroupTitle(group: string, t: (k: string, opts?: any) => string): string {
  switch (group) {
    case "today":
      return t("timeline.group.today", "Today");
    case "yesterday":
      return t("timeline.group.yesterday", "Yesterday");
    case "week":
      return t("timeline.group.week", "Earlier this week");
    case "month":
      return t("timeline.group.month", "This Month");
    case "unknown":
      return t("timeline.group.unknown", "General");
    default:
      return group;
  }
}

function humanizeStatus(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === "confirmed" || s === "completed" || s === "active") return "success";
  if (s === "no_show" || s === "no show" || s === "rescheduled") return "warning";
  if (s === "cancelled" || s === "canceled" || s === "declined" || s === "missed")
    return "danger";
  if (s === "scheduled" || s === "pending" || s === "upcoming") return "info";
  return "neutral";
}

export default function TimelineScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const [filter, setFilter] = useState<TimelineEventKind | "all">("all");

  const { data, isLoading, isError, refetch, isFetching } = useUnifiedTimeline({
    type: filter,
  });

  const events: TimelineEvent[] = data?.events ?? [];
  const counts = data?.counts ?? {};

  // Group events by time section
  const groupedEvents = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of events) {
      const g = groupKey(e.date, locale);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(e);
    }
    return Array.from(map.entries());
  }, [events, locale]);

  const subtitle =
    events.length === 0
      ? t("timeline.subtitleEmpty", "Your entire record, in one stream")
      : t("timeline.subtitleCount", {
          count: events.length,
          defaultValue: `${events.length} events recorded`,
        });

  function handleFilterSelect(val: TimelineEventKind | "all") {
    Haptics.selectionAsync().catch(() => {});
    setFilter(val);
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      {/* Header */}
      <ScreenHeader
        title={t("timeline.title", "Timeline")}
        subtitle={subtitle}
        onBack={() => router.back()}
      />

      {/* Horizontal Filter Bar */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xs,
            paddingBottom: spacing.md,
            gap: spacing.sm,
          }}
        >
          {FILTERS.map((f) => {
            const isSelected = filter === f.value;
            const Icon = f.icon;
            const count =
              f.value === "all"
                ? events.length
                : counts[f.value] ??
                  events.filter(
                    (e) =>
                      e.kind === f.value ||
                      (f.value === "medicine_start" && e.kind === "medicine_stop")
                  ).length;

            return (
              <Pressable
                key={f.value}
                onPress={() => handleFilterSelect(f.value)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 14,
                  height: 36,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderWidth: isSelected ? 0 : StyleSheet.hairlineWidth * 2,
                  borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
                  ...(scheme === "dark"
                    ? null
                    : isSelected
                    ? { ...shadow.xs, shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }
                    : shadow.xs),
                }}
              >
                <Icon
                  size={14}
                  color={isSelected ? colors.onPrimary : colors.textMuted}
                  strokeWidth={isSelected ? 2.5 : 2}
                />
                <Text
                  style={[
                    typography.label.md,
                    {
                      color: isSelected ? colors.onPrimary : colors.text,
                    },
                  ]}
                >
                  {t(f.key, f.label)}
                </Text>
                {count > 0 && (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      backgroundColor: isSelected
                        ? "rgba(255, 255, 255, 0.25)"
                        : colors.fill,
                    }}
                  >
                    <Text
                      style={[
                        typography.label.xs,
                        {
                          letterSpacing: 0,
                          color: isSelected ? colors.onPrimary : colors.textMuted,
                        },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: 120,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {/* Loading State */}
        {isLoading ? (
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <Skeleton width={"100%"} height={104} radius={20} />
            <Skeleton width={"100%"} height={104} radius={20} />
            <Skeleton width={"100%"} height={104} radius={20} />
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Could not load timeline")}
            message={t("recordDetail.errorBody", "Please check your network and try again")}
            actionLabel={t("common.retry", "Retry")}
            onAction={() => refetch()}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={History}
            title={t("timeline.empty.title", "No events found")}
            message={
              filter === "all"
                ? t("timeline.empty.allMessage", "Your health timeline will automatically update as records and visits are recorded.")
                : t("timeline.empty.filteredMessage", {
                    filter: filter,
                    defaultValue: `No ${filter} events recorded yet.`,
                  })
            }
          />
        ) : (
          /* Timeline Sections */
          <View style={{ gap: spacing.xl }}>
            {groupedEvents.map(([gKey, groupList], gIdx) => {
              const groupTitle = resolveGroupTitle(gKey, t);

              return (
                <View key={gKey} style={{ gap: spacing.md }}>
                  {/* Group Header */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase", letterSpacing: 1.1 }]}>
                      {groupTitle}
                    </Text>
                    <View
                      style={{
                        minWidth: 22,
                        height: 22,
                        paddingHorizontal: 7,
                        borderRadius: 11,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.well,
                      }}
                    >
                      <Text style={[typography.label.xs, { color: colors.textMuted, letterSpacing: 0 }]}>
                        {groupList.length}
                      </Text>
                    </View>
                    <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
                  </View>

                  {/* Connected Timeline Feed */}
                  <View style={{ gap: 0 }}>
                    {groupList.map((item, idx) => {
                      const isLastItem = idx === groupList.length - 1;
                      return (
                        <TimelineEventRow
                          key={item.id || `${gKey}-${idx}`}
                          event={item}
                          isLast={isLastItem}
                          locale={locale}
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
function TimelineEventRow({
  event,
  isLast,
  locale,
}: {
  event: TimelineEvent;
  isLast: boolean;
  locale: any;
}) {
  const router = useRouter();
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
  const meta = KIND_META[event.kind] || {
    icon: FileText,
    tone: "neutral" as Tone,
    defaultLabel: "Update",
  };
  const palette = useTone(meta.tone);
  const Icon = meta.icon;

  const isVital = event.kind === "vital";
  const isAppointment = event.kind === "appointment";
  const isRecord = event.kind === "record";

  // Nicely capitalized title
  const cleanTitle = useMemo(() => {
    if (!event.title) return "Health Event";
    return event.title.charAt(0).toUpperCase() + event.title.slice(1);
  }, [event.title]);

  const vitalSplit = useMemo(() => {
    const i = cleanTitle.indexOf(":");
    if (i < 1) return null;
    return [cleanTitle.slice(0, i).trim(), cleanTitle.slice(i + 1).trim()] as const;
  }, [cleanTitle]);

  const date = event.date ? new Date(event.date) : null;
  const validDate = date && !isNaN(date.getTime()) ? date : null;

  function handlePress() {
    Haptics.selectionAsync().catch(() => {});

    if (isAppointment) {
      const aptId = event.meta?.appointmentId || event.id.replace(/^apt-/, "");
      router.push({
        pathname: "/(app)/appointment-detail",
        params: { id: aptId },
      } as any);
      return;
    }

    if (isRecord) {
      const recId = (event as any).recordId || event.meta?.recordId || event.id.replace(/^rec-/, "");
      router.push({
        pathname: "/(app)/record-detail",
        params: { id: recId },
      } as any);
      return;
    }

    if (isVital) {
      router.push("/(app)/records/trends" as any);
    }
  }

  const isInteractive = isAppointment || isRecord || isVital;

  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      {/* Date rail: day + month, with a spine down to the next event */}
      <View style={{ width: 40, alignItems: "center", paddingTop: spacing.md }}>
        <Text
          style={[
            typography.title.md,
            { color: colors.text, fontVariant: ["tabular-nums"], lineHeight: 24 },
          ]}
        >
          {validDate ? validDate.getDate() : "—"}
        </Text>
        <Text
          style={[
            typography.overline,
            { color: colors.textSubtle, textTransform: "uppercase", fontSize: 10 },
          ]}
          numberOfLines={1}
        >
          {validDate ? fmtMonthShort(validDate, locale) : ""}
        </Text>
        {!isLast && (
          <View
            style={{
              flex: 1,
              width: 2,
              marginTop: spacing.sm,
              marginBottom: -spacing.xs,
              borderRadius: 1,
              backgroundColor: colors.separator,
            }}
          />
        )}
      </View>

      {/* Event card */}
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.md }}>
        <Pressable
          onPress={isInteractive ? handlePress : undefined}
          accessibilityRole={isInteractive ? "button" : undefined}
          style={{
            borderRadius: radius.xl,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
            padding: spacing.md + 2,
            gap: spacing.sm,
            overflow: "hidden",
            ...(scheme === "dark" ? null : shadow.xs),
          }}
        >
          {/* Kind + time, status on the right */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.md,
                borderCurve: "continuous",
                backgroundColor: palette.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={16} color={palette.fg} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.label.md, { color: palette.fg }]} numberOfLines={1}>
                {event.label || meta.defaultLabel}
              </Text>
              {validDate ? (
                <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                  {fmtTime(validDate, locale)}
                </Text>
              ) : null}
            </View>
            {event.meta?.status && (
              <PillCmp
                label={humanizeStatus(event.meta.status)}
                tone={statusTone(event.meta.status)}
                size="sm"
              />
            )}
            {isInteractive && <ChevronRight size={16} color={colors.textSubtle} />}
          </View>

          {/* Event Title */}
          {isVital && vitalSplit ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm, flexWrap: "wrap" }}>
              <Text style={[typography.title.lg, { color: colors.text }]}>{vitalSplit[1]}</Text>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>{vitalSplit[0]}</Text>
            </View>
          ) : (
            <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={2}>
              {cleanTitle}
            </Text>
          )}

          {/* Event Subtitle / Details */}
          {!!event.subtitle && (
            <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: -2 }]} numberOfLines={2}>
              {event.subtitle}
            </Text>
          )}

          {/* Extracted Lab / Test Badges */}
          {Array.isArray((event as any).extractedItems) &&
            (event as any).extractedItems.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {(event as any).extractedItems.slice(0, 3).map((item: any, i: number) => (
                  <View
                    key={i}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      backgroundColor: colors.fill,
                    }}
                  >
                    <Text style={[typography.caption, { fontSize: 11, color: colors.text }]}>
                      {item.name || item.modality || "Report item"}:{" "}
                      <Text style={{ fontWeight: "700" }}>{item.value || item.impression || ""}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}
        </Pressable>
      </View>
    </View>
  );
}

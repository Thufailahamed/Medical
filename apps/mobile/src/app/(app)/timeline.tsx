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
  Sparkles,
  Clock,
  Waypoints,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLocaleStore } from "@/stores/locale";
import { fmtMonthYear, fmtDateLong, fmtTime } from "@/lib/format";
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

function formatEventTimestamp(dateIso: string | null, locale: any): string {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return "—";
  const dateStr = fmtDateLong(d, locale);
  const timeStr = fmtTime(d, locale);
  return `${dateStr} · ${timeStr}`;
}

export default function TimelineScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow } = useTheme();
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
        right={<History size={20} color={colors.textMuted} />}
      />

      {/* Horizontal Filter Bar */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border + "40" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            gap: spacing.xs + 2,
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
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                }}
              >
                <Icon
                  size={14}
                  color={isSelected ? colors.onPrimary : colors.textMuted}
                  strokeWidth={isSelected ? 2.5 : 2}
                />
                <Text
                  style={[
                    typography.label.sm,
                    {
                      color: isSelected ? colors.onPrimary : colors.text,
                      fontWeight: isSelected ? "700" : "500",
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
                      backgroundColor: isSelected
                        ? "rgba(255, 255, 255, 0.25)"
                        : colors.surfaceSubtle,
                    }}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          fontSize: 11,
                          fontWeight: "700",
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
        {/* Stream Health Journey Hero */}
        {filter === "all" && events.length > 0 && (
          <Card
            padded={false}
            elevated={false}
            style={{
              borderRadius: radius.xxxl,
              borderWidth: 0,
              overflow: "hidden",
              ...shadow.hero,
            }}
          >
            <LinearGradient
              colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: spacing.lg }}
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: "#0C8B8C",
                    opacity: 0.32,
                    borderRadius: 200,
                    transform: [{ translateX: 120 }, { translateY: -80 }],
                  },
                ]}
                pointerEvents="none"
              />
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 40,
                  backgroundColor: "rgba(255, 255, 255, 0.10)",
                }}
                pointerEvents="none"
              />
              <Waypoints
                size={140}
                color="#FFFFFF"
                strokeWidth={1}
                style={{
                  position: "absolute",
                  right: -24,
                  bottom: -24,
                  opacity: 0.1,
                }}
                pointerEvents="none"
              />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255, 255, 255, 0.16)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.30)",
                  }}
                >
                  <Sparkles size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: "#FFFFFF", fontWeight: "800" },
                    ]}
                  >
                    {t("timeline.heroTitle", "Continuous Health Stream")}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: "rgba(255,255,255,0.82)", lineHeight: 16 },
                    ]}
                  >
                    {t(
                      "timeline.heroBody",
                      "Chronological care record connecting clinical visits, prescribed medicines, and logged vitals."
                    )}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: "rgba(255, 255, 255, 0.16)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.30)",
                    alignSelf: "flex-start",
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: "#FFFFFF", fontWeight: "700", fontSize: 11 },
                    ]}
                  >
                    {events.length}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Card>
        )}

        {/* Loading State */}
        {isLoading ? (
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <Skeleton width={"100%"} height={96} radius={radius.lg} />
            <Skeleton width={"100%"} height={96} radius={radius.lg} />
            <Skeleton width={"100%"} height={96} radius={radius.lg} />
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
                  {/* Group Header Badge */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 20,
                        backgroundColor: colors.surfaceSubtle,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={[
                          typography.overline,
                          { color: colors.text, fontWeight: "700", letterSpacing: 0.6 },
                        ]}
                      >
                        {groupTitle.toUpperCase()} · {groupList.length}
                      </Text>
                    </View>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border + "50" }} />
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
  const { colors, spacing, typography, radius, shadow } = useTheme();
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
  const isMedicine = event.kind === "medicine_start" || event.kind === "medicine_stop";

  // Nicely capitalized title
  const cleanTitle = useMemo(() => {
    if (!event.title) return "Health Event";
    return event.title.charAt(0).toUpperCase() + event.title.slice(1);
  }, [event.title]);

  const timestampFormatted = formatEventTimestamp(event.date, locale);

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
    <View style={{ flexDirection: "row", gap: spacing.md, position: "relative" }}>
      {/* Left Continuous Timeline Spine */}
      <View style={{ alignItems: "center", width: 38 }}>
        {/* Connected Vertical Track Line */}
        {!isLast && (
          <View
            style={{
              position: "absolute",
              top: 38,
              bottom: 0,
              width: 2,
              backgroundColor: colors.border,
            }}
          />
        )}

        {/* Embedded Icon Node on Spine */}
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: palette.bg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: palette.border + "40",
            shadowColor: palette.fg,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 4,
            elevation: 2,
            zIndex: 2,
          }}
        >
          <Icon size={18} color={palette.fg} strokeWidth={2.2} />
        </View>
      </View>

      {/* Right Event Card Container */}
      <View style={{ flex: 1, paddingBottom: spacing.md }}>
        <Pressable
          onPress={isInteractive ? handlePress : undefined}
          style={{
            borderRadius: radius.xl,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            gap: spacing.xs + 2,
            ...shadow.sm,
          }}
        >
          {/* Card Top Strip: Category Pill + Formatted Timestamp */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <PillCmp
                label={event.label || meta.defaultLabel}
                tone={meta.tone}
                size="sm"
              />
              {event.meta?.status && (
                <PillCmp
                  label={humanizeStatus(event.meta.status)}
                  tone={statusTone(event.meta.status)}
                  size="sm"
                />
              )}
            </View>

            {isInteractive && (
              <ChevronRight size={16} color={colors.textSubtle} />
            )}
          </View>

          {/* Event Title */}
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "600", marginTop: 2 },
            ]}
            numberOfLines={2}
          >
            {cleanTitle}
          </Text>

          {/* Event Subtitle / Details */}
          {!!event.subtitle && (
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, lineHeight: 18 },
              ]}
              numberOfLines={2}
            >
              {event.subtitle}
            </Text>
          )}

          {/* Extracted Lab / Test Badges */}
          {Array.isArray((event as any).extractedItems) &&
            (event as any).extractedItems.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 4,
                  marginTop: 2,
                }}
              >
                {(event as any).extractedItems.slice(0, 3).map((item: any, i: number) => (
                  <View
                    key={i}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: colors.surfaceSubtle,
                      borderWidth: 1,
                      borderColor: colors.border,
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

          {/* Formatted Date & Time */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
            }}
          >
            <Clock size={12} color={colors.textSubtle} />
            <Text style={[typography.caption, { color: colors.textSubtle, fontSize: 11 }]}>
              {timestampFormatted}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
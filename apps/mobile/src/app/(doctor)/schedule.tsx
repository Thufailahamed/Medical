// @ts-nocheck
import { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Calendar as CalendarIcon,
  CalendarOff,
  CalendarCheck,
  Pill,
  ChevronLeft,
  ChevronRight,
  Bell,
  Video,
  Sparkles,
  ArrowRight,
  UserPlus,
} from "lucide-react-native";
import { useDoctorScheduleRange } from "@/hooks/useApi";
import {
  Screen,
  ErrorState,
  IconButton,
  IconTile,
  LargeHeader,
  MetricStrip,
  SectionHeader,
  Skeleton,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";
import { useLocaleStore } from "@/stores/locale";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay(); // 0 = Sun
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const KIND_META: Record<
  string,
  { label: string; icon: any; tone: Tone; tag: string }
> = {
  appointment: { label: "Appt", icon: CalendarCheck, tone: "primary", tag: "APPOINTMENT" },
  walkin: { label: "Walk-in", icon: Bell, tone: "warning", tag: "WALK-IN" },
  followup: { label: "Follow-up", icon: Pill, tone: "accent", tag: "FOLLOW-UP" },
  timeoff: { label: "Off", icon: CalendarOff, tone: "danger", tag: "TIME OFF" },
};

export default function ScheduleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const locale = useLocaleStore((s) => s.locale);

  const today = useMemo(() => new Date(), []);
  const todayIso = toIso(today);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(today));
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return toIso(d);
  }, [weekStart]);
  const fromIso = toIso(weekStart);

  const { data, isLoading, isError, refetch } = useDoctorScheduleRange(fromIso, weekEnd);

  const events = data?.events || [];

  // Group events by date.
  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of events) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    }
    return map;
  }, [events]);

  const selectedEvents = byDate[selectedDate] || [];

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const iso = toIso(d);
      return {
        iso,
        dayLabel: d.toLocaleDateString(
          locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
          { weekday: "short" }
        ),
        monthLabel: d.toLocaleDateString(
          locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
          { month: "short" }
        ),
        num: d.getDate(),
        isToday: iso === todayIso,
        isPast: iso < todayIso,
        eventCount: byDate[iso]?.length || 0,
      };
    });
  }, [weekStart, todayIso, locale, byDate]);

  const goPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => {
    const s = startOfWeek(today);
    setWeekStart(s);
    setSelectedDate(todayIso);
  };

  const headerDateRange = useMemo(() => {
    const start = weekStart;
    const end = addDays(weekStart, 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(
        locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
        { month: "short", day: "numeric" }
      );
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  }, [weekStart, locale]);

  const selectedDateFormatted = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(
      locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
      { weekday: "long", month: "short", day: "numeric" }
    );
  }, [selectedDate, locale]);

  const isViewingToday = selectedDate === todayIso;

  const onSelectDay = useCallback((iso: string) => {
    setSelectedDate(iso);
  }, []);

  const totalThisWeek = events.length;
  const totalsByKind = useMemo(() => {
    const c = { appointment: 0, walkin: 0, followup: 0, timeoff: 0 };
    for (const e of events) c[e.kind] = (c[e.kind] || 0) + 1;
    return c;
  }, [events]);

  const selectedDayTotals = useMemo(() => {
    const c = { total: selectedEvents.length, appointment: 0, walkin: 0, followup: 0, timeoff: 0 };
    for (const e of selectedEvents) {
      if (e.kind && c[e.kind] !== undefined) c[e.kind]++;
    }
    return c;
  }, [selectedEvents]);

  // Smart jump: find another day in this week with visits when selected day is empty
  const nextDayWithVisits = useMemo(() => {
    if (selectedEvents.length > 0) return null;
    const daysWithEvents = weekDays.filter(
      (d) => d.iso !== selectedDate && d.eventCount > 0
    );
    if (daysWithEvents.length === 0) return null;
    const futureDay = daysWithEvents.find((d) => d.iso > selectedDate);
    return futureDay || daysWithEvents[0];
  }, [selectedEvents, weekDays, selectedDate]);

  const kickerLabel = isViewingToday
    ? `${t("schedule.today", "Today")} · ${selectedDateFormatted}`
    : selectedDateFormatted;

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Header: title + week range, week nav on the right ── */}
        <LargeHeader
          kicker={headerDateRange}
          title={t("schedule.title", "Schedule")}
          right={
            <>
          {!isViewingToday || weekStart.getTime() !== startOfWeek(today).getTime() ? (
            <Pressable
              onPress={goToday}
              hitSlop={6}
              accessibilityRole="button"
              style={({ pressed }) => ({
                height: 36,
                paddingHorizontal: 14,
                borderRadius: 18,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.primary : colors.primarySoft,
              })}
            >
              {({ pressed }) => (
                <Text
                  style={[typography.label.md, { color: pressed ? colors.onPrimary : colors.primary }]}
                >
                  {t("schedule.today", "Today")}
                </Text>
              )}
            </Pressable>
          ) : null}
          <IconButton
            icon={ChevronLeft}
            variant="surface"
            size="sm"
            onPress={goPrevWeek}
            accessibilityLabel={t("schedule.previousWeek", "Previous week")}
          />
          <IconButton
            icon={ChevronRight}
            variant="surface"
            size="sm"
            onPress={goNextWeek}
            accessibilityLabel={t("schedule.previousWeek", "Previous week")}
          />
          <IconButton
            icon={UserPlus}
            variant="surface"
            size="sm"
            onPress={() => router.push("/(doctor)/walk-ins" as any)}
            accessibilityLabel={t("walkIns.title", "Walk-ins")}
          />
            </>
          }
        />

        {/* ── 7-day selector — one paper card, selected day is a filled capsule ── */}
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: spacing.lg,
            padding: 5,
            gap: 2,
            borderRadius: radius.card,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? colors.borderStrong : colors.hairline,
            ...(isDark ? {} : shadow.card),
          }}
        >
          {weekDays.map((d) => {
            const isSelected = d.iso === selectedDate;
            const hasEvents = d.eventCount > 0;
            const fg = isSelected ? colors.onPrimary : d.isToday ? colors.primary : colors.text;

            return (
              <Pressable
                key={d.iso}
                onPress={() => onSelectDay(d.iso)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t("schedule.dayA11y", {
                  day: `${d.dayLabel} ${d.num}`,
                  count: d.eventCount,
                })}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 74,
                  borderRadius: 20,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  backgroundColor: isSelected
                    ? colors.primary
                    : pressed
                    ? colors.fill
                    : "transparent",
                  ...(isSelected && !isDark ? shadow.primary : {}),
                })}
              >
                <Text
                  style={[
                    typography.overline,
                    {
                      fontSize: 10,
                      color: isSelected
                        ? "rgba(255,255,255,0.8)"
                        : d.isToday
                        ? colors.primary
                        : colors.textSubtle,
                      textTransform: "uppercase",
                    },
                  ]}
                >
                  {d.dayLabel.slice(0, 3)}
                </Text>
                <Text
                  style={[
                    typography.title.lg,
                    {
                      fontVariant: ["tabular-nums"],
                      color: fg,
                      opacity: d.isPast && !isSelected ? 0.45 : 1,
                    },
                  ]}
                >
                  {d.num}
                </Text>
                <View style={{ height: 6, flexDirection: "row", gap: 2, alignItems: "center" }}>
                  {hasEvents
                    ? Array.from({ length: Math.min(d.eventCount, 3) }).map((_, i) => (
                        <View
                          key={i}
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: isSelected ? "rgba(255,255,255,0.9)" : colors.primary,
                          }}
                        />
                      ))
                    : d.isToday && !isSelected
                    ? (
                        <View
                          style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: colors.primary }}
                        />
                      )
                    : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ── Day metrics ───────────────────────────────────────── */}
        <MetricStrip
          size="md"
          style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}
          items={[
            {
              icon: CalendarIcon,
              label: t("schedule.total", "Total"),
              value: selectedDayTotals.total,
              sub:
                totalThisWeek === selectedDayTotals.total
                  ? t("schedule.allScheduled")
                  : t("schedule.thisWeek", { count: totalThisWeek }),
              tone: "primary",
            },
            {
              icon: CalendarCheck,
              label: t("schedule.appts", "Appts"),
              value: selectedDayTotals.appointment,
              sub: t("schedule.thisWeek", { count: totalsByKind.appointment || 0 }),
              tone: "info",
            },
            {
              icon: Bell,
              label: t("schedule.walkins", "Walk-ins"),
              value: selectedDayTotals.walkin,
              sub: t("schedule.thisWeek", { count: totalsByKind.walkin || 0 }),
              tone: "warning",
            },
          ]}
        />

        {/* ── Agenda ───────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SectionHeader
            kicker={kickerLabel}
            title={t("schedule.agenda", "Daily agenda")}
            count={selectedEvents.length > 0 ? selectedEvents.length : undefined}
          />

          {isLoading ? (
            <View style={{ gap: spacing.sm }}>
              <Skeleton height={76} radius={radius.xl} />
              <Skeleton height={76} radius={radius.xl} />
            </View>
          ) : isError ? (
            <ErrorState
              title={t("recordDetail.errorTitle", "Couldn't load schedule")}
              message={t("recordDetail.errorBody", "Check your connection and try again.")}
              actionLabel={t("common.retry")}
              onAction={() => refetch()}
            />
          ) : selectedEvents.length === 0 ? (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.xxl,
                alignItems: "center",
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isDark ? colors.borderStrong : colors.hairline,
                ...(isDark ? {} : shadow.card),
              }}
            >
              <IconTile icon={CalendarCheck} tone="primary" appearance="soft" size={60} />
              <Text
                style={[
                  typography.title.lg,
                  { color: colors.text, marginTop: spacing.lg, textAlign: "center" },
                ]}
              >
                {t("schedule.clearDay", "Your day is clear")}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 260 },
                ]}
              >
                {t("schedule.clearDayBody")}
              </Text>

              {nextDayWithVisits ? (
                <Pressable
                  onPress={() => onSelectDay(nextDayWithVisits.iso)}
                  style={({ pressed }) => ({
                    marginTop: spacing.lg,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    height: 38,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderCurve: "continuous",
                    backgroundColor: pressed ? colors.primary : colors.primarySoft,
                  })}
                >
                  {({ pressed }) => (
                    <>
                      <Sparkles
                        size={15}
                        color={pressed ? colors.onPrimary : colors.primary}
                        strokeWidth={2.2}
                      />
                      <Text
                        style={[
                          typography.label.md,
                          { color: pressed ? colors.onPrimary : colors.primary },
                        ]}
                      >
                        {t("schedule.nextDay", {
                          day: nextDayWithVisits.dayLabel,
                          count: nextDayWithVisits.eventCount,
                        })}
                      </Text>
                      <ArrowRight
                        size={14}
                        color={pressed ? colors.onPrimary : colors.primary}
                        strokeWidth={2.5}
                      />
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View>
            {selectedEvents.map((e, idx) => {
              const meta = KIND_META[e.kind] || KIND_META.appointment;
              const tn = tonePalette(meta.tone, colors);
              const Icon = meta.icon;
              const isVideo = e.mode === "video";
              const isLast = idx === selectedEvents.length - 1;

              return (
                <View
                  key={`${e.kind}-${e.id}`}
                  style={{ flexDirection: "row", alignItems: "stretch" }}
                >
                  {/* Time column */}
                  <View style={{ width: 52, paddingTop: spacing.md + 2 }}>
                    {e.startTime ? (
                      <>
                        <Text
                          style={[
                            typography.label.md,
                            { color: colors.text, fontVariant: ["tabular-nums"] },
                          ]}
                        >
                          {e.startTime}
                        </Text>
                        {e.endTime ? (
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSubtle, fontVariant: ["tabular-nums"] },
                            ]}
                          >
                            {e.endTime}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </View>

                  {/* Timeline rail */}
                  <View style={{ width: 18, alignItems: "center" }}>
                    <View
                      style={{
                        marginTop: spacing.md + 5,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: tn.fg,
                        borderWidth: 2,
                        borderColor: colors.bg,
                      }}
                    />
                    {!isLast ? (
                      <View
                        style={{
                          flex: 1,
                          width: StyleSheet.hairlineWidth * 2,
                          marginTop: 4,
                          backgroundColor: colors.separator,
                        }}
                      />
                    ) : null}
                  </View>

                  <Pressable
                    onPress={() => {
                      if (e.patientId) {
                        router.push(`/(doctor)/patient-detail?id=${e.patientId}` as any);
                      }
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      padding: spacing.md,
                      marginLeft: spacing.xs,
                      borderRadius: radius.xl,
                      borderCurve: "continuous",
                      backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: isDark ? colors.borderStrong : colors.hairline,
                      marginBottom: spacing.sm + 2,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                      ...(isDark ? {} : shadow.card),
                    })}
                  >
                    {/* Left Icon */}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: tn.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: spacing.md,
                      }}
                    >
                      <Icon size={19} color={tn.fg} strokeWidth={2.2} />
                    </View>

                    {/* Center Content */}
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View
                          style={{
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 6,
                            borderCurve: "continuous",
                            backgroundColor: tn.bg,
                          }}
                        >
                          <Text style={[typography.label.xs, { fontSize: 10, color: tn.fg, letterSpacing: 0.4 }]}>
                            {t(`schedule.kinds.${e.kind}.tag`, {
                              defaultValue: meta.tag,
                            })}
                          </Text>
                        </View>
                        {isVideo ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              borderCurve: "continuous",
                              backgroundColor: colors.successSoft,
                            }}
                          >
                            <Video size={10} color={colors.success} />
                            <Text style={[typography.label.xs, { fontSize: 10, color: colors.success }]}>
                              {t("schedule.video")}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Patient Name / Title */}
                      <Text
                        numberOfLines={1}
                        style={[typography.title.md, { color: colors.text }]}
                      >
                        {e.patientName ||
                          e.title ||
                          t(`schedule.kinds.${e.kind}.label`, {
                            defaultValue: meta.label,
                          })}
                      </Text>

                      {/* Subtitle Details: Queue / Room / Status */}
                      {(e.queueNumber !== null || e.status || e.title) ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {e.queueNumber !== null && e.queueNumber !== undefined ? (
                            <View
                              style={{
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: 5,
                                borderCurve: "continuous",
                                backgroundColor: colors.fill,
                              }}
                            >
                              <Text style={[typography.label.xs, { color: colors.textMuted }]}>
                                {t("schedule.queueNumber", {
                                  number: e.queueNumber,
                                })}
                              </Text>
                            </View>
                          ) : null}

                          {e.status ? (
                            <Text
                              style={[
                                typography.caption,
                                { color: colors.textSubtle, textTransform: "capitalize" },
                              ]}
                            >
                              {t(`status.${e.status}`, {
                                defaultValue: e.status,
                              })}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>

                    {/* Right Chevron */}
                    <ChevronRight
                      size={17}
                      color={colors.textSubtle}
                      strokeWidth={2.4}
                      style={{ marginLeft: spacing.xs }}
                    />
                  </Pressable>
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


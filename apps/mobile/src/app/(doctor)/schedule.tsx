// @ts-nocheck
import { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  CalendarOff,
  CalendarCheck,
  Pill,
  ChevronLeft,
  ChevronRight,
  Bell,
  Video,
  Building2,
  Sparkles,
  ArrowRight,
  User,
} from "lucide-react-native";
import { useDoctorScheduleRange } from "@/hooks/useApi";
import { Screen, ErrorState } from "@/components/ui";
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

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              borderCurve: "continuous",
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CalendarDays size={22} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.display.md, { color: colors.text }]}>
              {t("schedule.title", "Schedule")}
            </Text>
            <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}>
              {headerDateRange}
            </Text>
          </View>
        </View>

        {/* Quick jump to Today button if looking at another day */}
        {!isViewingToday ? (
          <Pressable
            onPress={goToday}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              height: 34,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: pressed ? colors.primary : colors.primarySoft,
            })}
          >
            {({ pressed }) => (
              <>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: pressed ? colors.onPrimary : colors.primary,
                  }}
                />
                <Text
                  style={[
                    typography.label.md,
                    { color: pressed ? colors.onPrimary : colors.primary },
                  ]}
                >
                  {t("schedule.today", "Today")}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* ── Week Switcher Toolbar ─────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginHorizontal: spacing.lg,
          marginBottom: spacing.xs,
          marginTop: spacing.xs,
          padding: 3,
          borderRadius: 12,
          borderCurve: "continuous",
          backgroundColor: colors.fill,
        }}
      >
        <Pressable
          onPress={goPrevWeek}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 9,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surface : "transparent",
          })}
        >
          <ChevronLeft size={18} color={colors.text} strokeWidth={2.4} />
        </Pressable>

        <Pressable
          onPress={goToday}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 6,
          }}
        >
          <Text
            style={[
              typography.label.md,
              { color: isViewingToday ? colors.primary : colors.text },
            ]}
          >
            {isViewingToday
              ? `Today · ${headerDateRange.split("–")[0].trim()}`
              : headerDateRange}
          </Text>
        </Pressable>

        <Pressable
          onPress={goNextWeek}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next week"
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 9,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surface : "transparent",
          })}
        >
          <ChevronRight size={18} color={colors.text} strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* ── 7-Day Selector Strip ──────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: spacing.lg,
          paddingVertical: spacing.xs,
          gap: 6,
        }}
      >
        {weekDays.map((d) => {
          const isSelected = d.iso === selectedDate;
          const hasEvents = d.eventCount > 0;

          return (
            <Pressable
              key={d.iso}
              onPress={() => onSelectDay(d.iso)}
              accessibilityRole="button"
              accessibilityLabel={`${d.dayLabel} ${d.num}, ${d.eventCount} visits`}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 78,
                borderRadius: 16,
                borderCurve: "continuous",
                paddingVertical: 8,
                paddingHorizontal: 2,
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: isSelected
                  ? colors.primary
                  : d.isToday
                  ? colors.primarySoft
                  : pressed
                  ? colors.surfaceMuted
                  : colors.surface,
                borderWidth: isSelected || d.isToday ? 0 : StyleSheet.hairlineWidth,
                borderColor: isDark ? colors.borderStrong : colors.separator,
                opacity: d.isPast && !isSelected ? 0.6 : 1,
                ...(isSelected && !isDark ? shadow.primary : isDark ? {} : shadow.xs),
              })}
            >
              {/* Day Label (e.g. SUN, MON) */}
              <Text
                style={[
                  typography.overline,
                  {
                    fontSize: 10,
                    color: isSelected
                      ? "rgba(255,255,255,0.85)"
                      : d.isToday
                      ? colors.primary
                      : colors.textSubtle,
                    textTransform: "uppercase",
                  },
                ]}
              >
                {d.dayLabel.slice(0, 3)}
              </Text>

              {/* Day Number (e.g. 23) */}
              <Text
                style={[
                  typography.title.lg,
                  {
                    fontVariant: ["tabular-nums"],
                    color: isSelected
                      ? colors.onPrimary
                      : d.isToday
                      ? colors.primary
                      : colors.text,
                  },
                ]}
              >
                {d.num}
              </Text>

              {/* Event indicator badge */}
              {hasEvents ? (
                <View
                  style={{
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: 9,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isSelected
                      ? "rgba(255, 255, 255, 0.24)"
                      : colors.primarySoft,
                  }}
                >
                  <Text
                    style={[
                      typography.label.xs,
                      { fontSize: 10, color: isSelected ? colors.onPrimary : colors.primary },
                    ]}
                  >
                    {d.eventCount}
                  </Text>
                </View>
              ) : d.isToday ? (
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: isSelected
                      ? "rgba(255, 255, 255, 0.8)"
                      : colors.primary,
                  }}
                />
              ) : (
                <View style={{ height: 18 }} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── Metrics Cards Strip ───────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
          gap: spacing.sm,
        }}
      >
        <PulseMetricCard
          label={t("schedule.total", "Total")}
          value={selectedDayTotals.total}
          subtext={
            totalThisWeek === selectedDayTotals.total
              ? "All scheduled"
              : `${totalThisWeek} this week`
          }
          icon={CalendarIcon}
          tone="primary"
        />
        <PulseMetricCard
          label={t("schedule.appts", "Appts")}
          value={selectedDayTotals.appointment}
          subtext={`${totalsByKind.appointment || 0} this week`}
          icon={CalendarCheck}
          tone="info"
        />
        <PulseMetricCard
          label={t("schedule.walkins", "Walk-ins")}
          value={selectedDayTotals.walkin}
          subtext={`${totalsByKind.walkin || 0} this week`}
          icon={Bell}
          tone="warning"
        />
      </View>

      {/* ── Day Event List / Agenda ───────────────────────────── */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xs,
        }}
      >
        {/* Agenda Section Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: spacing.xs,
            marginBottom: spacing.xs,
          }}
        >
          <View style={{ gap: 2 }}>
            <Text
              style={[
                typography.overline,
                { color: colors.textSubtle, textTransform: "uppercase" },
              ]}
            >
              {selectedDateFormatted}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[typography.title.lg, { color: colors.text }]}>
                {t("schedule.agenda", "Daily agenda")}
              </Text>
              {isViewingToday ? (
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Text
                    style={[
                      typography.label.xs,
                      { fontSize: 10, color: colors.primary, textTransform: "uppercase" },
                    ]}
                  >
                    Today
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Visits Count Pill */}
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor:
                selectedEvents.length > 0 ? colors.primarySoft : colors.fill,
            }}
          >
            <Text
              style={[
                typography.label.sm,
                { color: selectedEvents.length > 0 ? colors.primary : colors.textMuted },
              ]}
            >
              {selectedEvents.length}{" "}
              {selectedEvents.length === 1 ? "visit" : "visits"}
            </Text>
          </View>
        </View>

        {/* List Content */}
        {isLoading ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: "center", gap: 10 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.body.sm, { color: colors.textMuted }]}>
              Loading appointments...
            </Text>
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load schedule")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : selectedEvents.length === 0 ? (
          /* Empty State */
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 130 }}
          >
            <View
              style={{
                marginTop: spacing.xs,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.xxl,
                alignItems: "center",
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isDark ? colors.borderStrong : colors.separator,
                ...(isDark ? {} : shadow.sm),
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 22,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarCheck size={28} color={colors.primary} strokeWidth={2} />
              </View>

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
                No visits or consultations scheduled for this date.
              </Text>

              {/* Actionable smart hint to jump to next day with events */}
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
                        Next: {nextDayWithVisits.dayLabel} ({nextDayWithVisits.eventCount}{" "}
                        {nextDayWithVisits.eventCount === 1 ? "visit" : "visits"})
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
          </ScrollView>
        ) : (
          /* Events List */
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 130 }}
          >
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
                      borderColor: isDark ? colors.borderStrong : colors.separator,
                      marginBottom: spacing.sm + 2,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                      ...(isDark ? {} : shadow.sm),
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
                        <Text style={[typography.label.xs, { color: tn.fg }]}>
                          {meta.tag}
                        </Text>
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
                              Video
                            </Text>
                          </View>
                        ) : null}
                        {e.startTime ? (
                          <View
                            style={{
                              marginLeft: "auto",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <Clock size={11} color={colors.textSubtle} />
                            <Text
                              style={[
                                typography.caption,
                                { color: colors.textMuted, fontVariant: ["tabular-nums"] },
                              ]}
                            >
                              {e.startTime}
                              {e.endTime ? ` – ${e.endTime}` : ""}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Patient Name / Title */}
                      <Text
                        numberOfLines={1}
                        style={[typography.title.md, { color: colors.text }]}
                      >
                        {e.patientName || e.title || meta.label}
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
                                Queue #{e.queueNumber}
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
                              {e.status}
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
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

// ── Pulse Metric Card ──────────────────────────────────────────
function PulseMetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: number;
  subtext: string;
  icon: any;
  tone?: Tone;
}) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const tn = tonePalette(tone, colors);

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        borderCurve: "continuous",
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.separator,
        justifyContent: "space-between",
        ...(isDark ? {} : shadow.xs),
      }}
    >
      {/* Top row: Icon + Label */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            borderCurve: "continuous",
            backgroundColor: tn.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={12} color={tn.fg} strokeWidth={2.5} />
        </View>
        <Text
          numberOfLines={1}
          style={[typography.label.sm, { flex: 1, color: tn.fg }]}
        >
          {label}
        </Text>
      </View>

      {/* Number */}
      <Text
        style={[
          typography.display.sm,
          {
            fontSize: 26,
            lineHeight: 30,
            letterSpacing: -0.9,
            color: colors.text,
            fontVariant: ["tabular-nums"],
          },
        ]}
      >
        {value}
      </Text>

      {/* Subtext */}
      <Text
        numberOfLines={1}
        style={[typography.caption, { fontSize: 11, color: colors.textSubtle, marginTop: 1 }]}
      >
        {subtext}
      </Text>
    </View>
  );
}

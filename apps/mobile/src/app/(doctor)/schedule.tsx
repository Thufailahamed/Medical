// @ts-nocheck
import { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
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
  { label: string; icon: any; bg: string; fg: string; tag: string; border: string }
> = {
  appointment: {
    label: "Appt",
    icon: CalendarCheck,
    bg: "rgba(59, 130, 246, 0.10)",
    fg: "#2563EB",
    border: "rgba(59, 130, 246, 0.25)",
    tag: "APPOINTMENT",
  },
  walkin: {
    label: "Walk-in",
    icon: Bell,
    bg: "rgba(245, 158, 11, 0.10)",
    fg: "#D97706",
    border: "rgba(245, 158, 11, 0.25)",
    tag: "WALK-IN",
  },
  followup: {
    label: "Follow-up",
    icon: Pill,
    bg: "rgba(16, 185, 129, 0.10)",
    fg: "#059669",
    border: "rgba(16, 185, 129, 0.25)",
    tag: "FOLLOW-UP",
  },
  timeoff: {
    label: "Off",
    icon: CalendarOff,
    bg: "rgba(239, 68, 68, 0.10)",
    fg: "#DC2626",
    border: "rgba(239, 68, 68, 0.25)",
    tag: "TIME OFF",
  },
};

export default function ScheduleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily, shadow } = useTheme();
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
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(14, 165, 233, 0.25)",
            }}
          >
            <CalendarDays size={22} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text,
                fontFamily: fontFamily.displayBold,
                fontSize: 24,
                fontWeight: "800",
                letterSpacing: -0.6,
              }}
            >
              {t("schedule.title", "Schedule")}
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 13,
                fontWeight: "500",
                marginTop: 1,
              }}
            >
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
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: pressed ? colors.primary : colors.primarySoft,
              borderWidth: 1,
              borderColor: colors.borderFocus,
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
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: pressed ? colors.onPrimary : colors.primary,
                    fontFamily: fontFamily.bodyBold,
                  }}
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
          padding: 4,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadow.sm,
        }}
      >
        <Pressable
          onPress={goPrevWeek}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
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
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: isViewingToday ? colors.primary : colors.text,
              fontFamily: fontFamily.bodyBold,
            }}
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
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
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
                minHeight: 76,
                borderRadius: 18,
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
                borderWidth: 1.5,
                borderColor: isSelected
                  ? colors.primary
                  : d.isToday
                  ? colors.borderFocus
                  : "rgba(226, 235, 241, 0.7)",
                opacity: d.isPast && !isSelected ? 0.75 : 1,
                shadowColor: isSelected ? colors.primary : "#062238",
                shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
                shadowOpacity: isSelected ? 0.28 : 0.04,
                shadowRadius: isSelected ? 8 : 4,
                elevation: isSelected ? 4 : 1,
              })}
            >
              {/* Day Label (e.g. SUN, MON) */}
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: isSelected
                    ? "rgba(255,255,255,0.92)"
                    : d.isToday
                    ? colors.primary
                    : colors.textSubtle,
                  fontFamily: fontFamily.bodyBold,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {d.dayLabel.slice(0, 3)}
              </Text>

              {/* Day Number (e.g. 23) */}
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 22,
                  fontWeight: "800",
                  color: isSelected
                    ? "#FFFFFF"
                    : d.isToday
                    ? colors.primary
                    : colors.text,
                  fontFamily: fontFamily.displayBold,
                }}
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
                      : colors.primary,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: "#FFFFFF",
                    }}
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
          paddingVertical: spacing.xs,
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
          fg={colors.primary}
          bg="rgba(14, 165, 233, 0.10)"
          border="rgba(14, 165, 233, 0.20)"
        />
        <PulseMetricCard
          label={t("schedule.appts", "Appts")}
          value={selectedDayTotals.appointment}
          subtext={`${totalsByKind.appointment || 0} this week`}
          icon={CalendarCheck}
          fg="#4F46E5"
          bg="rgba(79, 70, 229, 0.09)"
          border="rgba(79, 70, 229, 0.20)"
        />
        <PulseMetricCard
          label={t("schedule.walkins", "Walk-ins")}
          value={selectedDayTotals.walkin}
          subtext={`${totalsByKind.walkin || 0} this week`}
          icon={Bell}
          fg="#D97706"
          bg="rgba(217, 119, 6, 0.09)"
          border="rgba(217, 119, 6, 0.20)"
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
              style={{
                color: colors.textSubtle,
                fontFamily: fontFamily.bodyBold,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              {selectedDateFormatted}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={{
                  color: colors.text,
                  fontFamily: fontFamily.displayBold,
                  fontSize: 18,
                  fontWeight: "800",
                }}
              >
                {t("schedule.agenda", "Daily agenda")}
              </Text>
              {isViewingToday ? (
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: colors.primary,
                      textTransform: "uppercase",
                    }}
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
                selectedEvents.length > 0 ? colors.primarySoft : colors.surfaceMuted,
              borderWidth: 1,
              borderColor:
                selectedEvents.length > 0 ? colors.borderFocus : colors.border,
            }}
          >
            <Text
              style={{
                color: selectedEvents.length > 0 ? colors.primary : colors.textMuted,
                fontFamily: fontFamily.bodyBold,
                fontSize: 12,
                fontWeight: "800",
              }}
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
            <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "500" }}>
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
                paddingVertical: spacing.xl,
                alignItems: "center",
                borderRadius: 22,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                ...shadow.sm,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 22,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(14, 165, 233, 0.2)",
                }}
              >
                <CalendarCheck size={28} color={colors.primary} strokeWidth={2} />
              </View>

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  fontFamily: fontFamily.displayBold,
                  color: colors.text,
                  marginTop: spacing.md,
                  textAlign: "center",
                }}
              >
                {t("schedule.clearDay", "Your day is clear")}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 19,
                  color: colors.textMuted,
                  marginTop: 4,
                  textAlign: "center",
                }}
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
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    backgroundColor: pressed ? colors.primary : colors.primarySoft,
                    borderWidth: 1,
                    borderColor: colors.borderFocus,
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
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: pressed ? colors.onPrimary : colors.primary,
                        }}
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
            {selectedEvents.map((e) => {
              const meta = KIND_META[e.kind] || KIND_META.appointment;
              const Icon = meta.icon;
              const isVideo = e.mode === "video";

              return (
                <Pressable
                  key={`${e.kind}-${e.id}`}
                  onPress={() => {
                    if (e.patientId) {
                      router.push(`/(doctor)/patient-detail?id=${e.patientId}` as any);
                    }
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    borderRadius: 20,
                    backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderLeftWidth: 4,
                    borderLeftColor: meta.fg,
                    marginBottom: spacing.sm,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                    shadowColor: "#062238",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                  })}
                >
                  {/* Left Icon Pill */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      backgroundColor: meta.bg,
                      borderWidth: 1,
                      borderColor: meta.border,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: spacing.md,
                    }}
                  >
                    <Icon size={20} color={meta.fg} strokeWidth={2.2} />
                  </View>

                  {/* Center Content */}
                  <View style={{ flex: 1, gap: 3 }}>
                    {/* Top Row: Tag + Time */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View
                          style={{
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: meta.bg,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "800",
                              color: meta.fg,
                              letterSpacing: 0.5,
                            }}
                          >
                            {meta.tag}
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
                              backgroundColor: "rgba(16, 185, 129, 0.12)",
                            }}
                          >
                            <Video size={10} color="#059669" />
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "700",
                                color: "#059669",
                              }}
                            >
                              Video
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {e.startTime ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Clock size={11} color={colors.textSubtle} />
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: colors.text,
                              fontFamily: fontFamily.bodyBold,
                            }}
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
                      style={{
                        fontSize: 16,
                        fontWeight: "800",
                        color: colors.text,
                        fontFamily: fontFamily.displayBold,
                        marginTop: 1,
                      }}
                    >
                      {e.patientName || e.title || meta.label}
                    </Text>

                    {/* Subtitle Details: Queue / Room / Status */}
                    {(e.queueNumber !== null || e.status || e.title) ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
                        {e.queueNumber !== null && e.queueNumber !== undefined ? (
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 4,
                              backgroundColor: colors.surfaceMuted,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: colors.textMuted,
                              }}
                            >
                              Queue #{e.queueNumber}
                            </Text>
                          </View>
                        ) : null}

                        {e.status ? (
                          <Text
                            style={{
                              fontSize: 12,
                              color: colors.textSubtle,
                              textTransform: "capitalize",
                            }}
                          >
                            {e.status}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {/* Right Chevron */}
                  <ChevronRight
                    size={18}
                    color={colors.textSubtle}
                    strokeWidth={2.4}
                    style={{ marginLeft: spacing.xs }}
                  />
                </Pressable>
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
  fg,
  bg,
  border,
}: {
  label: string;
  value: number;
  subtext: string;
  icon: any;
  fg: string;
  bg: string;
  border: string;
}) {
  const { colors, radius, fontFamily, spacing } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        padding: spacing.sm + 2,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: border || colors.border,
        justifyContent: "space-between",
        shadowColor: "#062238",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 1,
      }}
    >
      {/* Top row: Label + Icon */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 0.6,
            color: fg,
            fontFamily: fontFamily.displayBold,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 9,
            backgroundColor: bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={13} color={fg} strokeWidth={2.4} />
        </View>
      </View>

      {/* Number */}
      <Text
        style={{
          fontSize: 24,
          lineHeight: 28,
          fontWeight: "800",
          color: colors.text,
          fontFamily: fontFamily.displayBold,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </Text>

      {/* Subtext */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 10,
          fontWeight: "600",
          color: colors.textMuted,
          marginTop: 2,
        }}
      >
        {subtext}
      </Text>
    </View>
  );
}

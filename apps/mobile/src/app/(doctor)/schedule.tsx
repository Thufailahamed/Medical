// @ts-nocheck
import { useMemo, useState, useCallback, useEffect } from "react";
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
  Clock,
  CalendarOff,
  CalendarCheck,
  Pill,
  ChevronLeft,
  ChevronRight,
  Bell,
} from "lucide-react-native";
import { useDoctorScheduleRange } from "@/hooks/useApi";
import { Screen } from "@/components/ui";
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
  { label: string; icon: any; bg: string; fg: string; tag: string }
> = {
  appointment: {
    label: "Appt",
    icon: CalendarCheck,
    bg: "rgba(85, 110, 245, 0.12)",
    fg: "#556EF5",
    tag: "APPT",
  },
  walkin: {
    label: "Walk-in",
    icon: Bell,
    bg: "rgba(245, 158, 11, 0.12)",
    fg: "#F59E0B",
    tag: "WALK",
  },
  followup: {
    label: "Follow-up",
    icon: Pill,
    bg: "rgba(16, 185, 129, 0.12)",
    fg: "#10B981",
    tag: "F/U",
  },
  timeoff: {
    label: "Off",
    icon: CalendarOff,
    bg: "rgba(244, 63, 94, 0.10)",
    fg: "#F43F5E",
    tag: "OFF",
  },
};

export default function ScheduleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  const locale = useLocaleStore((s) => s.locale);

  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(today));
  const [selectedDate, setSelectedDate] = useState<string>(toIso(today));

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return toIso(d);
  }, [weekStart]);
  const fromIso = toIso(weekStart);

  const { data, isLoading } = useDoctorScheduleRange(fromIso, weekEnd);

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
  const todayIso = toIso(today);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return {
        iso: toIso(d),
        dayLabel: d.toLocaleDateString(locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK", {
          weekday: "short",
        }),
        num: d.getDate(),
        isToday: toIso(d) === todayIso,
        isPast: toIso(d) < todayIso,
      };
    });
  }, [weekStart, todayIso, locale]);

  const goPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => {
    const s = startOfWeek(today);
    setWeekStart(s);
    setSelectedDate(todayIso);
  };

  const headerLabel = useMemo(() => {
    const start = weekStart;
    const end = addDays(weekStart, 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK", {
        month: "short",
        day: "numeric",
      });
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  }, [weekStart, locale]);

  const onSelectDay = useCallback((iso: string) => {
    setSelectedDate(iso);
  }, []);

  const totalThisWeek = events.length;
  const totalsByKind = useMemo(() => {
    const c = { appointment: 0, walkin: 0, followup: 0, timeoff: 0 };
    for (const e of events) c[e.kind] = (c[e.kind] || 0) + 1;
    return c;
  }, [events]);

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
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
          {t("schedule.title")}
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSubtle, marginTop: 4 },
          ]}
        >
          {headerLabel}
        </Text>
      </View>

      {/* Week navigation */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.sm,
        }}
      >
        <Pressable
          onPress={goPrevWeek}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <ChevronLeft size={18} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={goToday}
          style={({ pressed }) => ({
            flex: 1,
            marginHorizontal: spacing.sm,
            paddingVertical: 8,
            borderRadius: radius.full,
            backgroundColor: pressed ? colors.primary : colors.primarySoft,
            alignItems: "center",
          })}
        >
          <Text
            style={{
              color: colors.primary,
              fontFamily: fontFamily.bodyBold,
              fontWeight: "700",
              fontSize: 13,
            }}
          >
            {t("schedule.today")}
          </Text>
        </Pressable>
        <Pressable
          onPress={goNextWeek}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <ChevronRight size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Week day strip */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        {weekDays.map((d) => {
          const isSelected = d.iso === selectedDate;
          const eventCount = byDate[d.iso]?.length || 0;
          return (
            <Pressable
              key={d.iso}
              onPress={() => onSelectDay(d.iso)}
              style={({ pressed }) => ({
                flex: 1,
                marginHorizontal: 3,
                borderRadius: radius.md,
                paddingVertical: 10,
                alignItems: "center",
                backgroundColor: isSelected
                  ? colors.primary
                  : d.isToday
                  ? colors.primarySoft
                  : pressed
                  ? colors.surfaceMuted
                  : colors.surface,
                borderWidth: 1,
                borderColor: isSelected ? colors.primary : colors.border,
              })}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: isSelected ? "#FFFFFF" : colors.textSubtle,
                  fontFamily: fontFamily.bodyBold,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                {d.dayLabel.slice(0, 3)}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: isSelected ? "#FFFFFF" : colors.text,
                  fontFamily: fontFamily.displayBold,
                  marginTop: 4,
                }}
              >
                {d.num}
              </Text>
              {eventCount > 0 ? (
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: isSelected ? "#FFFFFF" : colors.primary,
                    marginTop: 4,
                  }}
                />
              ) : (
                <View style={{ height: 9, marginTop: 4 }} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Pulse strip */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <PulseTile
          label={t("schedule.total")}
          value={totalThisWeek}
          fg={colors.primary}
          bg={colors.primarySoft}
        />
        <PulseTile
          label={t("schedule.appts")}
          value={totalsByKind.appointment || 0}
          fg="#556EF5"
          bg="rgba(85, 110, 245, 0.12)"
        />
        <PulseTile
          label={t("schedule.walkins")}
          value={totalsByKind.walkin || 0}
          fg="#F59E0B"
          bg="rgba(245, 158, 11, 0.12)"
        />
      </View>

      {/* Day event list */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
        }}
      >
        <Text
          style={[
            typography.caption,
            {
              color: colors.textSubtle,
              fontFamily: fontFamily.displayBold,
              letterSpacing: 1.2,
              fontSize: 10,
              fontWeight: "800",
              textTransform: "uppercase",
              marginBottom: spacing.sm,
            },
          ]}
        >
          {selectedDate === todayIso
            ? t("schedule.today")
            : t("schedule.dayOf", {
                date: new Date(selectedDate).toLocaleDateString(
                  locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
                  {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  }
                ),
              })}
        </Text>

        {isLoading ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : selectedEvents.length === 0 ? (
          <View
            style={{
              paddingVertical: spacing.xxl,
              alignItems: "center",
            }}
          >
            <CalendarIcon size={48} color={colors.textSubtle} strokeWidth={1.4} />
            <Text
              style={{
                fontSize: 14,
                color: colors.textSubtle,
                marginTop: spacing.md,
              }}
            >
              {t("schedule.noEvents")}
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {selectedEvents.map((e) => {
              const meta = KIND_META[e.kind] || KIND_META.appointment;
              const Icon = meta.icon;
              return (
                <Pressable
                  key={`${e.kind}-${e.id}`}
                  onPress={() => {
                    if (e.kind === "appointment" && e.patientId) {
                      router.push(`/(doctor)/patient-detail?id=${e.patientId}` as any);
                    } else if (e.kind === "walkin" && e.patientId) {
                      router.push(`/(doctor)/patient-detail?id=${e.patientId}` as any);
                    }
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: spacing.sm,
                  })}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: meta.bg,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: spacing.md,
                    }}
                  >
                    <Icon size={20} color={meta.fg} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: meta.fg,
                          fontFamily: fontFamily.displayBold,
                          letterSpacing: 0.6,
                        }}
                      >
                        {meta.tag}
                      </Text>
                      {e.startTime && (
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
                              color: colors.textSubtle,
                              fontFamily: fontFamily.bodyBold,
                            }}
                          >
                            {e.startTime}
                            {e.endTime ? `–${e.endTime}` : ""}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: colors.text,
                        fontFamily: fontFamily.bodyBold,
                        marginTop: 2,
                      }}
                    >
                      {e.patientName || e.title || meta.label}
                    </Text>
                    {(e.title || e.status || e.queueNumber) && (
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          color: colors.textSubtle,
                          marginTop: 2,
                        }}
                      >
                        {[
                          e.title,
                          e.queueNumber !== null ? `Q ${e.queueNumber}` : null,
                          e.status,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

function PulseTile({
  label,
  value,
  fg,
  bg,
}: {
  label: string;
  value: number;
  fg: string;
  bg: string;
}) {
  const { colors, typography, radius, fontFamily, spacing } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: radius.md,
        padding: spacing.sm,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: "800",
          letterSpacing: 0.8,
          color: fg,
          fontFamily: fontFamily.displayBold,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "800",
          color: colors.text,
          fontFamily: fontFamily.displayBold,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

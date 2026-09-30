// @ts-nocheck

import { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput as RNTextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Save,
  Plus,
  Trash2,
  CalendarOff,
  Check,
  CalendarDays,
  Clock,
  Timer,
  ChevronDown,
  X,
  ArrowRight,
  Copy,
  AlertTriangle,
} from "lucide-react-native";
import {
  useDoctorAvailabilityMe,
  useUpdateDoctorAvailability,
  useTimeOff,
  useAddTimeOff,
  useDeleteTimeOff,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  Button,
  Skeleton,
  FormField,
  TextInput,
  SectionHeader,
  BottomSheet,
  ErrorState,
  useToast,
} from "@/components/ui";

type DaySchedule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  active: boolean;
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AvailabilityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const toast = useToast();

  const days = t("doctorAvailability.days", { returnObjects: true }) as string[];

  const { data, isLoading, isError, refetch } = useDoctorAvailabilityMe();
  const update = useUpdateDoctorAvailability();

  const DEFAULT_SCHEDULE: DaySchedule[] = useMemo(
    () =>
      days.map((_, i) => ({
        dayOfWeek: i,
        startTime: "09:00",
        endTime: "17:00",
        slotMinutes: 30,
        active: i >= 1 && i <= 5,
      })),
    [days]
  );

  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const seededRef = useRef(false);
  // Serialized last-saved schedule — Save stays disabled until it differs.
  const [baseline, setBaseline] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (seededRef.current || !data) return;
    seededRef.current = true;
    if (data.availability && data.availability.length > 0) {
      const seeded = data.availability.map((r: any) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        slotMinutes: r.slotMinutes,
        active: !!r.active,
      }));
      setSchedule(seeded);
      setBaseline(JSON.stringify(seeded));
    } else {
      setBaseline(JSON.stringify(DEFAULT_SCHEDULE));
    }
  }, [data, DEFAULT_SCHEDULE]);

  function addShift(dayOfWeek: number) {
    const dayShifts = schedule.filter((s) => s.dayOfWeek === dayOfWeek);
    let nextStart = "14:00";
    let nextEnd = "17:00";
    if (dayShifts.length > 0) {
      const lastShift = dayShifts[dayShifts.length - 1];
      const [h, m] = lastShift.endTime.split(":").map(Number);
      const startHour = Math.min(23, h + 1);
      const endHour = Math.min(23, startHour + 3);
      nextStart = `${String(startHour).padStart(2, "0")}:00`;
      nextEnd = `${String(endHour).padStart(2, "0")}:00`;
    }
    setSchedule((prev) => [
      ...prev,
      {
        dayOfWeek,
        startTime: nextStart,
        endTime: nextEnd,
        slotMinutes: 30,
        active: true,
      },
    ]);
  }

  function removeShift(flatIdx: number) {
    setSchedule((prev) => prev.filter((_, i) => i !== flatIdx));
  }

  function updateShift(flatIdx: number, p: Partial<DaySchedule>) {
    setSchedule((prev) =>
      prev.map((item, i) => (i === flatIdx ? { ...item, ...p } : item))
    );
  }

  function toggleDayActive(dayOfWeek: number, val: boolean) {
    setSchedule((prev) => {
      const dayShifts = prev.filter((s) => s.dayOfWeek === dayOfWeek);
      if (val) {
        if (dayShifts.length === 0) {
          return [
            ...prev,
            {
              dayOfWeek,
              startTime: "09:00",
              endTime: "17:00",
              slotMinutes: 30,
              active: true,
            },
          ];
        }
        return prev.map((s) =>
          s.dayOfWeek === dayOfWeek ? { ...s, active: true } : s
        );
      } else {
        return prev.map((s) =>
          s.dayOfWeek === dayOfWeek ? { ...s, active: false } : s
        );
      }
    });
  }

  async function save() {
    try {
      await update.mutateAsync({ schedule });
      setBaseline(JSON.stringify(schedule));
      toast.show(t("doctorAvailability.savedToast"), "success");
    } catch (err: any) {
      toast.show(err?.message || t("doctorAvailability.saveError"), "danger");
    }
  }

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => router.back()}
          title={t("doctorAvailability.title")}
        />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={120} radius={20} />
          ))}
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => router.back()}
          title={t("doctorAvailability.title")}
        />
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load availability")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      </Screen>
    );
  }

  const activeDays = new Set(
    schedule.filter((d) => d.active).map((d) => d.dayOfWeek)
  );
  const activeCount = activeDays.size;

  const activeShifts = schedule.filter((d) => d.active);
  const minSlot = activeShifts.length > 0
    ? Math.min(...activeShifts.map((d) => d.slotMinutes || 30))
    : 30;
  const weeklyMinutes = activeShifts.reduce((sum, s) => {
    const a = toMinutes(s.startTime);
    const b = toMinutes(s.endTime);
    return a != null && b != null && b > a ? sum + (b - a) : sum;
  }, 0);
  const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
  const hasInvalid = activeShifts.some((s) => shiftError(s) != null);
  const dirty = baseline != null && JSON.stringify(schedule) !== baseline;
  const canSave = dirty && !hasInvalid && !update.isPending;

  function copyToOpenDays(fromDay: number) {
    const source = schedule.filter((s) => s.dayOfWeek === fromDay && s.active);
    setSchedule((prev) => {
      const others = prev.filter((s) => !activeDays.has(s.dayOfWeek) || s.dayOfWeek === fromDay);
      const copies = Array.from(activeDays)
        .filter((d) => d !== fromDay)
        .flatMap((d) => source.map((s) => ({ ...s, dayOfWeek: d })));
      return [...others, ...copies];
    });
    toast.show(t("doctorAvailability.copiedToast", "Hours copied to all open days"), "success");
  }

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorAvailability.title")}
        subtitle={
          dirty
            ? t("doctorAvailability.unsaved", "Unsaved changes")
            : t("doctorAvailability.subtitle", { count: activeCount, min: minSlot })
        }
        right={
          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            style={({ pressed }) => ({
              height: 38,
              paddingHorizontal: 16,
              borderRadius: 19,
              borderCurve: "continuous",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: canSave || update.isPending ? colors.primary : colors.fill,
              opacity: pressed ? 0.85 : 1,
              ...(canSave && !isDark ? shadow.primary : {}),
            })}
          >
            {update.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <Check size={15} color={canSave ? colors.onPrimary : colors.textSubtle} strokeWidth={2.6} />
                <Text style={[typography.label.md, { color: canSave ? colors.onPrimary : colors.textSubtle }]}>
                  {t("common.save")}
                </Text>
              </>
            )}
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl * 2,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Week at a glance */}
        <View
          style={{
            padding: spacing.md,
            gap: spacing.md,
            borderRadius: radius.card,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? colors.borderStrong : colors.hairline,
            ...(isDark ? {} : shadow.card),
          }}
        >
          <View style={{ flexDirection: "row", gap: 5 }}>
            {Array.from({ length: 7 }).map((_, d) => {
              const on = activeDays.has(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDayActive(d, !on)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={days[d]}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 48,
                    borderRadius: 14,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? colors.primary : pressed ? colors.fill : colors.surfaceMuted,
                  })}
                >
                  <Text
                    numberOfLines={1}
                    style={[typography.label.sm, { color: on ? colors.onPrimary : colors.textSubtle }]}
                  >
                    {(days[d] || "").slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View
            style={{
              flexDirection: "row",
              paddingTop: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.separator,
            }}
          >
            <GlanceStat icon={CalendarDays} value={`${activeCount}/7`} label={t("doctorAvailability.statDays", "Open days")} />
            <GlanceStat icon={Clock} value={`${weeklyHours}h`} label={t("doctorAvailability.statHours", "Per week")} />
            <GlanceStat icon={Timer} value={`${minSlot}m`} label={t("doctorAvailability.statSlot", "Slot length")} />
          </View>
        </View>

        <SectionHeader
          kicker={t("doctorAvailability.kicker", "Hours")}
          title={t("doctorAvailability.weeklySchedule")}
        />

        <View
          style={{
            borderRadius: radius.card,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? colors.borderStrong : colors.hairline,
            overflow: "hidden",
            ...(isDark ? {} : shadow.card),
          }}
        >
          {Array.from({ length: 7 }).map((_, dOfWeek) => {
            const dayShifts = schedule
              .map((s, flatIdx) => ({ ...s, flatIdx }))
              .filter((s) => s.dayOfWeek === dOfWeek);
            const isDayActive = dayShifts.some((s) => s.active);
            const activeDayShifts = dayShifts.filter((s) => s.active);
            const isOpen = expanded === dOfWeek && isDayActive;
            const dayInvalid = activeDayShifts.some((s) => shiftError(s) != null);

            return (
              <View
                key={dOfWeek}
                style={{
                  borderTopWidth: dOfWeek > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: colors.separator,
                  backgroundColor: isOpen ? withOpacity(colors.primary, 0.03) : "transparent",
                }}
              >
                <Pressable
                  onPress={() => {
                    if (isDayActive) {
                      setExpanded(isOpen ? null : dOfWeek);
                    } else {
                      toggleDayActive(dOfWeek, true);
                      setExpanded(dOfWeek);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingLeft: spacing.lg,
                    paddingRight: spacing.md,
                    paddingVertical: spacing.md,
                    backgroundColor: pressed ? colors.fill : "transparent",
                  })}
                >
                  <View style={{ width: 42 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: isDayActive ? colors.text : colors.textSubtle },
                      ]}
                    >
                      {(days[dOfWeek] || "").slice(0, 3)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                    {isDayActive ? (
                      activeDayShifts.map((s) => {
                        const bad = shiftError(s) != null;
                        return (
                          <View
                            key={s.flatIdx}
                            style={{
                              height: 26,
                              paddingHorizontal: 9,
                              justifyContent: "center",
                              borderRadius: 8,
                              borderCurve: "continuous",
                              backgroundColor: bad ? colors.dangerSoft : colors.primarySoft,
                            }}
                          >
                            <Text
                              style={[
                                typography.label.sm,
                                { color: bad ? colors.danger : colors.primary, fontVariant: ["tabular-nums"] },
                              ]}
                            >
                              {s.startTime}–{s.endTime}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={[typography.body.sm, { color: colors.textSubtle }]}>
                        {t("doctorAvailability.closed", "Closed")}
                      </Text>
                    )}
                  </View>
                  {isDayActive ? (
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.well,
                        transform: [{ rotate: isOpen ? "180deg" : "0deg" }],
                      }}
                    >
                      <ChevronDown size={15} color={dayInvalid ? colors.danger : colors.textMuted} strokeWidth={2.5} />
                    </View>
                  ) : null}
                  <Switch
                    value={isDayActive}
                    onValueChange={(v) => {
                      toggleDayActive(dOfWeek, v);
                      if (!v && expanded === dOfWeek) setExpanded(null);
                    }}
                    trackColor={{ true: colors.primary, false: colors.fillStrong }}
                    ios_backgroundColor={colors.fillStrong}
                    style={{ transform: [{ scale: 0.85 }] }}
                  />
                </Pressable>

                {isOpen ? (
                  <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
                    {activeDayShifts.map((s, idx) => {
                      const err = shiftError(s);
                      return (
                        <View
                          key={s.flatIdx}
                          style={{
                            padding: spacing.md,
                            gap: spacing.md,
                            borderRadius: 16,
                            borderCurve: "continuous",
                            backgroundColor: colors.surface,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: err ? colors.danger : isDark ? colors.borderStrong : colors.hairline,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                            <Text style={[typography.caption, { color: colors.textSubtle, flex: 1 }]}>
                              {t("doctorAvailability.shiftNumber", { num: idx + 1 })}
                            </Text>
                            <Pressable
                              onPress={() => removeShift(s.flatIdx)}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={t("common.delete")}
                              style={({ pressed }) => ({
                                width: 26,
                                height: 26,
                                borderRadius: 13,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: pressed ? colors.dangerSoft : colors.well,
                              })}
                            >
                              {({ pressed }) => (
                                <X size={14} color={pressed ? colors.danger : colors.textMuted} strokeWidth={2.5} />
                              )}
                            </Pressable>
                          </View>

                          {/* Time range */}
                          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                            <TimeBox
                              label={t("doctorAvailability.start")}
                              value={s.startTime}
                              invalid={toMinutes(s.startTime) == null}
                              onChangeText={(v) => updateShift(s.flatIdx, { startTime: v })}
                            />
                            <ArrowRight size={16} color={colors.textSubtle} strokeWidth={2.2} />
                            <TimeBox
                              label={t("doctorAvailability.end")}
                              value={s.endTime}
                              invalid={err != null}
                              onChangeText={(v) => updateShift(s.flatIdx, { endTime: v })}
                            />
                          </View>
                          {err ? (
                            <Text style={[typography.caption, { color: colors.danger, marginTop: -6 }]}>
                              {err === "format"
                                ? t("doctorAvailability.errFormat", "Use 24-hour time, e.g. 09:30")
                                : t("doctorAvailability.errOrder", "End time must be after start time")}
                            </Text>
                          ) : null}

                          {/* Slot length */}
                          <View style={{ gap: 6 }}>
                            <Text style={[typography.caption, { color: colors.textSubtle }]}>
                              {t("doctorAvailability.slotMin")}
                            </Text>
                            <View style={{ flexDirection: "row", gap: 5 }}>
                              {SLOT_OPTIONS.map((m) => {
                                const on = s.slotMinutes === m;
                                return (
                                  <Pressable
                                    key={m}
                                    onPress={() => updateShift(s.flatIdx, { slotMinutes: m })}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on }}
                                    style={({ pressed }) => ({
                                      flex: 1,
                                      height: 32,
                                      borderRadius: 10,
                                      borderCurve: "continuous",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor: on ? colors.primary : pressed ? colors.primarySoft : colors.surfaceMuted,
                                    })}
                                  >
                                    <Text
                                      style={[
                                        typography.label.sm,
                                        { color: on ? colors.onPrimary : colors.textMuted, fontVariant: ["tabular-nums"] },
                                      ]}
                                    >
                                      {m}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                      <SmallAction
                        icon={Plus}
                        label={t("doctorAvailability.addShift")}
                        onPress={() => addShift(dOfWeek)}
                        primary
                      />
                      {activeCount > 1 ? (
                        <SmallAction
                          icon={Copy}
                          label={t("doctorAvailability.copyToAll", "Copy to all open days")}
                          onPress={() => copyToOpenDays(dOfWeek)}
                        />
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {hasInvalid ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: spacing.md,
              padding: spacing.md,
              borderRadius: 14,
              backgroundColor: colors.dangerSoft,
            }}
          >
            <AlertTriangle size={15} color={colors.danger} strokeWidth={2.3} />
            <Text style={[typography.caption, { color: colors.danger, flex: 1 }]}>
              {t("doctorAvailability.fixErrors", "Fix the highlighted shifts before saving.")}
            </Text>
          </View>
        ) : null}

        <SectionHeader
          kicker={t("doctorAvailability.timeOffKicker", "Away")}
          title={t("doctorAvailability.timeOff")}
        />

        <TimeOffSection
          colors={colors}
          spacing={spacing}
          typography={typography}
          radius={radius}
          toast={toast}
          t={t}
        />
      </ScrollView>
    </Screen>
  );
}

const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "HH:MM" → minutes since midnight, or null when malformed. */
function toMinutes(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((v || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function shiftError(s: { startTime: string; endTime: string }): "format" | "order" | null {
  const a = toMinutes(s.startTime);
  const b = toMinutes(s.endTime);
  if (a == null || b == null) return "format";
  if (b <= a) return "order";
  return null;
}

function GlanceStat({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  const { colors, typography, fontFamily } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Icon size={13} color={colors.primary} strokeWidth={2.4} />
        <Text
          style={{
            fontFamily: fontFamily.heavy,
            fontSize: 17,
            letterSpacing: -0.3,
            color: colors.text,
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
      </View>
      <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

function TimeBox({
  label,
  value,
  invalid,
  onChangeText,
}: {
  label: string;
  value: string;
  invalid?: boolean;
  onChangeText: (v: string) => void;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 12,
        paddingTop: 7,
        paddingBottom: 3,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: focused ? colors.surface : colors.surfaceMuted,
        borderWidth: 1,
        borderColor: invalid ? colors.danger : focused ? colors.primary : "transparent",
      }}
    >
      <Text style={[typography.caption, { fontSize: 11, color: invalid ? colors.danger : colors.textSubtle }]}>
        {label}
      </Text>
      <RNTextInput
        value={value}
        onChangeText={(v) => {
          // Auto-insert the colon: "930" → "9:30", "0930" → "09:30".
          const digits = v.replace(/[^0-9]/g, "").slice(0, 4);
          if (v.includes(":") || digits.length < 3) onChangeText(v.replace(/[^0-9:]/g, "").slice(0, 5));
          else onChangeText(`${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const mins = toMinutes(value);
          if (mins != null) {
            onChangeText(`${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
          }
        }}
        keyboardType="numbers-and-punctuation"
        placeholder="09:00"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel={label}
        maxLength={5}
        style={{
          paddingVertical: 3,
          paddingHorizontal: 0,
          fontSize: 18,
          color: colors.text,
          fontFamily: fontFamily.bodyBold,
          fontVariant: ["tabular-nums"],
        }}
      />
    </View>
  );
}

function SmallAction({
  icon: Icon,
  label,
  onPress,
  primary,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors, typography } = useTheme();
  const fg = primary ? colors.primary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 34,
        paddingHorizontal: 13,
        borderRadius: 17,
        borderCurve: "continuous",
        backgroundColor: primary
          ? pressed ? withOpacity(colors.primary, 0.2) : colors.primarySoft
          : pressed ? colors.fill : colors.well,
      })}
    >
      <Icon size={14} color={fg} strokeWidth={2.5} />
      <Text style={[typography.label.sm, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** "2026-10-04" → { day: "4", month: "Oct", weekday: "Sun" }. */
function dateParts(iso: string) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return { day: iso, month: "", weekday: "" };
  const wd = new Date(y, m - 1, d).getDay();
  return { day: String(d), month: MONTHS_SHORT[m - 1], weekday: WEEKDAYS_SHORT[wd] };
}

function TimeOffSection({
  colors,
  spacing,
  typography,
  radius,
  toast,
  t,
}: any) {
  const { data, isLoading } = useTimeOff();
  const add = useAddTimeOff();
  const del = useDeleteTimeOff();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayPlus(1));
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");

  const list: any[] = data?.timeOff || [];

  async function submit() {
    try {
      await add.mutateAsync({
        date,
        startTime: allDay ? null : startTime,
        endTime: allDay ? null : endTime,
        reason: reason || null,
      });
      toast.show(t("doctorAvailability.timeOffAdded"), "success");
      setOpen(false);
      setReason("");
    } catch (err: any) {
      toast.show(err?.message || t("doctorAvailability.saveError"), "danger");
    }
  }

  async function remove(id: string) {
    try {
      await del.mutateAsync(id);
      toast.show(t("doctorAvailability.removed"), "info");
    } catch (err: any) {
      toast.show(err?.message || t("doctorAvailability.deleteError"), "danger");
    }
  }

  return (
    <>
      <Card padded={false}>
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {isLoading ? (
            <Skeleton height={80} radius={16} />
          ) : list.length === 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarOff size={16} color={colors.textSubtle} />
              </View>
              <Text
                style={[typography.body.sm, { color: colors.textMuted, flex: 1 }]}
              >
                {t("doctorAvailability.timeOffEmpty")}
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {list.map((r: any) => {
                const dp = dateParts(r.date);
                return (
                  <View
                    key={r.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      backgroundColor: colors.surfaceMuted,
                      padding: spacing.sm,
                      paddingRight: spacing.md,
                      borderRadius: 16,
                      borderCurve: "continuous",
                    }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 50,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.warningSoft,
                      }}
                    >
                      <Text style={[typography.label.xs, { fontSize: 10, color: colors.warning, textTransform: "uppercase" }]}>
                        {dp.month}
                      </Text>
                      <Text style={[typography.title.md, { color: colors.text, lineHeight: 22 }]}>
                        {dp.day}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text }]}>
                        {r.startTime && r.endTime
                          ? t("doctorAvailability.timeOffFormat", {
                              start: r.startTime,
                              end: r.endTime,
                            })
                          : t("doctorAvailability.allDay")}
                      </Text>
                      <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
                        {[dp.weekday, r.reason].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={() => remove(r.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t("common.delete")}
                      style={({ pressed }) => ({
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: pressed ? colors.dangerSoft : colors.well,
                      })}
                    >
                      {({ pressed }) => (
                        <X size={14} color={pressed ? colors.danger : colors.textMuted} strokeWidth={2.5} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
          <Button
            title={t("doctorAvailability.addTimeOff")}
            icon={Plus}
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => setOpen(true)}
          />
        </View>
      </Card>

      <BottomSheet
        visible={open}
        onDismiss={() => setOpen(false)}
        title={t("doctorAvailability.blockTimeOff")}
      >
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <FormField label={t("doctorAvailability.date")}>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder={t("doctorAvailability.datePlaceholder")}
              keyboardType="numbers-and-punctuation"
            />
          </FormField>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Switch
              value={allDay}
              onValueChange={setAllDay}
              trackColor={{ true: colors.primary, false: colors.fillStrong }}
            />
            <Text style={[typography.body.md, { color: colors.text }]}>
              {t("doctorAvailability.allDay")}
            </Text>
          </View>
          {!allDay ? (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <FormField label={t("doctorAvailability.start")}>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder={t("doctorAvailability.timePlaceholder")}
                  />
                </FormField>
              </View>
              <View style={{ flex: 1 }}>
                <FormField label={t("doctorAvailability.end")}>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder={t("doctorAvailability.timePlaceholder")}
                  />
                </FormField>
              </View>
            </View>
          ) : null}
          <FormField label={t("doctorAvailability.reason")}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t("doctorAvailability.reasonPlaceholder")}
              multiline
            />
          </FormField>
          <Button
            title={t("doctorAvailability.save")}
            icon={Save}
            onPress={submit}
            loading={add.isPending}
          />
        </View>
      </BottomSheet>
    </>
  );
}
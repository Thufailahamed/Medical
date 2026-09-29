// @ts-nocheck

import { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Save,
  Plus,
  Trash2,
  CalendarOff,
  Ban,
} from "lucide-react-native";
import {
  useDoctorAvailabilityMe,
  useUpdateDoctorAvailability,
  useTimeOff,
  useAddTimeOff,
  useDeleteTimeOff,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
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

  useEffect(() => {
    if (seededRef.current) return;
    if (data?.availability && data.availability.length > 0) {
      seededRef.current = true;
      setSchedule(
        data.availability.map((r: any) => ({
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          slotMinutes: r.slotMinutes,
          active: !!r.active,
        }))
      );
    }
  }, [data]);

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

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorAvailability.title")}
        subtitle={t("doctorAvailability.subtitle", {
          count: activeCount,
          min: minSlot,
        })}
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
            flexDirection: "row",
            gap: 6,
            padding: 6,
            borderRadius: radius.card,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? colors.borderStrong : colors.hairline,
            ...(isDark ? {} : shadow.card),
          }}
        >
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
                  height: 52,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  backgroundColor: on ? colors.primary : pressed ? colors.fill : "transparent",
                })}
              >
                <Text
                  style={[
                    typography.label.md,
                    { color: on ? colors.onPrimary : colors.textMuted },
                  ]}
                >
                  {(days[d] || "").slice(0, 3)}
                </Text>
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: on ? "rgba(255,255,255,0.85)" : "transparent",
                  }}
                />
              </Pressable>
            );
          })}
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
            ...(isDark ? {} : shadow.card),
          }}
        >
          {Array.from({ length: 7 }).map((_, dOfWeek) => {
            const dayShifts = schedule
              .map((s, flatIdx) => ({ ...s, flatIdx }))
              .filter((s) => s.dayOfWeek === dOfWeek);
            const isDayActive = dayShifts.some((s) => s.active);
            const activeDayShifts = dayShifts.filter((s) => s.active);
            const summary = activeDayShifts
              .map((s) => `${s.startTime}–${s.endTime}`)
              .join(", ");

            return (
              <View
                key={dOfWeek}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  gap: spacing.md,
                  borderTopWidth: dOfWeek > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: colors.separator,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: isDayActive ? colors.primarySoft : colors.fill,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={[
                        typography.label.md,
                        { color: isDayActive ? colors.primary : colors.textSubtle },
                      ]}
                    >
                      {(days[dOfWeek] || "").slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: isDayActive ? colors.text : colors.textMuted },
                      ]}
                    >
                      {days[dOfWeek]}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        typography.caption,
                        {
                          color: isDayActive ? colors.textMuted : colors.textSubtle,
                          marginTop: 1,
                          fontVariant: ["tabular-nums"],
                        },
                      ]}
                    >
                      {isDayActive ? summary : t("doctorAvailability.closed", "Closed")}
                    </Text>
                  </View>
                  <Switch
                    value={isDayActive}
                    onValueChange={(v) => toggleDayActive(dOfWeek, v)}
                    trackColor={{ true: colors.primary, false: colors.fillStrong }}
                    ios_backgroundColor={colors.fillStrong}
                  />
                </View>

                {isDayActive ? (
                  <View style={{ gap: spacing.sm, paddingLeft: 38 + spacing.md }}>
                    {activeDayShifts.map((s, idx) => (
                      <View
                        key={s.flatIdx}
                        style={{
                          padding: spacing.md,
                          gap: spacing.sm,
                          borderRadius: 16,
                          borderCurve: "continuous",
                          backgroundColor: colors.surfaceMuted,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text
                            style={[
                              typography.kicker,
                              { color: colors.textSubtle, textTransform: "uppercase" },
                            ]}
                          >
                            {t("doctorAvailability.shiftNumber", { num: idx + 1 })}
                          </Text>
                          <Pressable
                            onPress={() => removeShift(s.flatIdx)}
                            hitSlop={8}
                            accessibilityRole="button"
                            style={({ pressed }) => ({
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: pressed ? colors.dangerSoft : "transparent",
                            })}
                          >
                            <Trash2 size={14} color={colors.danger} strokeWidth={2.2} />
                          </Pressable>
                        </View>
                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                          <View style={{ flex: 1 }}>
                            <FormField label={t("doctorAvailability.start")}>
                              <TextInput
                                value={s.startTime}
                                onChangeText={(v) => updateShift(s.flatIdx, { startTime: v })}
                                placeholder={t("doctorAvailability.timePlaceholder")}
                                keyboardType="numbers-and-punctuation"
                              />
                            </FormField>
                          </View>
                          <View style={{ flex: 1 }}>
                            <FormField label={t("doctorAvailability.end")}>
                              <TextInput
                                value={s.endTime}
                                onChangeText={(v) => updateShift(s.flatIdx, { endTime: v })}
                                placeholder={t("doctorAvailability.timePlaceholder")}
                                keyboardType="numbers-and-punctuation"
                              />
                            </FormField>
                          </View>
                          <View style={{ flex: 0.8 }}>
                            <FormField label={t("doctorAvailability.slotMin")}>
                              <TextInput
                                value={String(s.slotMinutes)}
                                onChangeText={(v) =>
                                  updateShift(s.flatIdx, {
                                    slotMinutes: parseInt(v, 10) || 30,
                                  })
                                }
                                placeholder="30"
                                keyboardType="number-pad"
                              />
                            </FormField>
                          </View>
                        </View>
                      </View>
                    ))}

                    <Pressable
                      onPress={() => addShift(dOfWeek)}
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        alignSelf: "flex-start",
                        gap: 6,
                        height: 32,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        backgroundColor: pressed ? colors.primary : colors.primarySoft,
                      })}
                    >
                      {({ pressed }) => (
                        <>
                          <Plus size={14} color={pressed ? colors.onPrimary : colors.primary} strokeWidth={2.5} />
                          <Text
                            style={[
                              typography.label.sm,
                              { color: pressed ? colors.onPrimary : colors.primary },
                            ]}
                          >
                            {t("doctorAvailability.addShift")}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Button
          title={t("doctorAvailability.saveSchedule")}
          onPress={save}
          loading={update.isPending}
          icon={Save}
          size="lg"
          style={{ marginTop: spacing.lg }}
        />

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
              {list.map((r: any) => (
                <View
                  key={r.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    backgroundColor: colors.surfaceMuted,
                    paddingVertical: spacing.sm + 2,
                    paddingHorizontal: spacing.md,
                    borderRadius: 16,
                    borderCurve: "continuous",
                  }}
                >
                  <PillCmp icon={Ban} label={r.date} tone="warning" size="sm" />
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, flex: 1 },
                    ]}
                  >
                    {r.startTime && r.endTime
                      ? t("doctorAvailability.timeOffFormat", {
                          start: r.startTime,
                          end: r.endTime,
                        })
                      : t("doctorAvailability.allDay")}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => remove(r.id)}>
                    <Trash2 size={16} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
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
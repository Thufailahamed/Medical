import { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Save,
  Clock4,
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
  EmptyState,
  FormField,
  TextInput,
  SectionHeader,
  BottomSheet,
  useToast,
} from "@/components/ui";

type DaySchedule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  active: boolean;
};

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_SCHEDULE: DaySchedule[] = DAY_LABELS.map((_, i) => ({
  dayOfWeek: i,
  startTime: "09:00",
  endTime: "17:00",
  slotMinutes: 30,
  active: i >= 1 && i <= 5, // Mon-Fri by default
}));

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AvailabilityScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();

  const { data, isLoading } = useDoctorAvailabilityMe();
  const update = useUpdateDoctorAvailability();

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

  function patchDay(idx: number, p: Partial<DaySchedule>) {
    setSchedule((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...p } : d))
    );
  }

  async function save() {
    try {
      await update.mutateAsync({ schedule });
      toast.show("Availability updated", "success");
    } catch (err: any) {
      toast.show(err?.message || "Could not save", "danger");
    }
  }

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => router.back()}
          title="Availability"
        />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={120} radius={20} />
          ))}
        </View>
      </Screen>
    );
  }

  const activeCount = schedule.filter((d) => d.active).length;
  const minSlot = Math.min(...schedule.map((d) => d.slotMinutes || 30));

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScreenHeader
          back
          onBack={() => router.back()}
          title="Availability"
          subtitle={`${activeCount} day${activeCount === 1 ? "" : "s"} active · ${minSlot}-min slots`}
        />

        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: spacing.xl * 2,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <SectionHeader title="Weekly schedule" />

          {schedule.map((d, idx) => (
            <Card key={d.dayOfWeek} padded={false}>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Clock4
                    size={18}
                    color={d.active ? colors.primary : colors.textSubtle}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, flex: 1 },
                    ]}
                  >
                    {DAY_LABELS[d.dayOfWeek]}
                  </Text>
                  <Switch
                    value={d.active}
                    onValueChange={(v) => patchDay(idx, { active: v })}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>

                {d.active ? (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <FormField label="Start">
                        <TextInput
                          value={d.startTime}
                          onChangeText={(t) => patchDay(idx, { startTime: t })}
                          placeholder="HH:MM"
                          keyboardType="numbers-and-punctuation"
                        />
                      </FormField>
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormField label="End">
                        <TextInput
                          value={d.endTime}
                          onChangeText={(t) => patchDay(idx, { endTime: t })}
                          placeholder="HH:MM"
                          keyboardType="numbers-and-punctuation"
                        />
                      </FormField>
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormField label="Slot min">
                        <TextInput
                          value={String(d.slotMinutes)}
                          onChangeText={(t) =>
                            patchDay(idx, {
                              slotMinutes: parseInt(t, 10) || 30,
                            })
                          }
                          placeholder="30"
                          keyboardType="number-pad"
                        />
                      </FormField>
                    </View>
                  </View>
                ) : null}
              </View>
            </Card>
          ))}

          <Button
            title="Save weekly schedule"
            onPress={save}
            loading={update.isPending}
            icon={Save}
            size="lg"
          />

          <SectionHeader title="Time off" />

          <TimeOffSection colors={colors} spacing={spacing} typography={typography} radius={radius} toast={toast} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TimeOffSection({
  colors,
  spacing,
  typography,
  radius,
  toast,
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
      toast.show("Time off added", "success");
      setOpen(false);
      setReason("");
    } catch (err: any) {
      toast.show(err?.message || "Could not save", "danger");
    }
  }

  async function remove(id: string) {
    try {
      await del.mutateAsync(id);
      toast.show("Removed", "info");
    } catch (err: any) {
      toast.show(err?.message || "Could not delete", "danger");
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
              <CalendarOff size={18} color={colors.textSubtle} />
              <Text
                style={[typography.body.sm, { color: colors.textMuted, flex: 1 }]}
              >
                No time off blocks. Use this for vacation, conference, sick days.
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
                    padding: spacing.sm,
                    borderRadius: radius.md,
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
                      ? `${r.startTime} – ${r.endTime}`
                      : "All day"}
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
            title="Add time off"
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
        title="Block time off"
      >
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <FormField label="Date">
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
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
              trackColor={{ true: colors.primary, false: colors.border }}
            />
            <Text style={[typography.body.md, { color: colors.text }]}>
              All day
            </Text>
          </View>
          {!allDay ? (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <FormField label="Start">
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="HH:MM"
                  />
                </FormField>
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="End">
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="HH:MM"
                  />
                </FormField>
              </View>
            </View>
          ) : null}
          <FormField label="Reason (optional)">
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Conference, vacation"
              multiline
            />
          </FormField>
          <Button
            title="Save"
            icon={Save}
            onPress={submit}
            loading={add.isPending}
          />
        </View>
      </BottomSheet>
    </>
  );
}
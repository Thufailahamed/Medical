import { useState, useEffect, useMemo } from "react";
import { View, Text, Switch } from "react-native";
import { useRouter } from "expo-router";
import { Save, Clock4 } from "lucide-react-native";
import {
  useDoctorAvailabilityMe,
  useUpdateDoctorAvailability,
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

export default function AvailabilityScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const { data, isLoading } = useDoctorAvailabilityMe();
  const update = useUpdateDoctorAvailability();

  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);

  useEffect(() => {
    if (data?.availability && data.availability.length > 0) {
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

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Availability"
        subtitle={`${activeCount} day${activeCount === 1 ? "" : "s"} active`}
      />

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
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
                          patchDay(idx, { slotMinutes: parseInt(t, 10) || 30 })
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
          title="Save availability"
          onPress={save}
          loading={update.isPending}
          icon={Save}
          size="lg"
        />
      </View>
    </Screen>
  );
}
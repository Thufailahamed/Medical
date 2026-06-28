import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Plus, CalendarPlus, Clock, Users } from "lucide-react-native";
import { useMyAppointments } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  IconButton,
  Card,
  Pill,
  PillTone,
  EmptyState,
  Skeleton,
  Timeline,
} from "@/components/ui";

const STATUS_TONE: Record<string, PillTone> = {
  confirmed: "success",
  pending: "warning",
  scheduled: "primary",
  completed: "info",
  cancelled: "danger",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

function dateParts(date: string) {
  const m = date?.match?.(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { day: m[3], month: monthName(+m[2]) };
  const m2 = date?.match?.(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return { day: m2[1], month: monthName(+m2[2]) };
  return { day: "--", month: "—" };
}

function monthName(m: number) {
  const names = [
    "JAN","FEB","MAR","APR","MAY","JUN",
    "JUL","AUG","SEP","OCT","NOV","DEC",
  ];
  return names[(m - 1) % 12] || "—";
}

function groupKey(a: any) {
  const d = new Date(a.appointments?.date);
  if (isNaN(d.getTime())) return "later";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "today";
  if (d < now) return "past";
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 7) return "week";
  return "later";
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const { data, isLoading } = useMyAppointments();
  const [filter, setFilter] = useState("all");

  const all = data?.appointments || [];
  const now = new Date();
  const filtered = all.filter((a: any) => {
    if (filter === "all") return true;
    const d = new Date(a.appointments.date);
    if (filter === "upcoming") return d >= new Date(now.toDateString());
    return d < new Date(now.toDateString());
  });

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader
        title="Appointments"
        subtitle={`${all.length} total · ${all.length > 0 ? Math.round((all.filter((a: any) => new Date(a.appointments.date) >= new Date(now.toDateString())).length / all.length) * 100) : 0}% upcoming`}
        right={
          <IconButton
            icon={Plus}
            variant="solid"
            onPress={() => router.push("/(app)/book-appointment")}
            accessibilityLabel="Book appointment"
          />
        }
      />

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: "row",
          gap: spacing.sm,
        }}
      >
        {FILTERS.map((f) => (
          <FilterPill
            key={f.value}
            label={f.label}
            active={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={92} radius={20} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title={filter === "past" ? "No past appointments" : "No appointments yet"}
          message={
            filter === "past"
              ? "Past appointments will appear here"
              : "Schedule your next visit with a doctor"
          }
          actionLabel={filter !== "past" ? "Book appointment" : undefined}
          onAction={
            filter !== "past"
              ? () => router.push("/(app)/book-appointment")
              : undefined
          }
        />
      ) : (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Timeline
            data={filtered}
            groupBy={groupKey}
            keyExtractor={(a: any) => a.appointments.id}
            flush
            renderItem={(item: any) => {
              const appt = item.appointments;
              const tone = STATUS_TONE[appt.status] ?? "neutral";
              const { day, month } = dateParts(appt.date);
              return (
                <Card padded={false}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      padding: spacing.lg,
                    }}
                  >
                    <View
                      style={{
                        width: 60,
                        height: 68,
                        borderRadius: radius.lg,
                        backgroundColor: colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={[
                          typography.title.md,
                          { color: colors.primary, fontSize: 22, lineHeight: 24 },
                        ]}
                      >
                        {day}
                      </Text>
                      <Text
                        style={[
                          typography.overline,
                          { color: colors.primary, marginTop: 2 },
                        ]}
                      >
                        {month}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text
                        style={[typography.title.sm, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {appt.doctorName || appt.specialty || "Doctor visit"}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.sm,
                          flexWrap: "wrap",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Clock size={13} color={colors.textMuted} strokeWidth={2.25} />
                          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                            {appt.time}
                          </Text>
                        </View>
                        <Pill label={appt.status} tone={tone} size="sm" />
                      </View>
                      {appt.queueNumber ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: spacing.xs,
                          }}
                        >
                          <Users size={12} color={colors.textSubtle} strokeWidth={2.25} />
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSubtle },
                            ]}
                          >
                            Queue #{appt.queueNumber}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              );
            }}
          />
        </View>
      )}
    </Screen>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onTouchEnd={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text
        style={[
          typography.label.md,
          {
            color: active ? colors.onPrimary : colors.text,
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

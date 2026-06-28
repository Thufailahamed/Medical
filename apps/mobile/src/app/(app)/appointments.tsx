import { useMemo, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Plus, CalendarPlus, Clock, X, Loader } from "lucide-react-native";
import { useMyAppointments, useCancelAppointment } from "@/hooks/useApi";
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
  useToast,
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

function dateParts(date?: string | null) {
  if (!date) return { day: "--", month: "—" };
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { day: m[3], month: monthName(+m[2]) };
  const m2 = date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return { day: m2[1], month: monthName(+m2[2]) };
  return { day: "--", month: "—" };
}

function monthName(m: number) {
  const names = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  return names[(m - 1) % 12] || "—";
}

function groupKey(a: any) {
  if (!a?.date) return "later";
  const d = new Date(a.date);
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
  const toast = useToast();
  const { spacing, colors, typography, radius } = useTheme();
  const { data, isLoading } = useMyAppointments();
  const cancelAppointment = useCancelAppointment();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");

  function confirmCancel(item: any) {
    Alert.alert(
      "Cancel appointment?",
      `Your visit on ${item.date} at ${item.time || "—"} will be cancelled.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel appointment",
          style: "destructive",
          onPress: async () => {
            try {
              setCancellingId(item.id);
              await cancelAppointment.mutateAsync(item.id);
              toast.show("Appointment cancelled", "info");
            } catch (err: any) {
              toast.show(err?.message || "Could not cancel", "danger");
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  }

  // API returns FLAT appointment objects
  const all: any[] = data?.appointments || [];

  const now = new Date();
  const todayStart = new Date(now.toDateString());

  const filtered = useMemo(() => {
    return all.filter((a) => {
      if (filter === "all") return true;
      const d = a.date ? new Date(a.date) : null;
      if (!d || isNaN(d.getTime())) return filter === "upcoming";
      if (filter === "upcoming") return d >= todayStart;
      return d < todayStart;
    });
  }, [all, filter]);

  const upcomingCount = all.filter((a) => {
    if (!a.date) return false;
    const d = new Date(a.date);
    return !isNaN(d.getTime()) && d >= todayStart;
  }).length;
  const upcomingPct = all.length
    ? Math.round((upcomingCount / all.length) * 100)
    : 0;

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader
        title="Appointments"
        subtitle={`${all.length} total · ${upcomingPct}% upcoming`}
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
            onPress={() => setFilter(f.value as any)}
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
            keyExtractor={(a: any) => a.id}
            flush
            renderItem={(item: any) => {
              const tone = STATUS_TONE[item.status] ?? "neutral";
              const { day, month } = dateParts(item.date);
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
                    <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                      <Text
                        style={[typography.title.sm, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {item.reason || item.specialty || "Doctor visit"}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.sm,
                          flexWrap: "wrap",
                        }}
                      >
                        {item.time ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Clock
                              size={13}
                              color={colors.textMuted}
                              strokeWidth={2.25}
                            />
                            <Text
                              style={[
                                typography.body.sm,
                                { color: colors.textMuted },
                              ]}
                            >
                              {item.time}
                            </Text>
                          </View>
                        ) : null}
                        {item.status ? (
                          <Pill
                            label={item.status}
                            tone={tone}
                            size="sm"
                          />
                        ) : null}
                      </View>
                    </View>
                    {(item.status === "scheduled" ||
                      item.status === "confirmed" ||
                      item.status === "pending") ? (
                      <Pressable
                        onPress={() => confirmCancel(item)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel appointment"
                        hitSlop={6}
                        disabled={cancellingId === item.id}
                        style={({ pressed }) => ({
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: pressed
                            ? colors.danger
                            : colors.dangerSoft,
                          opacity: cancellingId === item.id ? 0.6 : 1,
                          marginRight: spacing.sm,
                        })}
                      >
                        {cancellingId === item.id ? (
                          <Loader
                            size={16}
                            color={colors.danger}
                            strokeWidth={2.25}
                          />
                        ) : (
                          <X
                            size={16}
                            color={colors.danger}
                            strokeWidth={2.5}
                          />
                        )}
                      </Pressable>
                    ) : null}
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
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
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
    </Pressable>
  );
}
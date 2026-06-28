import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell,
  Pill,
  ClipboardList,
  CalendarPlus,
  Siren,
  Plus,
  ChevronRight,
  Stethoscope,
  Camera,
  Edit3,
  Droplet,
  Ruler,
  Sun,
  Moon,
  Sunset,
  Coffee,
  Activity,
  HeartPulse,
  Scale,
  Wind,
  Check,
  StickyNote,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import {
  usePatientProfile,
  useTodayMedicines,
  useMyAppointments,
  useUnreadCount,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Screen,
  IconButton,
  Card,
  ListItem,
  EmptyState,
  Skeleton,
  Hero,
  NextActionCard,
  Timeline,
  FloatingActionButton,
  DoseRing,
  Pill as PillBadge,
  BottomSheet,
  useToast,
} from "@/components/ui";

type TimingKey = "morning" | "afternoon" | "evening" | "night";

const TIMING_META: Record<
  TimingKey,
  { label: string; icon: any; tone: Tone }
> = {
  morning: { label: "Morning", icon: Coffee, tone: "warning" },
  afternoon: { label: "Afternoon", icon: Sun, tone: "primary" },
  evening: { label: "Evening", icon: Sunset, tone: "accent" },
  night: { label: "Night", icon: Moon, tone: "info" },
};

function timingOf(s?: string): TimingKey {
  const v = (s || "").toLowerCase();
  if (v.includes("morning") || v.includes("before breakfast")) return "morning";
  if (v.includes("afternoon") || v.includes("lunch")) return "afternoon";
  if (v.includes("evening") || v.includes("dinner")) return "evening";
  if (v.includes("night") || v.includes("bed")) return "night";
  return "morning";
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { spacing, typography, colors, radius } = useTheme();
  const toast = useToast();

  const { data: profileData } = usePatientProfile();
  const { data: medsData, isLoading: medsLoading } = useTodayMedicines();
  const { data: apptsData, isLoading: apptsLoading } = useMyAppointments();
  const { data: unread } = useUnreadCount();

  const [fabOpen, setFabOpen] = useState(false);

  const patient = profileData?.patient?.patients;
  const todayMeds = medsData?.medicines || [];
  const appointments = apptsData?.appointments || [];

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const firstName = user?.name?.split(" ")[0] || "there";

  const bmi =
    patient?.height && patient?.weight
      ? (patient.weight / Math.pow(patient.height / 100, 2)).toFixed(1)
      : null;

  const takenCount = (todayMeds as any[]).filter(
    (m) => m.medicines?.takenToday
  ).length;
  const totalMeds = todayMeds.length;
  const adherence = totalMeds > 0 ? Math.round((takenCount / totalMeds) * 100) : 0;

  // Next med not yet taken
  const nextMed = todayMeds.find((m: any) => !m.medicines?.takenToday) || todayMeds[0];
  const nextAppt = appointments[0];

  // Group today's meds by timing
  const grouped: Record<TimingKey, any[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  todayMeds.forEach((m: any) => {
    grouped[timingOf(m.medicines?.timing)].push(m);
  });

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl + spacing.xxl }}
      >
        <Hero
          eyebrow={`${greeting.toUpperCase()} · ${formatToday()}`}
          title={firstName}
          subtitle={
            adherence === 100
              ? "All done — well done today."
              : adherence > 0
              ? `${totalMeds - takenCount} of ${totalMeds} medicines left today.`
              : "Let's set up your daily routine."
          }
          numeral={totalMeds > 0 ? `${adherence}%` : undefined}
          numeralLabel={
            totalMeds > 0 ? "Today's adherence" : "No medicines yet"
          }
          numeralTrend={
            adherence >= 80 ? "up" : adherence >= 50 ? "flat" : "down"
          }
          right={
            <IconButton
              icon={Bell}
              onPress={() => router.push("/(app)/notifications")}
              accessibilityLabel="Notifications"
              badge={unread?.count}
              variant="soft"
            />
          }
          status={[
            {
              icon: Droplet,
              label: `Blood ${patient?.bloodGroup ?? "—"}`,
              tone: "danger",
            },
            {
              icon: Ruler,
              label: `BMI ${bmi ?? "—"}`,
              tone: "info",
            },
            {
              icon: Activity,
              label: `${unread?.count ?? 0} alerts`,
              tone: "warning",
            },
          ]}
        />

        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: -spacing.lg,
            gap: spacing.xl,
          }}
        >
          {/* Quick actions — 2x2 grid for breathing room */}
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.label.lg, { color: colors.textMuted }]}>
              QUICK ACTIONS
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <QuickTile
                icon={Pill}
                label="Medicines"
                tone="primary"
                onPress={() => router.push("/(app)/medicines")}
              />
              <QuickTile
                icon={ClipboardList}
                label="Records"
                tone="accent"
                onPress={() => router.push("/(app)/records")}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <QuickTile
                icon={CalendarPlus}
                label="Book visit"
                tone="accent2"
                onPress={() => router.push("/(app)/book-appointment")}
              />
              <QuickTile
                icon={Siren}
                label="Emergency"
                tone="danger"
                onPress={() => router.push("/(app)/emergency")}
              />
            </View>
          </View>

          {/* Today schedule — horizontal dose rings by timing */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel
              title="Today"
              action={
                todayMeds.length > 0
                  ? {
                      label: "View all",
                      onPress: () => router.push("/(app)/medicines"),
                    }
                  : undefined
              }
            />

            {medsLoading ? (
              <Card>
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <Skeleton width={72} height={72} radius={999} />
                  <Skeleton width={72} height={72} radius={999} />
                  <Skeleton width={72} height={72} radius={999} />
                </View>
              </Card>
            ) : totalMeds === 0 ? (
              <Card padded={false}>
                <View
                  style={{
                    padding: spacing.lg,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Pill size={24} color={colors.primary} strokeWidth={2.25} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.title.sm, { color: colors.text }]}>
                      No medicines yet
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted },
                      ]}
                      numberOfLines={2}
                    >
                      Add your first medicine to get daily reminders.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push("/(app)/add-medicine")}
                    accessibilityRole="button"
                    accessibilityLabel="Add medicine"
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: 999,
                      backgroundColor: colors.primary,
                    }}
                  >
                    <Text
                      style={[
                        typography.label.md,
                        { color: colors.onPrimary, fontWeight: "800" },
                      ]}
                    >
                      Add
                    </Text>
                  </Pressable>
                </View>
              </Card>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}
              >
                {(Object.keys(grouped) as TimingKey[])
                  .filter((k) => grouped[k].length > 0)
                  .map((k) => (
                    <TimingCard
                      key={k}
                      meta={TIMING_META[k]}
                      items={grouped[k]}
                    />
                  ))}
              </ScrollView>
            )}
          </View>

          {/* Next-up featured card */}
          {nextMed ? (
            <NextActionCard
              subject={nextMed.medicines?.name || "Medicine"}
              verb={`${nextMed.medicines?.dosage ?? ""} · ${
                nextMed.medicines?.timing ?? "Scheduled"
              }`}
              context={
                nextMed.medicines?.takenToday
                  ? "Taken today"
                  : nextMed.medicines?.notes ?? "Tap to log"
              }
              icon={Pill}
              iconTone="primary"
              trailing={
                nextMed.medicines?.takenToday ? (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.successSoft,
                    }}
                  >
                    <Check size={22} color={colors.success} strokeWidth={2.75} />
                  </View>
                ) : (
                  <DoseRing
                    value={Math.min(1, adherence / 100)}
                    size={52}
                    tone="primary"
                    label={`${adherence}%`}
                  />
                )
              }
              onPress={() => router.push("/(app)/medicines")}
            />
          ) : null}

          {/* Next visit — featured if upcoming */}
          {nextAppt ? (
            <Pressable
              onPress={() => router.push("/(app)/appointments")}
              accessibilityRole="button"
              accessibilityLabel="View upcoming appointment"
            >
              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.glass,
                  backgroundColor: colors.accent2Soft,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.surface,
                  }}
                >
                  <Stethoscope
                    size={26}
                    color={colors.accent2}
                    strokeWidth={2.25}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PillBadge
                    label="Next visit"
                    tone="accent2"
                    size="sm"
                  />
                  <Text
                    style={[
                      typography.title.md,
                      { color: colors.text, marginTop: 4 },
                    ]}
                    numberOfLines={1}
                  >
                    {nextAppt.appointments?.doctorName ?? "Doctor visit"}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {formatDate(nextAppt.appointments?.date)} ·{" "}
                    {nextAppt.appointments?.time ?? "—"}
                  </Text>
                </View>
                <ChevronRight
                  size={20}
                  color={colors.textMuted}
                  strokeWidth={2.25}
                />
              </View>
            </Pressable>
          ) : null}

          {/* Wellness snapshot — placeholder metric tiles */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title="Wellness" />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <MetricTile
                icon={HeartPulse}
                label="Heart rate"
                value="—"
                unit="bpm"
                tone="danger"
              />
              <MetricTile
                icon={Scale}
                label="Weight"
                value={patient?.weight ? String(patient.weight) : "—"}
                unit="kg"
                tone="primary"
              />
              <MetricTile
                icon={Wind}
                label="Steps"
                value="—"
                unit=""
                tone="accent"
              />
            </View>
          </View>

          {/* Upcoming appointments — compact Timeline */}
          {appointments.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <SectionLabel
                title="Coming up"
                action={{
                  label: "All visits",
                  onPress: () => router.push("/(app)/appointments"),
                }}
              />
              {apptsLoading ? (
                <Card>
                  <View style={{ gap: spacing.sm }}>
                    <Skeleton width="70%" height={16} />
                    <Skeleton width="55%" height={16} />
                  </View>
                </Card>
              ) : (
                <Timeline
                  data={appointments.slice(0, 4)}
                  groupBy={(a: any) => {
                    const dateStr = a.appointments?.date;
                    if (!dateStr) return "later";
                    const d = new Date(dateStr);
                    const today = new Date();
                    const sameDay =
                      d.getFullYear() === today.getFullYear() &&
                      d.getMonth() === today.getMonth() &&
                      d.getDate() === today.getDate();
                    if (sameDay) return "today";
                    const diff =
                      (d.getTime() - today.getTime()) /
                      (1000 * 60 * 60 * 24);
                    if (diff <= 7) return "week";
                    return "later";
                  }}
                  groupMeta={{
                    today: { label: "Today", tone: "accent2" },
                    week: { label: "This week", tone: "primary" },
                    later: { label: "Later", tone: "neutral" },
                  }}
                  keyExtractor={(a: any, i: number) =>
                    a.appointments?.id ?? `a-${i}`
                  }
                  flush
                  renderItem={(a: any) => (
                    <AppointmentRow item={a} />
                  )}
                />
              )}
            </View>
          ) : null}

          <View style={{ height: spacing.lg }} />
        </View>
      </ScrollView>

      <FloatingActionButton
        icon={Plus}
        tone="primary"
        onPress={() => setFabOpen(true)}
        aboveTabBar
        accessibilityLabel="Quick add"
      />

      <BottomSheet
        visible={fabOpen}
        onDismiss={() => setFabOpen(false)}
        title="Quick add"
      >
        <View style={{ gap: spacing.xs }}>
          <FabAction
            icon={Check}
            label="Log a dose"
            description="Mark a medicine as taken"
            tone="primary"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/medicines");
            }}
          />
          <FabAction
            icon={Pill}
            label="Add medicine"
            description="Add to your daily routine"
            tone="accent"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/add-medicine");
            }}
          />
          <FabAction
            icon={StickyNote}
            label="Quick note"
            description="Save a symptom or thought"
            tone="warning"
            onPress={() => {
              setFabOpen(false);
              toast.show("Notes coming soon", "info");
            }}
          />
          <FabAction
            icon={CalendarPlus}
            label="Book visit"
            description="Schedule a doctor appointment"
            tone="accent2"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/book-appointment");
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function SectionLabel({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.xs,
      }}
    >
      <Text style={[typography.title.md, { color: colors.text }]}>{title}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={action.label}
        >
          <Text style={[typography.label.md, { color: colors.primary }]}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickTile({
  icon: Icon,
  label,
  tone,
  onPress,
}: {
  icon: React.ComponentType<any>;
  label: string;
  tone: Tone;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = useTone(tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }: any) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
        }}
      >
        <Icon size={20} color={palette.fg} strokeWidth={2.25} />
      </View>
      <Text
        style={[typography.title.sm, { color: colors.text, flex: 1 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <ChevronRight
        size={16}
        color={colors.textSubtle}
        strokeWidth={2.25}
      />
    </Pressable>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  unit: string;
  tone: Tone;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = useTone(tone);
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.xs,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
        }}
      >
        <Icon size={14} color={palette.fg} strokeWidth={2.5} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
        <Text
          style={[
            typography.title.md,
            {
              color: colors.text,
              fontFamily: typography.display.md.fontFamily,
            },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {unit}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          typography.caption,
          { color: colors.textMuted },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function FabAction({
  icon: Icon,
  label,
  description,
  tone,
  onPress,
}: {
  icon: any;
  label: string;
  description: string;
  tone: Tone;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = useTone(tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }: any) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
        }}
      >
        <Icon size={20} color={palette.fg} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.title.sm, { color: colors.text }]}>
          {label}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>
      <ChevronRight
        size={16}
        color={colors.textSubtle}
        strokeWidth={2.25}
      />
    </Pressable>
  );
}

function TimingCard({
  meta,
  items,
}: {
  meta: (typeof TIMING_META)[TimingKey];
  items: any[];
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = useTone(meta.tone);
  const Icon = meta.icon;
  const taken = items.filter((i: any) => i.medicines?.takenToday).length;
  const progress = items.length > 0 ? taken / items.length : 0;
  return (
    <View
      style={{
        width: 168,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.bg,
          }}
        >
          <Icon size={14} color={palette.fg} strokeWidth={2.5} />
        </View>
        <Text style={[typography.label.md, { color: colors.text }]}>
          {meta.label}
        </Text>
      </View>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <DoseRing
          value={progress}
          size={56}
          tone={meta.tone}
          label={`${taken}/${items.length}`}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          {items.slice(0, 2).map((it: any, idx: number) => (
            <Text
              key={idx}
              style={[
                typography.body.sm,
                { color: colors.text, fontWeight: "600" },
              ]}
              numberOfLines={1}
            >
              {it.medicines?.name ?? "—"}
            </Text>
          ))}
          {items.length > 2 ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              +{items.length - 2} more
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function AppointmentRow({ item }: { item: any }) {
  const router = useRouter();
  const a = item.appointments;
  const status = (a?.status || "scheduled").toLowerCase();
  const tone: Tone =
    status === "confirmed"
      ? "success"
      : status === "cancelled"
      ? "danger"
      : status === "completed"
      ? "info"
      : "warning";
  const dateLabel = a?.date ? formatDate(a.date) : "—";
  return (
    <ListItem
      icon={Stethoscope}
      iconTone="accent2"
      variant="timeline"
      title={a?.doctorName ?? "Doctor visit"}
      subtitle={`${dateLabel} · ${a?.time ?? ""}`}
      pill={a?.status ? { label: a.status, tone } : undefined}
      onPress={() => router.push("/(app)/appointments")}
    />
  );
}

function formatDate(input?: string) {
  if (!input) return "—";
  try {
    const d = new Date(input);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return input;
  }
}

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

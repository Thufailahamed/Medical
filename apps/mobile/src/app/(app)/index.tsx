import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Bell,
  Pill,
  ClipboardList,
  CalendarPlus,
  Plus,
  ChevronRight,
  Scale,
  Ruler,
  Droplet,
  Check,
  StickyNote,
  Clock,
  AlertTriangle,
  Activity,
  Upload,
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
  Card,
  EmptyState,
  Skeleton,
  DoseRing,
  FloatingActionButton,
  BottomSheet,
  useToast,
} from "@/components/ui";

type TimingKey = "morning" | "afternoon" | "evening" | "night";

const TIMING_META: Record<TimingKey, { label: string; tone: Tone }> = {
  morning: { label: "Morning", tone: "primary" },
  afternoon: { label: "Afternoon", tone: "accent" },
  evening: { label: "Evening", tone: "accent2" },
  night: { label: "Night", tone: "info" },
};

const HERO_GRADIENT = ["#7C3AED", "#6D28D9", "#5B21B6"] as const;

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

  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = usePatientProfile();
  const { data: medsData, isLoading: medsLoading, refetch: refetchMeds } = useTodayMedicines();
  const { data: apptsData, isLoading: apptsLoading, refetch: refetchAppts } = useMyAppointments();
  const { data: unread, refetch: refetchUnread } = useUnreadCount();

  const [fabOpen, setFabOpen] = useState(false);

  const patient = profileData?.patient?.patients;
  const todayMeds: any[] = medsData?.medicines ?? [];
  const appointments: any[] = apptsData?.appointments ?? [];

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const firstName = user?.name?.split(" ")[0] || "there";

  const bmi =
    patient?.height && patient?.weight
      ? (patient.weight / Math.pow(patient.height / 100, 2)).toFixed(1)
      : null;

  // Dose tracking not implemented in DB schema; show 0% unless doses API exists.
  const totalMeds = todayMeds.length;
  const adherence = 0;

  // Pick first scheduled medicine as the "up next" item
  const nextMed = todayMeds[0];

  // Group today's meds by timing string
  const grouped: Record<TimingKey, any[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  todayMeds.forEach((m: any) => {
    grouped[timingOf(m.timing)].push(m);
  });

  const formatHeaderDate = () => {
    const d = new Date();
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const day = d.getDate();
    const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    return `${greeting.toUpperCase()} · ${weekday} ${day} ${month}`;
  };

  const userPhoto = profileData?.patient?.users?.photo;
  const userName = profileData?.patient?.users?.name || user?.name || "";

  const refetchAll = () => {
    profileData && refetchProfile();
    medsData && refetchMeds();
    apptsData && refetchAppts();
    unread && refetchUnread();
  };

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={profileLoading || medsLoading || apptsLoading}
            onRefresh={refetchAll}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 150 }}
      >
        {/* App header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            {userPhoto ? (
              <Image
                source={{ uri: userPhoto }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  backgroundColor: colors.surfaceMuted,
                }}
              />
            ) : (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: colors.primary,
                  }}
                >
                  {(userName || "?")[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              style={[
                typography.title.lg,
                { color: colors.primary, fontWeight: "800", fontSize: 20 },
              ]}
            >
              HealthHub
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(app)/notifications")}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Bell size={22} color={colors.primary} strokeWidth={2.25} />
            {unread?.count ? (
              <View
                style={[
                  styles.bellBadge,
                  { backgroundColor: colors.primary },
                ]}
              />
            ) : null}
          </Pressable>
        </View>

        {/* Purple hero */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            borderRadius: radius.xxl,
            overflow: "hidden",
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <LinearGradient
            colors={["#7C3AED", "#5B21B6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Decorative orbs */}
          <View
            style={[
              styles.heroOrb,
              {
                width: 180,
                height: 180,
                top: -60,
                right: -40,
                backgroundColor: "rgba(255,255,255,0.10)",
              },
            ]}
          />
          <View
            style={[
              styles.heroOrb,
              {
                width: 120,
                height: 120,
                bottom: -30,
                left: -20,
                backgroundColor: "rgba(255,255,255,0.08)",
              },
            ]}
          />

          <Text
            style={[
              typography.overline,
              { color: "rgba(255,255,255,0.75)", letterSpacing: 1.4 },
            ]}
          >
            {formatHeaderDate()}
          </Text>

          <Text
            style={[
              typography.display.lg,
              {
                color: "#FFFFFF",
                fontSize: 32,
                lineHeight: 36,
                letterSpacing: -0.8,
                fontWeight: "700",
              },
            ]}
            numberOfLines={1}
          >
            {firstName}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              marginTop: spacing.xs,
            }}
          >
            <Text
              style={[
                typography.display.lg,
                {
                  color: "#FFFFFF",
                  fontSize: 52,
                  lineHeight: 56,
                  letterSpacing: -2,
                  fontWeight: "800",
                },
              ]}
            >
              {totalMeds > 0 ? `${adherence}%` : "0%"}
            </Text>
            <Text
              style={[
                typography.title.md,
                {
                  color: "rgba(255, 255, 255, 0.85)",
                  marginLeft: spacing.xs,
                  fontWeight: "600",
                  fontSize: 15,
                },
              ]}
            >
              Adherence
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginTop: spacing.sm,
              flexWrap: "wrap",
            }}
          >
            <HeroChip label={`${patient?.bloodGroup ?? "O+"} Blood`} />
            <HeroChip label={bmi ? `${bmi} BMI` : "24.1 BMI"} />
            <HeroChip
              label={unread?.count ? `${unread.count} alerts` : "No alerts"}
              dot={!unread?.count}
            />
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.lg,
            gap: spacing.xl,
          }}
        >
          {/* Quick actions — 2x2 */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title="Quick actions" />
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
                tone="neutral"
                onPress={() => router.push("/(app)/records")}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <QuickTile
                icon={CalendarPlus}
                label="Book visit"
                tone="warning"
                onPress={() => router.push("/(app)/book-appointment")}
              />
              <QuickTile
                icon={AlertTriangle}
                label="Emergency"
                tone="danger"
                onPress={() => router.push("/(app)/emergency")}
              />
            </View>
          </View>

          {/* Up next featured card */}
          {nextMed ? (
            <UpNextCard
              med={nextMed}
              onPress={() => router.push("/(app)/medicines")}
            />
          ) : null}

          {/* Today's schedule */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel
              title="Today's schedule"
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
                  <Skeleton width={140} height={140} radius={radius.xl} />
                  <Skeleton width={140} height={140} radius={radius.xl} />
                  <Skeleton width={140} height={140} radius={radius.xl} />
                </View>
              </Card>
            ) : totalMeds === 0 ? (
              <EmptyState
                icon={Pill}
                title="No medicines yet"
                message="Add your first medicine to get daily reminders."
                actionLabel="Add medicine"
                onAction={() => router.push("/(app)/add-medicine")}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: spacing.md,
                  paddingRight: spacing.lg,
                }}
              >
                {(Object.keys(grouped) as TimingKey[])
                  .filter((k) => grouped[k].length > 0)
                  .map((k) => (
                    <ScheduleCard
                      key={k}
                      meta={TIMING_META[k]}
                      items={grouped[k]}
                    />
                  ))}
              </ScrollView>
            )}
          </View>

          {/* Wellness */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title="Wellness" />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <MetricTile
                icon={Scale}
                value={patient?.weight ? String(patient.weight) : "—"}
                unit="kg"
                tone="warning"
              />
              <MetricTile
                icon={Ruler}
                value={patient?.height ? String(patient.height) : "—"}
                unit="cm"
                tone="info"
              />
              <MetricTile
                icon={Droplet}
                value={patient?.bloodGroup || "—"}
                unit=""
                tone="danger"
              />
            </View>
          </View>

          {/* Coming up — list rows with timeline dots */}
          {appointments.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <SectionLabel
                title="Coming up"
                action={{
                  label: "All visits",
                  onPress: () => router.push("/(app)/appointments"),
                }}
              />
              <View
                style={{
                  marginLeft: spacing.sm,
                  paddingLeft: spacing.md,
                  gap: spacing.sm,
                }}
              >
                {apptsLoading
                  ? [0, 1].map((i) => (
                      <View key={i} style={{ marginLeft: -spacing.sm + 1.5 }}>
                        <Card>
                          <View style={{ gap: spacing.sm }}>
                            <Skeleton width="70%" height={16} />
                            <Skeleton width="55%" height={14} />
                          </View>
                        </Card>
                      </View>
                    ))
                  : appointments.slice(0, 4).map((a: any, idx: number) => (
                      <AppointmentTimelineRow
                        key={a.id ?? `a-${idx}`}
                        item={a}
                        isFirst={idx === 0}
                        isLast={
                          idx === Math.min(appointments.length, 4) - 1
                        }
                      />
                    ))}
              </View>
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
              toast.show("Open Medicines to log a dose", "info");
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
              router.push("/(app)/notes");
            }}
          />
          <FabAction
            icon={Activity}
            label="Log vital"
            description="BP, sugar, weight..."
            tone="danger"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/vitals");
            }}
          />
          <FabAction
            icon={Upload}
            label="Add record"
            description="Upload a lab report or scan"
            tone="info"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/add-record");
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

function HeroChip({ label, dot }: { label: string; dot?: boolean }) {
  const { spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.18)",
      }}
    >
      {dot ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#34D399",
          }}
        />
      ) : null}
      <Text
        style={[
          typography.label.md,
          { color: "#FFFFFF", fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </View>
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
      <Text
        style={[
          typography.overline,
          { color: colors.textMuted, letterSpacing: 1.2 },
        ]}
      >
        {title.toUpperCase()}
      </Text>
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
  
  const isEmergency = tone === "danger";
  const labelColor = isEmergency ? palette.fg : colors.text;
  const chevronColor = isEmergency ? palette.fg : colors.textSubtle;
  
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }: any) => ({
        flex: 1,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: palette.bg,
        opacity: pressed ? 0.85 : 1,
        minHeight: 110,
        justifyContent: "space-between",
      })}
    >
      {/* Top row: Icon */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
        }}
      >
        <Icon size={18} color={palette.fg} strokeWidth={2.25} />
      </View>

      {/* Bottom row: Text + Chevron */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: spacing.sm,
        }}
      >
        <Text
          style={[
            typography.title.sm,
            {
              color: labelColor,
              fontWeight: "700",
              fontSize: 14,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <ChevronRight
          size={14}
          color={chevronColor}
          strokeWidth={2.5}
        />
      </View>
    </Pressable>
  );
}

function UpNextCard({
  med,
  onPress,
}: {
  med: any;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Up next medicine"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.xl,
          backgroundColor: colors.primarySoft,
          borderLeftWidth: 4,
          borderLeftColor: colors.primary,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
          }}
        >
          <Clock size={22} color="#FFFFFF" strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              typography.overline,
              { color: colors.primary, letterSpacing: 1.2 },
            ]}
          >
            {med?.startDate ? `UP NEXT · ${formatClock(med.startDate)}` : "UP NEXT"}
          </Text>
          <Text
            style={[
              typography.title.md,
              { color: colors.text, marginTop: 2, fontWeight: "800" },
            ]}
            numberOfLines={1}
          >
            {med?.name ?? "Medicine"}
            {med?.dosage ? ` ${med.dosage}` : ""}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {med?.notes ?? med?.timing ?? "Tap to view"}
          </Text>
        </View>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <ChevronRight size={20} color={colors.primary} strokeWidth={2.5} />
        </View>
      </View>
    </Pressable>
  );
}

function ScheduleCard({
  meta,
  items,
}: {
  meta: (typeof TIMING_META)[TimingKey];
  items: any[];
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      style={{
        width: 140,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.primarySoft,
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <Text
        style={[
          typography.label.md,
          { color: colors.primary, fontWeight: "700" },
        ]}
      >
        {meta.label}
      </Text>
      <DoseRing
        value={0}
        size={88}
        tone="primary"
        label={`${items.length}`}
        sublabel="meds"
        centerColor={colors.primarySoft}
      />
      <Text
        style={[typography.caption, { color: colors.textMuted, fontWeight: "500" }]}
        numberOfLines={1}
      >
        {items.length} {items.length === 1 ? "Dose" : "Doses"}
      </Text>
    </View>
  );
}

function MetricTile({
  icon: Icon,
  value,
  unit,
  tone,
}: {
  icon: any;
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
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      <Icon size={20} color={palette.fg} strokeWidth={2.25} />
      <Text
        style={[
          typography.display.md,
          { color: colors.text, fontWeight: "800" },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {unit}
      </Text>
    </View>
  );
}

function AppointmentTimelineRow({
  item,
  isLast,
  isFirst,
}: {
  item: any;
  isLast: boolean;
  isFirst: boolean;
}) {
  const router = useRouter();
  const { colors, spacing, typography, radius } = useTheme();
  const dateLabel = item?.date ? formatDate(item.date) : "—";
  const timeLabel = item?.time ? formatClock(item.time) : "";

  const title = item?.reason || "Doctor visit";
  const subLabel = item?.queueNumber
    ? `Queue #${item.queueNumber}${item?.status ? ` • ${item.status}` : ""}`
    : item?.status
    ? item.status
    : "Tap to view details";

  const isHighlightDate = dateLabel === "Today" || dateLabel === "Tomorrow";

  return (
    <View style={{ position: "relative", paddingBottom: spacing.lg }}>
      {/* Vertical line connector */}
      {!isLast && (
        <View
          style={{
            position: "absolute",
            left: -spacing.sm - 2 + 0.75,
            top: 22,
            bottom: -spacing.lg,
            width: 1.5,
            backgroundColor: colors.border,
          }}
        />
      )}
      
      {/* Timeline dot */}
      <View
        style={[
          styles.timelineDot,
          {
            backgroundColor: isFirst ? colors.primary : colors.borderStrong,
            borderColor: "transparent",
            top: 8,
            left: -spacing.sm - 7 + 0.75,
          },
        ]}
      />
      
      <Pressable
        onPress={() => router.push("/(app)/appointments")}
        accessibilityRole="button"
        style={{ marginLeft: spacing.sm }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "700" },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, marginTop: 2 },
              ]}
              numberOfLines={1}
            >
              {subLabel}
            </Text>
          </View>
          
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={[
                typography.title.sm,
                {
                  color: isHighlightDate ? colors.primary : colors.text,
                  fontWeight: "700",
                },
              ]}
              numberOfLines={1}
            >
              {dateLabel}
            </Text>
            {timeLabel ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
              >
                {timeLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
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
      <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.25} />
    </Pressable>
  );
}

function formatDate(input?: string) {
  if (!input) return "—";
  try {
    const d = new Date(input);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (sameDay(d, today)) return "Today";
    if (sameDay(d, tomorrow)) return "Tomorrow";
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return input;
  }
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatClock(input: string) {
  const [hStr, mStr] = (input || "").split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return input || "—";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mStr || "00"} ${ampm}`;
}

const styles = StyleSheet.create({
  heroOrb: {
    position: "absolute",
    borderRadius: 9999,
  },
  bellBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  timelineDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    zIndex: 1,
  },
});
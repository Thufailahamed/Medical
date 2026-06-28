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
  Droplet,
  Check,
  StickyNote,
  Clock,
  AlertTriangle,
  Activity,
  Upload,
  HeartPulse,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  MessageSquare,
  ScanText,
  FileSearch,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import {
  usePatientProfile,
  useTodayMedicines,
  useMyAppointments,
  useUnreadCount,
  useWellness,
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
  Button,
} from "@/components/ui";

type TimingKey = "morning" | "afternoon" | "evening" | "night";

const TIMING_META: Record<TimingKey, { label: string; tone: Tone }> = {
  morning: { label: "Morning", tone: "primary" },
  afternoon: { label: "Afternoon", tone: "accent" },
  evening: { label: "Evening", tone: "accent2" },
  night: { label: "Night", tone: "info" },
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

  const totalMeds = todayMeds.length;
  const adherence = 0;

  const nextMed = todayMeds[0];

  const grouped: Record<TimingKey, any[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  todayMeds.forEach((m: any) => {
    grouped[timingOf(m.timing)].push(m);
  });

  const headerDate = (() => {
    const d = new Date();
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const day = d.getDate();
    const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    return `${greeting.toUpperCase()} · ${weekday} ${day} ${month}`;
  })();

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
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* ─── App header ─── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {userPhoto ? (
              <Image
                source={{ uri: userPhoto }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.surfaceMuted,
                }}
              />
            ) : (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
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
              numberOfLines={1}
              style={[
                typography.title.lg,
                { color: colors.primary, fontWeight: "800", fontSize: 20, flexShrink: 1 },
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
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
              backgroundColor: pressed ? colors.surfaceMuted : "transparent",
            })}
          >
            <Bell size={22} color={colors.primary} strokeWidth={2.25} />
            {unread?.count ? (
              <View style={[styles.bellBadge, { backgroundColor: colors.primary }]} />
            ) : null}
          </Pressable>
        </View>

        {/* ─── Purple hero ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            borderRadius: radius.xxl,
            overflow: "hidden",
            padding: spacing.lg,
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

          {/* Content sits above orbs */}
          <View style={{ gap: spacing.sm }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[
                typography.overline,
                { color: "rgba(255,255,255,0.85)", letterSpacing: 1.2 },
              ]}
            >
              {headerDate}
            </Text>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[
                typography.display.lg,
                {
                  color: "#FFFFFF",
                  fontSize: 30,
                  lineHeight: 34,
                  letterSpacing: -0.6,
                  fontWeight: "700",
                  marginTop: 2,
                },
              ]}
            >
              {firstName}
            </Text>

            {/* Adherence row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: spacing.sm,
                marginTop: spacing.sm,
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={[
                  typography.display.lg,
                  {
                    color: "#FFFFFF",
                    fontSize: 48,
                    lineHeight: 52,
                    letterSpacing: -1.5,
                    fontWeight: "800",
                    includeFontPadding: false,
                  },
                ]}
              >
                {totalMeds > 0 ? `${adherence}%` : "0%"}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  typography.title.sm,
                  {
                    color: "rgba(255, 255, 255, 0.9)",
                    fontWeight: "600",
                  },
                ]}
              >
                Adherence
              </Text>
            </View>

            {/* Chips */}
            <View
              style={{
                flexDirection: "row",
                gap: spacing.xs,
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
        </View>

        {/* ─── Sections ─── */}
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

          {/* AI assistant */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title="AI assistant" />
            <Card padded={false}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={20} color={colors.accent} strokeWidth={2.25} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[typography.title.sm, { color: colors.text }]}
                  >
                    Health AI
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      typography.caption,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    Summaries, drug checks, chat & more
                  </Text>
                </View>
              </View>
              {/* Divider */}
              <View
                style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }}
              />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                  padding: spacing.md,
                }}
              >
                <QuickTile
                  icon={MessageSquare}
                  label="Chat"
                  tone="accent"
                  onPress={() => router.push("/(app)/ai/chat")}
                />
                <QuickTile
                  icon={Sparkles}
                  label="Summary"
                  tone="primary"
                  onPress={() => router.push("/(app)/ai/summary")}
                />
                <QuickTile
                  icon={ScanText}
                  label="Lab explain"
                  tone="info"
                  onPress={() => router.push("/(app)/ai/lab-explain")}
                />
                <QuickTile
                  icon={Pill}
                  label="Drug check"
                  tone="warning"
                  onPress={() => router.push("/(app)/ai/drug-check")}
                />
              </View>
            </Card>
            <Button
              title="Prescription OCR"
              icon={FileSearch}
              variant="outline"
              size="md"
              fullWidth
              onPress={() => router.push("/(app)/ai/ocr")}
            />
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
                  paddingRight: spacing.sm,
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
            <WellnessCard />
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
                  marginLeft: spacing.md,
                  paddingLeft: spacing.md,
                  gap: spacing.xs,
                }}
              >
                {apptsLoading
                  ? [0, 1].map((i) => (
                      <View key={i}>
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
                        isLast={idx === Math.min(appointments.length, 4) - 1}
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

// ─── Hero chip ────────────────────────────────────────────
function HeroChip({ label, dot }: { label: string; dot?: boolean }) {
  const { spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
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
        numberOfLines={1}
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

// ─── Section label ────────────────────────────────────────
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
        numberOfLines={1}
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

// ─── Quick tile ───────────────────────────────────────────
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
      style={({ pressed }) => ({
        flexBasis: "48%",
        flexGrow: 1,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: palette.bg,
        opacity: pressed ? 0.85 : 1,
        minHeight: 104,
        justifyContent: "space-between",
        gap: spacing.md,
      })}
    >
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

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.xs,
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            typography.title.sm,
            {
              color: labelColor,
              fontWeight: "700",
              flex: 1,
            },
          ]}
        >
          {label}
        </Text>
        <ChevronRight size={14} color={chevronColor} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

// ─── Up next card ─────────────────────────────────────────
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
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
          }}
        >
          <Clock size={22} color="#FFFFFF" strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={[
              typography.overline,
              { color: colors.primary, letterSpacing: 1.2 },
            ]}
          >
            UP NEXT
          </Text>
          <Text
            numberOfLines={1}
            style={[
              typography.title.md,
              { color: colors.text, marginTop: 2, fontWeight: "800" },
            ]}
          >
            {med?.name ?? "Medicine"}
            {med?.dosage ? ` ${med.dosage}` : ""}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 2 },
            ]}
          >
            {med?.notes ?? med?.timing ?? "Tap to view"}
          </Text>
        </View>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <ChevronRight size={18} color={colors.primary} strokeWidth={2.5} />
        </View>
      </View>
    </Pressable>
  );
}

// ─── Schedule card ────────────────────────────────────────
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
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.primarySoft,
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      <Text
        numberOfLines={1}
        style={[
          typography.label.md,
          { color: colors.primary, fontWeight: "700" },
        ]}
      >
        {meta.label}
      </Text>
      <DoseRing
        value={0}
        size={84}
        tone="primary"
        label={`${items.length}`}
        sublabel="meds"
        centerColor={colors.primarySoft}
      />
      <Text
        numberOfLines={1}
        style={[
          typography.caption,
          { color: colors.textMuted, fontWeight: "600" },
        ]}
      >
        {items.length} {items.length === 1 ? "Dose" : "Doses"}
      </Text>
    </View>
  );
}

// ─── Wellness bar ─────────────────────────────────────────
function WellnessBar({
  label,
  score,
  max,
  tone,
}: {
  label: string;
  score: number;
  max: number;
  tone: Tone;
}) {
  const { colors, typography, spacing } = useTheme();
  const p = useTone(tone);
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            typography.label.md,
            { color: colors.text, fontWeight: "700", flex: 1 },
          ]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            typography.caption,
            { color: colors.textMuted, fontWeight: "700" },
          ]}
        >
          {score}/{max}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.surfaceMuted,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: p.fg,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}

// ─── Wellness card (composite 0-100 score) ────────────────
const COMPONENT_TONE: Record<string, Tone> = {
  bmi: "info",
  adherence: "primary",
  vitals: "accent",
  profile: "warning",
  engagement: "success",
};

function WellnessCard() {
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();
  const { data, isLoading } = useWellness();

  if (isLoading) {
    return (
      <Card style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Skeleton width={72} height={72} radius={36} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={14} />
          </View>
        </View>
        <Skeleton width="100%" height={10} radius={5} />
        <Skeleton width="100%" height={10} radius={5} />
      </Card>
    );
  }

  if (!data) return null;

  const score = data.score;
  const tone: Tone = data.level?.tone ?? "info";
  const palette = useTone(tone);
  const components = Array.isArray(data.components) ? data.components : [];
  const Trend = score >= 75 ? TrendingUp : score >= 45 ? Minus : TrendingDown;

  return (
    <Pressable
      onPress={() => router.push("/(app)/profile")}
      accessibilityRole="button"
      accessibilityLabel="Wellness score"
      style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
    >
      <Card
        style={{
          padding: spacing.lg,
          gap: spacing.lg,
          backgroundColor: colors.surface,
          borderColor: palette.bg,
        }}
      >
        {/* Score hero */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.bg,
              borderWidth: 2,
              borderColor: palette.fg,
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[
                typography.display.lg,
                {
                  color: palette.fg,
                  fontWeight: "800",
                  fontSize: 30,
                  lineHeight: 34,
                  includeFontPadding: false,
                },
              ]}
            >
              {score}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: palette.fg, fontWeight: "700", marginTop: -2 },
              ]}
            >
              / 100
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <HeartPulse size={14} color={palette.fg} strokeWidth={2.25} />
              <Text
                numberOfLines={1}
                style={[
                  typography.overline,
                  {
                    color: palette.fg,
                    letterSpacing: 1.2,
                    fontWeight: "700",
                  },
                ]}
              >
                {data.level?.label?.toUpperCase() ?? "WELLNESS"}
              </Text>
            </View>
            <Text
              numberOfLines={2}
              style={[
                typography.title.md,
                { color: colors.text, fontWeight: "800", fontSize: 17 },
              ]}
            >
              {score >= 75
                ? "You're doing great"
                : score >= 45
                ? "Room to improve"
                : "Let's get back on track"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Trend size={12} color={colors.textMuted} strokeWidth={2.25} />
              <Text
                numberOfLines={1}
                style={[typography.caption, { color: colors.textMuted, flex: 1 }]}
              >
                {data.bmi != null
                  ? `BMI ${data.bmi} • ${data.bmiCategory}`
                  : "Complete profile for BMI"}
              </Text>
            </View>
          </View>
        </View>

        {/* Component breakdown */}
        <View style={{ gap: spacing.sm }}>
          {components.map((c) => (
            <WellnessBar
              key={c.key}
              label={c.label}
              score={c.score}
              max={c.max}
              tone={COMPONENT_TONE[c.key] ?? "neutral"}
            />
          ))}
        </View>

        {/* Top tip */}
        {data.topTip ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: 14,
              backgroundColor: palette.bg,
              borderWidth: 1,
              borderColor: `${palette.fg}33`,
            }}
          >
            <Sparkles size={16} color={palette.fg} strokeWidth={2.25} />
            <Text
              style={[
                typography.body.sm,
                { color: colors.text, flex: 1 },
              ]}
            >
              {data.topTip}
            </Text>
          </View>
        ) : null}

        {/* Quick stats row */}
        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            paddingTop: spacing.xs,
          }}
        >
          <MiniStat
            icon={Droplet}
            label="Blood"
            value={
              data.profile?.filled != null && data.profile.filled > 0
                ? `${data.profile.filled}/${data.profile.total}`
                : "—"
            }
          />
          <MiniStat
            icon={Pill}
            label="Doses"
            value={
              data.adherence?.scheduled != null && data.adherence.scheduled > 0
                ? `${data.adherence.taken}/${data.adherence.scheduled}`
                : "—"
            }
          />
          <MiniStat
            icon={Activity}
            label="Vitals"
            value={data.vitals?.readings != null ? String(data.vitals.readings) : "—"}
          />
        </View>
      </Card>
    </Pressable>
  );
}

// ─── Mini stat ────────────────────────────────────────────
function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceMuted,
        minWidth: 0,
      }}
    >
      <Icon size={14} color={colors.textMuted} strokeWidth={2.25} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={[
            typography.caption,
            { color: colors.textMuted, fontWeight: "600" },
          ]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            typography.label.md,
            { color: colors.text, fontWeight: "800" },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Appointment timeline row ─────────────────────────────
function AppointmentTimelineRow({
  item,
  isLast,
}: {
  item: any;
  isLast: boolean;
  isFirst: boolean;
}) {
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();
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
    <View
      style={{
        paddingBottom: spacing.sm,
      }}
    >
      <Pressable
        onPress={() => router.push("/(app)/appointments")}
        accessibilityRole="button"
        style={({ pressed }) => ({
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: 14,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "700" },
              ]}
            >
              {title}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                typography.body.sm,
                { color: colors.textMuted, marginTop: 2 },
              ]}
            >
              {subLabel}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text
              numberOfLines={1}
              style={[
                typography.title.sm,
                {
                  color: isHighlightDate ? colors.primary : colors.text,
                  fontWeight: "700",
                },
              ]}
            >
              {dateLabel}
            </Text>
            {timeLabel ? (
              <Text
                numberOfLines={1}
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
      {!isLast ? (
        <View
          style={{
            width: 2,
            height: spacing.sm,
            backgroundColor: colors.border,
            alignSelf: "flex-start",
            marginLeft: spacing.md,
          }}
        />
      ) : null}
    </View>
  );
}

// ─── FAB action ───────────────────────────────────────────
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
      style={({ pressed }) => ({
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
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
        }}
      >
        <Icon size={20} color={palette.fg} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={[typography.title.sm, { color: colors.text }]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[typography.caption, { color: colors.textMuted }]}
        >
          {description}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.25} />
    </Pressable>
  );
}

// ─── Date helpers ─────────────────────────────────────────
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
    top: 6,
    right: 6,
    minWidth: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
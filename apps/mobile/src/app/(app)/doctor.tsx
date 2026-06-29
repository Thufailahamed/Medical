import { useEffect } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Users,
  ClipboardList,
  FlaskConical,
  CalendarClock,
  Clock4,
  Stethoscope,
  Search,
  ChevronRight,
  Bell,
  FileText,
  Edit3,
  UserRound,
} from "lucide-react-native";
import {
  useDoctorDashboard,
  useDoctorQueue,
  useDoctorPrescriptions,
  useDoctorClinicalNotes,
  useLabOrders,
  useFollowUps,
  useUnreadCount,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/stores/auth";
import {
  Screen,
  ScreenHeader,
  Card,
  Avatar,
  Skeleton,
  Pill,
  EmptyState,
} from "@/components/ui";

export default function DoctorHub() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const user = useAuthStore((s) => s.user);

  // Role gate
  useEffect(() => {
    if (user && user.role !== "doctor") {
      router.replace("/");
    }
  }, [user, router]);

  const { data: dashboard, isLoading } = useDoctorDashboard();
  const { data: queueData } = useDoctorQueue();
  const { data: rxData } = useDoctorPrescriptions();
  const { data: notesData } = useDoctorClinicalNotes();
  const { data: labData } = useLabOrders();
  const { data: followData } = useFollowUps({ upcoming: true });
  const { data: unread } = useUnreadCount();

  const todayCount = dashboard?.stats?.todayAppointments ?? 0;
  const totalPatients = dashboard?.stats?.totalPatients ?? 0;
  const upcoming =
    queueData?.queue?.filter(
      (q: any) =>
        q.status !== "completed" &&
        q.status !== "cancelled" &&
        q.status !== "no_show"
    ).length ?? 0;
  const rxCount = rxData?.prescriptions?.length ?? 0;
  const notesCount = notesData?.count ?? notesData?.notes?.length ?? 0;
  const labCount = labData?.orders?.length ?? 0;
  const followCount = followData?.followUps?.length ?? 0;
  const unreadN = unread?.count ?? 0;

  const tiles = [
    {
      key: "records",
      title: "Patient records",
      subtitle: `${rxCount + notesCount + labCount} across your patients`,
      icon: FileText,
      tone: "primary" as const,
      href: "/doctor/records",
    },
    {
      key: "queue",
      title: "Today's queue",
      subtitle: `${upcoming} waiting now`,
      icon: Clock4,
      tone: "primary" as const,
      href: "/doctor/queue",
    },
    {
      key: "search",
      title: "Search & prescribe",
      subtitle: "Find a patient, write a prescription",
      icon: Search,
      tone: "accent" as const,
      href: "/doctor/prescription",
    },
    {
      key: "rx",
      title: "My prescriptions",
      subtitle: `${rxCount} written`,
      icon: FileText,
      tone: "success" as const,
      href: "/doctor/prescriptions",
    },
    {
      key: "notes",
      title: "Clinical notes",
      subtitle: `${notesCount} recorded`,
      icon: Edit3,
      tone: "primary" as const,
      href: "/doctor/clinical-notes",
    },
    {
      key: "lab",
      title: "Lab orders",
      subtitle: `${labCount} on file`,
      icon: FlaskConical,
      tone: "info" as const,
      href: "/doctor/lab-orders",
    },
    {
      key: "follow",
      title: "Follow-ups",
      subtitle: `${followCount} upcoming`,
      icon: CalendarClock,
      tone: "warning" as const,
      href: "/doctor/follow-ups",
    },
    {
      key: "hours",
      title: "My availability",
      subtitle: "Edit working hours and slots",
      icon: ClipboardList,
      tone: "warning" as const,
      href: "/doctor/availability",
    },
  ];

  if (user && user.role !== "doctor") {
    return (
      <Screen padded>
        <EmptyState
          icon={Stethoscope}
          title="Doctor portal"
          message="This area is restricted to doctor accounts."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader
        title="Doctor portal"
        subtitle={`Welcome back, ${user?.name?.split(" ")[0] || "Doctor"}`}
        right={
          <Pressable
            onPress={() => router.push("/notifications")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Bell size={22} color={colors.primary} strokeWidth={2.25} />
            {unreadN > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  minWidth: 16,
                  height: 16,
                  paddingHorizontal: 3,
                  borderRadius: 8,
                  backgroundColor: colors.danger,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    color: "#fff",
                  }}
                >
                  {unreadN > 99 ? "99+" : unreadN}
                </Text>
              </View>
            ) : null}
          </Pressable>
        }
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        {/* Hero identity card */}
        {isLoading ? (
          <Skeleton height={120} radius={24} />
        ) : (
          <Pressable
            onPress={() => router.push("/doctor/profile")}
            accessibilityRole="button"
            accessibilityLabel="View doctor profile"
            style={({ pressed }) => ({
              padding: spacing.lg,
              borderRadius: radius.glass,
              backgroundColor: colors.primarySoft,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.lg,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Avatar name={user?.name || "Doctor"} size="lg" tone="primary" ring />
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {todayCount} appointments today
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
              >
                {totalPatients} total patients in your care
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 6,
                }}
              >
                <UserRound size={11} color={colors.primary} strokeWidth={2.5} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.primary,
                    letterSpacing: 0.3,
                  }}
                >
                  TAP FOR PROFILE
                </Text>
              </View>
            </View>
            <Pill label="On duty" tone="success" size="sm" />
          </Pressable>
        )}

        {/* Stats grid */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, fontWeight: "700" },
              ]}
            >
              IN QUEUE
            </Text>
            <Text
              style={[
                typography.title.lg,
                { color: colors.text, fontWeight: "900", marginTop: 2 },
              ]}
            >
              {upcoming}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, fontWeight: "700" },
              ]}
            >
              RX WRITTEN
            </Text>
            <Text
              style={[
                typography.title.lg,
                { color: colors.text, fontWeight: "900", marginTop: 2 },
              ]}
            >
              {rxCount}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, fontWeight: "700" },
              ]}
            >
              NOTES
            </Text>
            <Text
              style={[
                typography.title.lg,
                { color: colors.text, fontWeight: "900", marginTop: 2 },
              ]}
            >
              {notesCount}
            </Text>
          </View>
        </View>

        {/* Tiles */}
        <View style={{ gap: spacing.sm }}>
          {tiles.map((t) => (
            <Card
              key={t.key}
              onPress={() => router.push(t.href as any)}
              padded={false}
              accessibilityLabel={t.title}
            >
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
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <t.icon size={20} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t.title}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {t.subtitle}
                  </Text>
                </View>
                <ChevronRight
                  size={18}
                  color={colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
            </Card>
          ))}
        </View>
      </View>
    </Screen>
  );
}
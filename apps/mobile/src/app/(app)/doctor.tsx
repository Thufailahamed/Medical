import { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
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
} from "lucide-react-native";
import {
  useDoctorDashboard,
  useDoctorQueue,
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

  const todayCount = dashboard?.stats?.todayAppointments ?? 0;
  const totalPatients = dashboard?.stats?.totalPatients ?? 0;
  const upcoming = queueData?.queue?.filter(
    (q: any) =>
      q.status !== "completed" &&
      q.status !== "cancelled" &&
      q.status !== "no_show"
  ).length ?? 0;

  const tiles = [
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
      key: "lab",
      title: "Lab orders",
      subtitle: "Order labs and review results",
      icon: FlaskConical,
      tone: "info" as const,
      href: "/doctor/lab-orders",
    },
    {
      key: "follow",
      title: "Follow-ups",
      subtitle: "Upcoming and past follow-ups",
      icon: CalendarClock,
      tone: "success" as const,
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
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        {isLoading ? (
          <Skeleton height={120} radius={24} />
        ) : (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radius.glass,
              backgroundColor: colors.primarySoft,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.lg,
            }}
          >
            <Avatar
              name={user?.name || "Doctor"}
              size="lg"
              tone="primary"
              ring
            />
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
            </View>
            <Pill label="On duty" tone="success" size="sm" />
          </View>
        )}

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
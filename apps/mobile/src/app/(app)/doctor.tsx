// @ts-nocheck

import { useEffect } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
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
  const { t } = useTranslation();
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

  const firstName = user?.name?.split(" ")[0] || t("doctor.welcomeFallback");
  const totalItems = rxCount + notesCount + labCount;

  if (user && user.role !== "doctor") {
    return (
      <Screen padded>
        <EmptyState
          icon={Stethoscope}
          title={t("doctor.restrictedTitle")}
          message={t("doctor.restrictedBody")}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader
        title={t("doctor.title")}
        subtitle={t("doctor.subtitle", { name: firstName })}
        right={
          <Pressable
            onPress={() => router.push("/notifications")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("doctor.notificationsA11y")}
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
            accessibilityLabel={t("doctor.viewProfileA11y")}
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
            <Avatar name={user?.name || t("doctor.welcomeFallback")} size="lg" tone="primary" ring />
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {t("doctor.heroAppointments", { count: todayCount })}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
              >
                {t("doctor.heroPatients", { count: totalPatients })}
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
                  {t("doctor.tapForProfile")}
                </Text>
              </View>
            </View>
            <Pill label={t("doctor.onDuty")} tone="success" size="sm" />
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
              {t("doctor.stats.inQueue")}
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
              {t("doctor.stats.rxWritten")}
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
              {t("doctor.stats.notes")}
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
          <Tile
            icon={FileText}
            title={t("doctor.tiles.recordsTitle")}
            subtitle={t("doctor.tiles.recordsSubtitle", { count: totalItems })}
            onPress={() => router.push("/doctor/records" as any)}
          />
          <Tile
            icon={Clock4}
            title={t("doctor.tiles.queueTitle")}
            subtitle={t("doctor.tiles.queueSubtitle", { count: upcoming })}
            onPress={() => router.push("/doctor/queue" as any)}
          />
          <Tile
            icon={Search}
            title={t("doctor.tiles.searchTitle")}
            subtitle={t("doctor.tiles.searchSubtitle")}
            onPress={() => router.push("/doctor/prescription" as any)}
          />
          <Tile
            icon={FileText}
            title={t("doctor.tiles.rxTitle")}
            subtitle={t("doctor.tiles.rxSubtitle", { count: rxCount })}
            onPress={() => router.push("/doctor/prescriptions" as any)}
          />
          <Tile
            icon={Edit3}
            title={t("doctor.tiles.notesTitle")}
            subtitle={t("doctor.tiles.notesSubtitle", { count: notesCount })}
            onPress={() => router.push("/doctor/clinical-notes" as any)}
          />
          <Tile
            icon={FlaskConical}
            title={t("doctor.tiles.labTitle")}
            subtitle={t("doctor.tiles.labSubtitle", { count: labCount })}
            onPress={() => router.push("/doctor/lab-orders" as any)}
          />
          <Tile
            icon={CalendarClock}
            title={t("doctor.tiles.followTitle")}
            subtitle={t("doctor.tiles.followSubtitle", { count: followCount })}
            onPress={() => router.push("/doctor/follow-ups" as any)}
          />
          <Tile
            icon={ClipboardList}
            title={t("doctor.tiles.hoursTitle")}
            subtitle={t("doctor.tiles.hoursSubtitle")}
            onPress={() => router.push("/doctor/availability" as any)}
          />
        </View>
      </View>
    </Screen>
  );
}

function Tile({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { spacing, colors, typography } = useTheme();
  return (
    <Card onPress={onPress} padded={false} accessibilityLabel={title}>
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
          <Icon size={20} color={colors.primary} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.title.sm, { color: colors.text }]}>
            {title}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 2 },
            ]}
          >
            {subtitle}
          </Text>
        </View>
        <ChevronRight
          size={18}
          color={colors.textSubtle}
          strokeWidth={2.2}
        />
      </View>
    </Card>
  );
}
// @ts-nocheck

import { useMemo, useCallback } from "react";
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
import { useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  Clock4,
  ChevronRight,
  FileText,
  Edit3,
  FlaskConical,
  CalendarClock,
  ClipboardList,
  Stethoscope,
  Users,
  BadgeCheck,
  CalendarDays,
  Wallet,
  Inbox,
  Video,
  Building2,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react-native";
import {
  useDoctorDashboard,
  useDoctorQueue,
  useDoctorPrescriptions,
  useDoctorClinicalNotes,
  useLabOrders,
  useFollowUps,
  useUnreadCount,
  useDoctorMe,
  useConsentsIssued,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { useAuthStore } from "@/stores/auth";
import {
  Screen,
  Card,
  Avatar,
  Skeleton,
  Pill,
  EmptyState,
  ErrorState,
  DoseRing,
} from "@/components/ui";
import { TenantSwitcher } from "@/components/TenantSwitcher";

export default function DoctorHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, fontFamily, layout } =
    useTheme();
  const user = useAuthStore((s) => s.user);

  const {
    data: dashboard,
    isLoading,
    isError,
    refetch: refetchDashboard,
  } = useDoctorDashboard();
  const { data: queueData, refetch: refetchQueue } = useDoctorQueue();
  const { data: rxData, refetch: refetchRx } = useDoctorPrescriptions();
  const { data: notesData, refetch: refetchNotes } = useDoctorClinicalNotes();
  const { data: labData, refetch: refetchLabs } = useLabOrders();
  const { data: followData, refetch: refetchFollows } = useFollowUps({
    upcoming: true,
  });
  const { data: unread, refetch: refetchUnread } = useUnreadCount();
  const { data: doctorData } = useDoctorMe();
  const { data: consentsData, refetch: refetchConsents } = useConsentsIssued();

  useFocusEffect(
    useCallback(() => {
      refetchDashboard();
      refetchQueue();
      refetchRx();
      refetchNotes();
      refetchLabs();
      refetchFollows();
      refetchUnread();
      refetchConsents();
    }, [
      refetchDashboard,
      refetchQueue,
      refetchRx,
      refetchNotes,
      refetchLabs,
      refetchFollows,
      refetchUnread,
      refetchConsents,
    ])
  );

  const todayCount = dashboard?.stats?.todayAppointments ?? 0;
  const totalPatients = dashboard?.stats?.totalPatients ?? 0;
  const queueList = useMemo(() => {
    return (
      queueData?.queue?.filter(
        (q: any) =>
          q.status !== "completed" &&
          q.status !== "cancelled" &&
          q.status !== "no_show"
      ) ?? []
    );
  }, [queueData]);
  const upcoming = queueList.length;
  const rxCount = rxData?.prescriptions?.length ?? 0;
  const notesCount = notesData?.count ?? notesData?.notes?.length ?? 0;
  const labCount = labData?.orders?.length ?? 0;
  const followCount = followData?.followUps?.length ?? 0;
  const unreadN = unread?.count ?? 0;

  const consentsCount = useMemo(() => {
    return (consentsData?.items ?? []).filter((c: any) =>
      c.scope?.defaultScope?.includes("records_all") ||
      c.scope?.defaultScope?.includes("records_recent") ||
      c.scope?.kinds?.includes?.("*")
    ).length;
  }, [consentsData]);

  const doctorUser = doctorData?.doctor?.users || user;
  const displayName = doctorUser?.name || user?.name || "";
  const firstName = displayName.replace(/^dr\.?\s+/i, "").trim().split(/\s+/)[0] || "";
  const heroName =
    firstName && !/^(dr\.?|doctor)$/i.test(firstName)
      ? `Dr. ${firstName}`
      : t("doctor.welcomeFallback", "Doctor");
  const userPhoto = doctorData?.doctor?.users?.photo;
  const specialization = doctorData?.doctor?.doctors?.specialization;
  const verified = doctorData?.doctor?.users?.verified;

  const doctorInitials = useMemo(() => {
    if (!displayName) return "DR";
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [displayName]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("doctor.greeting.morning", "Good morning")
      : hour < 17
        ? t("doctor.greeting.afternoon", "Good afternoon")
        : t("doctor.greeting.evening", "Good evening");

  const headerDate = useMemo(() => {
    const d = new Date();
    const weekday = d
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase();
    const day = d.getDate();
    const month = d
      .toLocaleDateString("en-US", { month: "short" })
      .toUpperCase();
    return `${greeting.toUpperCase()} · ${weekday} ${day} ${month}`;
  }, [greeting]);

  const onRefresh = useCallback(() => {
    refetchDashboard();
    refetchQueue();
    refetchRx();
    refetchNotes();
    refetchLabs();
    refetchFollows();
    refetchUnread();
    refetchConsents();
  }, [
    refetchDashboard,
    refetchQueue,
    refetchRx,
    refetchNotes,
    refetchLabs,
    refetchFollows,
    refetchUnread,
    refetchConsents,
  ]);

  const bottomPadding = layout.tabBarHeight + insets.bottom + spacing.xxxl + 40;

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ─── Top App Bar ────────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xs,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={() => router.push("/profile" as any)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="View Doctor Profile"
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              {userPhoto ? (
                <Image
                  source={{ uri: userPhoto }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    backgroundColor: colors.primarySoft,
                    borderWidth: 1.5,
                    borderColor: "rgba(14, 165, 233, 0.3)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: colors.primary,
                      fontFamily: fontFamily.displayBold,
                      letterSpacing: -0.2,
                    }}
                  >
                    {doctorInitials}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.text,
                      fontWeight: "800",
                      fontSize: 19,
                      fontFamily: fontFamily.displayBold,
                      letterSpacing: -0.4,
                    }}
                  >
                    {t("doctor.brand", "Healers")}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: colors.primarySoft,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "800",
                        color: colors.primary,
                        letterSpacing: 0.8,
                      }}
                    >
                      MD
                    </Text>
                  </View>
                </View>
                <Text
                  style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}
                  numberOfLines={1}
                >
                  {specialization || t("doctor.welcomeFallback", "General Practice")}
                </Text>
              </View>
            </Pressable>

            {/* Notification Bell */}
            <Pressable
              onPress={() => router.push("/(doctor)/notifications" as any)}
              accessibilityRole="button"
              accessibilityLabel={t("doctor.notificationsA11y", "Notifications")}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.primarySoft : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#062238",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 1,
              })}
            >
              <Bell size={20} color={colors.primary} strokeWidth={2.2} />
              {unreadN > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    minWidth: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.danger,
                    borderWidth: 1.5,
                    borderColor: colors.surface,
                  }}
                />
              ) : null}
            </Pressable>
          </View>

          {/* Integrated Workspace Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 5,
              paddingHorizontal: spacing.xs,
              minHeight: 34,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Building2 size={13} color={colors.textMuted} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 1.1,
                  color: colors.textSubtle,
                  fontFamily: fontFamily.bodyBold,
                  textTransform: "uppercase",
                }}
              >
                {t("doctor.workspaceLabel", "Workspace")}
              </Text>
            </View>
            <TenantSwitcher />
          </View>
        </View>

        {/* ─── Hero Card ──────────────────────────────────────────── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xs,
            borderRadius: 28,
            overflow: "hidden",
            padding: spacing.xl,
            paddingBottom: spacing.lg,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.16)",
            elevation: 8,
            shadowColor: "#001B3F",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.22,
            shadowRadius: 20,
          }}
        >
          <LinearGradient
            colors={["#082247", "#0A4874", "#0C7888"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Ambient Lighting Orbs */}
          <View
            style={{
              position: "absolute",
              top: -50,
              right: -30,
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -60,
              left: -40,
              width: 170,
              height: 170,
              borderRadius: 85,
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text
                numberOfLines={1}
                style={{
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 1.1,
                  fontFamily: fontFamily.displayBold,
                  textTransform: "uppercase",
                }}
              >
                {headerDate}
              </Text>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{
                  color: "#FFFFFF",
                  fontSize: 32,
                  lineHeight: 38,
                  letterSpacing: -0.6,
                  fontWeight: "800",
                  marginTop: 4,
                  fontFamily: fontFamily.displayBold,
                }}
              >
                {heroName}
              </Text>

              {/* Status Badge */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  gap: 6,
                  marginTop: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: "#34D399",
                  }}
                />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: "700",
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {t("doctor.onDuty", "On duty")}
                </Text>
                {verified ? (
                  <BadgeCheck size={14} color="#34D399" strokeWidth={2.4} />
                ) : null}
              </View>

            </View>

            {/* Circular Gauge */}
            <View style={{ width: 88, height: 88, alignItems: "center", justifyContent: "center" }}>
              <DoseRing
                value={todayCount > 0 ? Math.min(todayCount / 10, 1) : 0}
                size={88}
                trackColor="rgba(255,255,255,0.16)"
                progressColor="#5EEAD4"
                centerColor="rgba(255,255,255,0.06)"
                accessibilityLabel={`${todayCount} appointments today`}
              />
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 26,
                    lineHeight: 30,
                    fontWeight: "800",
                    fontFamily: fontFamily.displayBold,
                    letterSpacing: -0.5,
                  }}
                >
                  {todayCount}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.72)",
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                  }}
                >
                  {t("doctor.todayAppointments", "Today")}
                </Text>
              </View>
            </View>
          </View>

          {/* Hero Metrics Strip */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              marginTop: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
            }}
          >
            <HeroMetric
              icon={Users}
              value={totalPatients}
              label={t("doctor.heroMetricPatients", "Patients")}
              onPress={() => router.push("/care-team" as any)}
            />
            <HeroDivider />
            <HeroMetric
              icon={Bell}
              value={unreadN}
              label={t("doctor.heroMetricAlerts", "Alerts")}
              highlight={unreadN > 0}
              onPress={() => router.push("/(doctor)/notifications" as any)}
            />
            <HeroDivider />
            <HeroMetric
              icon={CalendarClock}
              value={followCount}
              label={t("doctor.heroMetricFollowUps", "Follow-ups")}
              onPress={() => router.push("/follow-ups" as any)}
            />
          </View>
        </View>

        {/* ─── Main Content Sections ──────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.xxl,
            gap: spacing.xxl,
          }}
        >
          {/* Today's Pulse */}
          <View style={{ gap: spacing.md }}>
            <SectionLabel title={t("doctor.statsStrip.label", "Today's Pulse")} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <StatTile
                icon={Clock4}
                label={t("doctor.stats.inQueue", "In Queue")}
                value={upcoming}
                sub="Waiting now"
                tone="primary"
                onPress={() => router.push("/queue" as any)}
              />
              <StatTile
                icon={FileText}
                label={t("doctor.stats.rxWritten", "Rx Written")}
                value={rxCount}
                sub="Issued"
                tone="info"
                onPress={() => router.push("/(doctor)/prescriptions" as any)}
              />
              <StatTile
                icon={Edit3}
                label={t("doctor.stats.notes", "Notes")}
                value={notesCount}
                sub="Recorded"
                tone="accent"
                onPress={() => router.push("/clinical-notes" as any)}
              />
            </View>
          </View>

          {/* Quick Actions 2x2 Grid */}
          <View style={{ gap: spacing.md }}>
            <SectionLabel title={t("doctor.sectionQuickActions", "Quick Actions")} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <QuickTile
                icon={CalendarDays}
                label={t("schedule.title", "Schedule")}
                subtitle={
                  todayCount > 0 ? `${todayCount} visits today` : "View timetable"
                }
                tone="primary"
                badge={todayCount}
                onPress={() => router.push("/schedule" as any)}
              />
              <QuickTile
                icon={Wallet}
                label={t("earnings.title", "Earnings")}
                subtitle="Payouts & billing"
                tone="warning"
                onPress={() => router.push("/earnings" as any)}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <QuickTile
                icon={Inbox}
                label={t("inbox.title", "Messages")}
                subtitle={unreadN > 0 ? `${unreadN} unread` : "No new messages"}
                tone="accent"
                badge={unreadN}
                onPress={() => router.push("/inbox" as any)}
              />
              <QuickTile
                icon={FlaskConical}
                label={t("doctor.tiles.labTitle", "Lab Orders")}
                subtitle={labCount > 0 ? `${labCount} active orders` : "Review tests"}
                tone="info"
                badge={labCount}
                onPress={() => router.push("/lab-orders" as any)}
              />
            </View>
          </View>

          {/* Today's Queue Preview */}
          <View style={{ gap: spacing.md }}>
            <SectionLabel
              title={t("doctor.sectionTodayQueue", "Today's Queue")}
              action={
                queueList.length > 0
                  ? {
                      label: t("doctor.viewAll", "View all"),
                      onPress: () => router.push("/queue" as any),
                    }
                  : undefined
              }
            />
            {isLoading ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={74} radius={radius.xl} />
                <Skeleton height={74} radius={radius.xl} />
              </View>
            ) : isError ? (
              <ErrorState
                title={t("recordDetail.errorTitle", "Couldn't load dashboard")}
                message={t(
                  "recordDetail.errorBody",
                  "Check your connection and try again."
                )}
                actionLabel={t("common.retry", "Retry")}
                onAction={() => refetchDashboard()}
              />
            ) : queueList.length === 0 ? (
              <View
                style={{
                  padding: spacing.xl,
                  borderRadius: 20,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  shadowColor: "#062238",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.03,
                  shadowRadius: 5,
                  elevation: 1,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Clock4 size={24} color={colors.primary} strokeWidth={2} />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    fontFamily: fontFamily.displayBold,
                    color: colors.text,
                  }}
                >
                  {t("doctor.emptyQueueTitle", "Queue is clear")}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    textAlign: "center",
                  }}
                >
                  {t(
                    "doctor.emptyQueueBody",
                    "No patients waiting in queue right now."
                  )}
                </Text>
                <Pressable
                  onPress={() => router.push("/schedule" as any)}
                  style={({ pressed }) => ({
                    marginTop: spacing.xs,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: pressed ? colors.primary : colors.primarySoft,
                  })}
                >
                  {({ pressed }) => (
                    <>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: pressed ? colors.onPrimary : colors.primary,
                        }}
                      >
                        View schedule
                      </Text>
                      <ArrowRight
                        size={12}
                        color={pressed ? colors.onPrimary : colors.primary}
                        strokeWidth={2.5}
                      />
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {queueList.slice(0, 3).map((item: any, idx: number) => (
                  <QueuePreviewRow
                    key={item.id ?? `q-${idx}`}
                    item={item}
                    index={idx}
                    onPress={() =>
                      router.push({
                        pathname: "/patient-detail" as any,
                        params: { id: item.patientId },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </View>

          {/* Quick Links */}
          <View style={{ gap: spacing.md }}>
            <SectionLabel title={t("doctor.sectionQuickLinks", "Management & Records")} />
            <View
              style={{
                borderRadius: 22,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
                shadowColor: "#062238",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
                elevation: 2,
              }}
            >
              <LinkTile
                icon={FileText}
                title={t("doctor.tiles.rxTitle", "Prescriptions Hub")}
                subtitle={t("doctor.tiles.rxSubtitle", {
                  count: rxCount,
                  defaultValue: `${rxCount} prescriptions written`,
                })}
                tone="info"
                onPress={() => router.push("/(doctor)/prescriptions" as any)}
              />
              <LinkTile
                icon={CalendarClock}
                title={t("doctor.tiles.followTitle", "Follow-up Requests")}
                subtitle={t("doctor.tiles.followSubtitle", {
                  count: followCount,
                  defaultValue: `${followCount} scheduled`,
                })}
                tone="accent"
                onPress={() => router.push("/follow-ups" as any)}
              />
              <LinkTile
                icon={ClipboardList}
                title={t("doctor.tiles.hoursTitle", "Working Hours & Schedule")}
                subtitle={t(
                  "doctor.tiles.hoursSubtitle",
                  "Manage shifts and clinic availability"
                )}
                tone="warning"
                onPress={() => router.push("/availability" as any)}
              />
              <LinkTile
                icon={Users}
                title={t("careTeam.title", "My Care Team")}
                subtitle={t("careTeam.doctorSubtitle", {
                  count: totalPatients,
                  defaultValue: `${totalPatients} patients assigned`,
                })}
                tone="primary"
                onPress={() => router.push("/care-team" as any)}
              />
              <LinkTile
                icon={Stethoscope}
                title={t("doctor.tiles.recordsTitle", "Patient Consent & Records")}
                subtitle={t("doctor.tiles.recordsSubtitle", {
                  count: consentsCount,
                  defaultValue: `${consentsCount} consents granted`,
                })}
                tone="success"
                last
                onPress={() => router.push("/records-v2" as any)}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

/* ─── Elevated Sub-components ────────────────────────────────────── */

function HeroMetric({
  icon: Icon,
  value,
  label,
  highlight,
  onPress,
}: {
  icon: any;
  value: number;
  label: string;
  highlight?: boolean;
  onPress?: () => void;
}) {
  const { fontFamily } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon
          size={14}
          color={highlight ? "#FCD34D" : "rgba(255,255,255,0.8)"}
          strokeWidth={2.4}
        />
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 18,
            lineHeight: 22,
            fontWeight: "800",
            fontFamily: fontFamily.displayBold,
          }}
        >
          {value}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 11,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HeroDivider() {
  return (
    <View
      style={{
        width: StyleSheet.hairlineWidth,
        marginVertical: 4,
        backgroundColor: "rgba(255,255,255,0.25)",
      }}
    />
  );
}

function SectionLabel({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors, typography, spacing, fontFamily } = useTheme();
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
        style={{
          flex: 1,
          fontSize: 17,
          lineHeight: 22,
          fontWeight: "800",
          letterSpacing: -0.3,
          color: colors.text,
          fontFamily: fontFamily.displayBold,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={action.label}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: colors.primarySoft,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: colors.primary,
            }}
          >
            {action.label}
          </Text>
          <ChevronRight size={13} color={colors.primary} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickTile({
  icon: Icon,
  label,
  subtitle,
  tone,
  badge,
  onPress,
}: {
  icon: React.ComponentType<any>;
  label: string;
  subtitle?: string;
  tone: Tone;
  badge?: number;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography, shadow, fontFamily } = useTheme();
  const palette = useTone(tone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        padding: spacing.lg,
        borderRadius: 22,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: pressed ? palette.fg : colors.border,
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        minHeight: 128,
        justifyContent: "space-between",
        shadowColor: "#062238",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: palette.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={21} color={palette.fg} strokeWidth={2.2} />
        </View>
        {badge !== undefined && badge > 0 ? (
          <View
            style={{
              minWidth: 24,
              height: 24,
              paddingHorizontal: 7,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.fg,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 11,
                fontWeight: "800",
              }}
            >
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{
          marginTop: spacing.lg,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: colors.text,
              fontFamily: fontFamily.displayBold,
              letterSpacing: -0.2,
            }}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                color: colors.textMuted,
                fontWeight: "500",
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.bg,
          }}
        >
          <ChevronRight size={14} color={palette.fg} strokeWidth={2.6} />
        </View>
      </View>
    </Pressable>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
  onPress,
}: {
  icon: any;
  label: string;
  value: number | string;
  sub?: string;
  tone?: "primary" | "info" | "accent" | "warning" | "success";
  onPress?: () => void;
}) {
  const { colors, spacing, radius, fontFamily } = useTheme();
  const tones: Record<string, { bg: string; fg: string; border: string }> = {
    primary: {
      bg: "rgba(14, 165, 233, 0.08)",
      fg: "#0284C7",
      border: "rgba(14, 165, 233, 0.18)",
    },
    info: {
      bg: "rgba(99, 102, 241, 0.08)",
      fg: "#4F46E5",
      border: "rgba(99, 102, 241, 0.18)",
    },
    accent: {
      bg: "rgba(16, 185, 129, 0.08)",
      fg: "#059669",
      border: "rgba(16, 185, 129, 0.18)",
    },
    warning: {
      bg: "rgba(245, 158, 11, 0.08)",
      fg: "#D97706",
      border: "rgba(245, 158, 11, 0.18)",
    },
    success: {
      bg: "rgba(16, 185, 129, 0.08)",
      fg: "#10B981",
      border: "rgba(16, 185, 129, 0.18)",
    },
  };
  const tn = tones[tone] ?? tones.primary;

  const Body = (
    <View
      style={{
        flex: 1,
        minHeight: 118,
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "space-between",
        overflow: "hidden",
        shadowColor: "#062238",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: spacing.md,
          right: spacing.md,
          height: 3,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          backgroundColor: tn.fg,
          opacity: 0.85,
        }}
      />
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: tn.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={17} color={tn.fg} strokeWidth={2.3} />
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <Text
          style={{
            fontSize: 28,
            lineHeight: 32,
            fontWeight: "800",
            color: colors.text,
            fontFamily: fontFamily.displayBold,
            letterSpacing: -0.6,
          }}
        >
          {value}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: colors.text,
            marginTop: 2,
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              fontWeight: "500",
              color: colors.textMuted,
              marginTop: 1,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return Body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        opacity: pressed ? 0.88 : 1,
      })}
    >
      {Body}
    </Pressable>
  );
}

function QueuePreviewRow({
  item,
  index,
  onPress,
}: {
  item: any;
  index: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, fontFamily } = useTheme();

  const isVideo = item.mode === "video";
  const statusLabel =
    item.status === "in_progress"
      ? t("doctor.patientInProgress", "In Progress")
      : item.status === "completed"
        ? t("doctor.patientCompleted", "Completed")
        : t("doctor.patientWaiting", "Waiting");

  const statusTone: "warning" | "success" | "primary" =
    item.status === "in_progress"
      ? "warning"
      : item.status === "completed"
        ? "success"
        : "primary";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.99 : 1 }],
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          padding: spacing.md,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          shadowColor: "#062238",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 5,
          elevation: 1,
        }}
      >
        <Avatar
          name={item.patientName || "Patient"}
          size="md"
          tone="primary"
        />

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: colors.text,
                fontFamily: fontFamily.displayBold,
                flex: 1,
              }}
            >
              {item.patientName || "Patient"}
            </Text>
            {isVideo ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: "rgba(16, 185, 129, 0.10)",
                }}
              >
                <Video size={10} color="#059669" />
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#059669" }}>
                  Video
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: colors.textMuted,
            }}
          >
            {item.reason || item.notes || "Regular consultation"}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Pill label={statusLabel} tone={statusTone} size="sm" />
          <Text style={{ fontSize: 10, color: colors.textSubtle, fontWeight: "700" }}>
            Queue #{item.queueNumber ?? index + 1}
          </Text>
        </View>

        <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

function LinkTile({
  icon: Icon,
  title,
  subtitle,
  tone = "primary",
  last,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  tone?: Tone;
  last?: boolean;
  onPress: () => void;
}) {
  const { spacing, colors, fontFamily } = useTheme();
  const palette = useTone(tone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
      })}
    >
      <View
        style={{
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        {!last ? (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              left: spacing.lg + 42 + spacing.md,
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.border,
            }}
          />
        ) : null}
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            backgroundColor: palette.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} color={palette.fg} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: colors.text,
              fontFamily: fontFamily.displayBold,
            }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: colors.textMuted,
            }}
          >
            {subtitle}
          </Text>
        </View>
        <ChevronRight size={17} color={colors.textSubtle} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}
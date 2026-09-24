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
  const { spacing, colors, typography, radius, fontFamily, layout, shadow, scheme } =
    useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.separator;
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
              accessibilityLabel={t("doctor.viewProfileA11y", { defaultValue: "View doctor profile" })}
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
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderCurve: "continuous",
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: hairline,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.primary, fontFamily: fontFamily.displayBold },
                    ]}
                  >
                    {doctorInitials}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    numberOfLines={1}
                    style={[typography.title.md, { color: colors.text }]}
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
                    <Text style={[typography.overline, { fontSize: 9, lineHeight: 12, color: colors.primary }]}>
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
                width: 40,
                height: 40,
                borderRadius: 20,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.fillStrong : colors.fill,
              })}
            >
              <Bell size={19} color={colors.text} strokeWidth={2} />
              {unreadN > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 9,
                    minWidth: 9,
                    height: 9,
                    borderRadius: 4.5,
                    backgroundColor: colors.danger,
                    borderWidth: 1.5,
                    borderColor: colors.bg,
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
                style={[
                  typography.overline,
                  { color: colors.textSubtle, textTransform: "uppercase" },
                ]}
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
            borderCurve: "continuous",
            overflow: "hidden",
            padding: spacing.xl,
            paddingBottom: spacing.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.22)",
            ...(isDark ? {} : shadow.hero),
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
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.28)",
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
                accessibilityLabel={t("doctor.todayAppointmentsA11y", {
                  count: todayCount,
                })}
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
              borderCurve: "continuous",
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.24)",
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
                sub={t("doctor.statsSub.waiting")}
                tone="primary"
                onPress={() => router.push("/queue" as any)}
              />
              <StatTile
                icon={FileText}
                label={t("doctor.stats.rxWritten", "Rx Written")}
                value={rxCount}
                sub={t("doctor.statsSub.issued")}
                tone="info"
                onPress={() => router.push("/(doctor)/prescriptions" as any)}
              />
              <StatTile
                icon={Edit3}
                label={t("doctor.stats.notes", "Notes")}
                value={notesCount}
                sub={t("doctor.statsSub.recorded")}
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
                  todayCount > 0
                    ? t("doctor.tiles.scheduleSubtitleCount", { count: todayCount })
                    : t("doctor.tiles.scheduleSubtitleEmpty")
                }
                tone="primary"
                badge={todayCount}
                onPress={() => router.push("/schedule" as any)}
              />
              <QuickTile
                icon={Wallet}
                label={t("earnings.title", "Earnings")}
                subtitle={t("doctor.tiles.earningsSubtitle")}
                tone="warning"
                onPress={() => router.push("/earnings" as any)}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <QuickTile
                icon={Inbox}
                label={t("inbox.title", "Messages")}
                subtitle={
                  unreadN > 0
                    ? t("doctor.tiles.inboxSubtitleCount", { count: unreadN })
                    : t("doctor.tiles.inboxSubtitleEmpty")
                }
                tone="accent"
                badge={unreadN}
                onPress={() => router.push("/inbox" as any)}
              />
              <QuickTile
                icon={FlaskConical}
                label={t("doctor.tiles.labTitle", "Lab Orders")}
                subtitle={
                  labCount > 0
                    ? t("doctor.tiles.labSubtitleCount", { count: labCount })
                    : t("doctor.tiles.labSubtitleEmpty")
                }
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
                  paddingVertical: spacing.xxl,
                  paddingHorizontal: spacing.xl,
                  borderRadius: radius.card,
                  borderCurve: "continuous",
                  backgroundColor: colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: hairline,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  ...(isDark ? {} : shadow.sm),
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: spacing.xs,
                  }}
                >
                  <CheckCircle2 size={26} color={colors.primary} strokeWidth={2} />
                </View>
                <Text style={[typography.title.md, { color: colors.text }]}>
                  {t("doctor.emptyQueueTitle", "Queue is clear")}
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, textAlign: "center", maxWidth: 260 },
                  ]}
                >
                  {t(
                    "doctor.emptyQueueBody",
                    "No patients waiting in queue right now."
                  )}
                </Text>
                <Pressable
                  onPress={() => router.push("/schedule" as any)}
                  style={({ pressed }) => ({
                    marginTop: spacing.sm,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    height: 36,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderCurve: "continuous",
                    backgroundColor: pressed ? colors.primary : colors.primarySoft,
                  })}
                >
                  {({ pressed }) => (
                    <>
                      <Text
                        style={[
                          typography.label.md,
                          { color: pressed ? colors.onPrimary : colors.primary },
                        ]}
                      >
                        {t("doctor.viewSchedule")}
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
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: hairline,
                overflow: "hidden",
                ...(isDark ? {} : shadow.sm),
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
        style={[typography.title.lg, { flex: 1, color: colors.text }]}
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
            gap: 1,
            paddingVertical: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={[typography.label.lg, { color: colors.primary }]}>
            {action.label}
          </Text>
          <ChevronRight size={16} color={colors.primary} strokeWidth={2.4} />
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
  const { colors, spacing, radius, typography, shadow, scheme } = useTheme();
  const palette = useTone(tone);
  const isDark = scheme === "dark";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        padding: spacing.lg,
        borderRadius: radius.card,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.separator,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        minHeight: 132,
        justifyContent: "space-between",
        ...(isDark ? {} : shadow.sm),
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
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: "continuous",
            backgroundColor: palette.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} color={palette.fg} strokeWidth={2.2} />
        </View>
        {badge !== undefined && badge > 0 ? (
          <View
            style={{
              minWidth: 22,
              height: 22,
              paddingHorizontal: 7,
              borderRadius: 11,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.bg,
            }}
          >
            <Text style={[typography.label.xs, { color: palette.fg }]}>
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
            style={[typography.title.md, { color: colors.text }]}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[typography.caption, { color: colors.textMuted }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
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
  const { colors, spacing, radius, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const tn = useTone(tone);

  const Body = (
    <View
      style={{
        flex: 1,
        minHeight: 124,
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: spacing.md + 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.separator,
        justifyContent: "space-between",
        overflow: "hidden",
        ...(isDark ? {} : shadow.sm),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            borderCurve: "continuous",
            backgroundColor: tn.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={13} color={tn.fg} strokeWidth={2.5} />
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[typography.label.sm, { flex: 1, color: tn.fg }]}
        >
          {label}
        </Text>
      </View>
      <View style={{ marginTop: spacing.md }}>
        <Text
          style={[
            typography.display.md,
            {
              fontSize: 32,
              lineHeight: 36,
              letterSpacing: -1.1,
              color: colors.text,
              fontVariant: ["tabular-nums"],
            },
          ]}
        >
          {value}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={[typography.caption, { color: colors.textSubtle, marginTop: 2 }]}
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
        opacity: pressed ? 0.9 : 1,
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
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";

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
  const stn = useTone(statusTone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.99 : 1 }],
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          paddingVertical: spacing.md,
          paddingLeft: spacing.md + 4,
          paddingRight: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? colors.borderStrong : colors.separator,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          overflow: "hidden",
          ...(isDark ? {} : shadow.xs),
        }}
      >
        {/* timeline accent rail */}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: spacing.md,
            bottom: spacing.md,
            width: 3,
            borderTopRightRadius: 3,
            borderBottomRightRadius: 3,
            backgroundColor: stn.fg,
          }}
        />
        <Avatar
          name={item.patientName || t("doctor.patientFallback")}
          size="md"
          tone="primary"
        />

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}
            >
              {item.patientName || t("doctor.patientFallback")}
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
                  borderCurve: "continuous",
                  backgroundColor: colors.successSoft,
                }}
              >
                <Video size={10} color={colors.success} />
                <Text style={[typography.label.xs, { fontSize: 10, color: colors.success }]}>
                  {t("doctor.video")}
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            numberOfLines={1}
            style={[typography.body.sm, { color: colors.textMuted }]}
          >
            {item.reason || item.notes || t("doctor.regularConsultation")}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Pill label={statusLabel} tone={statusTone} size="sm" />
          <Text
            style={[
              typography.label.xs,
              { color: colors.textSubtle, fontVariant: ["tabular-nums"] },
            ]}
          >
            {t("doctor.queueNumber", {
              number: item.queueNumber ?? index + 1,
            })}
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
  const { spacing, colors, typography } = useTheme();
  const palette = useTone(tone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <View
        style={{
          minHeight: 60,
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
              left: spacing.lg + 32 + spacing.md,
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.separator,
            }}
          />
        ) : null}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            borderCurve: "continuous",
            backgroundColor: palette.bgStrong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={17} color={palette.onBgStrong} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text
            numberOfLines={1}
            style={[typography.title.sm, { color: colors.text }]}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[typography.body.sm, { color: colors.textMuted }]}
          >
            {subtitle}
          </Text>
        </View>
        <ChevronRight size={17} color={colors.textSubtle} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

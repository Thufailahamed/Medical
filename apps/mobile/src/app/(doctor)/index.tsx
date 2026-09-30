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
  Sparkles,
  ArrowRight,
  ArrowUpRight,
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
  IconButton,
  IconTile,
  SectionHeader,
  Pressable as Touchable,
} from "@/components/ui";
import { TenantSwitcher } from "@/components/TenantSwitcher";

export default function DoctorHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, fontFamily, layout, shadow, scheme } =
    useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.hairline;
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
    const cleaned = displayName.replace(/^dr\.?\s+/i, "").trim();
    if (!cleaned || /^(dr\.?|doctor)$/i.test(cleaned)) return "DR";
    const parts = cleaned.split(/\s+/);
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
            paddingBottom: spacing.md,
            gap: spacing.md,
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
                gap: spacing.md,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={isDark ? null : shadow.sm}>
                <LinearGradient
                  colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 48, height: 48, borderRadius: 24, padding: 2 }}
                >
                  {userPhoto ? (
                    <Image
                      source={{ uri: userPhoto }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: colors.surfaceMuted,
                        borderWidth: 2,
                        borderColor: colors.bg,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: colors.primarySoft,
                        borderWidth: 2,
                        borderColor: colors.bg,
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
                </LinearGradient>
                {verified ? (
                  <View
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: colors.bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <BadgeCheck size={15} color={colors.primary} strokeWidth={2.4} />
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={[typography.caption, { color: colors.textMuted }]}
                >
                  {greeting}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fontFamily.displayBold,
                    fontSize: 22,
                    lineHeight: 27,
                    letterSpacing: -0.5,
                    color: colors.text,
                  }}
                >
                  {heroName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[typography.caption, { color: colors.textSubtle }]}
                >
                  {specialization || t("doctorProfile.generalPractice", "General Practice")}
                </Text>
              </View>
            </Pressable>

            {/* Notification Bell */}
            <IconButton
              icon={Bell}
              variant="surface"
              badge={unreadN}
              onPress={() => router.push("/(doctor)/notifications" as any)}
              accessibilityLabel={t("doctor.notificationsA11y", "Notifications")}
            />
          </View>

          {/* Workspace — renders nothing when the doctor has no memberships */}
          <TenantSwitcher variant="chip" />
        </View>

        {/* ─── Hero Card ──────────────────────────────────────────── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
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
          {/* Material sheen — lit top-left falling off to the base */}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0)", "rgba(94,234,212,0.10)"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -70,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: 100,
              borderWidth: 28,
              borderColor: "rgba(255,255,255,0.05)",
            }}
          />

          {/* Date + duty status */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.sm,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                color: "rgba(255,255,255,0.72)",
                fontSize: 11,
                letterSpacing: 1.2,
                fontFamily: fontFamily.displayBold,
                textTransform: "uppercase",
              }}
            >
              {headerDate}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "rgba(52,211,153,0.16)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(52,211,153,0.45)",
              }}
            >
              <View
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#34D399" }}
              />
              <Text
                style={{ color: "#D1FAE5", fontSize: 11.5, fontFamily: fontFamily.bodyBold }}
              >
                {t("doctor.onDuty", "On duty")}
              </Text>
            </View>
          </View>

          {/* Headline — today's workload */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.md }}>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 52,
                lineHeight: 56,
                letterSpacing: -2,
                fontFamily: fontFamily.heavy ?? fontFamily.displayBold,
                fontVariant: ["tabular-nums"],
              }}
            >
              {todayCount}
            </Text>
            <View style={{ flex: 1, paddingBottom: 8 }}>
              <Text
                numberOfLines={1}
                style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 20, fontFamily: fontFamily.bodyBold }}
              >
                {t("doctor.heroApptLabel", { count: todayCount })}
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 17, fontFamily: fontFamily.body }}
              >
                {upcoming > 0
                  ? t("doctor.heroWaiting", { count: upcoming })
                  : t("doctor.heroQueueClear", "No one waiting right now")}
              </Text>
            </View>
          </View>

          {/* Primary actions */}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            <HeroButton
              primary
              icon={Clock4}
              label={t("doctor.openQueue", "Open queue")}
              badge={upcoming}
              onPress={() => router.push("/queue" as any)}
            />
            <HeroButton
              icon={CalendarDays}
              label={t("schedule.title", "Schedule")}
              onPress={() => router.push("/schedule" as any)}
            />
          </View>

          {/* Hero Metrics Strip */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              marginTop: spacing.lg,
              paddingTop: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: "rgba(255,255,255,0.18)",
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
          {/* Quick Actions — 4-up launcher */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader kicker={t("doctor.kicker.workspace", "Workspace")} title={t("doctor.sectionQuickActions", "Quick Actions")} style={{ paddingTop: 0, paddingBottom: 0 }} />
            <View
              style={{
                flexDirection: "row",
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.xs,
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: hairline,
                ...(isDark ? {} : shadow.card),
              }}
            >
              <QuickTile
                icon={FileText}
                label={t("doctor.tiles.prescribeShort", "Prescribe")}
                tone="primary"
                onPress={() => router.push("/prescription" as any)}
              />
              <QuickTile
                icon={Inbox}
                label={t("inbox.title", "Messages")}
                tone="accent"
                badge={unreadN}
                onPress={() => router.push("/inbox" as any)}
              />
              <QuickTile
                icon={FlaskConical}
                label={t("doctor.tiles.labShort", "Labs")}
                tone="info"
                badge={labCount}
                onPress={() => router.push("/lab-orders" as any)}
              />
              <QuickTile
                icon={Wallet}
                label={t("earnings.title", "Earnings")}
                tone="warning"
                onPress={() => router.push("/earnings" as any)}
              />
            </View>
          </View>

          {/* Today's Pulse */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader kicker={t("doctor.kicker.today", "Live")} title={t("doctor.statsStrip.label", "Today's Pulse")} style={{ paddingTop: 0, paddingBottom: 0 }} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <StatTile
                icon={Clock4}
                label={t("doctor.stats.inQueue", "In queue")}
                value={upcoming}
                tone="primary"
                live={upcoming > 0}
                onPress={() => router.push("/queue" as any)}
              />
              <StatTile
                icon={FileText}
                label={t("doctor.stats.rxWritten", "Rx written")}
                value={rxCount}
                tone="accent"
                onPress={() => router.push("/(doctor)/prescriptions" as any)}
              />
              <StatTile
                icon={Edit3}
                label={t("doctor.stats.notes", "Notes")}
                value={notesCount}
                tone="accent2"
                onPress={() => router.push("/clinical-notes" as any)}
              />
            </View>
          </View>

          {/* Today's Queue Preview */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              kicker={t("doctor.kicker.patients", "Patients")}
              title={t("doctor.sectionTodayQueue", "Today's Queue")}
              count={queueList.length > 0 ? queueList.length : undefined}
              style={{ paddingTop: 0, paddingBottom: 0 }}
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
                  ...(isDark ? {} : shadow.card),
                }}
              >
                <IconTile
                  icon={CheckCircle2}
                  tone="success"
                  appearance="solid"
                  size={56}
                  style={{ marginBottom: spacing.xs }}
                />
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
            <SectionHeader kicker={t("doctor.kicker.practice", "Practice")} title={t("doctor.sectionQuickLinks", "Management & Records")} style={{ paddingTop: 0, paddingBottom: 0 }} />
            <View
              style={{
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: hairline,
                paddingVertical: 4,
                ...(isDark ? {} : shadow.card),
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

function HeroButton({
  icon: Icon,
  label,
  primary,
  badge,
  onPress,
}: {
  icon: any;
  label: string;
  primary?: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const { fontFamily } = useTheme();
  const fg = primary ? "#0A4874" : "#FFFFFF";
  return (
    <Touchable
      onPress={onPress}
      haptic="light"
      pressedScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      wrapperStyle={{ flex: 1 }}
      style={{
        height: 46,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: primary ? "#FFFFFF" : "rgba(255,255,255,0.14)",
        borderWidth: primary ? 0 : StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.3)",
      }}
    >
      <Icon size={17} color={fg} strokeWidth={2.4} />
      <Text numberOfLines={1} style={{ color: fg, fontSize: 14.5, fontFamily: fontFamily.bodyBold }}>
        {label}
      </Text>
      {badge ? (
        <View
          style={{
            minWidth: 20,
            height: 20,
            paddingHorizontal: 6,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0A4874",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontFamily: fontFamily.bodyBold }}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Touchable>
  );
}

function QuickTile({
  icon: Icon,
  label,
  tone,
  badge,
  onPress,
}: {
  icon: any;
  label: string;
  tone: Tone;
  badge?: number;
  onPress: () => void;
}) {
  const { colors, typography } = useTheme();

  return (
    <Touchable
      onPress={onPress}
      haptic="light"
      pressedScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      wrapperStyle={{ flex: 1 }}
      style={{ alignItems: "center", gap: 8 }}
    >
      <View>
        <IconTile icon={Icon} tone={tone} appearance="solid" size={52} />
        {badge !== undefined && badge > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -5,
              right: -7,
              minWidth: 20,
              height: 20,
              paddingHorizontal: 5,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.danger,
              borderWidth: 2,
              borderColor: colors.surface,
            }}
          >
            <Text style={[typography.label.xs, { fontSize: 10, color: "#FFFFFF" }]}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[typography.label.md, { color: colors.text, textAlign: "center" }]}
      >
        {label}
      </Text>
    </Touchable>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "primary",
  live,
  onPress,
}: {
  icon: any;
  label: string;
  value: number | string;
  tone?: Tone;
  /** Shows a live dot beside the value (e.g. patients waiting). */
  live?: boolean;
  onPress?: () => void;
}) {
  const { colors, spacing, typography, fontFamily, radius, shadow, scheme } = useTheme();
  const palette = useTone(tone);
  const isDark = scheme === "dark";

  return (
    <Touchable
      onPress={onPress}
      disabled={!onPress}
      haptic="light"
      pressedScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      wrapperStyle={[{ flex: 1 }, isDark ? null : [shadow.card, { borderRadius: radius.xl }]]}
      style={{
        padding: spacing.md,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.hairline,
        overflow: "hidden",
      }}
    >
      {/* Tone accent bar */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: spacing.md,
          width: 22,
          height: 3,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
          backgroundColor: palette.fg,
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.bg,
          }}
        >
          <Icon size={14} color={palette.fg} strokeWidth={2.4} />
        </View>
        {live ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.success,
              borderWidth: 2,
              borderColor: colors.successSoft,
            }}
          />
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: fontFamily.heavy,
          fontSize: 26,
          lineHeight: 30,
          letterSpacing: -1,
          color: colors.text,
          marginTop: spacing.sm,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[typography.caption, { color: colors.textMuted }]}
      >
        {label}
      </Text>
    </Touchable>
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
  const { colors, spacing, typography, radius, shadow, scheme, fontFamily } = useTheme();
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

  return (
    <Touchable
      onPress={onPress}
      haptic="light"
      pressedScale={0.98}
      pressedOpacity={0.96}
      accessibilityRole="button"
      accessibilityLabel={`${item.patientName || t("doctor.patientFallback")}, ${statusLabel}`}
      wrapperStyle={isDark ? null : [shadow.card, { borderRadius: radius.xl }]}
    >
      <View
        style={{
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? colors.borderStrong : colors.hairline,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          overflow: "hidden",
        }}
      >
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
            style={{
              fontFamily: fontFamily.mono,
              fontSize: 11.5,
              letterSpacing: 0.2,
              color: colors.textSubtle,
              fontVariant: ["tabular-nums"],
            }}
          >
            {t("doctor.queueNumber", {
              number: item.queueNumber ?? index + 1,
            })}
          </Text>
        </View>

        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.well,
          }}
        >
          <ChevronRight size={15} color={colors.textMuted} strokeWidth={2.5} />
        </View>
      </View>
    </Touchable>
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
        marginHorizontal: 6,
        borderRadius: 16,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <View
        style={{
          minHeight: 62,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg - 6,
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
              left: spacing.lg - 6 + 34 + spacing.md,
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.separator,
            }}
          />
        ) : null}
        <IconTile icon={Icon} tone={tone} appearance="solid" size={34} />
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
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.well,
          }}
        >
          <ChevronRight size={15} color={colors.textMuted} strokeWidth={2.5} />
        </View>
      </View>
    </Pressable>
  );
}

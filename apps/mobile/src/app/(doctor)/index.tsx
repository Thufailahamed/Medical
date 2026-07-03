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
import {
  Bell,
  Clock4,
  Search,
  ChevronRight,
  FileText,
  Edit3,
  UserRound,
  FlaskConical,
  CalendarClock,
  ClipboardList,
  Stethoscope,
  Users,
  Plus,
  Activity,
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
  DoseRing,
} from "@/components/ui";

export default function DoctorHub() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, fontFamily, layout, shadow } =
    useTheme();
  const user = useAuthStore((s) => s.user);

  const {
    data: dashboard,
    isLoading,
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

  useFocusEffect(
    useCallback(() => {
      refetchDashboard();
      refetchQueue();
      refetchRx();
      refetchNotes();
      refetchLabs();
      refetchFollows();
      refetchUnread();
    }, [
      refetchDashboard,
      refetchQueue,
      refetchRx,
      refetchNotes,
      refetchLabs,
      refetchFollows,
      refetchUnread,
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

  const firstName = user?.name?.split(" ")[0] || t("doctor.welcomeFallback");
  const userPhoto = doctorData?.doctor?.users?.photo;
  const userName = user?.name || "";
  const specialization = doctorData?.doctor?.doctors?.specialization;

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("doctor.greeting.morning")
      : hour < 17
        ? t("doctor.greeting.afternoon")
        : t("doctor.greeting.evening");

  const headerDate = (() => {
    const d = new Date();
    const weekday = d
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase();
    const day = d.getDate();
    const month = d
      .toLocaleDateString("en-US", { month: "short" })
      .toUpperCase();
    return `${greeting.toUpperCase()} · ${weekday} ${day} ${month}`;
  })();

  const refetchAll = () => {
    refetchDashboard();
    refetchQueue();
    refetchRx();
    refetchNotes();
    refetchLabs();
    refetchFollows();
    refetchUnread();
  };

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
    <Screen
      padded={false}
      edges={["top"]}
      tabBarOffset={false}
      bottomInset={false}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetchAll}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{
          paddingBottom: layout.tabBarHeight + spacing.lg,
        }}
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
          }}
        >
          <Pressable onPress={() => router.push("/doctor/profile" as any)}>
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
          </Pressable>

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                style={[
                  typography.title.lg,
                  {
                    color: colors.primary,
                    fontWeight: "800",
                    fontSize: 22,
                    fontFamily: fontFamily.displayBold,
                  },
                ]}
              >
                {t("doctor.brand")}
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
            {specialization ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: -1 },
                ]}
              >
                {specialization}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Pressable
              onPress={() => router.push("/notifications" as any)}
              accessibilityRole="button"
              accessibilityLabel={t("doctor.notificationsA11y")}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
                backgroundColor: pressed
                  ? colors.surfaceMuted
                  : "transparent",
              })}
            >
              <Bell size={24} color={colors.primary} strokeWidth={2} />
              {unreadN > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.danger || "#FF3B30",
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* ─── Sky hero ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            borderRadius: radius.xxl,
            overflow: "hidden",
            padding: spacing.xl,
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
          }}
        >
          <LinearGradient
            colors={["#0B2B64", "#0C8B8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Decorative orbs */}
          <View
            style={{
              position: "absolute",
              top: -40,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: "rgba(255, 255, 255, 0.07)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -60,
              left: -40,
              width: 160,
              height: 160,
              borderRadius: 80,
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
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[
                  typography.overline,
                  {
                    color: "rgba(255,255,255,0.75)",
                    letterSpacing: 1.2,
                    fontFamily: fontFamily.displayBold,
                  },
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
                    fontSize: 36,
                    lineHeight: 42,
                    letterSpacing: -0.6,
                    fontWeight: "800",
                    marginTop: 4,
                    fontFamily: fontFamily.displayBold,
                  },
                ]}
              >
                Dr. {firstName}
              </Text>

              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.8)",
                  fontSize: 14,
                  lineHeight: 20,
                  marginTop: 8,
                  fontFamily: fontFamily.body,
                }}
              >
                {t("doctor.heroPatients", { count: totalPatients })}
              </Text>
            </View>

            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <DoseRing
                value={todayCount > 0 ? Math.min(todayCount / 10, 1) : 0}
                size={96}
                tone="primary"
                label={`${todayCount}`}
                sublabel={t("doctor.todayAppointments")}
                centerColor="rgba(255, 255, 255, 0.08)"
              />
            </View>
          </View>

          {/* Glass chips */}
          <View
            style={{
              flexDirection: "row",
              gap: spacing.xs,
              marginTop: spacing.lg,
              flexWrap: "wrap",
            }}
          >
            <HeroChip label={t("doctor.heroChipQueue", { count: upcoming })} />
            <HeroChip
              label={t("doctor.heroChipPatients", { count: totalPatients })}
            />
            <HeroChip
              label={
                unreadN > 0
                  ? t("doctor.heroChipAlerts", { count: unreadN })
                  : t("doctor.heroChipNoAlerts")
              }
              dot={unreadN === 0}
            />
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
          {/* Quick Actions 2x2 Grid */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title={t("doctor.sectionQuickActions")} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <QuickTile
                icon={Clock4}
                label={t("doctor.tiles.queueTitle")}
                tone="primary"
                onPress={() => router.push("/doctor/queue" as any)}
              />
              <QuickTile
                icon={Search}
                label={t("doctor.tiles.searchTitle")}
                tone="warning"
                onPress={() => router.push("/doctor/prescription" as any)}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <QuickTile
                icon={Edit3}
                label={t("doctor.tiles.notesTitle")}
                tone="accent"
                onPress={() => router.push("/doctor/clinical-notes" as any)}
              />
              <QuickTile
                icon={FlaskConical}
                label={t("doctor.tiles.labTitle")}
                tone="info"
                onPress={() => router.push("/doctor/lab-orders" as any)}
              />
            </View>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <StatBlock
              icon={Clock4}
              label={t("doctor.stats.inQueue")}
              value={upcoming}
              tone="primary"
            />
            <StatBlock
              icon={FileText}
              label={t("doctor.stats.rxWritten")}
              value={rxCount}
              tone="info"
            />
            <StatBlock
              icon={Edit3}
              label={t("doctor.stats.notes")}
              value={notesCount}
              tone="accent"
            />
          </View>

          {/* Today's Queue Preview */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel
              title={t("doctor.sectionTodayQueue")}
              action={
                queueList.length > 0
                  ? {
                      label: t("doctor.viewAll"),
                      onPress: () => router.push("/doctor/queue" as any),
                    }
                  : undefined
              }
            />
            {isLoading ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={72} radius={radius.xl} />
                <Skeleton height={72} radius={radius.xl} />
              </View>
            ) : queueList.length === 0 ? (
              <EmptyState
                icon={Clock4}
                title={t("doctor.emptyQueueTitle")}
                message={t("doctor.emptyQueueBody")}
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {queueList.slice(0, 3).map((item: any, idx: number) => (
                  <QueuePreviewRow
                    key={item.id ?? `q-${idx}`}
                    item={item}
                    onPress={() =>
                      router.push({
                        pathname: "/doctor/patient-detail" as any,
                        params: { id: item.patientId },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </View>

          {/* Quick Links */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title={t("doctor.sectionQuickLinks")} />
            <View style={{ gap: spacing.sm }}>
              <LinkTile
                icon={FileText}
                title={t("doctor.tiles.rxTitle")}
                subtitle={t("doctor.tiles.rxSubtitle", { count: rxCount })}
                onPress={() => router.push("/doctor/prescriptions" as any)}
              />
              <LinkTile
                icon={CalendarClock}
                title={t("doctor.tiles.followTitle")}
                subtitle={t("doctor.tiles.followSubtitle", {
                  count: followCount,
                })}
                onPress={() => router.push("/doctor/follow-ups" as any)}
              />
              <LinkTile
                icon={ClipboardList}
                title={t("doctor.tiles.hoursTitle")}
                subtitle={t("doctor.tiles.hoursSubtitle")}
                onPress={() => router.push("/doctor/availability" as any)}
              />
              <LinkTile
                icon={Users}
                title={t("doctor.tiles.recordsTitle")}
                subtitle={t("doctor.tiles.recordsSubtitle", {
                  count: rxCount + notesCount + labCount,
                })}
                onPress={() => router.push("/doctor/records" as any)}
              />
            </View>
          </View>

          <View style={{ height: spacing.lg }} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/* ─── Sub-components ─── */

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
              color: colors.text,
              fontWeight: "700",
              flex: 1,
            },
          ]}
        >
          {label}
        </Text>
        <ChevronRight size={14} color={colors.textSubtle} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: any;
  label: string;
  value: number | string;
  tone?: "primary" | "info" | "accent" | "warning" | "success";
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const tones: Record<string, { bg: string; fg: string }> = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    info: { bg: colors.infoSoft, fg: colors.info },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    success: { bg: colors.successSoft, fg: colors.success },
  };
  const tn = tones[tone] ?? tones.primary;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        gap: 4,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: tn.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={tn.fg} strokeWidth={2.25} />
      </View>
      <Text
        style={[
          typography.title.md,
          { color: colors.text, fontWeight: "800" },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.textMuted, textAlign: "center" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function QueuePreviewRow({
  item,
  onPress,
}: {
  item: any;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius } = useTheme();

  const statusLabel =
    item.status === "in_progress"
      ? t("doctor.patientInProgress")
      : item.status === "completed"
        ? t("doctor.patientCompleted")
        : t("doctor.patientWaiting");
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
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Card padded={false}>
        <View
          style={{
            padding: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Avatar
            name={item.patientName || "Patient"}
            size="md"
            tone="primary"
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "700" },
              ]}
            >
              {item.patientName || "Patient"}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                typography.body.sm,
                { color: colors.textMuted, marginTop: 2 },
              ]}
            >
              {item.reason || item.notes || "—"}
            </Text>
          </View>
          <Pill label={statusLabel} tone={statusTone} size="sm" />
        </View>
      </Card>
    </Pressable>
  );
}

function LinkTile({
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
            backgroundColor: colors.primarySoft,
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
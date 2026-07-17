// @ts-nocheck

import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Phone,
  Mail,
  Building2,
  BadgeCheck,
  CalendarClock,
  GraduationCap,
  Briefcase,
  Languages,
  Clock4,
  ChevronRight,
  Edit3,
  FlaskConical,
  CalendarDays,
  FileText,
  Bell,
  Stethoscope,
  LogOut,
  Users,
} from "lucide-react-native";
import {
  useDoctorMe,
  useDoctorQueue,
  useDoctorDashboard,
  useDoctorPrescriptions,
  useDoctorClinicalNotes,
  useLabOrders,
  useFollowUps,
  useUnreadCount,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, Card, Skeleton, ErrorState, Button } from "@/components/ui";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  t,
}: {
  icon: any;
  label: string;
  value?: string | null;
  href?: string;
  t: (k: string, opts?: any) => string;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={colors.textMuted} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, letterSpacing: 0.3 },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            typography.body.md,
            { color: colors.text, fontWeight: "600", marginTop: 1 },
          ]}
          numberOfLines={1}
        >
          {value || "—"}
        </Text>
      </View>
      {href && value ? (
        <Pressable
          onPress={() => Linking.openURL(href).catch(() => {})}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("doctorProfile.openA11y", { label })}
        >
          <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
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
  tone?: "primary" | "info" | "warning" | "success" | "accent";
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const tones: Record<string, { bg: string; fg: string }> = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    info: { bg: colors.infoSoft, fg: colors.info },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    success: { bg: colors.successSoft, fg: colors.success },
    accent: { bg: colors.accentSoft, fg: colors.accent },
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

export default function DoctorProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const { user, logout } = useAuthStore();

  function confirmLogout() {
    Alert.alert(
      t("profile.logout.title"),
      t("profile.logout.body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.logout.confirm"),
          style: "destructive",
          onPress: handleLogout,
        },
      ]
    );
  }

  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    queryClient.clear();
    logout();
    router.replace("/(auth)/login" as any);
  }

  const { data, isLoading, isError, refetch } = useDoctorMe();
  const { data: dashboard } = useDoctorDashboard();
  const { data: queue } = useDoctorQueue();
  const { data: rxData } = useDoctorPrescriptions();
  const { data: notesData } = useDoctorClinicalNotes();
  const { data: labData } = useLabOrders();
  const { data: followData } = useFollowUps({ upcoming: true });
  const { data: unread } = useUnreadCount();

  const doctor = data?.doctor?.doctors;
  const dbUser = data?.doctor?.users;

  const queueCount = useMemo(() => {
    const list = queue?.queue || [];
    return list.filter(
      (q: any) =>
        q.status !== "completed" &&
        q.status !== "cancelled" &&
        q.status !== "no_show"
    ).length;
  }, [queue]);

  const rxCount = rxData?.prescriptions?.length ?? 0;
  const notesCount = notesData?.count ?? notesData?.notes?.length ?? 0;
  const labCount = labData?.orders?.length ?? 0;
  const followCount = followData?.followUps?.length ?? 0;
  const unreadN = unread?.count ?? 0;

  if (isError) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load profile")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      </Screen>
    );
  }

  if (isLoading || !doctor || !dbUser) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.lg }}>
          <Skeleton height={180} radius={24} />
          <Skeleton height={140} radius={20} />
          <Skeleton height={220} radius={20} />
        </View>
      </Screen>
    );
  }

  const initials = (dbUser?.name || t("doctorProfile.initialsFallback"))
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const phoneHref = dbUser?.phone ? `tel:${dbUser.phone}` : undefined;
  const emailHref = dbUser?.email ? `mailto:${dbUser.email}` : undefined;
  const nameFallback = t("doctorProfile.nameFallback");
  const displayName = dbUser?.name || nameFallback;
  const verified = dbUser?.verified;

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset={false} bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 140,
          gap: spacing.lg,
        }}
      >
        {/* ─── Page Header ─── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xs,
          }}
        >
          <Text
            style={[
              typography.display.sm,
              { color: colors.text, fontWeight: "800", letterSpacing: -0.5 },
            ]}
          >
            {t("doctorProfile.title")}
          </Text>
        </View>
        {/* ─── Hero identity card ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
            borderRadius: radius.xxl,
            overflow: "hidden",
            backgroundColor: colors.primarySoft,
            elevation: 4,
            shadowColor: colors.primary,
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
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -50,
              left: -30,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: "rgba(255,255,255,0.05)",
            }}
          />

          <View
            style={{
              padding: spacing.xl,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "800",
                  color: colors.primary,
                  letterSpacing: 0.5,
                }}
              >
                {initials}
              </Text>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "800",
                    color: "#FFFFFF",
                    letterSpacing: -0.3,
                    flexShrink: 1,
                  }}
                  numberOfLines={1}
                >
                  Dr. {displayName}
                </Text>
                {verified ? (
                  <BadgeCheck
                    size={18}
                    color="#FFFFFF"
                    strokeWidth={2.4}
                  />
                ) : null}
              </View>
              <Text
                style={{
                  color: "rgba(255,255,255,0.92)",
                  fontSize: 14,
                  fontWeight: "700",
                  marginTop: 3,
                }}
                numberOfLines={1}
              >
                {doctor.specialization || t("doctorProfile.generalPractice")}
              </Text>
              {doctor.licenseNumber ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 6,
                    backgroundColor: "rgba(255,255,255,0.18)",
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: 999,
                    alignSelf: "flex-start",
                  }}
                >
                  <BadgeCheck size={12} color="#FFFFFF" strokeWidth={2.4} />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 0.4,
                    }}
                    numberOfLines={1}
                  >
                    {t("doctorProfile.slmc", { number: doctor.licenseNumber })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ─── Activity stats row 1 ─── */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text
            style={[
              typography.overline,
              {
                color: colors.textMuted,
                letterSpacing: 1.2,
                paddingHorizontal: spacing.xs,
              },
            ]}
          >
            {t("doctorProfile.sections.activity")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginTop: spacing.sm,
            }}
          >
            <StatBlock
              icon={CalendarDays}
              label={t("doctorProfile.stats.todayQueue")}
              value={queueCount}
              tone="primary"
            />
            <StatBlock
              icon={FlaskConical}
              label={t("doctorProfile.stats.labOrders")}
              value={labCount}
              tone="info"
            />
            <StatBlock
              icon={CalendarClock}
              label={t("doctorProfile.stats.followUps")}
              value={followCount}
              tone="warning"
            />
          </View>
        </View>

        {/* ─── Activity stats row 2 ─── */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <StatBlock
              icon={FileText}
              label={t("doctorProfile.stats.prescriptions")}
              value={rxCount}
              tone="success"
            />
            <StatBlock
              icon={Edit3}
              label={t("doctorProfile.stats.clinicalNotes")}
              value={notesCount}
              tone="accent"
            />
            <StatBlock
              icon={Bell}
              label={t("doctorProfile.stats.unread")}
              value={unreadN}
              tone="warning"
            />
          </View>
        </View>

        {/* ─── Contact card ─── */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card>
            <Text
              style={[
                typography.label.md,
                {
                  color: colors.textMuted,
                  fontWeight: "700",
                  marginBottom: spacing.sm,
                  letterSpacing: 0.6,
                },
              ]}
            >
              {t("doctorProfile.sections.contact")}
            </Text>
            <InfoRow
              icon={Phone}
              label={t("doctorProfile.rows.phone")}
              value={dbUser?.phone}
              href={phoneHref}
              t={t}
            />
            <InfoRow
              icon={Mail}
              label={t("doctorProfile.rows.email")}
              value={dbUser?.email}
              href={emailHref}
              t={t}
            />
          </Card>
        </View>

        {/* ─── Practice card ─── */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card>
            <Text
              style={[
                typography.label.md,
                {
                  color: colors.textMuted,
                  fontWeight: "700",
                  marginBottom: spacing.sm,
                  letterSpacing: 0.6,
                },
              ]}
            >
              {t("doctorProfile.sections.practice")}
            </Text>
            <InfoRow
              icon={Stethoscope}
              label={t("doctorProfile.rows.specialization")}
              value={doctor.specialization}
              t={t}
            />
            <InfoRow
              icon={Briefcase}
              label={t("doctorProfile.rows.years")}
              value={
                doctor.yearsOfExperience != null
                  ? t("doctorProfile.rows.yearsValue", {
                      count: doctor.yearsOfExperience,
                    })
                  : null
              }
              t={t}
            />
            <InfoRow
              icon={GraduationCap}
              label={t("doctorProfile.rows.qualifications")}
              value={doctor.qualifications}
              t={t}
            />
            <InfoRow
              icon={Languages}
              label={t("doctorProfile.rows.languages")}
              value={doctor.languages}
              t={t}
            />
            <InfoRow
              icon={Building2}
              label={t("doctorProfile.rows.hospital")}
              value={doctor.hospitalName}
              t={t}
            />
            <InfoRow
              icon={Clock4}
              label={t("doctorProfile.rows.fee")}
              value={
                doctor.consultationFee != null
                  ? t("doctorProfile.rows.feeValue", {
                      amount: doctor.consultationFee,
                    })
                  : null
              }
              t={t}
            />
          </Card>
        </View>

        {/* ─── Quick links ─── */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <Pressable
            onPress={() => router.push("/availability" as any)}
            accessibilityLabel={t("doctorProfile.editAvailabilityA11y")}
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
                  <CalendarClock
                    size={20}
                    color={colors.primary}
                    strokeWidth={2.25}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "700" },
                    ]}
                  >
                    {t("doctorProfile.availabilityTitle")}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {t("doctorProfile.availabilitySubtitle")}
                  </Text>
                </View>
                <ChevronRight
                  size={18}
                  color={colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
            </Card>
          </Pressable>

          <Pressable
            onPress={() => router.push("/tenants" as any)}
            accessibilityLabel="Manage workspaces"
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
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: "#EFF6FF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Building2
                    size={20}
                    color="#3B82F6"
                    strokeWidth={2.25}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "700" },
                    ]}
                  >
                    Workspaces
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    Manage clinics and hospitals
                  </Text>
                </View>
                <ChevronRight
                  size={18}
                  color={colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
            </Card>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(doctor)/relationships" as any)}
            accessibilityLabel={t("doctorProfile.relationshipsA11y")}
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
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: "rgba(99, 102, 241, 0.14)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Users
                    size={20}
                    color="#6366F1"
                    strokeWidth={2.25}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "700" },
                    ]}
                  >
                    {t("doctorProfile.relationshipsTitle")}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {t("doctorProfile.relationshipsSubtitle")}
                  </Text>
                </View>
                <ChevronRight
                  size={18}
                  color={colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
            </Card>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(doctor)/prescriptions" as any)}
            accessibilityLabel={t("doctorProfile.myRxA11y")}
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
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: "rgba(16, 185, 129, 0.14)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileText size={20} color="#10B981" strokeWidth={2.25} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "700" },
                    ]}
                  >
                    {t("doctorProfile.myRxTitle")}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {t("doctorProfile.myRxSubtitle", { count: rxCount })}
                  </Text>
                </View>
                <ChevronRight
                  size={18}
                  color={colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
            </Card>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(doctor)/notifications" as any)}
            accessibilityLabel={t("doctorProfile.notificationsTitle")}
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
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: colors.warningSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Bell size={20} color={colors.warning} strokeWidth={2.25} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "700" },
                    ]}
                  >
                    {t("doctorProfile.notificationsTitle")}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {unreadN
                      ? t("doctorProfile.notificationsUnread", { count: unreadN })
                      : t("doctorProfile.notificationsCaughtUp")}
                  </Text>
                </View>
                {unreadN ? (
                  <View
                    style={{
                      minWidth: 24,
                      height: 24,
                      paddingHorizontal: 6,
                      borderRadius: 12,
                      backgroundColor: colors.danger,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: "#fff",
                      }}
                    >
                      {unreadN}
                    </Text>
                  </View>
                ) : (
                  <ChevronRight
                    size={18}
                    color={colors.textSubtle}
                    strokeWidth={2.2}
                  />
                )}
              </View>
            </Card>
          </Pressable>
        </View>

        {/* ─── Sign out ─── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.md,
            gap: spacing.lg,
            alignItems: "center",
          }}
        >
          <Button
            title={t("profile.logout.confirm")}
            variant="outline"
            icon={LogOut}
            onPress={confirmLogout}
            fullWidth
          />
          <Text
            style={[
              typography.caption,
              { color: colors.textSubtle, textAlign: "center" },
            ]}
          >
            {t("profile.footer")}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
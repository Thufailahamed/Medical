// @ts-nocheck

import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Stethoscope,
  Phone,
  Mail,
  Building2,
  BadgeCheck,
  CalendarClock,
  GraduationCap,
  Briefcase,
  Award,
  Clock4,
  ChevronRight,
  Edit3,
  FlaskConical,
  CalendarDays,
  FileText,
  Bell,
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
import { Screen, ScreenHeader, Card, Skeleton } from "@/components/ui";
import { useAuthStore } from "@/stores/auth";

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: any;
  label: string;
  value?: string | null;
  href?: string;
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
          accessibilityLabel={`Open ${label}`}
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
  tone?: "primary" | "info" | "warning" | "success";
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const tones: Record<string, { bg: string; fg: string }> = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    info: { bg: "rgba(14, 165, 183, 0.14)", fg: "#0EA5B7" },
    warning: { bg: "rgba(245, 158, 11, 0.14)", fg: "#F59E0B" },
    success: { bg: "rgba(16, 185, 129, 0.14)", fg: "#10B981" },
  };
  const t = tones[tone] ?? tones.primary;
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
          backgroundColor: t.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={t.fg} strokeWidth={2.25} />
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
  const { spacing, colors, typography, radius } = useTheme();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useDoctorMe();
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

  if (isLoading || !doctor || !dbUser) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <ScreenHeader title="Doctor profile" onBack={() => router.back()} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={140} radius={20} />
          <Skeleton height={220} radius={20} />
          <Skeleton height={120} radius={20} />
        </View>
      </Screen>
    );
  }

  const initials = (dbUser?.name || "Dr")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const phoneHref = dbUser?.phone ? `tel:${dbUser.phone}` : undefined;
  const emailHref = dbUser?.email ? `mailto:${dbUser.email}` : undefined;

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title="Doctor profile"
        subtitle={dbUser?.name || "Doctor"}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 120,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View
          style={{
            padding: spacing.lg,
            borderRadius: radius.xxl,
            backgroundColor: colors.primarySoft,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: colors.primary,
                letterSpacing: 0.5,
              }}
            >
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={[
                  typography.title.md,
                  { color: colors.text, fontWeight: "800" },
                ]}
                numberOfLines={1}
              >
                {dbUser?.name || "Doctor"}
              </Text>
              {dbUser?.verified ? (
                <BadgeCheck size={16} color={colors.primary} strokeWidth={2.4} />
              ) : null}
            </View>
            <Text
              style={[
                typography.body.sm,
                { color: colors.primary, marginTop: 2, fontWeight: "700" },
              ]}
              numberOfLines={1}
            >
              {doctor.specialization || "General Practice"}
            </Text>
            {doctor.licenseNumber ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                SLMC {doctor.licenseNumber}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <StatBlock
            icon={CalendarDays}
            label="Today's queue"
            value={queueCount}
            tone="primary"
          />
          <StatBlock
            icon={FlaskConical}
            label="Lab orders"
            value={labCount}
            tone="info"
          />
          <StatBlock
            icon={CalendarClock}
            label="Follow-ups"
            value={followCount}
            tone="warning"
          />
        </View>

        {/* Activity */}
        <Card>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, fontWeight: "700", marginBottom: 6 },
            ]}
          >
            ACTIVITY
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <StatBlock
              icon={FileText}
              label="Prescriptions"
              value={rxCount}
              tone="success"
            />
            <StatBlock
              icon={Edit3}
              label="Clinical notes"
              value={notesCount}
              tone="primary"
            />
            <StatBlock
              icon={Bell}
              label="Unread alerts"
              value={unread?.count ?? 0}
              tone="warning"
            />
          </View>
        </Card>

        {/* Contact */}
        <Card>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, fontWeight: "700", marginBottom: 6 },
            ]}
          >
            CONTACT
          </Text>
          <InfoRow
            icon={Phone}
            label="Phone"
            value={dbUser?.phone}
            href={phoneHref}
          />
          <InfoRow
            icon={Mail}
            label="Email"
            value={dbUser?.email}
            href={emailHref}
          />
        </Card>

        {/* Practice */}
        <Card>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, fontWeight: "700", marginBottom: 6 },
            ]}
          >
            PRACTICE
          </Text>
          <InfoRow
            icon={Stethoscope}
            label="Specialization"
            value={doctor.specialization}
          />
          <InfoRow
            icon={Briefcase}
            label="Years of experience"
            value={
              doctor.yearsOfExperience != null
                ? `${doctor.yearsOfExperience} years`
                : null
            }
          />
          <InfoRow
            icon={GraduationCap}
            label="Qualifications"
            value={doctor.qualifications}
          />
          <InfoRow
            icon={Award}
            label="Languages spoken"
            value={doctor.languages}
          />
          <InfoRow
            icon={Building2}
            label="Hospital"
            value={doctor.hospitalName}
          />
          <InfoRow
            icon={Clock4}
            label="Consultation fee"
            value={
              doctor.consultationFee != null
                ? `LKR ${doctor.consultationFee}`
                : null
            }
          />
        </Card>

        {/* Quick links */}
        <View style={{ gap: spacing.sm }}>
          <Card
            onPress={() => router.push("/doctor/availability")}
            accessibilityLabel="Edit availability"
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarClock
                  size={18}
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
                  My availability
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                >
                  Edit weekly hours and slot minutes
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.2} />
            </View>
          </Card>

          <Card
            onPress={() => router.push("/notifications")}
            accessibilityLabel="Notifications"
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: "rgba(245, 158, 11, 0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bell size={18} color="#F59E0B" strokeWidth={2.25} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.title.sm,
                    { color: colors.text, fontWeight: "700" },
                  ]}
                >
                  Notifications
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                >
                  {unread?.count
                    ? `${unread.count} unread`
                    : "All caught up"}
                </Text>
              </View>
              {unread?.count ? (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    paddingHorizontal: 6,
                    borderRadius: 11,
                    backgroundColor: colors.danger,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: "#fff",
                    }}
                  >
                    {unread.count}
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
        </View>
      </ScrollView>
    </Screen>
  );
}
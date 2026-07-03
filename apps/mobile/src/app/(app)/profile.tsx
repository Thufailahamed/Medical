import { useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Users,
  Bell,
  Stethoscope,
  HelpCircle,
  LogOut,
  ShieldCheck,
  Palette,
  Droplet,
  Activity,
  StickyNote,
  KeyRound,
  HeartPulse,
  AlertTriangle,
  ChevronRight,
  Building2,
  BedDouble,
  Share2,
  Inbox,
  ClipboardList,
  FileText,
  Syringe,
  Download,
  Lock,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import {
  usePatientProfile,
  useUnreadCount,
  useFamilyMembers,
  useMyMedicines,
  useAllergies,
  useDoctorMe,
} from "@/hooks/useApi";
import { api } from "@/lib/api";
import {
  Screen,
  Card,
  Avatar,
  Pill,
  Skeleton,
  Button,
  IconButton,
  StatCard,
  ListItem,
  SectionHeader,
  Divider,
  Chip,
} from "@/components/ui";

function calcBmi(height?: number | null, weight?: number | null) {
  if (!height || !weight) return null;
  const m = height / 100;
  return weight / (m * m);
}

function bmiCategory(
  t: (k: string, opts?: any) => string,
  bmi: number
): { label: string; tone: "info" | "success" | "warning" | "danger" } {
  if (bmi < 18.5) return { label: t("profile.bmi.underweight"), tone: "info" };
  if (bmi < 25) return { label: t("profile.bmi.healthy"), tone: "success" };
  if (bmi < 30) return { label: t("profile.bmi.elevated"), tone: "warning" };
  return { label: t("profile.bmi.high"), tone: "danger" };
}

function parseList(v: string | null | undefined): string[] {
  if (!v) return [];
  try {
    const out = JSON.parse(v);
    return Array.isArray(out) ? out.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseContacts(v: string | null | undefined): { name: string; phone?: string }[] {
  if (!v) return [];
  try {
    const out = JSON.parse(v);
    return Array.isArray(out) ? out.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function ProfileScreen() {
  const { user, logout, authFailureCount } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow } = useTheme();
  const { data: profileData, isLoading: profileLoading } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { data: familyData } = useFamilyMembers();
  const { data: medicinesData } = useMyMedicines();
  const { data: allergiesData } = useAllergies();

  // If the API layer reports an unrecoverable 401, sign the user out.
  useEffect(() => {
    if (authFailureCount > 0) {
      logout();
      router.replace("/(auth)/login");
    }
  }, [authFailureCount]);

  // Doctors have their own portal; route them there if they deep-link here.
  useEffect(() => {
    if (user?.role === "doctor") {
      router.replace("/(doctor)/profile" as any);
    }
  }, [user]);

  const patient = profileData?.patient?.patients;
  const userRow = profileData?.patient?.users;
  const photoUri = userRow?.photo;
  const role = (user?.role || userRow?.role || "patient").toString();
  const isDoctor = role === "doctor";
  const isHospitalAdmin = role === "hospital_admin";
  const isHospitalStaff = role === "hospital_staff";
  const isHospital = isHospitalAdmin || isHospitalStaff;

  const { data: doctorProfileData } = useDoctorMe({ enabled: isDoctor });

  const bmi = useMemo(() => calcBmi(patient?.height, patient?.weight), [patient]);
  const bmiInfo = bmi ? bmiCategory(t, bmi) : null;

  const allergies = useMemo(() => parseList(patient?.allergies), [patient?.allergies]);
  const conditions = useMemo(
    () => parseList(patient?.medicalConditions),
    [patient?.medicalConditions]
  );
  const emergencyContacts = useMemo(
    () => parseContacts(patient?.emergencyContacts),
    [patient?.emergencyContacts]
  );

  const familyCount: number = familyData?.family?.length ?? 0;
  const activeMeds: any[] = (medicinesData?.medicines || []).filter(
    (m: any) => m.active !== false
  );
  const medCount = activeMeds.length;
  const allergyCount = allergiesData?.allergies?.length ?? 0;
  const criticalAllergies =
    allergiesData?.allergies?.filter(
      (a: any) => a.severity === "critical" && a.active !== false
    ).length ?? 0;
  const unreadCount: number = unread?.count ?? 0;

  function confirmLogout() {
    Alert.alert(
      t("profile.logout.title"),
      t("profile.logout.body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("profile.logout.confirm"), style: "destructive", onPress: handleLogout },
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

  const accountItems = [
    {
      labelKey: "profile.item.editProfile.label",
      subtitle: t("profile.item.editProfile.subtitle"),
      icon: Pencil,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/edit-profile" as any),
    },
    {
      labelKey: "profile.item.emailImport.label",
      subtitle: t("profile.item.emailImport.subtitle"),
      icon: Inbox,
      tone: "accent" as const,
      onPress: () => router.push("/(app)/email-import" as any),
    },
    {
      labelKey: "profile.item.family.label",
      subtitle:
        familyCount === 0
          ? `${t("profile.item.family.subtitleEmpty")}\n${t(
              "profile.item.family.subtitleEmptyHint",
            )}`
          : t("profile.item.family.subtitleCount", { count: familyCount }),
      icon: Users,
      tone: "accent" as const,
      onPress: () => router.push("/(app)/family" as any),
    },
    {
      labelKey: "profile.item.notifications.label",
      subtitle: unreadCount > 0
        ? t("profile.item.notifications.subtitleUnread", { count: unreadCount })
        : t("profile.item.notifications.subtitle"),
      icon: Bell,
      tone: "warning" as const,
      onPress: () => router.push("/(app)/notifications" as any),
    },
    {
      labelKey: "profile.item.notificationPreferences.label",
      subtitle: t("profile.item.notificationPreferences.subtitle"),
      icon: Bell,
      tone: "neutral" as const,
      onPress: () => router.push("/(app)/notification-preferences" as any),
    },
    {
      labelKey: "profile.item.appearance.label",
      subtitle: t("profile.item.appearance.subtitle"),
      icon: Palette,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/appearance" as any),
    },
    {
      labelKey: "profile.item.changePassword.label",
      subtitle: t("profile.item.changePassword.subtitle"),
      icon: KeyRound,
      tone: "neutral" as const,
      onPress: () => router.push("/(app)/change-password" as any),
    },
    {
      labelKey: "profile.item.appLock.label",
      subtitle: t("profile.item.appLock.subtitle"),
      icon: Lock,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/app-lock" as any),
    },
  ];

  const healthItems = [
    {
      labelKey: "profile.item.timeline.label",
      subtitle: t("profile.item.timeline.subtitle"),
      icon: ClipboardList,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/timeline" as any),
    },
    {
      labelKey: "profile.item.healthSummary.label",
      subtitle: t("profile.item.healthSummary.subtitle"),
      icon: FileText,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/health-summary" as any),
    },
    {
      labelKey: "profile.item.vitals.label",
      subtitle: medCount > 0
        ? t("profile.item.vitals.subtitleCount", { count: medCount })
        : t("profile.item.vitals.subtitleEmpty"),
      icon: Activity,
      tone: "info" as const,
      onPress: () => router.push("/(app)/vitals" as any),
    },
    {
      labelKey: "profile.item.allergies.label",
      subtitle: allergyCount > 0
        ? t("profile.item.allergies.subtitleCount", { count: allergyCount }) +
          (criticalAllergies > 0
            ? t("profile.item.allergies.subtitleCritical", { count: criticalAllergies })
            : "")
        : t("profile.item.allergies.subtitleEmpty"),
      icon: AlertTriangle,
      tone: criticalAllergies > 0 ? ("danger" as const) : ("warning" as const),
      onPress: () => router.push("/(app)/allergies" as any),
    },
    {
      labelKey: "profile.item.vaccinations.label",
      subtitle: t("profile.item.vaccinations.subtitle"),
      icon: Syringe,
      tone: "info" as const,
      onPress: () => router.push("/(app)/vaccinations" as any),
    },
    {
      labelKey: "profile.item.notes.label",
      subtitle: t("profile.item.notes.subtitle"),
      icon: StickyNote,
      tone: "info" as const,
      onPress: () => router.push("/(app)/notes" as any),
    },
    {
      labelKey: "profile.item.activity.label",
      subtitle: t("profile.item.activity.subtitle"),
      icon: ShieldCheck,
      tone: "warning" as const,
      onPress: () => router.push("/(app)/activity" as any),
    },
    {
      labelKey: "profile.item.share.label",
      subtitle: t("profile.item.share.subtitle"),
      icon: Share2,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/share" as any),
    },
    {
      labelKey: "profile.item.export.label",
      subtitle: t("profile.item.export.subtitle"),
      icon: Download,
      tone: "neutral" as const,
      onPress: () => router.push("/(app)/export" as any),
    },
    ...(isDoctor
      ? [
          {
            labelKey: "profile.item.doctorPortal.label",
            subtitle: t("profile.item.doctorPortal.subtitle"),
            icon: Stethoscope,
            tone: "info" as const,
            onPress: () => router.push("/(doctor)" as any),
          },
        ]
      : []),
    ...(isHospital
      ? [
          {
            labelKey: isHospitalAdmin
              ? "profile.item.hospitalAdmin.label"
              : "profile.item.hospitalStaff.label",
            subtitle: isHospitalAdmin
              ? t("profile.item.hospitalAdmin.subtitle")
              : t("profile.item.hospitalStaff.subtitle"),
            icon: Building2,
            tone: "info" as const,
            onPress: () => router.push("/(app)/hospital/dashboard" as any),
          },
          ...(isHospitalAdmin
            ? [
                {
                  labelKey: "profile.item.wards.label",
                  subtitle: t("profile.item.wards.subtitle"),
                  icon: BedDouble,
                  tone: "neutral" as const,
                  onPress: () => router.push("/(app)/hospital/wards" as any),
                },
              ]
            : []),
          ...(isHospitalAdmin
            ? [
                {
                  labelKey: "profile.item.staffRoster.label",
                  subtitle: t("profile.item.staffRoster.subtitle"),
                  icon: Users,
                  tone: "neutral" as const,
                  onPress: () => router.push("/(app)/hospital/staff" as any),
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
      >
        {/* ─── Top bar ─── */}
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
          <Text
            style={[
              typography.display.sm,
              { color: colors.text, fontWeight: "800", letterSpacing: -0.5 },
            ]}
          >
            {t("profile.title")}
          </Text>
          <IconButton
            icon={Bell}
            variant="ghost"
            size="md"
            onPress={() => router.push("/(app)/notifications" as any)}
            accessibilityLabel={t("profile.item.notifications.label")}
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
        </View>

        {/* ─── Hero identity card ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xs,
          }}
        >
          <Card padded={false}>
            <View
              style={{
                padding: spacing.xl,
                gap: spacing.lg,
              }}
            >
              {/* Identity row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.lg,
                }}
              >
                <Avatar
                  name={userRow?.name || user?.name}
                  source={photoUri ? { uri: photoUri } : undefined}
                  size="2xl"
                  ring
                  tone={isDoctor ? "info" : "primary"}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  {profileLoading ? (
                    <>
                      <Skeleton width="80%" height={20} />
                      <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
                    </>
                  ) : (
                    <>
                      <Text
                        style={[
                          typography.title.lg,
                          {
                            color: colors.text,
                            fontWeight: "800",
                            letterSpacing: -0.4,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {isDoctor && !(userRow?.name || user?.name || "").toLowerCase().startsWith("dr.")
                          ? `Dr. ${userRow?.name || user?.name || "—"}`
                          : (userRow?.name || user?.name || "—")}
                      </Text>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted, marginTop: 2 },
                        ]}
                        numberOfLines={1}
                      >
                        {userRow?.email ||
                          user?.email ||
                          userRow?.phone ||
                          user?.phone ||
                          " "}
                      </Text>
                    </>
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.xs,
                      marginTop: spacing.sm,
                      flexWrap: "wrap",
                    }}
                  >
                    <Pill
                      label={role.replace("_", " ")}
                      tone={isDoctor ? "info" : "primary"}
                      size="sm"
                    />
                    {isDoctor && doctorProfileData?.doctor?.doctors?.specialization ? (
                      <Pill
                        label={doctorProfileData.doctor.doctors.specialization}
                        tone="info"
                        size="sm"
                      />
                    ) : null}
                    {isDoctor && doctorProfileData?.doctor?.doctors?.registrationNumber ? (
                      <Pill
                        label={`SLMC: ${doctorProfileData.doctor.doctors.registrationNumber}`}
                        tone="neutral"
                        size="sm"
                      />
                    ) : null}
                    {userRow?.verified || user?.verified ? (
                      <Pill
                        icon={ShieldCheck}
                        label={t("profile.verified")}
                        tone="success"
                        size="sm"
                      />
                    ) : null}
                  </View>
                </View>
              </View>

              {/* 3-col stats grid */}
              {!isDoctor && (
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.sm,
                  }}
                >
                  <StatCard
                    icon={Droplet}
                    tone="danger"
                    size="sm"
                    label={t("profile.statCard.blood")}
                    value={patient?.bloodGroup || "—"}
                  />
                  <StatCard
                    icon={HeartPulse}
                    tone={bmiInfo?.tone ?? "info"}
                    size="sm"
                    label={t("profile.statCard.bmi")}
                    value={bmi ? bmi.toFixed(1) : "—"}
                    hint={bmiInfo?.label}
                  />
                  <StatCard
                    icon={Activity}
                    tone="primary"
                    size="sm"
                    label={t("profile.statCard.active")}
                    value={String(medCount)}
                    hint={t("profile.statCard.medicine", { count: medCount })}
                  />
                </View>
              )}
            </View>
          </Card>
        </View>

        {/* ─── Health profile card ─── */}
        {!isDoctor && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
            }}
          >
            <Card
              padded={false}
              onPress={() => router.push("/(app)/edit-profile" as any)}
              accessibilityLabel={t("profile.healthCard.accessibilityLabel")}
            >
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.warningSoft,
                  }}
                >
                  <AlertTriangle
                    size={20}
                    color={colors.warning}
                    strokeWidth={2.25}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("profile.healthCard.title")}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                    numberOfLines={2}
                  >
                    {t("profile.healthCard.subtitle")}
                  </Text>
                </View>
                <ChevronRight
                  size={18}
                  color={colors.textSubtle}
                  strokeWidth={2.25}
                />
              </View>
              <Divider />
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <SummaryRow
                  label={t("profile.allergiesHeading")}
                  empty={t("profile.noneRecorded")}
                  items={allergies}
                  tone="danger"
                  icon={AlertTriangle}
                />
                <SummaryRow
                  label={t("profile.conditionsHeading")}
                  empty={t("profile.noneRecorded")}
                  items={conditions}
                  tone="warning"
                  icon={Activity}
                />
                <View style={{ gap: spacing.xs }}>
                  <Text
                    style={[
                      typography.overline,
                      { color: colors.textMuted, letterSpacing: 1.2, alignSelf: "flex-start" },
                    ]}
                  >
                    {t("profile.emergencyContactsHeading")}
                  </Text>
                  <Text
                    style={[
                      typography.body.md,
                      {
                        color: emergencyContacts.length > 0 ? colors.text : colors.textSubtle,
                        fontWeight: emergencyContacts.length > 0 ? "600" : "500",
                        alignSelf: "flex-start",
                        marginTop: 4,
                      },
                    ]}
                  >
                    {emergencyContacts.length > 0
                      ? t("profile.onFile", { count: emergencyContacts.length })
                      : t("profile.noneRecorded")}
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* ─── Account section ─── */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title={t("profile.section.account")}
            style={{ paddingHorizontal: spacing.lg }}
          />
          <View style={{ marginHorizontal: spacing.lg }}>
            <Card padded={false}>
              {accountItems.map((item, i) => (
                <View key={item.labelKey}>
                  <ListItem
                    icon={item.icon}
                    iconTone={item.tone}
                    title={t(item.labelKey)}
                    subtitle={item.subtitle}
                    onPress={item.onPress}
                    showChevron
                    bordered={false}
                  />
                  {i < accountItems.length - 1 ? <Divider /> : null}
                </View>
              ))}
            </Card>
          </View>
        </View>

        {isDoctor && (
          <View style={{ marginTop: spacing.lg }}>
            <SectionHeader
              title={t("profile.section.clinical", "Clinical Suite")}
              style={{ paddingHorizontal: spacing.lg }}
            />
            <View style={{ marginHorizontal: spacing.lg }}>
              <Card padded={false}>
                <ListItem
                  icon={Stethoscope}
                  iconTone="info"
                  title={t("profile.item.doctorPortal.label", "Doctor Portal")}
                  subtitle={t("profile.item.doctorPortal.subtitle", "Access queue, clinical notes & prescriptions")}
                  onPress={() => router.push("/(doctor)" as any)}
                  showChevron
                  bordered={false}
                />
              </Card>
            </View>
          </View>
        )}

        {/* ─── Health section ─── */}
        {!isDoctor && (
          <View style={{ marginTop: spacing.lg }}>
            <SectionHeader
              title={t("profile.section.health")}
              style={{ paddingHorizontal: spacing.lg }}
            />
            <View style={{ marginHorizontal: spacing.lg }}>
              <Card padded={false}>
                {healthItems.map((item, i) => (
                  <View key={item.labelKey}>
                    <ListItem
                      icon={item.icon}
                      iconTone={item.tone}
                      title={t(item.labelKey)}
                      subtitle={item.subtitle}
                      onPress={item.onPress}
                      showChevron
                      bordered={false}
                    />
                    {i < healthItems.length - 1 ? <Divider /> : null}
                  </View>
                ))}
              </Card>
            </View>
          </View>
        )}

        {/* ─── Support section ─── */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title={t("profile.section.support")}
            style={{ paddingHorizontal: spacing.lg }}
          />
          <View style={{ marginHorizontal: spacing.lg }}>
            <Card padded={false}>
              <ListItem
                icon={HelpCircle}
                iconTone="neutral"
                title={t("profile.item.helpSupport.label")}
                subtitle={t("profile.item.helpSupport.subtitle")}
                onPress={() => router.push("/(app)/support" as any)}
                showChevron
                bordered={false}
              />
            </Card>
          </View>
        </View>

        {/* ─── Sign out + app info ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xxl,
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

function SummaryRow({
  label,
  empty,
  items,
  tone,
  icon: Icon,
}: {
  label: string;
  empty: string;
  items: string[];
  tone: "danger" | "warning";
  icon: any;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ alignItems: "flex-start", gap: spacing.xs }}>
      <Text
        style={[
          typography.overline,
          { color: colors.textMuted, letterSpacing: 1.2, alignSelf: "flex-start" },
        ]}
      >
        {label}
      </Text>
      {items.length === 0 ? (
        <Text
          style={[
            typography.body.md,
            { color: colors.textSubtle, fontWeight: "500", alignSelf: "flex-start" },
          ]}
        >
          {empty}
        </Text>
      ) : (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.xs,
            alignSelf: "flex-start",
          }}
        >
          {items.map((it, i) => (
            <Chip key={`${label}-${i}`} label={it} size="sm" tone={tone} icon={Icon} />
          ))}
        </View>
      )}
    </View>
  );
}
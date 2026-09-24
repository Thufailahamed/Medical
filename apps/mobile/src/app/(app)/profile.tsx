import { useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  Pill as PillIcon,
  ScrollText,
  QrCode,
  Shield,
  BadgeCheck,
  Phone,
  Plus,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  usePatientProfile,
  useUnreadCount,
  useFamilyMembers,
  useMyMedicines,
  useAllergies,
  useDoctorMe,
  useVitalsAlerts,
  useMyPrescriptions,
} from "@/hooks/useApi";
import { useCaretakerLinks } from "@/hooks/useCaretaker";
import { api } from "@/lib/api";
import {
  Screen,
  Card,
  Avatar,
  Button,
  ListItem,
  SectionHeader,
  Divider,
  Chip,
  Pressable,
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

type MenuItem = {
  labelKey: string;
  subtitle: string;
  icon: LucideIcon;
  tone: Tone;
  pill?: { label: string; tone?: Tone };
  onPress: () => void;
};

export default function ProfileScreen() {
  const { user, logout, authFailureCount } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, layout } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: profileData, isLoading: profileLoading } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { data: familyData } = useFamilyMembers();
  const { data: medicinesData } = useMyMedicines();
  const { data: allergiesData } = useAllergies();
  const { data: prescriptionsData } = useMyPrescriptions();
  const { data: vitalsAlertsData } = useVitalsAlerts(30);
  const { data: caretakerLinksData } = useCaretakerLinks();

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
  const activeCaretakerCount: number =
    (caretakerLinksData?.links ?? []).filter(
      (l: any) => l.status === "active"
    ).length;
  const activeMeds: any[] = (medicinesData?.medicines || []).filter(
    (m: any) => m.active !== false
  );
  const medCount = activeMeds.length;
  const allergyCount = allergiesData?.allergies?.length ?? 0;
  const rxCount = prescriptionsData?.prescriptions?.length ?? 0;
  const abnormalCount = vitalsAlertsData?.count ?? 0;
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

  const accountItems: MenuItem[] = [
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
      labelKey: "profile.item.auditLog.label",
      subtitle: t("profile.item.auditLog.subtitle"),
      icon: ScrollText,
      tone: "neutral" as const,
      onPress: () => router.push("/(app)/audit" as any),
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
      labelKey: "profile.item.caretakers.label",
      subtitle:
        activeCaretakerCount === 0
          ? t("profile.item.caretakers.subtitleEmpty")
          : t("profile.item.caretakers.subtitleCount", {
              count: activeCaretakerCount,
            }),
      icon: Shield,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/caretakers" as any),
    },
    {
      labelKey: "profile.item.notifications.label",
      subtitle: unreadCount > 0
        ? t("profile.item.notifications.subtitleUnread", { count: unreadCount })
        : t("profile.item.notifications.subtitle"),
      icon: Bell,
      tone: "warning" as const,
      pill:
        unreadCount > 0
          ? { label: String(unreadCount), tone: "danger" as const }
          : undefined,
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

  const healthItems: MenuItem[] = [
    {
      labelKey: "profile.item.timeline.label",
      subtitle: t("profile.item.timeline.subtitle"),
      icon: ClipboardList,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/timeline" as any),
    },
    {
      labelKey: "profile.item.recordsV2.label",
      subtitle: t("profile.item.recordsV2.subtitle", "Unified hub · encrypted"),
      icon: ClipboardList,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/records" as any),
    },
    {
      labelKey: "profile.item.healthSummary.label",
      subtitle: t("profile.item.healthSummary.subtitle"),
      icon: FileText,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/health-summary" as any),
    },
    {
      labelKey: "profile.item.insurance.label",
      subtitle: t("profile.item.insurance.subtitle", "Marketplace & active policies"),
      icon: Shield,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/insurance" as any),
    },
    {
      labelKey: "profile.item.refill.label",
      subtitle: t("profile.item.refill.subtitle"),
      icon: PillIcon,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/refill" as any),
    },
    {
      labelKey: "profile.item.vitals.label",
      subtitle: abnormalCount > 0
        ? t("profile.item.vitals.subtitleAlert", { count: abnormalCount })
        : medCount > 0
        ? t("profile.item.vitals.subtitleCount", { count: medCount })
        : t("profile.item.vitals.subtitleEmpty"),
      icon: Activity,
      tone: abnormalCount > 0 ? ("danger" as const) : ("info" as const),
      pill:
        abnormalCount > 0
          ? { label: String(abnormalCount), tone: "danger" as const }
          : undefined,
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
      pill:
        criticalAllergies > 0
          ? { label: String(criticalAllergies), tone: "danger" as const }
          : undefined,
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
      labelKey: "profile.item.prescriptions.label",
      subtitle:
        rxCount > 0
          ? t("profile.item.prescriptions.subtitleCount", { count: rxCount })
          : t("profile.item.prescriptions.subtitleEmpty"),
      icon: PillIcon,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/prescriptions" as any),
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
      labelKey: "profile.item.healthId.label",
      subtitle: t("profile.item.healthId.subtitle"),
      icon: QrCode,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/health-id" as any),
    },
    {
      labelKey: "profile.item.tenants.label",
      subtitle: t("profile.item.tenants.subtitle"),
      icon: Building2,
      tone: "info" as const,
      onPress: () => router.push("/(app)/tenants" as any),
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

  const quickActions = [
    {
      key: "edit",
      label: t("profile.quick.edit"),
      icon: Pencil,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/edit-profile" as any),
    },
    {
      key: "healthId",
      label: t("profile.quick.healthId"),
      icon: QrCode,
      tone: "info" as const,
      onPress: () => router.push("/(app)/health-id" as any),
    },
    {
      key: "share",
      label: t("profile.quick.share"),
      icon: Share2,
      tone: "accent" as const,
      onPress: () => router.push("/(app)/share" as any),
    },
    {
      key: "family",
      label: t("profile.quick.family"),
      icon: Users,
      tone: "accent2" as const,
      onPress: () => router.push("/(app)/family" as any),
    },
  ];

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: layout.tabBarHeight + insets.bottom + spacing.xxxl,
        }}
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
            style={[typography.display.lg, { color: colors.text }]}
          >
            {t("profile.title")}
          </Text>
          <Pressable
            onPress={() => router.push("/(app)/notifications" as any)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t("profile.item.notifications.label")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.fill,
            }}
          >
            <Bell size={19} color={colors.text} strokeWidth={2.1} />
            {unreadCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -3,
                  right: -3,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                  borderRadius: 9,
                  backgroundColor: colors.danger,
                  borderWidth: 2,
                  borderColor: colors.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={[
                    typography.label.xs,
                    { color: "#FFFFFF", fontSize: 10, lineHeight: 12, letterSpacing: 0 },
                  ]}
                  numberOfLines={1}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* ─── Hero identity card (premium gradient) ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xs,
          }}
        >
          <View
            style={{
              borderRadius: radius.xxxl,
              borderCurve: "continuous",
              overflow: "hidden",
              ...shadow.hero,
            }}
          >
            <LinearGradient
              colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* radial accent overlays for depth */}
            <View
              style={{
                position: "absolute",
                top: -90,
                right: -70,
                width: 240,
                height: 240,
                borderRadius: 120,
                backgroundColor: "rgba(56, 189, 248, 0.30)",
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: -110,
                left: -70,
                width: 260,
                height: 260,
                borderRadius: 130,
                backgroundColor: "rgba(14, 165, 233, 0.28)",
              }}
            />
            {/* top sheen */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: "rgba(255, 255, 255, 0.25)",
              }}
            />
            {/* heartbeat watermark */}
            <View
              pointerEvents="none"
              style={{ position: "absolute", right: -18, bottom: -18, opacity: 0.08 }}
            >
              <HeartPulse size={170} color="#FFFFFF" strokeWidth={1.5} />
            </View>

            {/* edit shortcut — wrapped in a plain View so absolute positioning
                anchors to the card, not Pressable's inner animated wrapper */}
            <View
              style={{
                position: "absolute",
                top: spacing.md,
                right: spacing.md,
                zIndex: 2,
              }}
            >
              <Pressable
                onPress={() => router.push("/(app)/edit-profile" as any)}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={t("profile.item.editProfile.label")}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.16)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.32)",
                }}
              >
                <Pencil size={15} color="#FFFFFF" strokeWidth={2.25} />
              </Pressable>
            </View>

            <View
              style={{
                padding: spacing.xl,
                paddingBottom: spacing.xxxxl + spacing.sm,
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
                {/* avatar with glass ring + verified dot */}
                <View>
                  <View
                    style={{
                      padding: 3,
                      borderRadius: 9999,
                      backgroundColor: "rgba(255, 255, 255, 0.28)",
                      borderWidth: 1.5,
                      borderColor: "rgba(255, 255, 255, 0.55)",
                    }}
                  >
                    <View
                      style={{
                        borderRadius: 9999,
                        backgroundColor: colors.surface,
                        overflow: "hidden",
                      }}
                    >
                      <Avatar
                        name={userRow?.name || user?.name}
                        source={photoUri ? { uri: photoUri } : undefined}
                        size="xl"
                        tone={isDoctor ? "info" : "primary"}
                      />
                    </View>
                  </View>
                  {userRow?.verified || user?.verified ? (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderCurve: "continuous",
                        backgroundColor: "#10B981",
                        borderWidth: 2.5,
                        borderColor: "#FFFFFF",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <BadgeCheck size={12} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  ) : null}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  {profileLoading ? (
                    <>
                      <View
                        style={{
                          width: "70%",
                          height: 20,
                          borderRadius: 6,
                          backgroundColor: "rgba(255, 255, 255, 0.25)",
                        }}
                      />
                      <View
                        style={{
                          width: "50%",
                          height: 14,
                          borderRadius: 6,
                          backgroundColor: "rgba(255, 255, 255, 0.18)",
                          marginTop: 8,
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Text
                        style={[
                          typography.title.lg,
                          {
                            color: "#FFFFFF",
                            fontWeight: "800",
                            letterSpacing: -0.4,
                            fontSize: 22,
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
                          { color: "rgba(255, 255, 255, 0.78)", marginTop: 2 },
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
                </View>
              </View>

              {/* glass chips */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                <GlassChip
                  icon={isDoctor ? Stethoscope : HeartPulse}
                  label={role.replace("_", " ")}
                />
                {isDoctor && doctorProfileData?.doctor?.doctors?.specialization ? (
                  <GlassChip
                    label={doctorProfileData.doctor.doctors.specialization}
                  />
                ) : null}
                {isDoctor && doctorProfileData?.doctor?.doctors?.registrationNumber ? (
                  <GlassChip
                    label={`SLMC: ${doctorProfileData.doctor.doctors.registrationNumber}`}
                  />
                ) : null}
                {userRow?.verified || user?.verified ? (
                  <GlassChip icon={ShieldCheck} label={t("profile.verified")} />
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* ─── Floating health stats ─── */}
        {!isDoctor && (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginHorizontal: spacing.xxl,
              marginTop: -spacing.xxl - spacing.xs,
            }}
          >
            <StatTile
              icon={Droplet}
              tone="danger"
              label={t("profile.statCard.blood")}
              value={patient?.bloodGroup || "—"}
            />
            <StatTile
              icon={HeartPulse}
              tone={bmiInfo?.tone ?? "info"}
              label={t("profile.statCard.bmi")}
              value={bmi ? bmi.toFixed(1) : "—"}
              hint={bmiInfo?.label}
            />
            <StatTile
              icon={Activity}
              tone="primary"
              label={t("profile.statCard.active")}
              value={String(medCount)}
              hint={t("profile.statCard.medicine", { count: medCount })}
            />
          </View>
        )}

        {/* ─── Quick actions ─── */}
        {!isDoctor && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginHorizontal: spacing.xl,
              marginTop: spacing.xl,
            }}
          >
            {quickActions.map((a) => (
              <QuickAction
                key={a.key}
                icon={a.icon}
                label={a.label}
                tone={a.tone}
                onPress={a.onPress}
              />
            ))}
          </View>
        )}

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
                  paddingVertical: spacing.md + 2,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.lg,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.warningSoft,
                    borderWidth: 1,
                    borderColor: colors.border,
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
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChevronRight
                    size={15}
                    color={colors.textMuted}
                    strokeWidth={2.5}
                  />
                </View>
              </View>
              <Divider />
              <View style={{ padding: spacing.lg, gap: spacing.lg }}>
                <HealthRow
                  icon={AlertTriangle}
                  tone="danger"
                  label={t("profile.allergiesHeading")}
                >
                  {allergies.length === 0 ? (
                    <EmptyValue label={t("profile.noneRecorded")} />
                  ) : (
                    <ChipWrap items={allergies} tone="danger" icon={AlertTriangle} />
                  )}
                </HealthRow>
                <HealthRow
                  icon={Activity}
                  tone="warning"
                  label={t("profile.conditionsHeading")}
                >
                  {conditions.length === 0 ? (
                    <EmptyValue label={t("profile.noneRecorded")} />
                  ) : (
                    <ChipWrap items={conditions} tone="warning" icon={Activity} />
                  )}
                </HealthRow>
                <HealthRow
                  icon={Phone}
                  tone="info"
                  label={t("profile.emergencyContactsHeading")}
                >
                  {emergencyContacts.length === 0 ? (
                    <EmptyValue label={t("profile.noneRecorded")} />
                  ) : (
                    <Text
                      style={[
                        typography.body.md,
                        { color: colors.text, fontWeight: "600" },
                      ]}
                    >
                      {t("profile.onFile", { count: emergencyContacts.length })}
                    </Text>
                  )}
                </HealthRow>
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
                    pill={item.pill}
                    onPress={item.onPress}
                    showChevron
                    bordered={false}
                  />
                  {i < accountItems.length - 1 ? <Divider inset={60} /> : null}
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
                      pill={item.pill}
                      onPress={item.onPress}
                      showChevron
                      bordered={false}
                    />
                    {i < healthItems.length - 1 ? <Divider inset={60} /> : null}
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
            variant="danger"
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

/** Translucent chip rendered on the gradient hero card. */
function GlassChip({ icon: Icon, label }: { icon?: LucideIcon; label: string }) {
  const { spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(255, 255, 255, 0.16)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.30)",
      }}
    >
      {Icon ? <Icon size={11} color="#FFFFFF" strokeWidth={2.5} /> : null}
      <Text
        style={[
          typography.caption,
          { color: "#FFFFFF", fontWeight: "700", fontSize: 11 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** Elevated metric tile that overlaps the hero card. */
function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: string;
  hint?: string;
}) {
  const { colors, spacing, radius, typography, shadow } = useTheme();
  const pal = useTone(tone);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.separator,
        padding: spacing.md,
        gap: spacing.sm,
        ...shadow.md,
      }}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ""}`}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          borderCurve: "continuous",
          backgroundColor: pal.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={15} color={pal.fg} strokeWidth={2.5} />
      </View>
      <View>
        <Text
          style={[typography.title.md, { color: colors.text, fontWeight: "800" }]}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Text
          style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            style={[typography.caption, { color: colors.textSubtle, marginTop: 1 }]}
            numberOfLines={1}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Rounded icon tile + label for the quick-actions row. */
function QuickAction({
  icon: Icon,
  label,
  tone,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  tone: Tone;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const pal = useTone(tone);
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ alignItems: "center", gap: spacing.sm, width: 72 }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.lg,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pal.bg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Icon size={20} color={pal.fg} strokeWidth={2.25} />
      </View>
      <Text
        style={[
          typography.caption,
          { color: colors.textMuted, fontWeight: "600" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Labelled row inside the health profile card. */
function HealthRow({
  icon: Icon,
  tone,
  label,
  children,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  children: React.ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  const pal = useTone(tone);
  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            backgroundColor: pal.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={13} color={pal.fg} strokeWidth={2.5} />
        </View>
        <Text
          style={[
            typography.overline,
            { color: colors.textMuted, letterSpacing: 1.1 },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={{ paddingLeft: 24 + spacing.sm }}>{children}</View>
    </View>
  );
}

/** Muted "none recorded" text with a subtle add affordance. */
function EmptyValue({ label }: { label: string }) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Text
        style={[
          typography.body.sm,
          { color: colors.textSubtle, fontWeight: "500" },
        ]}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: colors.primarySoft,
        }}
      >
        <Plus size={10} color={colors.primary} strokeWidth={3} />
        <Text
          style={{
            color: colors.primary,
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 0.4,
          }}
        >
          {t("common.add").toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function ChipWrap({
  items,
  tone,
  icon: Icon,
}: {
  items: string[];
  tone: "danger" | "warning";
  icon: LucideIcon;
}) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.xs,
        alignSelf: "flex-start",
      }}
    >
      {items.map((it, i) => (
        <Chip key={`${it}-${i}`} label={it} size="sm" tone={tone} icon={Icon} />
      ))}
    </View>
  );
}
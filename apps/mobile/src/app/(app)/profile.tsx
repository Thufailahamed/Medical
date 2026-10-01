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
  IconTile,
  QuickAction,
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
      labelKey: "profile.item.consents.label",
      subtitle: t("profile.item.consents.subtitle"),
      icon: ShieldCheck,
      tone: "accent" as const,
      onPress: () => router.push("/(app)/consents" as any),
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
      tone: "info" as const,
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
      tone: "accent" as const,
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
      tone: "accent2" as const,
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
      key: "healthId",
      label: t("profile.quick.healthId"),
      icon: QrCode,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/health-id" as any),
    },
    {
      key: "records",
      label: t("profile.v2.quickRecords"),
      icon: ClipboardList,
      tone: "info" as const,
      onPress: () => router.push("/(app)/records" as any),
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

  // Split the long account/health lists into short, scannable groups.
  const itemsByKey: Record<string, MenuItem> = Object.fromEntries(
    [...accountItems, ...healthItems].map((i) => [i.labelKey.split(".")[2], i])
  );
  const pick = (keys: string[]) => keys.map((k) => itemsByKey[k]).filter(Boolean) as MenuItem[];
  const roleExtras = pick(["doctorPortal", "hospitalAdmin", "hospitalStaff", "wards", "staffRoster"]);
  const menuGroups: { key: string; title: string; items: MenuItem[]; patientOnly?: boolean }[] = [
    {
      key: "account",
      title: t("profile.section.account"),
      items: pick(["editProfile", "family", "caretakers", "emailImport"]),
    },
    {
      key: "records",
      title: t("profile.v2.records"),
      items: pick(["recordsV2", "timeline", "healthSummary", "prescriptions", "vaccinations", "notes"]),
      patientOnly: true,
    },
    {
      key: "care",
      title: t("profile.v2.care"),
      items: [...pick(["vitals", "allergies", "refill", "insurance", "tenants"]), ...roleExtras],
      patientOnly: true,
    },
    {
      key: "privacy",
      title: t("profile.v2.privacy"),
      items: pick(["healthId", "share", "export", "activity"]),
      patientOnly: true,
    },
    {
      key: "preferences",
      title: t("profile.v2.preferences"),
      items: pick(["notifications", "notificationPreferences", "appearance", "changePassword", "appLock", "auditLog"]),
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
                  borderRadius: 18,
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

            <View style={{ padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg }}>
              {/* Identity row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingRight: 40,
                }}
              >
                {/* avatar with glass ring + verified dot */}
                <View>
                  <View
                    style={{
                      padding: 3,
                      borderRadius: 9999,
                      backgroundColor: "rgba(255, 255, 255, 0.22)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.5)",
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
                        size={68}
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
                          { color: "rgba(255, 255, 255, 0.78)", marginTop: 1 },
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
                  {/* glass chips */}
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: spacing.sm,
                    }}
                  >
                    <GlassChip
                      icon={isDoctor ? Stethoscope : HeartPulse}
                      label={t(`profile.v2.role_${role}`, role.replace("_", " "))}
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

              {/* ─── Health stats strip ─── */}
              {!isDoctor && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "stretch",
                    paddingVertical: spacing.md,
                    borderRadius: radius.xl,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <HeroStat
                    icon={Droplet}
                    value={patient?.bloodGroup || "—"}
                    label={t("profile.v2.bloodType")}
                  />
                  <View style={{ width: 1, backgroundColor: "rgba(255, 255, 255, 0.18)" }} />
                  <HeroStat
                    icon={HeartPulse}
                    value={bmi ? bmi.toFixed(1) : "—"}
                    label={bmiInfo ? `${t("profile.statCard.bmi")} · ${bmiInfo.label}` : t("profile.statCard.bmi")}
                    dot={bmiInfo ? toneDot[bmiInfo.tone] : undefined}
                  />
                  <View style={{ width: 1, backgroundColor: "rgba(255, 255, 255, 0.18)" }} />
                  <HeroStat
                    icon={PillIcon}
                    value={String(medCount)}
                    label={t("profile.v2.medicines")}
                    onPress={() => router.push("/(app)/prescriptions" as any)}
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ─── Quick actions ─── */}
        {!isDoctor && (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginHorizontal: spacing.lg,
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
                size={54}
              />
            ))}
          </View>
        )}

        {/* ─── Health profile card ─── */}
        {!isDoctor && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.xl,
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
                <IconTile icon={HeartPulse} tone="primary" appearance="solid" size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("profile.healthCard.title")}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
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
                    backgroundColor: colors.well,
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
              <HealthRow
                icon={AlertTriangle}
                tone="danger"
                label={t("profile.v2.allergies")}
                count={allergies.length}
              >
                {allergies.length > 0 ? (
                  <ChipWrap items={allergies} tone="danger" icon={AlertTriangle} />
                ) : null}
              </HealthRow>
              <Divider inset={62} />
              <HealthRow
                icon={Activity}
                tone="warning"
                label={t("profile.v2.conditions")}
                count={conditions.length}
              >
                {conditions.length > 0 ? (
                  <ChipWrap items={conditions} tone="warning" icon={Activity} />
                ) : null}
              </HealthRow>
              <Divider inset={62} />
              <HealthRow
                icon={Phone}
                tone="info"
                label={t("profile.v2.emergencyContacts")}
                count={emergencyContacts.length}
                countLabel={t("profile.onFile", { count: emergencyContacts.length })}
              />
            </Card>
          </View>
        )}

        {/* ─── Menu groups ─── */}
        {menuGroups
          .filter((g) => g.items.length > 0 && !(g.patientOnly && isDoctor))
          .map((g) => (
            <View key={g.key} style={{ marginTop: spacing.xl }}>
              <SectionHeader
                title={g.title}
                style={{ paddingHorizontal: spacing.lg }}
              />
              <View style={{ marginHorizontal: spacing.lg }}>
                <Card padded={false}>
                  {g.items.map((item, i) => (
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
                      {i < g.items.length - 1 ? <Divider inset={60} /> : null}
                    </View>
                  ))}
                </Card>
              </View>
            </View>
          ))}

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

        {/* ─── Support section ─── */}
        <View style={{ marginTop: spacing.xl }}>
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

const toneDot: Record<string, string> = {
  info: "#7DD3FC",
  success: "#6EE7B7",
  warning: "#FCD34D",
  danger: "#FCA5A5",
};

/** One column of the glass stats strip inside the hero card. */
function HeroStat({
  icon: Icon,
  value,
  label,
  dot,
  onPress,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  dot?: string;
  onPress?: () => void;
}) {
  const { typography } = useTheme();
  const body = (
    <View style={{ alignItems: "center", paddingHorizontal: 6, gap: 2 }}>
      <Icon size={14} color="rgba(255, 255, 255, 0.72)" strokeWidth={2.4} />
      <Text
        style={[
          typography.title.lg,
          { color: "#FFFFFF", fontWeight: "800", marginTop: 2, fontVariant: ["tabular-nums"] },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} /> : null}
        <Text
          style={[typography.caption, { color: "rgba(255, 255, 255, 0.75)", fontSize: 11 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={{ flex: 1 }}
    >
      {body}
    </Pressable>
  ) : (
    <View style={{ flex: 1 }} accessibilityRole="text" accessibilityLabel={`${label}: ${value}`}>
      {body}
    </View>
  );
}

/** Row inside the health profile card: icon tile, label, count or add pill, optional chips. */
function HealthRow({
  icon,
  tone,
  label,
  count,
  countLabel,
  children,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  count: number;
  countLabel?: string;
  children?: React.ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const pal = useTone(tone);
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconTile icon={icon} tone={tone} size={34} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.title.xs, { color: colors.text }]} numberOfLines={1}>
            {label}
          </Text>
          {count === 0 ? (
            <Text style={[typography.caption, { color: colors.textSubtle, marginTop: 1 }]} numberOfLines={1}>
              {t("profile.noneRecorded")}
            </Text>
          ) : null}
        </View>
        {count === 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              paddingHorizontal: 10,
              height: 26,
              borderRadius: 13,
              backgroundColor: colors.primarySoft,
            }}
          >
            <Plus size={12} color={colors.primary} strokeWidth={2.75} />
            <Text style={[typography.label.sm, { color: colors.primary }]}>
              {t("profile.v2.add")}
            </Text>
          </View>
        ) : (
          <View
            style={{
              minWidth: 26,
              height: 24,
              paddingHorizontal: 8,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pal.bg,
            }}
          >
            <Text style={[typography.label.sm, { color: pal.fg, fontVariant: ["tabular-nums"] }]}>
              {countLabel ?? count}
            </Text>
          </View>
        )}
      </View>
      {children ? <View style={{ paddingLeft: 34 + spacing.md }}>{children}</View> : null}
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
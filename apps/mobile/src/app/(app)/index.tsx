// @ts-nocheck

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  RefreshControl,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { BlurView } from "expo-blur";
import { useRouter, useFocusEffect, Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Pill,
  ClipboardList,
  CalendarPlus,
  Plus,
  ChevronRight,
  Droplet,
  Check,
  StickyNote,
  Clock,
  AlertTriangle,
  Activity,
  ShieldAlert,
  Upload,
  HeartPulse,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  MessageSquare,
  ScanText,
  FlaskConical,
  Stethoscope,
  FileSearch,
  Share2,
  FileText,
  Heart,
  Scale,
  Shield,
  ShieldCheck,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore, type Locale } from "@/stores/locale";
import { ActiveMemberPill } from "@/components/ActiveMemberPill";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { HomePrescriptionsSection } from "@/components/HomePrescriptionsSection";
import { intlLocale } from "@/lib/format";
import {
  usePatientProfile,
  useAllergies,
  useVaccinationsDue,
  useTodayMedicines,
  useMyAppointments,
  useUnreadCount,
  useWellness,
  useTodayDoses,
  useVitalsDerived,
  useVitalsSparkline,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { Sparkline } from "@/components/vitals";
import { VITAL_REGISTRY, type VitalType } from "@healthcare/shared/vitals";
import { CURATED_PACKAGES, packageImage } from "./test-packages";
import { CURATED_INSURANCE_PLANS, insurancePlanImage } from "@/components/insurance/PlanCard";
import { HOME_ASSETS } from "@/constants/home-assets";
import {
  Screen,
  Card,
  EmptyState,
  Skeleton,
  DoseRing,
  BottomSheet,
  useToast,
} from "@/components/ui";

type TimingKey = "morning" | "afternoon" | "evening" | "night";

function timingOf(s?: string): TimingKey {
  const v = (s || "").toLowerCase();
  if (v.includes("morning") || v.includes("before breakfast")) return "morning";
  if (v.includes("afternoon") || v.includes("lunch")) return "afternoon";
  if (v.includes("evening") || v.includes("dinner")) return "evening";
  if (v.includes("night") || v.includes("bed")) return "night";
  return "morning";
}

function buildTimingMeta(t: (k: string) => string): Record<TimingKey, { label: string; tone: Tone }> {
  return {
    morning: { label: t("medicines.period.morning.label"), tone: "primary" },
    afternoon: { label: t("medicines.period.afternoon.label"), tone: "accent" },
    evening: { label: t("medicines.period.evening.label"), tone: "accent2" },
    night: { label: t("medicines.period.night.label"), tone: "info" },
  };
}

// Period color tokens for the new schedule cards. Kept independent of theme
// tones so the visual identity reads clearly regardless of light/dark scheme.
const PERIOD_ACCENT: Record<TimingKey, { color: string; soft: string; ring: [string, string] }> = {
  morning:   { color: "#F59E0B", soft: "#FEF3C7", ring: ["#FBBF24", "#F59E0B"] },
  afternoon: { color: "#0EA5E9", soft: "#E0F2FE", ring: ["#38BDF8", "#0284C7"] },
  evening:   { color: "#FF7A59", soft: "#FFE4D9", ring: ["#FF9670", "#E85F3D"] },
  night:     { color: "#6366F1", soft: "#E0E7FF", ring: ["#818CF8", "#4F46E5"] },
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, typography, colors, radius, fontFamily, layout, shadow } = useTheme();
  const toast = useToast();

  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = usePatientProfile();
  const { data: medsData, isLoading: medsLoading, refetch: refetchMeds } = useTodayMedicines();
  const { data: apptsData, isLoading: apptsLoading, refetch: refetchAppts } = useMyAppointments();
  const { data: unread, refetch: refetchUnread } = useUnreadCount();
  const { data: allergiesData } = useAllergies();
  const { data: vaccineDue } = useVaccinationsDue();
  const { data: wellnessData, refetch: refetchWellness } = useWellness();
  const { data: todayDoses, refetch: refetchDoses } = useTodayDoses();
  const [fabOpen, setFabOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetchProfile();
      refetchMeds();
      refetchAppts();
      refetchUnread();
      refetchWellness();
      refetchDoses();
    }, [refetchProfile, refetchMeds, refetchAppts, refetchUnread, refetchWellness, refetchDoses])
  );

  useEffect(() => {
    const remote = profileData?.patient?.users?.preferredLocale;
    if (remote && remote !== locale && (remote === "en" || remote === "si" || remote === "ta")) {
      useLocaleStore.getState().setLocale(remote as Locale);
    }
  }, [profileData?.patient?.users?.preferredLocale, locale]);

  const patient = profileData?.patient?.patients;
  const todayMeds: any[] = medsData?.medicines ?? [];
  const appointments: any[] = apptsData?.appointments ?? [];
  const upcomingAppointments = appointments.filter(
    (a: any) => a.bucket === "upcoming" || a.bucket === "today"
  );
  upcomingAppointments.sort((a: any, b: any) => a.startsAt - b.startsAt);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const firstName = user?.name?.split(" ")[0] || "there";

  const bmi =
    patient?.height && patient?.weight
      ? (patient.weight / Math.pow(patient.height / 100, 2)).toFixed(1)
      : null;

  const totalMeds = todayMeds.length;
  const adherence = wellnessData?.adherence?.ratio != null
    ? Math.round(wellnessData.adherence.ratio * 100)
    : 0;

  const takenSet = useMemo(() => {
    const s = new Set<string>();
    const doses = todayDoses?.doses || [];
    for (const d of doses) {
      if (d.medicine_doses?.takenAt || d.takenAt) {
        s.add(d.medicine_doses?.medicineId || d.medicineId);
      }
    }
    return s;
  }, [todayDoses]);

  const untakenMeds = todayMeds.filter((m) => !takenSet.has(m.id));
  const nextMed = untakenMeds[0];

  const grouped: Record<TimingKey, any[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  todayMeds.forEach((m: any) => {
    grouped[timingOf(m.timing)].push(m);
  });

  const headerDate = (() => {
    const d = new Date();
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const day = d.getDate();
    const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    return `${greeting.toUpperCase()} · ${weekday} ${day} ${month}`;
  })();

  const userPhoto = profileData?.patient?.users?.photo;
  const userName = profileData?.patient?.users?.name || user?.name || "";

  const refetchAll = () => {
    profileData && refetchProfile();
    medsData && refetchMeds();
    apptsData && refetchAppts();
    unread && refetchUnread();
    refetchWellness();
    refetchDoses();
  };

  const timingMeta = useMemo(() => buildTimingMeta(t), [t]);

  if (user?.role === "doctor") {
    return <Redirect href="/(doctor)" />;
  }

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset={false} bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={profileLoading || medsLoading || apptsLoading}
            onRefresh={refetchAll}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: layout.tabBarHeight + 56 }}
      >
        {/* ─── Critical allergy banner ─── */}
        {(() => {
          const criticalAllergies =
            (allergiesData?.allergies ?? []).filter(
              (a: any) => a.severity === "critical" && a.active !== false
            );
          if (criticalAllergies.length === 0) return null;
          return (
            <Pressable
              onPress={() => router.push("/(app)/allergies" as any)}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.criticalAllergies")}
              style={{
                marginHorizontal: spacing.lg,
                marginTop: spacing.sm,
                borderRadius: radius.lg,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={["#DC2626", "#B91C1C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: spacing.md,
                  flexDirection: "row",
                  gap: spacing.sm,
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldAlert size={16} color="#fff" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[typography.title.sm, { color: "#fff", fontWeight: "800" }]}
                  >
                    {criticalAllergies.length === 1
                      ? t("home.criticalAllergy_one", {
                          substance: criticalAllergies[0].substance,
                        })
                      : t("home.criticalAllergy_other", {
                          count: criticalAllergies.length,
                        })}
                  </Text>
                  <Text
                    style={[typography.caption, { color: "#fff", opacity: 0.9, marginTop: 2 }]}
                  >
                    {t("home.viewDetails")}
                  </Text>
                </View>
                <ChevronRight size={18} color="#fff" />
              </LinearGradient>
            </Pressable>
          );
        })()}

        {/* ─── App header (premium) ─── */}
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
          <Pressable
            onPress={() => router.push("/(app)/profile")}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            accessibilityRole="button"
            accessibilityLabel={t("home.a11y.profile")}
          >
            {userPhoto ? (
              <View>
                <Image
                  source={{ uri: userPhoto }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    bottom: -1,
                    right: -1,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: "#10B981",
                    borderWidth: 2.5,
                    borderColor: colors.surface,
                  }}
                />
              </View>
            ) : (
              <View>
                <Image
                  source={HOME_ASSETS.avatar}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    bottom: -1,
                    right: -1,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: "#10B981",
                    borderWidth: 2.5,
                    borderColor: colors.surface,
                  }}
                />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text
              style={[
                typography.title.lg,
                {
                  color: colors.primary,
                  fontWeight: "800",
                  fontSize: 17,
                  fontFamily: fontFamily.displayBold,
                  letterSpacing: -0.3,
                },
              ]}
            >
              {t("home.brand")}
            </Text>
            <ActiveMemberPill />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Pressable
              onPress={() => setFabOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.quickAdd")}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                ...shadow.sm,
              })}
            >
              <Plus size={20} color={colors.primary} strokeWidth={2.5} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/(app)/notifications")}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.notifications")}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                ...shadow.sm,
              })}
            >
              <Bell size={18} color={colors.text} strokeWidth={2} />
              {unread?.count ? (
                <View
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#DC2626",
                    borderWidth: 1.5,
                    borderColor: colors.surface,
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* ─── Hero (premium glassmorphism) ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            borderRadius: radius.xxxl,
            overflow: "hidden",
            ...shadow.hero,
          }}
        >
          {/* Base gradient — deeper, more saturated than before */}
          <LinearGradient
            colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Radial accent overlay (top-right) — gives depth */}
          <View
            style={{
              position: "absolute",
              top: -100,
              right: -80,
              width: 280,
              height: 280,
              borderRadius: 140,
              backgroundColor: "rgba(56, 189, 248, 0.35)",
            }}
          />
          {/* Radial accent overlay (bottom-left) */}
          <View
            style={{
              position: "absolute",
              bottom: -120,
              left: -80,
              width: 300,
              height: 300,
              borderRadius: 150,
              backgroundColor: "rgba(14, 165, 233, 0.3)",
            }}
          />
          {/* Soft white sheen top */}
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
          {/* Subtle medical heartbeat watermark */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -15,
              bottom: -15,
              opacity: 0.08,
            }}
          >
            <HeartPulse size={180} color="#FFFFFF" strokeWidth={1.5} />
          </View>

          <View style={{ padding: spacing.xl }}>
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
                  style={[
                    typography.overline,
                    {
                      color: "rgba(255,255,255,0.7)",
                      letterSpacing: 1.4,
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
                  style={{
                    color: "#FFFFFF",
                    fontSize: 34,
                    lineHeight: 40,
                    letterSpacing: -0.8,
                    fontWeight: "800",
                    marginTop: 4,
                    fontFamily: fontFamily.displayBold,
                  }}
                >
                  {firstName}
                </Text>

                {wellnessData?.topTip ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      color: "rgba(255, 255, 255, 0.85)",
                      fontSize: 13,
                      lineHeight: 19,
                      marginTop: 6,
                      fontFamily: fontFamily.body,
                    }}
                  >
                    "{wellnessData.topTip}"
                  </Text>
                ) : (
                  <Text
                    numberOfLines={2}
                    style={{
                      color: "rgba(255, 255, 255, 0.8)",
                      fontSize: 13,
                      lineHeight: 19,
                      marginTop: 6,
                      fontFamily: fontFamily.body,
                    }}
                  >
                    {t("home.welcomeDefault")}
                  </Text>
                )}
              </View>

              {/* Premium gradient ring with glow */}
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#38BDF8",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 14,
                  elevation: 8,
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 48,
                    borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.18)",
                  } as any}
                />
                <DoseRing
                  value={adherence / 100}
                  size={92}
                  tone="primary"
                  label={`${adherence}%`}
                  sublabel={t("home.doses")}
                  centerColor="rgba(255, 255, 255, 0.08)"
                  textColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Glassmorphism "Upcoming today" panel */}
            {(nextMed || upcomingAppointments[0]) && (
              <View
                style={{
                  marginTop: spacing.lg,
                  borderRadius: 20,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.18)",
                }}
              >
                {Platform.OS === "ios" ? (
                  <BlurView
                    intensity={30}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: "rgba(255,255,255,0.12)" },
                    ]}
                  />
                )}
                <View style={{ padding: spacing.md + 2 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: "#34D399",
                        shadowColor: "#34D399",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 4,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: "rgba(255, 255, 255, 0.85)",
                        letterSpacing: 1.4,
                        fontFamily: fontFamily.displayBold,
                      }}
                    >
                      {t("home.upcomingTodayLabel")}
                    </Text>
                  </View>

                  {nextMed && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: upcomingAppointments[0] ? 8 : 0,
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 9,
                          backgroundColor: "rgba(255, 255, 255, 0.18)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Pill size={14} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontSize: 13.5,
                          color: "#FFFFFF",
                          fontWeight: "600",
                          fontFamily: fontFamily.bodySemibold,
                        }}
                      >
                        {nextMed.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11.5,
                          color: "rgba(255,255,255,0.75)",
                          fontWeight: "600",
                        }}
                      >
                        {nextMed.timing}
                      </Text>
                    </View>
                  )}

                  {upcomingAppointments[0] && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 9,
                          backgroundColor: "rgba(255, 255, 255, 0.18)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Clock size={14} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontSize: 13.5,
                          color: "#FFFFFF",
                          fontWeight: "600",
                          fontFamily: fontFamily.bodySemibold,
                        }}
                      >
                        {(() => {
                          const appt = upcomingAppointments[0];
                          const rawName = appt.doctorName || appt.providerName || appt.doctor?.name || appt.provider || appt.reason || appt.type || "";
                          const cleanName = String(rawName).replace(/^Dr\.?\s*/i, "").trim();
                          const doctorStr = cleanName ? `Dr. ${cleanName}` : "Doctor visit";
                          const timeStr = appt.time || (appt.scheduledAt ? new Date(appt.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : null);
                          return timeStr ? `${doctorStr} at ${timeStr}` : doctorStr;
                        })()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Glass pills row */}
            <View
              style={{
                flexDirection: "row",
                gap: 6,
                marginTop: spacing.md,
                flexWrap: "wrap",
              }}
            >
              <GlassPill
                label={
                  patient?.bloodGroup
                    ? t("home.bloodChip", { group: patient.bloodGroup })
                    : t("home.bloodEmpty")
                }
              />
              <GlassPill label={bmi ? `${bmi} BMI` : t("home.bmiEmpty")} />
              <GlassPill
                label={
                  unread?.count
                    ? t("home.alerts", { count: unread.count })
                    : t("home.noAlerts")
                }
                dot={!unread?.count}
              />
            </View>
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
          {/* Quick Actions */}
          <View style={{ gap: spacing.md }}>
            <SectionLabel title={t("home.sectionQuickActions")} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <QuickTile
                image={HOME_ASSETS.medicines}
                icon={Pill}
                label={t("home.medicines")}
                hint={t("home.medicinesHint")}
                tone="primary"
                onPress={() => router.push("/(app)/medicines")}
              />
              <QuickTile
                image={HOME_ASSETS.records}
                icon={ClipboardList}
                label={t("home.records")}
                hint={t("home.recordsHint")}
                tone="info"
                onPress={() => router.push("/(app)/records")}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <QuickTile
                image={HOME_ASSETS.doctor}
                icon={CalendarPlus}
                label={t("home.bookVisit")}
                hint={t("home.bookVisitHint")}
                tone="warning"
                onPress={() => router.push("/(app)/book-appointment")}
              />
              <QuickTile
                image={HOME_ASSETS.emergency}
                icon={AlertTriangle}
                label={t("home.emergency")}
                hint={t("home.emergencyHint")}
                tone="danger"
                onPress={() => router.push("/(app)/emergency")}
              />
            </View>
            <View
              style={{
                marginTop: spacing.xs,
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: spacing.sm,
                paddingLeft: spacing.sm,
                ...shadow.sm,
              }}
            >
              <Text
                style={[
                  typography.overline,
                  {
                    color: colors.textSubtle,
                    letterSpacing: 1.2,
                    fontWeight: "700",
                    paddingHorizontal: spacing.sm,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                {t("home.moreActions").toUpperCase()}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: spacing.sm,
                  paddingRight: spacing.md,
                  paddingBottom: 2,
                }}
              >
                <SmallAction
                  icon={ClipboardList}
                  label={t("myPrescriptions.title", "Prescriptions")}
                  tone="primary"
                  onPress={() => router.push("/(app)/prescriptions")}
                />
                <SmallAction
                  icon={FlaskConical}
                  label={t("home.bookTest", "Book a Test")}
                  tone="info"
                  onPress={() => router.push("/(app)/test-catalog")}
                />
                <SmallAction
                  icon={FileSearch}
                  label={t("home.testBookings", "Test Bookings")}
                  tone="neutral"
                  onPress={() => router.push("/(app)/test-bookings")}
                />
                <SmallAction
                  icon={Shield}
                  label={t("home.insurance", "Insurance")}
                  tone="primary"
                  onPress={() => router.push("/(app)/insurance")}
                />
                <SmallAction
                  icon={FileText}
                  label={t("home.healthSummary", "Health Summary")}
                  tone="info"
                  onPress={() => router.push("/(app)/health-summary")}
                />
                <SmallAction
                  icon={StickyNote}
                  label={t("home.notes", "Notes")}
                  tone="warning"
                  onPress={() => router.push("/(app)/notes")}
                />
                <SmallAction
                  icon={Heart}
                  label={t("home.vitalsShort", "Vitals")}
                  tone="danger"
                  onPress={() => router.push("/(app)/vitals")}
                />
              </ScrollView>
            </View>
          </View>

          {/* Featured Health Checkup Packages (with real images) */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel
              title={t("home.healthPackages", "Health Packages")}
              action={{
                label: (t("home.seeAll", "See All") || "See All") + " →",
                onPress: () => router.push("/(app)/test-packages"),
              }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: spacing.md,
                paddingRight: spacing.lg,
                paddingBottom: 4,
              }}
            >
              {CURATED_PACKAGES.map((pkg) => {
                const effectivePrice = pkg.discountPrice ?? pkg.price;
                const pct = Math.round(((pkg.price - effectivePrice) / pkg.price) * 100);

                return (
                  <Pressable
                    key={pkg.id}
                    onPress={() => router.push(`/(app)/test-package-detail/${pkg.slug}`)}
                    style={({ pressed }) => ({
                      width: 240,
                      borderRadius: 20,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      overflow: "hidden",
                      opacity: pressed ? 0.85 : 1,
                      ...shadow.sm,
                    })}
                  >
                    {/* Image Banner */}
                    <View style={{ height: 115, width: "100%", position: "relative", backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center" }}>
                      <FlaskConical size={36} color="#0284C7" />
                      <Image
                        source={packageImage(pkg)}
                        resizeMode="cover"
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 115 }}
                      />
                      {/* Badge */}
                      <View
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          backgroundColor: "#0284C7",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Sparkles size={10} color="#FFFFFF" />
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.5 }}>
                          {pkg.tag}
                        </Text>
                      </View>

                      {pct > 0 && (
                        <View
                          style={{
                            position: "absolute",
                            bottom: 8,
                            right: 8,
                            backgroundColor: "#059669",
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF" }}>
                            {pct}% OFF
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Card Content */}
                    <View style={{ padding: 12, gap: 4 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: colors.text,
                        }}
                      >
                        {pkg.name}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          lineHeight: 15,
                        }}
                      >
                        {pkg.description}
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: 8,
                          paddingTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        }}
                      >
                        <View>
                          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>
                            Rs. {effectivePrice.toLocaleString("en-LK")}
                          </Text>
                          {pkg.discountPrice ? (
                            <Text style={{ fontSize: 10, color: colors.textMuted, textDecorationLine: "line-through" }}>
                              Rs. {pkg.price.toLocaleString("en-LK")}
                            </Text>
                          ) : null}
                        </View>

                        <View
                          style={{
                            backgroundColor: colors.primary + "15",
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
                            View
                          </Text>
                          <ChevronRight size={12} color={colors.primary} />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Featured Health Insurance Plans (with real images) */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel
              title={t("home.insurancePlans", "Health Insurance Plans")}
              action={{
                label: (t("home.seeAll", "See All") || "See All") + " →",
                onPress: () => router.push("/insurance/marketplace"),
              }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: spacing.md,
                paddingRight: spacing.lg,
                paddingBottom: 4,
              }}
            >
              {CURATED_INSURANCE_PLANS.map((plan) => {
                const planImg = insurancePlanImage(plan.planType);

                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => router.push(`/insurance/plans/${plan.id}`)}
                    style={({ pressed }) => ({
                      width: 240,
                      borderRadius: 20,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      overflow: "hidden",
                      opacity: pressed ? 0.85 : 1,
                      ...shadow.sm,
                    })}
                  >
                    {/* Image Banner */}
                    <View
                      style={{
                        height: 115,
                        width: "100%",
                        position: "relative",
                        backgroundColor: "#F0FDF4",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ShieldCheck size={36} color="#059669" />
                      {planImg ? (
                        <Image
                          source={planImg}
                          resizeMode="cover"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: 115,
                          }}
                        />
                      ) : null}
                      {/* Badge */}
                      <View
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          backgroundColor: "#0369A1",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <ShieldCheck size={10} color="#FFFFFF" />
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color: "#FFFFFF",
                            letterSpacing: 0.5,
                          }}
                        >
                          {plan.tag}
                        </Text>
                      </View>

                      {plan.annualDiscountPct > 0 && (
                        <View
                          style={{
                            position: "absolute",
                            bottom: 8,
                            right: 8,
                            backgroundColor: "#059669",
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "800",
                              color: "#FFFFFF",
                            }}
                          >
                            SAVE {plan.annualDiscountPct}%
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Card Content */}
                    <View style={{ padding: 12, gap: 4 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: colors.text,
                        }}
                      >
                        {plan.name}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          lineHeight: 15,
                        }}
                      >
                        {plan.description}
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 4,
                        }}
                      >
                        <ShieldCheck size={12} color="#059669" />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: colors.text,
                          }}
                        >
                          Cover up to LKR {plan.coverageSummaryLkr.toLocaleString("en-LK")}
                        </Text>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: 6,
                          paddingTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        }}
                      >
                        <View>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "800",
                              color: colors.primary,
                            }}
                          >
                            Rs. {plan.monthlyPremiumLkr.toLocaleString("en-LK")}
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "600",
                                color: colors.textMuted,
                              }}
                            >
                              /mo
                            </Text>
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: colors.textMuted,
                            }}
                          >
                            Rs. {plan.annualPremiumLkr.toLocaleString("en-LK")}/yr
                          </Text>
                        </View>

                        <View
                          style={{
                            backgroundColor: colors.primary + "15",
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: colors.primary,
                            }}
                          >
                            View
                          </Text>
                          <ChevronRight size={12} color={colors.primary} />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* AI Section (Modern Clinical AI Assistant) */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel
              title={t("home.sectionAi")}
              action={{
                label: "Chat Now",
                onPress: () => router.push("/(app)/ai/chat"),
              }}
            />
            <View
              style={{
                borderRadius: 24,
                overflow: "hidden",
                shadowColor: "#6366F1",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.08,
                shadowRadius: 18,
                elevation: 4,
                borderWidth: 1,
                borderColor: "rgba(99, 102, 241, 0.22)",
                backgroundColor: colors.surface,
              }}
            >
              <LinearGradient
                colors={["#FFFFFF", "#F8FAFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ padding: spacing.md, gap: 14 }}
              >
                {/* ─── Top Header: Title, Live Status & Quick Action ─── */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: "#6366F1",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: 3,
                        overflow: "hidden",
                      }}
                    >
                      <LinearGradient
                        colors={["#6366F1", "#3B82F6"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Sparkles size={20} color="#FFFFFF" strokeWidth={2.4} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 16,
                            fontWeight: "800",
                            color: colors.text,
                            letterSpacing: -0.3,
                          }}
                        >
                          {t("home.aiTitle")}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: "rgba(99, 102, 241, 0.1)",
                          }}
                        >
                          <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#6366F1" }}>
                            INTELLIGENCE
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                        <View
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 3.5,
                            backgroundColor: "#10B981",
                          }}
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 11,
                            color: "#64748B",
                            fontWeight: "600",
                          }}
                        >
                          24/7 Clinical Assistant Online
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => router.push("/(app)/ai/chat")}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10,
                      backgroundColor: pressed ? "rgba(99, 102, 241, 0.16)" : "rgba(99, 102, 241, 0.08)",
                    })}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#4F46E5" }}>
                      Chat Now
                    </Text>
                    <ChevronRight size={13} color="#4F46E5" strokeWidth={2.5} />
                  </Pressable>
                </View>

                {/* ─── Interactive Quick Ask Bar ─── */}
                <Pressable
                  onPress={() => router.push("/(app)/ai/chat")}
                  accessibilityRole="button"
                  accessibilityLabel="Ask AI a health question"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: pressed ? "#E2E8F0" : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: "rgba(203, 213, 225, 0.8)",
                    borderRadius: 16,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                  })}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      backgroundColor: "#EEF2FF",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MessageSquare size={14} color="#6366F1" strokeWidth={2.4} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      color: "#64748B",
                      fontWeight: "500",
                    }}
                  >
                    Ask symptoms, lab reports, drug safety...
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: "#6366F1",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Sparkles size={11} color="#FFF" strokeWidth={2.2} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFF" }}>
                      Ask
                    </Text>
                  </View>
                </Pressable>

                {/* ─── 4 Curated AI Tools Grid (2x2) ─── */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <AiToolCard
                    icon={MessageSquare}
                    title={t("home.aiChat")}
                    desc="Symptom check & Q&A"
                    iconColor="#2563EB"
                    bgColor="#EFF6FF"
                    onPress={() => router.push("/(app)/ai/chat")}
                  />
                  <AiToolCard
                    icon={ScanText}
                    title={t("home.aiLabExplain")}
                    desc="Decode medical tests"
                    iconColor="#0D9488"
                    bgColor="#F0FDFA"
                    onPress={() => router.push("/(app)/ai/lab-explain")}
                  />
                  <AiToolCard
                    icon={Pill}
                    title={t("home.aiDrugCheck")}
                    desc="Interaction checks"
                    iconColor="#6366F1"
                    bgColor="#EEF2FF"
                    onPress={() => router.push("/(app)/ai/drug-check")}
                  />
                  <AiToolCard
                    icon={FileSearch}
                    title={t("home.aiOcrLabel", "Prescription OCR")}
                    desc="Scan paper scripts"
                    iconColor="#7C3AED"
                    bgColor="#F5F3FF"
                    onPress={() => router.push("/(app)/ai/ocr")}
                  />
                </View>

                {/* ─── Secondary Tools Strip (Horizontal chips) ─── */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 16 }}
                >
                  <AiChip
                    icon={Sparkles}
                    label={t("home.aiSummary")}
                    onPress={() => router.push("/(app)/ai/summary")}
                  />
                  <AiChip
                    icon={FlaskConical}
                    label={t("home.aiLabTrend")}
                    onPress={() => router.push("/(app)/ai/lab-trend")}
                  />
                  <AiChip
                    icon={Stethoscope}
                    label={t("home.aiClinicalNote")}
                    onPress={() => router.push("/(app)/ai/clinical-note")}
                  />
                </ScrollView>
              </LinearGradient>
            </View>
          </View>



          {/* Active Prescriptions Hub */}
          <HomePrescriptionsSection />

          {/* Coming up */}
          {upcomingAppointments.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <SectionLabel
                title={t("home.sectionComingUp")}
                action={{
                  label: t("home.allVisits"),
                  onPress: () => router.push("/(app)/appointments"),
                }}
              />
              {apptsLoading
                ? [0, 1].map((i) => (
                    <View key={i}>
                      <Card>
                        <View style={{ gap: spacing.sm }}>
                          <Skeleton width="70%" height={16} />
                          <Skeleton width="55%" height={14} />
                        </View>
                      </Card>
                    </View>
                  ))
                : upcomingAppointments.slice(0, 4).map((a: any, idx: number) => (
                    <AppointmentTimelineRow
                      key={a.id ?? `a-${idx}`}
                      item={a}
                    />
                  ))}
            </View>
          ) : null}


          <View style={{ height: spacing.lg }} />
        </View>
      </ScrollView>

      <BottomSheet
        visible={fabOpen}
        onDismiss={() => setFabOpen(false)}
        title={t("home.fab.title")}
      >
        <View style={{ gap: spacing.xs }}>
          <FabAction
            icon={Check}
            label={t("home.fab.logDose.label")}
            description={t("home.fab.logDose.desc")}
            tone="primary"
            onPress={() => {
              setFabOpen(false);
              toast.show(t("home.a11y.logDoseHint"), "info");
              router.push("/(app)/medicines");
            }}
          />
          <FabAction
            icon={Pill}
            label={t("home.fab.addMed.label")}
            description={t("home.fab.addMed.desc")}
            tone="accent"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/add-medicine");
            }}
          />
          <FabAction
            icon={StickyNote}
            label={t("home.fab.quickNote.label")}
            description={t("home.fab.quickNote.desc")}
            tone="warning"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/notes");
            }}
          />
          <FabAction
            icon={Activity}
            label={t("home.fab.logVital.label")}
            description={t("home.fab.logVital.desc")}
            tone="danger"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/vitals");
            }}
          />
          <FabAction
            icon={Upload}
            label={t("home.fab.addRecord.label")}
            description={t("home.fab.addRecord.desc")}
            tone="info"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/add-record");
            }}
          />
          <FabAction
            icon={CalendarPlus}
            label={t("home.fab.bookVisit.label")}
            description={t("home.fab.bookVisit.desc")}
            tone="accent2"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/book-appointment");
            }}
          />
          <FabAction
            icon={Share2}
            label={t("home.fab.share.label")}
            description={t("home.fab.share.desc")}
            tone="primary"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/share");
            }}
          />
          <FabAction
            icon={ClipboardList}
            label={t("home.fab.timeline.label")}
            description={t("home.fab.timeline.desc")}
            tone="primary"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/timeline");
            }}
          />
          <FabAction
            icon={FileText}
            label={t("home.fab.healthSummary.label")}
            description={t("home.fab.healthSummary.desc")}
            tone="accent"
            onPress={() => {
              setFabOpen(false);
              router.push("/(app)/health-summary");
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

// ─── Glassmorphism pill used in hero ─────────────────────────────────────
function GlassPill({ label, dot }: { label: string; dot?: boolean }) {
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
        backgroundColor: "rgba(255,255,255,0.14)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
      }}
    >
      {dot ? (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: "#34D399",
            shadowColor: "#34D399",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 4,
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

// ─── Section heading ────────────────────────────────────────────────────
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
          { color: colors.textSubtle, letterSpacing: 1.4, fontWeight: "700" },
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
          <Text style={[typography.label.md, { color: colors.primary, fontWeight: "700" }]}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Quick action tile (premium with 3D illustration) ───────────────────
function QuickTile({
  icon: Icon,
  image,
  label,
  hint,
  tone,
  badge,
  onPress,
}: {
  icon: React.ComponentType<any>;
  image?: any;
  label: string;
  hint?: string;
  tone: Tone;
  badge?: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography, fontFamily } = useTheme();
  const palette = useTone(tone);
  const isEmergency = tone === "danger";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => ({
        flexBasis: "48%",
        flexGrow: 1,
        borderRadius: 22,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: isEmergency ? "rgba(239, 68, 68, 0.25)" : colors.border,
        overflow: "hidden",
        opacity: pressed ? 0.94 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        shadowColor: isEmergency ? "#EF4444" : "rgba(0, 0, 0, 0.08)",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: isEmergency ? 0.16 : 0.08,
        shadowRadius: 12,
        elevation: 3,
      })}
    >
      {/* Full width hero image at top */}
      <View
        style={{
          width: "100%",
          height: 112,
          position: "relative",
          backgroundColor: isEmergency ? "rgba(239, 68, 68, 0.08)" : palette.bg,
        }}
      >
        {image ? (
          <Image
            source={image}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: isEmergency ? "rgba(239, 68, 68, 0.15)" : palette.bg,
            }}
          />
        )}

        {/* Floating Icon Chip on Top-Left */}
        <View
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 5,
            elevation: 3,
          }}
        >
          <Icon size={19} color={palette.fg} strokeWidth={2.4} />
        </View>

        {/* Optional Badge on Top-Right (e.g. SOS for Emergency) */}
        {isEmergency ? (
          <View
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: "#EF4444",
              shadowColor: "#EF4444",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                color: "#FFFFFF",
                letterSpacing: 0.6,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              SOS
            </Text>
          </View>
        ) : badge ? (
          <View
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: palette.bgStrong,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: palette.onBgStrong,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Text details UNDER the image */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 14,
          gap: 3,
          backgroundColor: isEmergency ? palette.bg : colors.surface,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 15.5,
              fontWeight: "700",
              color: isEmergency ? palette.fg : colors.text,
              letterSpacing: -0.2,
              fontFamily: fontFamily.bodyBold,
              flex: 1,
            }}
          >
            {label}
          </Text>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: isEmergency ? "rgba(239, 68, 68, 0.12)" : colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 4,
            }}
          >
            <ChevronRight
              size={13}
              color={isEmergency ? palette.fg : colors.textSubtle}
              strokeWidth={2.5}
            />
          </View>
        </View>
        {hint ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: isEmergency ? palette.fg : colors.textMuted,
              opacity: isEmergency ? 0.85 : 1,
              fontFamily: fontFamily.bodyMedium,
            }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── AI section tool card (sleek modern 2-col tile) ─────────────────────
function AiToolCard({
  icon: Icon,
  title,
  desc,
  iconColor,
  bgColor,
  onPress,
}: {
  icon: any;
  title: string;
  desc: string;
  iconColor: string;
  bgColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${desc}`}
      style={({ pressed }) => ({
        flexBasis: "48%",
        flexGrow: 1,
        padding: 12,
        borderRadius: 18,
        backgroundColor: pressed ? "#F8FAFC" : "#FFFFFF",
        borderWidth: 1,
        borderColor: pressed ? "#C7D2FE" : "rgba(226, 232, 240, 0.9)",
        gap: 10,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 2,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: bgColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={iconColor} strokeWidth={2.4} />
        </View>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "#F1F5F9",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={13} color="#64748B" strokeWidth={2.5} />
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13,
            fontWeight: "800",
            color: "#0F172A",
            letterSpacing: -0.2,
          }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11,
            color: "#64748B",
            fontWeight: "500",
          }}
        >
          {desc}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── AI Chip for secondary tools ───────────────────────────────────────
function AiChip({
  icon: Icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        flexShrink: 0,
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: pressed ? "#EEF2FF" : "#FFFFFF",
        borderWidth: 1,
        borderColor: "rgba(226, 232, 240, 0.9)",
      })}
    >
      <Icon size={13} color="#6366F1" strokeWidth={2.2} />
      <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#334155" }}>
        {label}
      </Text>
      <ChevronRight size={11} color="#94A3B8" strokeWidth={2.2} />
    </Pressable>
  );
}

// ─── Small action chip (for horizontal scroll under Quick Actions) ─────
function SmallAction({
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
  const { colors } = useTheme();
  const palette = useTone(tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 5,
        paddingRight: 14,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: pressed ? palette.bg : colors.surfaceMuted,
        borderWidth: 1,
        borderColor: pressed ? palette.border : colors.border,
        minHeight: 40,
      })}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: palette.bgStrong,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={14} color={palette.onBgStrong} strokeWidth={2.5} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 12.5,
          fontWeight: "700",
          color: colors.text,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Schedule card with color-coded accent ─────────────────────────────
function ScheduleCard({
  meta,
  items,
}: {
  meta: { label: string; tone: Tone };
  items: any[];
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography, shadow: themeShadow } = useTheme();
  const key = (meta.tone === "accent" ? "afternoon"
              : meta.tone === "accent2" ? "evening"
              : meta.tone === "info" ? "night"
              : "morning") as TimingKey;
  const accent = PERIOD_ACCENT[key];

  return (
    <View
      style={{
        width: 130,
        paddingTop: 14,
        paddingBottom: 14,
        paddingHorizontal: 14,
        borderRadius: 22,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        gap: 4,
        position: "relative",
        overflow: "hidden",
        ...themeShadow.sm,
      }}
    >
      {/* Color accent strip on top */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: accent.color,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: accent.color,
          }}
        />
        <Text
          numberOfLines={1}
          style={{
            fontSize: 10.5,
            fontWeight: "800",
            color: accent.color,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          {meta.label}
        </Text>
      </View>

      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          marginTop: 4,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 3,
          borderColor: accent.soft,
          backgroundColor: accent.soft,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "800",
            color: accent.color,
            letterSpacing: -0.5,
          }}
        >
          {items.length}
        </Text>
      </View>

      <Text
        numberOfLines={1}
        style={{
          fontSize: 10.5,
          color: colors.textMuted,
          fontWeight: "600",
          marginTop: 2,
        }}
      >
        {t("home.dose", { count: items.length })}
      </Text>
    </View>
  );
}

// ─── Wellness circular progress gauge (SVG) ───────────────────────────
function WellnessScoreRing({
  score,
  tone = "info",
  size = 88,
}: {
  score: number;
  tone?: Tone;
  size?: number;
}) {
  const strokeWidth = 7.5;
  const center = size / 2;
  const radius = center - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const gradColors: [string, string] = (() => {
    if (tone === "success" || score >= 80) return ["#10B981", "#059669"];
    if (tone === "warning" || score < 50) return ["#F59E0B", "#D97706"];
    if (tone === "danger" || score < 30) return ["#EF4444", "#DC2626"];
    return ["#38BDF8", "#0284C7"];
  })();

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Ambient background glow */}
      <View
        style={{
          position: "absolute",
          width: size - 16,
          height: size - 16,
          borderRadius: (size - 16) / 2,
          backgroundColor: `${gradColors[0]}18`,
          shadowColor: gradColors[1],
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
        }}
      />

      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <SvgGradient id="wellnessRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradColors[0]} />
            <Stop offset="100%" stopColor={gradColors[1]} />
          </SvgGradient>
        </Defs>

        {/* Track circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(2, 132, 199, 0.12)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Active progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#wellnessRingGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </Svg>

      {/* Central Score */}
      <View
        style={{
          position: "absolute",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: gradColors[1],
            fontWeight: "800",
            fontSize: 26,
            lineHeight: 28,
            letterSpacing: -0.5,
          }}
        >
          {score}
        </Text>
        <Text
          style={{
            fontSize: 9.5,
            color: "#64748B",
            fontWeight: "800",
            marginTop: 1,
            letterSpacing: 0.5,
          }}
        >
          /100
        </Text>
      </View>
    </View>
  );
}

const COMPONENT_CONFIG: Record<
  string,
  {
    title: string;
    icon: any;
    colors: [string, string];
    bgColor: string;
  }
> = {
  bmi: {
    title: "Body Mass (BMI)",
    icon: Scale,
    colors: ["#06B6D4", "#0891B2"],
    bgColor: "#ECFEFF",
  },
  adherence: {
    title: "Med Adherence",
    icon: Pill,
    colors: ["#3B82F6", "#1D4ED8"],
    bgColor: "#EFF6FF",
  },
  vitals: {
    title: "Vitals In Range",
    icon: HeartPulse,
    colors: ["#F43F5E", "#BE123C"],
    bgColor: "#FFF1F2",
  },
  derived: {
    title: "Clinical Indices",
    icon: Activity,
    colors: ["#8B5CF6", "#6D28D9"],
    bgColor: "#F5F3FF",
  },
  profile: {
    title: "Health Profile",
    icon: ShieldCheck,
    colors: ["#F59E0B", "#B45309"],
    bgColor: "#FFFBEB",
  },
  engagement: {
    title: "App Activity",
    icon: Sparkles,
    colors: ["#10B981", "#047857"],
    bgColor: "#ECFDF5",
  },
};

// ─── Wellness metric tile (compact modern card) ────────────────────────
function WellnessMetricTile({
  itemKey,
  label,
  score,
  max,
}: {
  itemKey: string;
  label: string;
  score: number;
  max: number;
}) {
  const config = COMPONENT_CONFIG[itemKey] ?? {
    title: label,
    icon: Activity,
    colors: ["#0284C7", "#0369A1"],
    bgColor: "#F0F9FF",
  };
  const Icon = config.icon;
  const pct = max > 0 ? Math.min(100, Math.round((score / max) * 100)) : 0;

  return (
    <View
      style={{
        flexBasis: "48%",
        flexGrow: 1,
        padding: 12,
        borderRadius: 16,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "rgba(226, 232, 240, 0.85)",
        gap: 8,
      }}
    >
      {/* Top Header: Icon + Percentage */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            backgroundColor: config.bgColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={14} color={config.colors[0]} strokeWidth={2.4} />
        </View>

        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: `${config.colors[0]}15`,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: config.colors[1],
            }}
          >
            {pct}%
          </Text>
        </View>
      </View>

      {/* Metric Title (Full width) */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 12.5,
          fontWeight: "700",
          color: "#1E293B",
        }}
      >
        {config.title}
      </Text>

      {/* Bottom: Score fraction + sleek progress bar */}
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "600" }}>
            Score
          </Text>
          <Text style={{ fontSize: 11, color: "#475569", fontWeight: "700" }}>
            {score}/{max}
          </Text>
        </View>
        <View
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: "rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={config.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 3,
            }}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Wellness Card (redesigned modern health dashboard) ────────────────
function WellnessCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, shadow: themeShadow } = useTheme();
  const { data, isLoading } = useWellness();
  const tone: Tone = data?.level?.tone ?? "info";
  const palette = useTone(tone);

  if (isLoading) {
    return (
      <Card style={{ padding: spacing.lg, gap: spacing.md, borderRadius: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Skeleton width={88} height={88} radius={44} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={14} />
          </View>
        </View>
        <Skeleton width="100%" height={40} radius={12} />
        <Skeleton width="100%" height={10} radius={5} />
      </Card>
    );
  }

  if (!data) return null;

  const score = data.score;
  const components = Array.isArray(data.components) ? data.components : [];

  return (
    <Card
      style={{
        padding: spacing.lg,
        gap: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(226, 232, 240, 0.8)",
        shadowColor: "#0284C7",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 4,
      }}
    >
      {/* ─── Hero Header: Circular Gauge + Status ─── */}
      <Pressable
        onPress={() => router.push("/(app)/profile")}
        accessibilityRole="button"
        accessibilityLabel={t("home.a11y.wellnessScore")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        {/* SVG Circular Progress Gauge */}
        <WellnessScoreRing score={score} tone={tone} size={88} />

        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          {/* Status badge pill */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 12,
                backgroundColor: palette.bg,
                borderWidth: 1,
                borderColor: `${palette.fg}33`,
              }}
            >
              <HeartPulse size={12} color={palette.fg} strokeWidth={2.5} />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 10.5,
                  color: palette.fg,
                  letterSpacing: 0.8,
                  fontWeight: "800",
                  textTransform: "uppercase",
                }}
              >
                {data.level?.label ?? t("home.wellnessDefault")}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 11,
                color: "#64748B",
                fontWeight: "600",
              }}
            >
              Health Score
            </Text>
          </View>

          {/* Headline */}
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              fontWeight: "800",
              fontSize: 20,
              letterSpacing: -0.4,
            }}
          >
            {score >= 75
              ? t("home.wellnessDoingGreat")
              : score >= 45
              ? t("home.wellnessRoomToImprove")
              : t("home.wellnessBackOnTrack")}
          </Text>

          {/* BMI Status & Tap Hint */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: "#F1F5F9",
              }}
            >
              <Scale size={11} color="#64748B" strokeWidth={2.2} />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  color: "#475569",
                  fontWeight: "700",
                }}
              >
                {data.bmi != null
                  ? `BMI ${data.bmi} • ${data.bmiCategory ?? "Healthy"}`
                  : t("home.a11y.bmiNeeded")}
              </Text>
            </View>
            <ChevronRight size={14} color="#94A3B8" strokeWidth={2.5} />
          </View>
        </View>
      </Pressable>

      {/* ─── 2-Column Metric Tiles Grid ─── */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {components.map((c) => (
          <WellnessMetricTile
            key={c.key}
            itemKey={c.key}
            label={c.label}
            score={c.score}
            max={c.max}
          />
        ))}
      </View>

      {/* ─── Actionable Health Insight Banner ─── */}
      {data.topTip ? (
        <Pressable
          onPress={() => router.push("/(app)/vitals")}
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <LinearGradient
            colors={["#F0F9FF", "#E0F2FE"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 13,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(56, 189, 248, 0.4)",
              shadowColor: "#0284C7",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                backgroundColor: "#0284C7",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#0284C7",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
              }}
            >
              <Sparkles size={18} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: "#0369A1",
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                }}
              >
                Daily Health Insight
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#0F172A",
                  lineHeight: 16,
                }}
              >
                {data.topTip}
              </Text>
            </View>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "rgba(255, 255, 255, 0.85)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={15} color="#0284C7" strokeWidth={2.5} />
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      {/* ─── Bottom Quick Stat Pills ─── */}
      <View
        style={{
          flexDirection: "row",
          gap: 10,
        }}
      >
        <MiniStatCard
          icon={ShieldCheck}
          label="Profile Info"
          value={
            data.profile?.filled != null && data.profile.filled > 0
              ? `${data.profile.filled}/${data.profile.total}`
              : "—"
          }
          tone="warning"
          onPress={() => router.push("/(app)/profile")}
        />
        <MiniStatCard
          icon={Pill}
          label="Today's Doses"
          value={
            data.adherence?.scheduled != null && data.adherence.scheduled > 0
              ? `${data.adherence.taken}/${data.adherence.scheduled}`
              : "—"
          }
          tone="primary"
          onPress={() => router.push("/(app)/medicines")}
        />
        <MiniStatCard
          icon={HeartPulse}
          label="Recent Vitals"
          value={data.vitals?.readings != null ? `${data.vitals.readings}` : "—"}
          tone="danger"
          onPress={() => router.push("/(app)/vitals")}
        />
      </View>
    </Card>
  );
}

function MiniStatCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
  onPress,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: Tone;
  onPress?: () => void;
}) {
  const p = useTone(tone);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 16,
        backgroundColor: pressed ? "#F1F5F9" : "#F8FAFC",
        borderWidth: 1,
        borderColor: "rgba(226, 232, 240, 0.8)",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          backgroundColor: p.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={14} color={p.fg} strokeWidth={2.4} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 10,
          fontWeight: "600",
          color: "#64748B",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 14,
          fontWeight: "800",
          color: "#0F172A",
          textAlign: "center",
        }}
      >
        {value}
      </Text>
    </Pressable>
  );
}

// ─── Vitals glance (horizontal scroll of mini sparkline cards) ─────────
function VitalsGlanceCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow: themeShadow } = useTheme();
  const { data: derivedData } = useVitalsDerived();
  const { data: bpSeries } = useVitalsSparkline("blood_pressure", 7);
  const { data: hrSeries } = useVitalsSparkline("heart_rate", 7);
  const { data: spo2Series } = useVitalsSparkline("spo2", 7);
  const { data: wtSeries } = useVitalsSparkline("weight", 7);
  const { data: glucoseSeries } = useVitalsSparkline("blood_sugar", 7);

  const latestByType = derivedData?.latestByType ?? [];
  const latest = (type: any) => latestByType.find((l) => l.type === type)?.latest;

  const tiles: Array<{ type: any; series: any; icon: any; tone: Tone }> = [
    { type: "blood_pressure", series: bpSeries, icon: Heart, tone: "danger" },
    { type: "blood_sugar", series: glucoseSeries, icon: Droplet, tone: "warning" },
    { type: "heart_rate", series: hrSeries, icon: Activity, tone: "primary" },
    { type: "spo2", series: spo2Series, icon: Activity, tone: "info" },
    { type: "weight", series: wtSeries, icon: Scale, tone: "success" },
  ];

  // Resolve all palettes at the top level so the order of hooks stays stable
  const paletteBp = useTone("danger");
  const paletteBs = useTone("warning");
  const paletteHr = useTone("primary");
  const paletteSp = useTone("info");
  const paletteWt = useTone("success");
  const palettes = [paletteBp, paletteBs, paletteHr, paletteSp, paletteWt];

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel
        title={t("home.vitalsGlance.title")}
        action={{
          label: t("home.viewAll"),
          onPress: () => router.push("/(app)/vitals"),
        }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
      >
        {tiles.map(({ type, series, icon: Icon }, idx) => {
          const l = latest(type);
          const def = VITAL_REGISTRY[type as VitalType];
          const reading = l
            ? l.secondary != null
              ? `${l.value}/${l.secondary}`
              : `${l.value}`
            : "—";
          const unit = l?.unit || def?.unit || "";
          const cls = l?.classification ?? "normal";
          const stroke =
            cls === "critical" || cls === "high"
              ? colors.danger
              : cls === "elevated" || cls === "low"
              ? colors.warning
              : colors.success;
          const palette = palettes[idx];
          return (
            <Pressable
              key={type}
              onPress={() => router.push("/(app)/vitals")}
              accessibilityRole="button"
              accessibilityLabel={`${def?.label ?? type}: ${reading} ${unit}`}
              style={({ pressed }) => ({
                width: 140,
                padding: spacing.md,
                borderRadius: 18,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.sm,
                opacity: pressed ? 0.92 : 1,
                ...themeShadow.sm,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: palette.bg,
                  }}
                >
                  <Icon size={15} color={palette.fg} strokeWidth={2.5} />
                </View>
                {l ? (
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 3.5,
                      backgroundColor: stroke,
                    }}
                  />
                ) : null}
              </View>
              <View>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 10.5,
                    fontWeight: "700",
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {def?.label ?? type}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 3,
                    marginTop: 2,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: colors.text,
                      letterSpacing: -0.4,
                    }}
                  >
                    {reading}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10.5,
                      fontWeight: "600",
                      color: colors.textMuted,
                    }}
                  >
                    {unit}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 2 }}>
                <Sparkline
                  points={series?.points ?? []}
                  width={108}
                  height={26}
                  stroke={stroke}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Appointment card with date stamp ──────────────────────────────────
function AppointmentTimelineRow({
  item,
}: {
  item: any;
  isLast?: boolean;
  isFirst?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { colors, spacing, typography, radius, shadow: themeShadow } = useTheme();
  const dateLabel = item?.date ? formatDate(t, locale, item.date) : "—";
  const timeLabel = item?.time ? formatClock(item.time) : "";

  const title = item?.reason || t("appointments.fallbackTitle");
  const subLabel = item?.queueNumber
    ? `${t("home.queuePill", { n: item.queueNumber })}${item?.status ? ` • ${item.status}` : ""}`
    : item?.status
    ? item.status
    : t("home.tapToViewDetails");

  const isHighlightDate =
    dateLabel === t("home.dateToday") ||
    dateLabel === t("home.dateTomorrow");

  // Parse day + month for the date stamp
  let dayNum = "—";
  let monTxt = "";
  if (item?.date) {
    try {
      const d = new Date(item.date);
      if (!isNaN(d.getTime())) {
        dayNum = String(d.getDate());
        monTxt = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
      }
    } catch {}
  }

  return (
    <Pressable
      onPress={() => router.push("/(app)/appointments")}
      accessibilityRole="button"
      style={({ pressed }) => ({
        opacity: pressed ? 0.95 : 1,
        borderRadius: 18,
        ...(pressed ? { backgroundColor: colors.surfaceMuted } : null),
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: 14,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...themeShadow.sm,
        }}
      >
        <LinearGradient
          colors={isHighlightDate ? ["#E0F2FE", "#BAE6FD"] : ["#F1F5F9", "#E2E8F0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 52,
            height: 56,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: isHighlightDate ? "#0369A1" : colors.text,
              lineHeight: 1,
              letterSpacing: -0.5,
            }}
          >
            {dayNum}
          </Text>
          <Text
            style={{
              fontSize: 9,
              fontWeight: "800",
              color: isHighlightDate ? "#0369A1" : colors.textMuted,
              textTransform: "uppercase",
              marginTop: 3,
              letterSpacing: 0.6,
            }}
          >
            {monTxt}
          </Text>
        </LinearGradient>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "700", letterSpacing: -0.1 },
            ]}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 2 },
            ]}
          >
            {subLabel}
          </Text>
        </View>

        {timeLabel ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: isHighlightDate ? colors.primarySoft : colors.surfaceMuted,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: isHighlightDate ? colors.primary : colors.text,
              }}
            >
              {timeLabel}
            </Text>
          </View>
        ) : null}
        <ChevronRight
          size={16}
          color={colors.textSubtle}
          strokeWidth={2.25}
        />
      </View>
    </Pressable>
  );
}

function FabAction({
  icon: Icon,
  label,
  description,
  tone,
  onPress,
}: {
  icon: any;
  label: string;
  description: string;
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
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
        }}
      >
        <Icon size={20} color={palette.fg} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={[typography.title.sm, { color: colors.text }]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[typography.caption, { color: colors.textMuted }]}
        >
          {description}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.25} />
    </Pressable>
  );
}

function formatDate(t: (k: string) => string, locale: Locale, input?: string) {
  if (!input) return "—";
  try {
    const d = new Date(input);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (sameDay(d, today)) return t("home.dateToday");
    if (sameDay(d, tomorrow)) return t("home.dateTomorrow");
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return input;
  }
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatClock(input: string) {
  const [hStr, mStr] = (input || "").split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return input || "—";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mStr || "00"} ${ampm}`;
}

const styles = StyleSheet.create({
  heroOrb: {
    position: "absolute",
    borderRadius: 9999,
  },
  bellBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});

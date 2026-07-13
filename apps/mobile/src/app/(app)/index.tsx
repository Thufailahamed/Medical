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
  FileSearch,
  Share2,
  FileText,
  Heart,
  Scale,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore, type Locale } from "@/stores/locale";
import { ActiveMemberPill } from "@/components/ActiveMemberPill";
import { TenantSwitcher } from "@/components/TenantSwitcher";
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
import {
  Screen,
  Card,
  EmptyState,
  Skeleton,
  DoseRing,
  BottomSheet,
  useToast,
  Button,
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
        contentContainerStyle={{ paddingBottom: layout.tabBarHeight + spacing.lg }}
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
                <LinearGradient
                  colors={["#38BDF8", "#0284C7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: "#FFFFFF",
                      letterSpacing: -0.3,
                    }}
                  >
                    {(userName || "?")[0]?.toUpperCase()}
                  </Text>
                </LinearGradient>
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
                />
              </View>
            </View>

            {/* Glassmorphism "Upcoming today" panel */}
            {(nextMed || appointments[0]) && (
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
                        marginBottom: appointments[0] ? 8 : 0,
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

                  {appointments[0] && (
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
                        {t("home.doctorAt", {
                          name: appointments[0].doctorName,
                          time: appointments[0].time,
                        })}
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
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title={t("home.sectionQuickActions")} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <QuickTile
                icon={Pill}
                label={t("home.medicines")}
                tone="primary"
                onPress={() => router.push("/(app)/medicines")}
              />
              <QuickTile
                icon={ClipboardList}
                label={t("home.records")}
                tone="neutral"
                onPress={() => router.push("/(app)/records")}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <QuickTile
                icon={CalendarPlus}
                label={t("home.bookVisit")}
                tone="warning"
                onPress={() => router.push("/(app)/book-appointment")}
              />
              <QuickTile
                icon={AlertTriangle}
                label={t("home.emergency")}
                tone="danger"
                onPress={() => router.push("/(app)/emergency")}
              />
            </View>
          </View>

          {/* AI Section (premium dark) */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title={t("home.sectionAi")} />
            <View
              style={{
                borderRadius: 28,
                overflow: "hidden",
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.06,
                shadowRadius: 16,
                elevation: 3,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <LinearGradient
                colors={["#FFFFFF", "#F0F7FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: spacing.lg, position: "relative" }}
              >
                {/* Subtle blue glow orbs */}
                <View
                  style={{
                    position: "absolute",
                    top: -80,
                    right: -40,
                    width: 220,
                    height: 220,
                    borderRadius: 110,
                    backgroundColor: "rgba(56, 189, 248, 0.12)",
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    bottom: -90,
                    left: -30,
                    width: 200,
                    height: 200,
                    borderRadius: 100,
                    backgroundColor: "rgba(99, 102, 241, 0.08)",
                  }}
                />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    position: "relative",
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    <LinearGradient
                      colors={[colors.primary, "#1D4ED8"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Sparkles size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: colors.text,
                        letterSpacing: -0.2,
                        fontFamily: fontFamily.displayBold,
                      }}
                    >
                      {t("home.aiTitle")}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        marginTop: 1,
                        fontWeight: "500",
                      }}
                    >
                      {t("home.aiSubtitle")}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.border,
                    marginVertical: spacing.md,
                  }}
                />

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.sm,
                  }}
                >
                  <AiTile
                    icon={MessageSquare}
                    label={t("home.aiChat")}
                    iconColor="#2563EB"
                    iconBg="#EFF6FF"
                    onPress={() => router.push("/(app)/ai/chat")}
                  />
                  <AiTile
                    icon={Sparkles}
                    label={t("home.aiSummary")}
                    iconColor="#0284C7"
                    iconBg="#F0F9FF"
                    onPress={() => router.push("/(app)/ai/summary")}
                  />
                  <AiTile
                    icon={ScanText}
                    label={t("home.aiLabExplain")}
                    iconColor="#0D9488"
                    iconBg="#F0FDFA"
                    onPress={() => router.push("/(app)/ai/lab-explain")}
                  />
                  <AiTile
                    icon={Pill}
                    label={t("home.aiDrugCheck")}
                    iconColor="#4F46E5"
                    iconBg="#EEF2FF"
                  />
                </View>
              </LinearGradient>
            </View>
            <Button
              title={t("home.aiOcrButton")}
              icon={FileSearch}
              variant="outline"
              size="md"
              fullWidth
              onPress={() => router.push("/(app)/ai/ocr")}
            />
          </View>

          {/* Up next (premium gradient) */}
          {nextMed ? (
            <Pressable
              onPress={() => router.push("/(app)/medicines")}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.upNextMedicine")}
              style={({ pressed }) => ({
                borderRadius: 22,
                overflow: "hidden",
                opacity: pressed ? 0.95 : 1,
                shadowColor: "#0EA5E9",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.18,
                shadowRadius: 16,
                elevation: 4,
              })}
            >
              <LinearGradient
                colors={["#E0F2FE", "#BAE6FD"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    backgroundColor: "#0EA5E9",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#0EA5E9",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                  }}
                >
                  <LinearGradient
                    colors={["#38BDF8", "#0284C7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Clock size={22} color="#FFFFFF" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: "#0369A1",
                      letterSpacing: 1.3,
                      fontFamily: fontFamily.displayBold,
                    }}
                  >
                    {t("home.upNextLabel")}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 15,
                      color: "#0C4A6E",
                      marginTop: 2,
                      fontWeight: "800",
                      letterSpacing: -0.2,
                    }}
                  >
                    {nextMed?.name ?? t("home.fallbackMed")}
                    {nextMed?.dosage ? ` ${nextMed.dosage}` : ""}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 11.5,
                      color: "#0369A1",
                      opacity: 0.7,
                      marginTop: 1,
                    }}
                  >
                    {nextMed?.notes ?? nextMed?.timing ?? t("home.tapToView")}
                  </Text>
                </View>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <ChevronRight size={16} color="#0284C7" strokeWidth={2.5} />
                </View>
              </LinearGradient>
            </Pressable>
          ) : null}

          {/* Schedule */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel
              title={t("home.sectionSchedule")}
              action={
                todayMeds.length > 0
                  ? {
                      label: t("home.viewAll"),
                      onPress: () => router.push("/(app)/medicines"),
                    }
                  : undefined
              }
            />

            {medsLoading ? (
              <Card>
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <Skeleton width={130} height={130} radius={radius.xl} />
                  <Skeleton width={130} height={130} radius={radius.xl} />
                  <Skeleton width={130} height={130} radius={radius.xl} />
                </View>
              </Card>
            ) : totalMeds === 0 ? (
              <EmptyState
                icon={Pill}
                title={t("home.scheduleEmptyTitle")}
                message={t("home.scheduleEmptyBody")}
                actionLabel={t("home.scheduleEmptyAction")}
                onAction={() => router.push("/(app)/add-medicine")}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: spacing.md,
                  paddingRight: spacing.sm,
                }}
              >
                {(Object.keys(grouped) as TimingKey[])
                  .filter((k) => grouped[k].length > 0)
                  .map((k) => (
                    <ScheduleCard
                      key={k}
                      meta={timingMeta[k]}
                      items={grouped[k]}
                    />
                  ))}
              </ScrollView>
            )}
          </View>

          {/* Wellness */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title={t("home.sectionWellness")} />
            <WellnessCard />
          </View>

          {/* Vitals at a glance — sparkline row */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel title={t("home.vitalsGlance.title")} />
            <VitalsGlanceCard />
          </View>

          {/* Coming up */}
          {appointments.length > 0 ? (
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
                : appointments.slice(0, 4).map((a: any, idx: number) => (
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

// ─── Quick action tile (premium) ────────────────────────────────────────
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
  const { colors, spacing, radius, typography, shadow: themeShadow } = useTheme();
  const palette = useTone(tone);

  const isEmergency = tone === "danger";
  const labelColor = isEmergency ? palette.fg : colors.text;
  const chevronColor = isEmergency ? palette.fg : colors.textSubtle;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexBasis: "48%",
        flexGrow: 1,
        padding: spacing.md,
        borderRadius: 22,
        backgroundColor: palette.bg,
        opacity: pressed ? 0.85 : 1,
        minHeight: 108,
        justifyContent: "space-between",
        gap: spacing.md,
        borderWidth: 1,
        borderColor: palette.bg === colors.surfaceMuted ? colors.border : "transparent",
        overflow: "hidden",
        position: "relative",
        ...themeShadow.sm,
      })}
    >
      {/* Subtle inner highlight — gives the tile a 3D feel */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.5)",
        }}
      />

      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
          backgroundColor: "#FFFFFF",
        }}
      >
        <Icon size={18} color={palette.fg} strokeWidth={2.5} />
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
              color: labelColor,
              fontWeight: "700",
              flex: 1,
              letterSpacing: -0.1,
            },
          ]}
        >
          {label}
        </Text>
        <ChevronRight size={14} color={chevronColor} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

// ─── AI section tile (light theme white and blue) ───────────────────────
function AiTile({
  icon: Icon,
  label,
  iconColor = "#3B82F6",
  iconBg = "rgba(59, 130, 246, 0.1)",
  onPress,
}: {
  icon: any;
  label: string;
  iconColor?: string;
  iconBg?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexBasis: "48%",
        flexGrow: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: pressed ? "#F0F7FF" : "#FFFFFF",
        borderWidth: 1,
        borderColor: pressed ? "#93C5FD" : colors.border,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={15} color={iconColor} strokeWidth={2.5} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: colors.text,
          letterSpacing: -0.1,
          flex: 1,
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

// ─── Wellness bar (gradient) ───────────────────────────────────────────
function WellnessBar({
  label,
  score,
  max,
  tone,
}: {
  label: string;
  score: number;
  max: number;
  tone: Tone;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  const p = useTone(tone);
  const pct = max > 0 ? (score / max) * 100 : 0;

  const gradient: [string, string] = (() => {
    if (tone === "accent") return ["#38BDF8", "#0284C7"];
    if (tone === "warning") return ["#FBBF24", "#F59E0B"];
    if (tone === "info") return ["#67E8F9", "#22D3EE"];
    if (tone === "danger") return ["#FCA5A5", "#EF4444"];
    if (tone === "success") return ["#34D399", "#10B981"];
    return ["#38BDF8", "#0EA5E9"];
  })();

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            typography.label.md,
            { color: colors.text, fontWeight: "700", flex: 1 },
          ]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            typography.caption,
            { color: colors.textMuted, fontWeight: "700" },
          ]}
        >
          {score}/{max}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.surfaceMuted,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}

const COMPONENT_TONE: Record<string, Tone> = {
  bmi: "info",
  adherence: "primary",
  vitals: "accent",
  profile: "warning",
  engagement: "success",
};

// ─── Wellness card (premium — conic-style ring via gradient) ───────────
function WellnessCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, shadow: themeShadow } = useTheme();
  const { data, isLoading } = useWellness();
  const tone: Tone = data?.level?.tone ?? "info";
  const palette = useTone(tone);

  if (isLoading) {
    return (
      <Card style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Skeleton width={76} height={76} radius={38} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={14} />
          </View>
        </View>
        <Skeleton width="100%" height={10} radius={5} />
        <Skeleton width="100%" height={10} radius={5} />
      </Card>
    );
  }

  if (!data) return null;

  const score = data.score;
  const components = Array.isArray(data.components) ? data.components : [];
  const Trend = score >= 75 ? TrendingUp : score >= 45 ? Minus : TrendingDown;

  return (
    <Pressable
      onPress={() => router.push("/(app)/profile")}
      accessibilityRole="button"
      accessibilityLabel={t("home.a11y.wellnessScore")}
      style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
    >
      <Card
        style={{
          padding: spacing.lg,
          gap: spacing.lg,
          backgroundColor: colors.surface,
          borderColor: palette.bg,
          ...themeShadow.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          {/* Conic-style score ring with glow */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: palette.fg,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 6,
              backgroundColor: palette.bg,
              borderWidth: 3,
              borderColor: palette.fg,
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[
                typography.display.lg,
                {
                  color: palette.fg,
                  fontWeight: "800",
                  fontSize: 28,
                  lineHeight: 32,
                  includeFontPadding: false,
                  letterSpacing: -0.5,
                },
              ]}
            >
              {score}
            </Text>
            <Text
              style={{
                fontSize: 9,
                color: palette.fg,
                fontWeight: "800",
                marginTop: -2,
                letterSpacing: 0.4,
                opacity: 0.7,
              }}
            >
              / 100
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  backgroundColor: palette.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <HeartPulse size={12} color={palette.fg} strokeWidth={2.5} />
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 10.5,
                  color: palette.fg,
                  letterSpacing: 1.3,
                  fontWeight: "800",
                }}
              >
                {data.level?.label?.toUpperCase() ?? t("home.wellnessDefault")}
              </Text>
            </View>
            <Text
              numberOfLines={2}
              style={[
                typography.title.md,
                { color: colors.text, fontWeight: "800", fontSize: 17, letterSpacing: -0.3 },
              ]}
            >
              {score >= 75
                ? t("home.wellnessDoingGreat")
                : score >= 45
                ? t("home.wellnessRoomToImprove")
                : t("home.wellnessBackOnTrack")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Trend size={12} color={colors.textMuted} strokeWidth={2.5} />
              <Text
                numberOfLines={1}
                style={[typography.caption, { color: colors.textMuted, flex: 1 }]}
              >
                {data.bmi != null
                  ? t("home.bmiRow", { bmi: data.bmi, category: data.bmiCategory })
                  : t("home.a11y.bmiNeeded")}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          {components.map((c) => (
            <WellnessBar
              key={c.key}
              label={c.label}
              score={c.score}
              max={c.max}
              tone={COMPONENT_TONE[c.key] ?? "neutral"}
            />
          ))}
        </View>

        {data.topTip ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: 14,
              backgroundColor: palette.bg,
              borderWidth: 1,
              borderColor: `${palette.fg}33`,
            }}
          >
            <Sparkles size={16} color={palette.fg} strokeWidth={2.5} />
            <Text
              style={[
                typography.body.sm,
                { color: colors.text, flex: 1 },
              ]}
            >
              {data.topTip}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            paddingTop: spacing.xs,
          }}
        >
          <MiniStat
            icon={Droplet}
            label={t("home.miniStat.blood")}
            value={
              data.profile?.filled != null && data.profile.filled > 0
                ? `${data.profile.filled}/${data.profile.total}`
                : "—"
            }
          />
          <MiniStat
            icon={Pill}
            label={t("home.miniStat.doses")}
            value={
              data.adherence?.scheduled != null && data.adherence.scheduled > 0
                ? `${data.adherence.taken}/${data.adherence.scheduled}`
                : "—"
            }
          />
          <MiniStat
            icon={Activity}
            label={t("home.miniStat.vitals")}
            value={data.vitals?.readings != null ? String(data.vitals.readings) : "—"}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceMuted,
        minWidth: 0,
      }}
    >
      <Icon size={14} color={colors.textMuted} strokeWidth={2.25} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={[
            typography.caption,
            { color: colors.textMuted, fontWeight: "600" },
          ]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            typography.label.md,
            { color: colors.text, fontWeight: "800" },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Vitals glance (4 mini sparkline cards) ─────────────────────────────
function VitalsGlanceCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const { data: derivedData } = useVitalsDerived();
  const { data: bpSeries } = useVitalsSparkline("blood_pressure", 7);
  const { data: hrSeries } = useVitalsSparkline("heart_rate", 7);
  const { data: spo2Series } = useVitalsSparkline("spo2", 7);
  const { data: wtSeries } = useVitalsSparkline("weight", 7);
  const { data: glucoseSeries } = useVitalsSparkline("blood_sugar", 7);

  const latestByType = derivedData?.latestByType ?? [];
  const latest = (type: any) => latestByType.find((l) => l.type === type)?.latest;

  const tiles: Array<{ type: any; series: any; icon: any }> = [
    { type: "blood_pressure", series: bpSeries, icon: Heart },
    { type: "blood_sugar", series: glucoseSeries, icon: Droplet },
    { type: "heart_rate", series: hrSeries, icon: Activity },
    { type: "spo2", series: spo2Series, icon: Activity },
    { type: "weight", series: wtSeries, icon: Scale },
  ];

  return (
    <Pressable
      onPress={() => router.push("/(app)/vitals")}
      accessibilityRole="button"
      accessibilityLabel={t("home.vitalsGlance.openAll")}
    >
      <Card padded={false}>
        <View
          style={{
            padding: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
            {t("home.vitalsGlance.title")}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {t("home.vitalsGlance.last7d")}
          </Text>
        </View>
        <View style={{ padding: spacing.sm, gap: spacing.xs }}>
          {tiles.map(({ type, series, icon: Icon }) => {
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
            return (
              <View
                key={type}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Icon size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {def?.label ?? type}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                    <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
                      {reading}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{unit}</Text>
                  </View>
                </View>
                <View style={{ width: 80 }}>
                  <Sparkline
                    points={series?.points ?? []}
                    width={80}
                    height={28}
                    stroke={stroke}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </Card>
    </Pressable>
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

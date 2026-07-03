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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore, type Locale } from "@/stores/locale";
import { ActiveMemberPill } from "@/components/ActiveMemberPill";
import { intlLocale, fmtWeekdayShort, fmtMonthShort } from "@/lib/format";
import {
  usePatientProfile,
  useAllergies,
  useVaccinationsDue,
  useTodayMedicines,
  useMyAppointments,
  useUnreadCount,
  useWellness,
  useTodayDoses,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
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

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, typography, colors, radius, fontFamily, layout } = useTheme();
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

  // Phase 2.2.1: rehydrate local locale from server so future pushes
  // (vaccination cron, etc.) match what the user sees in the app.
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
        {/* V3: critical allergy banner */}
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
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: colors.danger,
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "flex-start",
              }}
            >
              <ShieldAlert size={20} color="#fff" strokeWidth={2.25} style={{ marginTop: 2 }} />
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
            </Pressable>
          );
        })()}

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
          <Pressable onPress={() => router.push("/(app)/profile")}>
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
            <Text
              style={[
                typography.title.lg,
                { color: colors.primary, fontWeight: "800", fontSize: 22, fontFamily: fontFamily.displayBold }
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
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
                backgroundColor: pressed ? colors.surfaceMuted : "transparent",
              })}
            >
              <Plus size={24} color={colors.primary} strokeWidth={2.25} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/(app)/notifications")}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.notifications")}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
                backgroundColor: pressed ? colors.surfaceMuted : "transparent",
              })}
            >
              <Bell size={24} color={colors.primary} strokeWidth={2} />
              {unread?.count ? (
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

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[
                  typography.overline,
                  { color: "rgba(255,255,255,0.75)", letterSpacing: 1.2, fontFamily: fontFamily.displayBold }
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
                {firstName}
              </Text>

              {wellnessData?.topTip ? (
                <Text
                  style={{
                    color: "rgba(255, 255, 255, 0.85)",
                    fontSize: 14,
                    lineHeight: 20,
                    marginTop: 8,
                    fontStyle: "italic",
                    fontFamily: fontFamily.body,
                  }}
                >
                  "{wellnessData.topTip}"
                </Text>
              ) : (
                <Text
                  style={{
                    color: "rgba(255, 255, 255, 0.8)",
                    fontSize: 14,
                    lineHeight: 20,
                    marginTop: 8,
                    fontFamily: fontFamily.body,
                  }}
                >
                  {t("home.welcomeDefault")}
                </Text>
              )}
            </View>

            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <DoseRing
                value={adherence / 100}
                size={96}
                tone="primary"
                label={`${adherence}%`}
                sublabel={t("home.doses")}
                centerColor="rgba(255, 255, 255, 0.08)"
              />
            </View>
          </View>

          {(nextMed || appointments[0]) && (
            <View
              style={{
                marginTop: spacing.lg,
                padding: spacing.md + 2,
                borderRadius: radius.xl,
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.12)",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: "rgba(255, 255, 255, 0.65)",
                  letterSpacing: 1.2,
                  marginBottom: 8,
                  fontFamily: fontFamily.displayBold,
                }}
              >
                {t("home.upcomingTodayLabel")}
              </Text>

              {nextMed && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: appointments[0] ? 8 : 0,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "rgba(255, 255, 255, 0.15)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Pill size={13} color="#FFFFFF" />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 14,
                      color: "#FFFFFF",
                      fontWeight: "600",
                      fontFamily: fontFamily.bodySemibold,
                    }}
                  >
                    {nextMed.name} · {nextMed.timing}
                  </Text>
                </View>
              )}

              {appointments[0] && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "rgba(255, 255, 255, 0.15)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Clock size={13} color="#FFFFFF" />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 14,
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
          )}

          <View
            style={{
              flexDirection: "row",
              gap: spacing.xs,
              marginTop: spacing.lg,
              flexWrap: "wrap",
            }}
          >
            <HeroChip
              label={
                patient?.bloodGroup
                  ? t("home.bloodChip", { group: patient.bloodGroup })
                  : t("home.bloodEmpty")
              }
            />
            <HeroChip label={bmi ? `${bmi} BMI` : t("home.bmiEmpty")} />
            <HeroChip
              label={
                unread?.count
                  ? t("home.alerts", { count: unread.count })
                  : t("home.noAlerts")
              }
              dot={!unread?.count}
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

          <View style={{ gap: spacing.sm }}>
            <SectionLabel title={t("home.sectionAi")} />
            <Card padded={false}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={20} color={colors.accent} strokeWidth={2.25} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[typography.title.sm, { color: colors.text }]}
                  >
                    {t("home.aiTitle")}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      typography.caption,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {t("home.aiSubtitle")}
                  </Text>
                </View>
              </View>
              <View
                style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }}
              />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                  padding: spacing.md,
                }}
              >
                <QuickTile
                  icon={MessageSquare}
                  label={t("home.aiChat")}
                  tone="accent"
                  onPress={() => router.push("/(app)/ai/chat")}
                />
                <QuickTile
                  icon={Sparkles}
                  label={t("home.aiSummary")}
                  tone="primary"
                  onPress={() => router.push("/(app)/ai/summary")}
                />
                <QuickTile
                  icon={ScanText}
                  label={t("home.aiLabExplain")}
                  tone="info"
                  onPress={() => router.push("/(app)/ai/lab-explain")}
                />
                <QuickTile
                  icon={Pill}
                  label={t("home.aiDrugCheck")}
                  tone="warning"
                  onPress={() => router.push("/(app)/ai/drug-check")}
                />
              </View>
            </Card>
            <Button
              title={t("home.aiOcrButton")}
              icon={FileSearch}
              variant="outline"
              size="md"
              fullWidth
              onPress={() => router.push("/(app)/ai/ocr")}
            />
          </View>

          {nextMed ? (
            <UpNextCard
              med={nextMed}
              onPress={() => router.push("/(app)/medicines")}
            />
          ) : null}

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
                  <Skeleton width={140} height={140} radius={radius.xl} />
                  <Skeleton width={140} height={140} radius={radius.xl} />
                  <Skeleton width={140} height={140} radius={radius.xl} />
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

          <View style={{ gap: spacing.sm }}>
            <SectionLabel title={t("home.sectionWellness")} />
            <WellnessCard />
          </View>

          {appointments.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <SectionLabel
                title={t("home.sectionComingUp")}
                action={{
                  label: t("home.allVisits"),
                  onPress: () => router.push("/(app)/appointments"),
                }}
              />
              <View
                style={{
                  marginLeft: spacing.md,
                  paddingLeft: spacing.md,
                  gap: spacing.xs,
                }}
              >
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
                        isFirst={idx === 0}
                        isLast={idx === Math.min(appointments.length, 4) - 1}
                      />
                    ))}
              </View>
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
              color: labelColor,
              fontWeight: "700",
              flex: 1,
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

function UpNextCard({
  med,
  onPress,
}: {
  med: any;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography, fontFamily } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("home.a11y.upNextMedicine")}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.xl,
          backgroundColor: colors.primarySoft,
          borderLeftWidth: 4,
          borderLeftColor: colors.primary,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
          }}
        >
          <Clock size={22} color="#FFFFFF" strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={[
              typography.overline,
              { color: colors.primary, letterSpacing: 1.2, fontFamily: fontFamily.displayBold },
            ]}
          >
            {t("home.upNextLabel")}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              typography.title.md,
              { color: colors.text, marginTop: 2, fontWeight: "800" },
            ]}
          >
            {med?.name ?? t("home.fallbackMed")}
            {med?.dosage ? ` ${med.dosage}` : ""}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 2 },
            ]}
          >
            {med?.notes ?? med?.timing ?? t("home.tapToView")}
          </Text>
        </View>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <ChevronRight size={18} color={colors.primary} strokeWidth={2.5} />
        </View>
      </View>
    </Pressable>
  );
}

function ScheduleCard({
  meta,
  items,
}: {
  meta: { label: string; tone: Tone };
  items: any[];
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      style={{
        width: 140,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.primarySoft,
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      <Text
        numberOfLines={1}
        style={[
          typography.label.md,
          { color: colors.primary, fontWeight: "700" },
        ]}
      >
        {meta.label}
      </Text>
      <DoseRing
        value={0}
        size={84}
        tone="primary"
        label={`${items.length}`}
        sublabel={t("home.medsSub")}
        centerColor={colors.primarySoft}
      />
      <Text
        numberOfLines={1}
        style={[
          typography.caption,
          { color: colors.textMuted, fontWeight: "600" },
        ]}
      >
        {t("home.dose", { count: items.length })}
      </Text>
    </View>
  );
}

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
  const { colors, typography, spacing } = useTheme();
  const p = useTone(tone);
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <View style={{ gap: 4 }}>
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
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: p.fg,
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

function WellnessCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const { data, isLoading } = useWellness();
  const tone: Tone = data?.level?.tone ?? "info";
  const palette = useTone(tone);

  if (isLoading) {
    return (
      <Card style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Skeleton width={72} height={72} radius={36} />
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
        }}
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
              width: 80,
              height: 80,
              borderRadius: 40,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.bg,
              borderWidth: 2,
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
                  fontSize: 30,
                  lineHeight: 34,
                  includeFontPadding: false,
                },
              ]}
            >
              {score}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: palette.fg, fontWeight: "700", marginTop: -2 },
              ]}
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
              <HeartPulse size={14} color={palette.fg} strokeWidth={2.25} />
              <Text
                numberOfLines={1}
                style={[
                  typography.overline,
                  {
                    color: palette.fg,
                    letterSpacing: 1.2,
                    fontWeight: "700",
                  },
                ]}
              >
                {data.level?.label?.toUpperCase() ?? t("home.wellnessDefault")}
              </Text>
            </View>
            <Text
              numberOfLines={2}
              style={[
                typography.title.md,
                { color: colors.text, fontWeight: "800", fontSize: 17 },
              ]}
            >
              {score >= 75
                ? t("home.wellnessDoingGreat")
                : score >= 45
                ? t("home.wellnessRoomToImprove")
                : t("home.wellnessBackOnTrack")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Trend size={12} color={colors.textMuted} strokeWidth={2.25} />
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
            <Sparkles size={16} color={palette.fg} strokeWidth={2.25} />
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

function AppointmentTimelineRow({
  item,
  isLast,
}: {
  item: any;
  isLast: boolean;
  isFirst: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { colors, spacing, typography } = useTheme();
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

  return (
    <View
      style={{
        paddingBottom: spacing.sm,
      }}
    >
      <Pressable
        onPress={() => router.push("/(app)/appointments")}
        accessibilityRole="button"
        style={({ pressed }) => ({
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: 14,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "700" },
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

          <View style={{ alignItems: "flex-end" }}>
            <Text
              numberOfLines={1}
              style={[
                typography.title.sm,
                {
                  color: isHighlightDate ? colors.primary : colors.text,
                  fontWeight: "700",
                },
              ]}
            >
              {dateLabel}
            </Text>
            {timeLabel ? (
              <Text
                numberOfLines={1}
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
              >
                {timeLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      {!isLast ? (
        <View
          style={{
            width: 2,
            height: spacing.sm,
            backgroundColor: colors.border,
            alignSelf: "flex-start",
            marginLeft: spacing.md,
          }}
        />
      ) : null}
    </View>
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
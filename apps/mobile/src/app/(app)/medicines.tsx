import { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Bell,
  Pill as PillIcon,
  Check,
  Clock,
  Calendar,
  Edit,
  Trash2,
  Power,
  Play,
  History,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
} from "lucide-react-native";
import {
  useMyMedicines,
  useTodayMedicines,
  useStopMedicine,
  usePatientProfile,
  useUnreadCount,
  useTodayDoses,
  useMarkDoseTaken,
  useUntakeDose,
  useSkipDose,
  useScheduleTodayDoses,
  useDeleteMedicine,
  useEditMedicine,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/stores/auth";
import {
  Screen,
  Card,
  BottomSheet,
  useToast,
  ErrorState,
  Button,
} from "@/components/ui";

// M1: third tab "All" surfaces stopped/paused medicines so users can
// resume them. The previous "All Active" label was a lie — the underlying
// query (`useMyMedicines()` without opts) only returned active=true rows.
const TAB_VALUES = ["today", "active", "all"] as const;
type TabValue = (typeof TAB_VALUES)[number];

type PeriodKey = "morning" | "afternoon" | "evening" | "night";

// Premium period identity — color + soft + icon for each time-of-day.
// Independent of theme tokens so the visual language reads consistently.
const PERIOD_THEME: Record<
  PeriodKey,
  {
    label: string;
    range: string;
    icon: any;
    color: string;
    soft: string;
    softText: string;
    gradient: [string, string];
    ring: [string, string];
  }
> = {
  morning: {
    label: "medicines.period.morning.label",
    range: "medicines.period.morning.range",
    icon: Sunrise,
    color: "#F59E0B",
    soft: "#FEF3C7",
    softText: "#92400E",
    gradient: ["#FBBF24", "#F59E0B"],
    ring: ["#FCD34D", "#F59E0B"],
  },
  afternoon: {
    label: "medicines.period.afternoon.label",
    range: "medicines.period.afternoon.range",
    icon: Sun,
    color: "#0EA5E9",
    soft: "#E0F2FE",
    softText: "#075985",
    gradient: ["#38BDF8", "#0284C7"],
    ring: ["#7DD3FC", "#0284C7"],
  },
  evening: {
    label: "medicines.period.evening.label",
    range: "medicines.period.evening.range",
    icon: Sunset,
    color: "#FF7A59",
    soft: "#FFE4D9",
    softText: "#9A3412",
    gradient: ["#FF9670", "#E85F3D"],
    ring: ["#FFB89B", "#E85F3D"],
  },
  night: {
    label: "medicines.period.night.label",
    range: "medicines.period.night.range",
    icon: Moon,
    color: "#6366F1",
    soft: "#E0E7FF",
    softText: "#3730A3",
    gradient: ["#818CF8", "#4F46E5"],
    ring: ["#A5B4FC", "#4F46E5"],
  },
};

function getPeriodKey(timingStr?: string | null): PeriodKey {
  const t = (timingStr || "").toLowerCase();
  if (t.includes("morning") || t.includes("before breakfast") || t.includes("am")) {
    return "morning";
  }
  if (t.includes("noon") || t.includes("afternoon") || t.includes("lunch")) {
    return "afternoon";
  }
  if (t.includes("evening") || t.includes("dinner")) {
    return "evening";
  }
  if (t.includes("night") || t.includes("bed") || t.includes("pm")) {
    return "night";
  }
  return "morning";
}

function subtitleForMed(t: (k: string) => string, m: any): string {
  const bits: string[] = [];
  if (m.dosage) bits.push(m.dosage);
  if (m.frequency) bits.push(m.frequency);
  if (m.timing) bits.push(m.timing);
  return bits.length ? bits.join(" • ") : t("medicines.subtitleFallback");
}

export default function MedicinesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, fontFamily, shadow: themeShadow } = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === "doctor") {
      router.replace("/(doctor)" as any);
    }
  }, [user]);

  const { data: profileData } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const [tab, setTab] = useState<TabValue>("today");
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const TABS: { value: TabValue; label: string }[] = [
    { value: "today", label: t("medicines.tabs.today") },
    { value: "active", label: t("medicines.tabs.active") },
    { value: "all", label: t("medicines.tabs.all") },
  ];

  const { data: allMeds, isLoading, isError, refetch: refetchAll } = useMyMedicines(
    tab === "all" ? { includeInactive: true } : undefined
  );
  const { data: todayMeds, refetch: refetchToday } = useTodayMedicines();
  const { data: todayDoses, refetch: refetchDoses } = useTodayDoses();
  const stopMedicine = useStopMedicine();
  const deleteMedicine = useDeleteMedicine();
  const edit = useEditMedicine();
  const markTaken = useMarkDoseTaken();
  const untakeDose = useUntakeDose();
  const skipDose = useSkipDose();
  const scheduleToday = useScheduleTodayDoses();

  useFocusEffect(
    useCallback(() => {
      refetchToday();
      refetchAll();
      refetchDoses();
    }, [refetchToday, refetchAll, refetchDoses])
  );

  useEffect(() => {
    if (tab !== "today") return;
    if (scheduleToday.isPending) return;
    const meds = todayMeds?.medicines ?? [];
    const doses = todayDoses?.doses ?? [];
    if (meds.length > 0 && doses.length === 0) {
      scheduleToday.mutate();
    }
  }, [tab, todayMeds, todayDoses, scheduleToday]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchToday(), refetchAll(), refetchDoses()]);
    } finally {
      setIsRefreshing(false);
    }
  }

  const list: any[] =
    tab === "today" ? todayMeds?.medicines ?? [] : allMeds?.medicines ?? [];

  const doseMap = useMemo(() => {
    const m: Record<string, Array<{ id: string; taken: boolean; skipped: boolean }>> = {};
    const doses: any[] = todayDoses?.doses || [];
    for (const d of doses) {
      const key = d.medicineId;
      if (!m[key]) m[key] = [];
      m[key].push({
        id: d.id,
        taken: !!d.takenAt,
        skipped: !!d.skipped,
      });
    }
    return m;
  }, [todayDoses]);

  const isMedicineTaken = useCallback(
    (medId: string) => {
      const doses = doseMap[medId];
      if (!doses || doses.length === 0) return false;
      return doses.every((d) => d.taken);
    },
    [doseMap]
  );

  const getDoseIds = useCallback(
    (medId: string) => (doseMap[medId] || []).map((d) => d.id),
    [doseMap]
  );

  const periods = useMemo(() => {
    const acc: Record<PeriodKey, any[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };
    for (const m of list) {
      acc[getPeriodKey(m.timing)].push(m);
    }
    return acc;
  }, [list]);

  const activePeriods = (Object.keys(periods) as PeriodKey[]).filter(
    (k) => periods[k].length > 0
  );

  const totalCount = list.length;
  const takenCount = list.filter((m) => isMedicineTaken(m.id)).length;
  const remainingCount = totalCount - takenCount;
  const adherence = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const profileName = profileData?.patient?.users?.name || "";
  const profilePhoto = profileData?.patient?.users?.photo;

  async function handleScheduleToday() {
    try {
      const res = await scheduleToday.mutateAsync();
      toast.show(
        res.count
          ? t("medicines.toast.scheduled", { count: res.count })
          : t("medicines.toast.noSchedule"),
        "success"
      );
      refetchDoses();
    } catch (err: any) {
      toast.show(err?.message || t("medicines.toast.scheduleError"), "danger");
    }
  }

  async function toggleTaken(med: any) {
    const doses = doseMap[med.id] || [];
    try {
      if (doses.length === 0) {
        await scheduleToday.mutateAsync();
        refetchDoses();
        toast.show(t("medicines.toast.markedTaken", { name: med.name }), "success");
      } else if (isMedicineTaken(med.id)) {
        await Promise.all(doses.map((d) => untakeDose.mutateAsync(d.id)));
        toast.show(t("medicines.toast.markedNotTaken", { name: med.name }), "info");
      } else {
        const untaken = doses.filter((d) => !d.taken);
        await Promise.all(untaken.map((d) => markTaken.mutateAsync({ id: d.id })));
        toast.show(t("medicines.toast.markedTaken", { name: med.name }), "success");
      }
    } catch (err: any) {
      toast.show(err?.message || t("medicines.toast.updateError"), "danger");
    }
  }

  async function handleStop() {
    if (!selectedMed) return;
    try {
      await stopMedicine.mutateAsync(selectedMed.id);
      toast.show(t("medicines.toast.stopped", { name: selectedMed.name }), "info");
    } catch (err: any) {
      toast.show(err.message || t("medicines.toast.stopError"), "danger");
    } finally {
      setMoreOpen(false);
      setSelectedMed(null);
    }
  }

  async function handleDelete() {
    if (!selectedMed) return;
    try {
      await deleteMedicine.mutateAsync(selectedMed.id);
      toast.show(t("medicines.toast.deleted", { name: selectedMed.name }), "success");
      refetchToday();
      refetchAll();
      refetchDoses();
    } catch (err: any) {
      toast.show(err.message || t("medicines.toast.deleteError"), "danger");
    } finally {
      setMoreOpen(false);
      setSelectedMed(null);
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ─── App bar (premium) ─── */}
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
            accessibilityRole="button"
            accessibilityLabel={t("medicines.a11y.profile")}
            hitSlop={6}
          >
            {profilePhoto ? (
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
                    padding: 1,
                  }}
                >
                  <View
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 22,
                      overflow: "hidden",
                    }}
                  />
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
                      fontSize: 15,
                      fontWeight: "800",
                      color: "#FFFFFF",
                      letterSpacing: -0.3,
                    }}
                  >
                    {(profileName || t("common.you"))[0]?.toUpperCase()}
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

          <Text
            style={[
              typography.title.lg,
              {
                color: colors.primary,
                fontWeight: "800",
                fontSize: 17,
                letterSpacing: -0.3,
                fontFamily: fontFamily.displayBold,
              },
            ]}
          >
            {t("medicines.brandName")}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Pressable
              onPress={() => router.push("/(app)/add-medicine")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("medicines.a11y.addMedicine")}
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
                ...themeShadow.sm,
              })}
            >
              <Plus size={20} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(app)/notifications")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("medicines.a11y.notifications")}
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
                ...themeShadow.sm,
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

        {/* ─── Hero (premium glass — adherence overview) ─── */}
        {tab === "today" ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
            <View
              style={{
                borderRadius: 32,
                overflow: "hidden",
                ...themeShadow.hero,
              }}
            >
              <LinearGradient
                colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet_AbsoluteFill}
              />
              {/* Accent orbs */}
              <View
                style={{
                  position: "absolute",
                  top: -90,
                  right: -70,
                  width: 240,
                  height: 240,
                  borderRadius: 120,
                  backgroundColor: "rgba(56, 189, 248, 0.32)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  bottom: -110,
                  left: -60,
                  width: 260,
                  height: 260,
                  borderRadius: 130,
                  backgroundColor: "rgba(14, 165, 233, 0.28)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: "rgba(255,255,255,0.25)",
                }}
              />

              <View style={{ padding: spacing.xl }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, marginRight: spacing.md }}>
                    <Text
                      style={[
                        typography.overline,
                        {
                          color: "rgba(255,255,255,0.7)",
                          letterSpacing: 1.4,
                          fontFamily: fontFamily.displayBold,
                        },
                      ]}
                    >
                      {t("medicines.hero.dailyProgress")}
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: 4,
                        marginTop: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 48,
                          lineHeight: 52,
                          letterSpacing: -1.5,
                          fontWeight: "800",
                          fontFamily: fontFamily.displayBold,
                        }}
                      >
                        {adherence}
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.7)",
                          fontSize: 22,
                          fontWeight: "700",
                          letterSpacing: -0.5,
                        }}
                      >
                        %
                      </Text>
                    </View>

                    <Text
                      style={[
                        typography.body.md,
                        {
                          color: "rgba(255,255,255,0.85)",
                          marginTop: 2,
                          fontWeight: "500",
                        },
                      ]}
                    >
                      {t("medicines.hero.completedFraction")}
                    </Text>
                  </View>

                  {/* Mini progress ring */}
                  <View
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 38,
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "#38BDF8",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.6,
                      shadowRadius: 12,
                      elevation: 6,
                    }}
                  >
                    <PillIcon size={32} color="rgba(255,255,255,0.95)" strokeWidth={2} />
                  </View>
                </View>

                {/* Status row — glassmorphism */}
                <View
                  style={{
                    marginTop: spacing.lg,
                    borderRadius: 18,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.18)",
                  }}
                >
                  {Platform.OS === "ios" ? (
                    <BlurView
                      intensity={30}
                      tint="dark"
                      style={StyleSheet_AbsoluteFill}
                    />
                  ) : (
                    <View
                      style={[
                        StyleSheet_AbsoluteFill,
                        { backgroundColor: "rgba(255,255,255,0.12)" },
                      ]}
                    />
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 9,
                          backgroundColor: remainingCount === 0
                            ? "rgba(52, 211, 153, 0.25)"
                            : "rgba(56, 189, 248, 0.25)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {remainingCount === 0 ? (
                          <Check size={14} color="#34D399" strokeWidth={3} />
                        ) : (
                          <Sparkles size={14} color="#7DD3FC" strokeWidth={2.5} />
                        )}
                      </View>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: "#FFFFFF",
                        }}
                      >
                        {remainingCount === 0
                          ? t("medicines.hero.allCompleted")
                          : t("medicines.hero.remaining", { count: remainingCount })}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: remainingCount === 0
                          ? "rgba(52, 211, 153, 0.22)"
                          : "rgba(255, 255, 255, 0.16)",
                      }}
                    >
                      {remainingCount === 0 ? (
                        <Check size={12} color="#34D399" strokeWidth={3} />
                      ) : (
                        <TrendingUp size={12} color="#7DD3FC" strokeWidth={2.5} />
                      )}
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: "800",
                          color: remainingCount === 0 ? "#34D399" : "#7DD3FC",
                          letterSpacing: 0.5,
                        }}
                      >
                        {remainingCount === 0
                          ? t("medicines.hero.allDone")
                          : t("medicines.hero.onTrack")}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Tab pills + actions row */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.sm,
            }}
          >
            {/* Premium sliding tab pills */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.surfaceMuted,
                borderRadius: 14,
                padding: 3,
                borderWidth: 1,
                borderColor: colors.border,
                flex: 1,
              }}
            >
              {TABS.map((tt) => {
                const active = tab === tt.value;
                return (
                  <Pressable
                    key={tt.value}
                    onPress={() => setTab(tt.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={tt.label}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? colors.surface : "transparent",
                      shadowColor: active ? "#0F172A" : "transparent",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: active ? 0.08 : 0,
                      shadowRadius: 4,
                      elevation: active ? 2 : 0,
                      opacity: pressed && !active ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={[
                        typography.label.md,
                        {
                          color: active ? colors.primary : colors.textMuted,
                          fontWeight: active ? "700" : "600",
                        },
                      ]}
                    >
                      {tt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {tab === "today" && list.length > 0 ? (
              <Pressable
                onPress={handleScheduleToday}
                disabled={scheduleToday.isPending}
                accessibilityRole="button"
                accessibilityLabel={t("medicines.actions.markSchedule")}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? colors.primarySoft : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: scheduleToday.isPending ? 0.5 : 1,
                  ...themeShadow.sm,
                })}
              >
                <Calendar size={18} color={colors.primary} strokeWidth={2.5} />
              </Pressable>
            ) : null}

            {tab !== "today" ? (
              <Pressable
                onPress={() => router.push("/(app)/medicines-history")}
                accessibilityRole="button"
                accessibilityLabel={t("medicines.actions.history")}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? colors.primarySoft : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...themeShadow.sm,
                })}
              >
                <History size={18} color={colors.primary} strokeWidth={2.5} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* List / timeline */}
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 60 }}
          />
        ) : isError ? (
          <ErrorState
            style={{ paddingHorizontal: spacing.lg, marginTop: 24 }}
            title={t("common.errorTitle")}
            message={t("common.errorLoad")}
            actionLabel={t("common.retry")}
            onAction={() => refetchAll()}
          />
        ) : list.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: 24 }}>
            <PremiumEmptyState
              onAdd={() => router.push("/(app)/add-medicine")}
              tab={tab}
            />
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            {activePeriods.map((periodKey) => {
              const period = PERIOD_THEME[periodKey];
              const PeriodIcon = period.icon;
              const items = periods[periodKey];

              return (
                <View key={periodKey} style={{ marginBottom: spacing.xl }}>
                  {/* Period section header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      marginBottom: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        overflow: "hidden",
                        shadowColor: period.color,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: 3,
                      }}
                    >
                      <LinearGradient
                        colors={period.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <PeriodIcon size={18} color="#FFFFFF" strokeWidth={2.5} />
                      </LinearGradient>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          typography.title.md,
                          {
                            color: colors.text,
                            fontWeight: "800",
                            fontSize: 16,
                            letterSpacing: -0.2,
                          },
                        ]}
                      >
                        {t(period.label)}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          typography.caption,
                          { color: colors.textMuted, marginTop: 1 },
                        ]}
                      >
                        {t(period.range)}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: period.soft,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: period.softText,
                          letterSpacing: 0.4,
                        }}
                      >
                        {items.length}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "600",
                          color: period.softText,
                          opacity: 0.7,
                        }}
                      >
                        {items.length === 1 ? "med" : "meds"}
                      </Text>
                    </View>
                  </View>

                  {/* Items — premium cards, no more timeline beads */}
                  {items.map((med, idx) => {
                    const isTaken = isMedicineTaken(med.id);
                    const isInactive = med.active === false;
                    return (
                      <MedicineCard
                        key={med.id}
                        med={med}
                        isTaken={isTaken}
                        isInactive={isInactive}
                        isLast={idx === items.length - 1}
                        showTakenButton={tab === "today"}
                        onPress={() => {
                          setSelectedMed(med);
                          setMoreOpen(true);
                        }}
                        onToggleTaken={() => toggleTaken(med)}
                        onMore={() => {
                          setSelectedMed(med);
                          setMoreOpen(true);
                        }}
                      />
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomSheet
        visible={moreOpen}
        onDismiss={() => {
          setMoreOpen(false);
          setSelectedMed(null);
        }}
        title={t("medicines.sheet.title")}
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <View
            style={{
              alignItems: "center",
              gap: 4,
              paddingVertical: spacing.sm,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
              }}
            >
              <PillIcon size={26} color={colors.primary} strokeWidth={2} />
            </View>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, fontWeight: "800" },
              ]}
            >
              {selectedMed?.name || t("medicines.sheet.fallbackName")}
            </Text>
            {selectedMed?.dosage ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                {selectedMed.dosage}
                {selectedMed.frequency ? ` • ${selectedMed.frequency}` : ""}
              </Text>
            ) : null}
            {selectedMed?.timing ? (
              <Text
                style={[typography.caption, { color: colors.textMuted }]}
              >
                {selectedMed.timing}
              </Text>
            ) : null}
          </View>

          {selectedMed && tab === "today" && selectedMed.active !== false ? (
            <Button
              title={
                isMedicineTaken(selectedMed.id)
                  ? t("medicines.sheet.markNotTaken")
                  : t("medicines.sheet.markTaken")
              }
              icon={Check}
              onPress={async () => {
                await toggleTaken(selectedMed);
                setMoreOpen(false);
                setSelectedMed(null);
              }}
              variant="primary"
            />
          ) : null}

          {selectedMed ? (
            <Button
              title={t("medicines.sheet.edit")}
              icon={Edit}
              onPress={() => {
                setMoreOpen(false);
                router.push({
                  pathname: "/(app)/edit-medicine",
                  params: { id: selectedMed.id },
                });
                setSelectedMed(null);
              }}
              variant="outline"
            />
          ) : null}

          {selectedMed && selectedMed.active !== false ? (
            <Button
              title={t("medicines.sheet.stop")}
              icon={Power}
              onPress={handleStop}
              variant="outline"
              loading={stopMedicine.isPending}
            />
          ) : null}

          {selectedMed && selectedMed.active === false ? (
            <Button
              title={t("medicines.sheet.resume")}
              icon={Play}
              onPress={async () => {
                try {
                  await edit.mutateAsync({
                    id: selectedMed.id,
                    active: true,
                  } as any);
                  toast.show(t("medicines.toast.resumed", { name: selectedMed.name }), "success");
                  refetchAll();
                  refetchToday();
                } catch (err: any) {
                  toast.show(err?.message || t("medicines.toast.resumeError"), "danger");
                } finally {
                  setMoreOpen(false);
                  setSelectedMed(null);
                }
              }}
              variant="primary"
              loading={edit.isPending}
            />
          ) : null}

          {selectedMed ? (
            <Button
              title={t("medicines.sheet.delete")}
              icon={Trash2}
              onPress={handleDelete}
              variant="danger"
              loading={deleteMedicine.isPending}
            />
          ) : null}

          <Button
            title={t("medicines.sheet.close")}
            onPress={() => {
              setMoreOpen(false);
              setSelectedMed(null);
            }}
            variant="ghost"
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

// ─── StyleSheet ref helper (avoids RN StyleSheet import here) ─────────
const StyleSheet_AbsoluteFill = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

// ─── Premium medicine card ─────────────────────────────────────────────
function MedicineCard({
  med,
  isTaken,
  isInactive,
  isLast,
  showTakenButton,
  onPress,
  onToggleTaken,
  onMore,
}: {
  med: any;
  isTaken: boolean;
  isInactive: boolean;
  isLast: boolean;
  showTakenButton: boolean;
  onPress: () => void;
  onToggleTaken: () => void;
  onMore: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, shadow: themeShadow } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${med.name}, ${med.dosage || ""}`}
      style={({ pressed }) => ({
        marginBottom: isLast ? 0 : spacing.sm + 2,
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.md,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: isTaken ? colors.successSoft : colors.border,
          overflow: "hidden",
          position: "relative",
          ...themeShadow.sm,
        }}
      >
        {/* Left color bar — period accent */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 4,
            backgroundColor: isTaken
              ? colors.success
              : isInactive
              ? colors.borderStrong
              : getMedAccent(med),
          }}
        />

        {/* Leading icon */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            marginLeft: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isTaken
              ? colors.successSoft
              : isInactive
              ? colors.surfaceMuted
              : colors.primarySoft,
            borderWidth: 1,
            borderColor: isTaken
              ? colors.success
              : isInactive
              ? colors.border
              : colors.primary,
          }}
        >
          {isTaken ? (
            <Check size={20} color={colors.success} strokeWidth={3} />
          ) : isInactive ? (
            <Power size={18} color={colors.textMuted} strokeWidth={2.25} />
          ) : (
            <PillIcon size={20} color={colors.primary} strokeWidth={2.25} />
          )}
        </View>

        {/* Body */}
        <View style={{ flex: 1, marginLeft: spacing.md, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text
              numberOfLines={1}
              style={[
                typography.title.sm,
                {
                  color: isInactive ? colors.textMuted : colors.text,
                  fontWeight: "800",
                  fontSize: 15,
                  letterSpacing: -0.2,
                  flexShrink: 1,
                },
              ]}
            >
              {med.name}
            </Text>
            {isInactive ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 9.5,
                    fontWeight: "800",
                    color: colors.textMuted,
                    letterSpacing: 0.6,
                  }}
                >
                  {t("medicines.status.stopped")}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={[
              typography.body.sm,
              {
                color: colors.textMuted,
                marginTop: 2,
                fontWeight: "500",
              },
            ]}
          >
            {subtitleForMed(t, med)}
          </Text>
        </View>

        {/* Trailing action */}
        {showTakenButton ? (
          isTaken ? (
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: colors.successSoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: colors.success,
              }}
            >
              <Check size={12} color={colors.success} strokeWidth={3} />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: "800",
                  color: colors.success,
                  letterSpacing: 0.3,
                }}
              >
                {t("medicines.status.taken")}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={onToggleTaken}
              accessibilityRole="button"
              accessibilityLabel={t("medicines.a11y.markTaken", { name: med.name })}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: pressed ? colors.primary : colors.primarySoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: pressed ? colors.primary : "transparent",
                shadowColor: pressed ? colors.primary : "transparent",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: pressed ? 0.3 : 0,
                shadowRadius: 8,
              })}
            >
              {({ pressed }) => (
                <>
                  <Check size={12} color={pressed ? colors.onPrimary : colors.primary} strokeWidth={3} />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: "800",
                      color: pressed ? colors.onPrimary : colors.primary,
                      letterSpacing: 0.3,
                    }}
                  >
                    {t("medicines.status.markTaken")}
                  </Text>
                </>
              )}
            </Pressable>
          )
        ) : (
          <Pressable
            onPress={onMore}
            accessibilityRole="button"
            accessibilityLabel={t("medicines.a11y.moreOptions")}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 12,
              backgroundColor: pressed ? colors.primarySoft : colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.5} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// Light per-medicine accent so cards in the same period still feel distinct.
// Stable across renders (id-based hash into a small palette).
function getMedAccent(med: any): string {
  const palette = ["#0284C7", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6"];
  const id = String(med?.id || med?.name || "0");
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

// ─── Premium empty state ───────────────────────────────────────────────
function PremiumEmptyState({
  onAdd,
  tab,
}: {
  onAdd: () => void;
  tab: TabValue;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, shadow: themeShadow } = useTheme();
  const isAll = tab === "all";

  return (
    <View
      style={{
        borderRadius: 28,
        padding: 32,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        overflow: "hidden",
        position: "relative",
        ...themeShadow.md,
      }}
    >
      {/* Subtle background orb */}
      <View
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: colors.primarySoft,
          opacity: 0.6,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -30,
          left: -30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: colors.accentSoft,
          opacity: 0.4,
        }}
      />

      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          marginBottom: 16,
        }}
      >
        <LinearGradient
          colors={["#38BDF8", "#0284C7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet_AbsoluteFill, { borderRadius: 22 }]}
        />
        <PillIcon size={32} color="#FFFFFF" strokeWidth={2} />
      </View>

      <Text
        style={[
          typography.title.md,
          {
            color: colors.text,
            fontWeight: "800",
            textAlign: "center",
            letterSpacing: -0.2,
          },
        ]}
      >
        {tab === "today"
          ? t("medicines.empty.today.title")
          : t("medicines.empty.all.title")}
      </Text>
      <Text
        style={[
          typography.body.sm,
          {
            color: colors.textMuted,
            textAlign: "center",
            marginTop: 6,
            paddingHorizontal: spacing.md,
            lineHeight: 20,
          },
        ]}
      >
        {tab === "today"
          ? t("medicines.empty.today.body")
          : t("medicines.empty.all.body")}
      </Text>
      {!isAll ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t("medicines.a11y.addMedicine")}
          style={({ pressed }) => ({
            marginTop: 20,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: pressed ? colors.primary : colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
          })}
        >
          {({ pressed }) => (
            <>
              <Plus size={16} color={colors.onPrimary} strokeWidth={3} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: colors.onPrimary,
                  letterSpacing: 0.2,
                }}
              >
                {t("medicines.a11y.addMedicine")}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

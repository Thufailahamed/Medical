import { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
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
  Button,
  Avatar,
} from "@/components/ui";

// M1: third tab "All" surfaces stopped/paused medicines so users can
// resume them. The previous "All Active" label was a lie — the underlying
// query (`useMyMedicines()` without opts) only returned active=true rows.
const TAB_VALUES = ["today", "active", "all"] as const;
type TabValue = (typeof TAB_VALUES)[number];

type PeriodKey = "morning" | "afternoon" | "evening" | "night";

function buildPeriodMeta(t: (k: string) => string): Record<
  PeriodKey,
  {
    label: string;
    range: string;
    icon: any;
    iconColor: string;
    bgTone: string;
  }
> {
  return {
    morning: {
      label: t("medicines.period.morning.label"),
      range: t("medicines.period.morning.range"),
      icon: Sunrise,
      iconColor: "#765b00",
      bgTone: "#ffdf93",
    },
    afternoon: {
      label: t("medicines.period.afternoon.label"),
      range: t("medicines.period.afternoon.range"),
      icon: Sun,
      iconColor: "#6750a4",
      bgTone: "#e9ddff",
    },
    evening: {
      label: t("medicines.period.evening.label"),
      range: t("medicines.period.evening.range"),
      icon: Sunset,
      iconColor: "#63597c",
      bgTone: "#e1d4fd",
    },
    night: {
      label: t("medicines.period.night.label"),
      range: t("medicines.period.night.range"),
      icon: Moon,
      iconColor: "#7a7582",
      bgTone: "#e6e0e9",
    },
  };
}

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
  const { spacing, colors, typography, radius } = useTheme();
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

  // M1: include inactive rows only when the user opts into the "All" tab.
  // "today" + "active" stay scoped to active=true so the period grouping
  // and dose badges don't show stale entries.
  const { data: allMeds, isLoading, refetch: refetchAll } = useMyMedicines(
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

  // B2: Auto-schedule today's doses for any active in-range medicine that
  // has no dose rows yet. Closes the gap where medicines added in the past
  // (or added on a day without an explicit "Mark today's schedule" tap)
  // showed up on the Today tab with no Mark-Taken button working.
  //
  // Safe to call repeatedly: B1's timezone fix makes the server dedup exact.
  // Only fires when there are meds but no doses yet for today — never when
  // the schedule is already in place or while a request is in-flight.
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

  // API returns FLAT objects. `allMeds` is already active-only for
  // tab="today" + tab="active" (no `includeInactive` opt passed); it
  // includes stopped rows for tab="all".
  const list: any[] =
    tab === "today" ? todayMeds?.medicines ?? [] : allMeds?.medicines ?? [];

  // Persisted taken state from /doses/me (keyed by medicineId -> array of doses)
  // A medicine can have multiple doses per day (e.g. twice daily), so we store
  // an array per medicineId. A medicine is "taken" only when ALL its doses are taken.
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

  // Helper: is a medicine fully taken (all doses taken)?
  const isMedicineTaken = useCallback(
    (medId: string) => {
      const doses = doseMap[medId];
      if (!doses || doses.length === 0) return false;
      return doses.every((d) => d.taken);
    },
    [doseMap]
  );

  // Helper: get all dose IDs for a medicine
  const getDoseIds = useCallback(
    (medId: string) => (doseMap[medId] || []).map((d) => d.id),
    [doseMap]
  );

  // Group by period
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

  const PERIOD_META = buildPeriodMeta(t);

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
        // No doses scheduled yet — schedule now and immediately mark taken
        await scheduleToday.mutateAsync();
        refetchDoses();
        toast.show(t("medicines.toast.markedTaken", { name: med.name }), "success");
      } else if (isMedicineTaken(med.id)) {
        // All doses taken → untake all
        await Promise.all(doses.map((d) => untakeDose.mutateAsync(d.id)));
        toast.show(t("medicines.toast.markedNotTaken", { name: med.name }), "info");
      } else {
        // Some or no doses taken → mark all untaken doses as taken
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
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
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
        {/* App bar */}
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
            <Avatar
              name={profileName || t("common.you")}
              source={profilePhoto ? { uri: profilePhoto } : undefined}
              size="md"
              tone="primary"
            />
          </Pressable>
          <Text
            style={[
              typography.title.lg,
              { color: colors.primary, fontWeight: "800", fontSize: 20 },
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
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Plus size={24} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(app)/notifications")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("medicines.a11y.notifications")}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Bell size={22} color={colors.primary} strokeWidth={2.25} />
              {unread?.count ? (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Hero banner */}
        {tab === "today" ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
            <LinearGradient
              colors={["#4f378a", "#31215a"]}
              style={{
                padding: spacing.lg,
                borderRadius: radius.xxl,
                position: "relative",
                overflow: "hidden",
                shadowColor: "#4f378a",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.15,
                shadowRadius: 15,
                elevation: 6,
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: -20,
                  right: -25,
                  width: 130,
                  height: 130,
                  borderRadius: 65,
                  backgroundColor: "rgba(233, 221, 255, 0.08)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <PillIcon
                  size={80}
                  color="rgba(233, 221, 255, 0.04)"
                  strokeWidth={1}
                />
              </View>

              <View style={{ zIndex: 10 }}>
                <Text
                  style={[
                    typography.overline,
                    {
                      color: "rgba(233, 221, 255, 0.8)",
                      letterSpacing: 1.5,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {t("medicines.hero.dailyProgress")}
                </Text>
                <Text
                  style={[
                    typography.display.lg,
                    {
                      color: "#FFFFFF",
                      fontWeight: "900",
                      marginTop: 4,
                      fontSize: 44,
                      lineHeight: 52,
                    },
                  ]}
                >
                  {adherence}%
                </Text>
                <Text
                  style={[
                    typography.body.md,
                    {
                      color: "rgba(233, 221, 255, 0.85)",
                      marginTop: 2,
                      fontWeight: "500",
                    },
                  ]}
                >
                  {t("medicines.hero.completedFraction")}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: spacing.lg,
                    paddingTop: spacing.md,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: "rgba(14, 165, 183, 0.25)",
                      borderWidth: 1,
                      borderColor: "rgba(14, 165, 183, 0.2)",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: "#0EA5B7",
                      }}
                    >
                      {remainingCount === 0 ? t("medicines.hero.allDone") : t("medicines.hero.onTrack")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      typography.label.md,
                      {
                        color: "rgba(233, 221, 255, 0.9)",
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {remainingCount === 0
                      ? t("medicines.hero.allCompleted")
                      : t("medicines.hero.remaining", { count: remainingCount })}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        ) : null}

        {tab === "today" && list.length > 0 ? (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              marginTop: spacing.md,
              flexDirection: "row",
              gap: spacing.sm,
            }}
          >
            <Button
              title={t("medicines.actions.markSchedule")}
              icon={Calendar}
              variant="outline"
              onPress={handleScheduleToday}
              loading={scheduleToday.isPending}
              fullWidth={false}
              size="sm"
            />
            <Button
              title={t("medicines.actions.history")}
              icon={History}
              variant="ghost"
              onPress={() => router.push("/(app)/medicines-history")}
              fullWidth={false}
              size="sm"
            />
          </View>
        ) : null}

        {/* F3: also surface a History shortcut when on the Active tab
            so users can review adherence without returning to Today. */}
        {tab === "active" ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Button
              title={t("medicines.actions.viewHistory")}
              icon={History}
              variant="outline"
              onPress={() => router.push("/(app)/medicines-history")}
              fullWidth={false}
              size="sm"
            />
          </View>
        ) : null}

        {/* Tabs */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {TABS.map((tt) => {
              const active = tab === tt.value;
              return (
                <Pressable
                  key={tt.value}
                  onPress={() => setTab(tt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tt.label}
                  style={{
                    height: 40,
                    paddingHorizontal: spacing.lg,
                    borderRadius: 999,
                    backgroundColor: active ? colors.primary : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={[
                      typography.label.md,
                      {
                        color: active ? colors.onPrimary : colors.textMuted,
                        fontWeight: active ? "700" : "500",
                      },
                    ]}
                  >
                    {tt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* List / timeline */}
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 60 }}
          />
        ) : list.length === 0 ? (
          <View
            style={{ paddingHorizontal: spacing.lg, marginTop: 40 }}
          >
            <Card style={{ alignItems: "center", paddingVertical: 40 }}>
              <PillIcon size={48} color={colors.textMuted} strokeWidth={1.5} />
              <Text
                style={[
                  typography.title.md,
                  {
                    color: colors.text,
                    fontWeight: "700",
                    marginTop: spacing.md,
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
                    marginTop: spacing.xs,
                    paddingHorizontal: spacing.xl,
                  },
                ]}
              >
                {tab === "today"
                  ? t("medicines.empty.today.body")
                  : t("medicines.empty.all.body")}
              </Text>
              <Button
                title={t("medicines.a11y.addMedicine")}
                icon={Plus}
                onPress={() => router.push("/(app)/add-medicine")}
                variant="outline"
                style={{ marginTop: spacing.lg }}
              />
            </Card>
          </View>
        ) : (
          <View
            style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}
          >
            {activePeriods.map((periodKey) => {
              const period = PERIOD_META[periodKey];
              const PeriodIcon = period.icon;
              const items = periods[periodKey];

              return (
                <View key={periodKey} style={{ marginBottom: spacing.lg }}>
                  {/* Period header */}
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
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: period.bgTone,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <PeriodIcon
                        size={18}
                        color={period.iconColor}
                        strokeWidth={2.25}
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          typography.title.sm,
                          {
                            color: colors.text,
                            fontWeight: "900",
                            fontSize: 16,
                          },
                        ]}
                      >
                        {period.label}
                      </Text>
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textMuted, marginTop: 1 },
                        ]}
                      >
                        {period.range}
                      </Text>
                    </View>
                  </View>

                  {/* Items */}
                  <View style={{ position: "relative" }}>
                    <View
                      style={{
                        position: "absolute",
                        left: 24,
                        top: 10,
                        bottom: 0,
                        width: 2,
                        backgroundColor: colors.surfaceMuted,
                        zIndex: -1,
                      }}
                    />

                    {items.map((med) => {
                      const isTaken = isMedicineTaken(med.id);
                      const isInactive = med.active === false;
                      return (
                        <Pressable
                          key={med.id}
                          onPress={() => {
                            setSelectedMed(med);
                            setMoreOpen(true);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${med.name}, ${med.dosage || ""}`}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: spacing.md,
                          }}
                        >
                          {/* Bullet */}
                          <View
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 24,
                              backgroundColor: colors.bg,
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 10,
                            }}
                          >
                            <View
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                backgroundColor: isTaken
                                  ? colors.successSoft
                                  : colors.primarySoft,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {isTaken ? (
                                <Check
                                  size={18}
                                  color={colors.success}
                                  strokeWidth={2.5}
                                />
                              ) : (
                                <PillIcon
                                  size={18}
                                  color={colors.primary}
                                  strokeWidth={2.25}
                                />
                              )}
                            </View>
                          </View>

                          {/* Card */}
                          <View
                            style={{
                              flex: 1,
                              marginLeft: spacing.md,
                              backgroundColor: colors.surface,
                              borderRadius: radius.xl,
                              padding: spacing.md,
                              borderWidth: 1,
                              borderColor: colors.border,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.02,
                              shadowRadius: 5,
                              elevation: 1,
                            }}
                          >
                            <View
                              style={{ flex: 1, marginRight: spacing.md }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: spacing.xs,
                                }}
                              >
                                <Text
                                  style={[
                                    typography.title.sm,
                                    {
                                      color: isInactive
                                        ? colors.textMuted
                                        : colors.text,
                                      fontWeight: "800",
                                      fontSize: 16,
                                      flexShrink: 1,
                                    },
                                  ]}
                                  numberOfLines={1}
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
                                        fontSize: 10,
                                        fontWeight: "800",
                                        color: colors.textMuted,
                                        letterSpacing: 0.5,
                                      }}
                                    >
                                      {t("medicines.status.stopped")}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text
                                style={[
                                  typography.body.sm,
                                  {
                                    color: colors.textMuted,
                                    marginTop: 2,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {subtitleForMed(t, med)}
                              </Text>
                            </View>

                            {tab === "today" ? (
                              isTaken ? (
                                <View
                                  style={{
                                    paddingHorizontal: spacing.md,
                                    paddingVertical: 6,
                                    borderRadius: radius.md,
                                    backgroundColor: colors.successSoft,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <Check
                                    size={14}
                                    color={colors.success}
                                    strokeWidth={3}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: "800",
                                      color: colors.success,
                                    }}
                                  >
                                    {t("medicines.status.taken")}
                                  </Text>
                                </View>
                              ) : (
                                <Pressable
                                  onPress={() => toggleTaken(med)}
                                  accessibilityRole="button"
                                  accessibilityLabel={t("medicines.a11y.markTaken", { name: med.name })}
                                  style={({ pressed }) => ({
                                    paddingHorizontal: spacing.md,
                                    paddingVertical: 8,
                                    borderRadius: radius.md,
                                    backgroundColor: pressed
                                      ? colors.primary
                                      : colors.primarySoft,
                                  })}
                                >
                                  {({ pressed }) => (
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        fontWeight: "800",
                                        color: pressed
                                          ? colors.onPrimary
                                          : colors.primary,
                                      }}
                                    >
                                      {t("medicines.status.markTaken")}
                                    </Text>
                                  )}
                                </Pressable>
                              )
                            ) : (
                              <Pressable
                                onPress={() => {
                                  setSelectedMed(med);
                                  setMoreOpen(true);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={t("medicines.a11y.moreOptions")}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  backgroundColor: colors.surfaceMuted,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Clock size={16} color={colors.textMuted} />
                              </Pressable>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Options sheet */}
      <BottomSheet
        visible={moreOpen}
        onDismiss={() => {
          setMoreOpen(false);
          setSelectedMed(null);
        }}
        title={t("medicines.sheet.title")}
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <View style={{ alignItems: "center", gap: 4 }}>
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

          {/* M1: resume/stop pair. Stop is hidden once the med is already
              inactive; Resume flips active=true via the existing PATCH. */}
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
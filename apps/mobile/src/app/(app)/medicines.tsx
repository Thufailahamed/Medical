import { useMemo, useState, useCallback } from "react";
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
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Card,
  BottomSheet,
  useToast,
  Button,
  Avatar,
} from "@/components/ui";

const TABS: { value: "today" | "all"; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "all", label: "All Active" },
];

type PeriodKey = "morning" | "afternoon" | "evening" | "night";

const PERIOD_META: Record<
  PeriodKey,
  {
    label: string;
    range: string;
    icon: any;
    iconColor: string;
    bgTone: string;
  }
> = {
  morning: {
    label: "Morning",
    range: "08:00 AM — 11:59 AM",
    icon: Sunrise,
    iconColor: "#765b00",
    bgTone: "#ffdf93",
  },
  afternoon: {
    label: "Afternoon",
    range: "12:00 PM — 04:59 PM",
    icon: Sun,
    iconColor: "#6750a4",
    bgTone: "#e9ddff",
  },
  evening: {
    label: "Evening",
    range: "05:00 PM — 08:59 PM",
    icon: Sunset,
    iconColor: "#63597c",
    bgTone: "#e1d4fd",
  },
  night: {
    label: "Night",
    range: "09:00 PM — 07:59 AM",
    icon: Moon,
    iconColor: "#7a7582",
    bgTone: "#e6e0e9",
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

function subtitleForMed(m: any): string {
  const bits: string[] = [];
  if (m.dosage) bits.push(m.dosage);
  if (m.frequency) bits.push(m.frequency);
  if (m.timing) bits.push(m.timing);
  return bits.length ? bits.join(" • ") : "Medicine";
}

export default function MedicinesScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data: profileData } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { data: allMeds, isLoading, refetch: refetchAll } = useMyMedicines();
  const { data: todayMeds, refetch: refetchToday } = useTodayMedicines();
  const { data: todayDoses, refetch: refetchDoses } = useTodayDoses();
  const stopMedicine = useStopMedicine();
  const deleteMedicine = useDeleteMedicine();
  const markTaken = useMarkDoseTaken();
  const untakeDose = useUntakeDose();
  const skipDose = useSkipDose();
  const scheduleToday = useScheduleTodayDoses();

  const [tab, setTab] = useState<"today" | "all">("today");
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetchToday();
      refetchAll();
      refetchDoses();
    }, [refetchToday, refetchAll, refetchDoses])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchToday(), refetchAll(), refetchDoses()]);
    } finally {
      setIsRefreshing(false);
    }
  }

  // API returns FLAT objects
  const list: any[] =
    tab === "today" ? todayMeds?.medicines ?? [] : allMeds?.medicines ?? [];

  // Persisted taken state from /doses/me (keyed by medicineId for today)
  const doseMap = useMemo(() => {
    const m: Record<string, { id: string; taken: boolean; skipped: boolean }> = {};
    const doses: any[] = todayDoses?.doses || [];
    for (const d of doses) {
      const key = d.medicine_doses?.medicineId || d.medicineId;
      m[key] = {
        id: d.medicine_doses?.id || d.id,
        taken: !!(d.medicine_doses?.takenAt || d.takenAt),
        skipped: !!(d.medicine_doses?.skipped || d.skipped),
      };
    }
    return m;
  }, [todayDoses]);

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
  const takenCount = list.filter((m) => doseMap[m.id]?.taken).length;
  const remainingCount = totalCount - takenCount;
  const adherence = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const profileName = profileData?.patient?.users?.name || "";
  const profilePhoto = profileData?.patient?.users?.photo;

  async function handleScheduleToday() {
    try {
      const res = await scheduleToday.mutateAsync();
      toast.show(
        res.count
          ? `Scheduled ${res.count} dose reminders for today`
          : "No medicines to schedule",
        "success"
      );
      refetchDoses();
    } catch (err: any) {
      toast.show(err?.message || "Could not schedule", "danger");
    }
  }

  async function toggleTaken(med: any) {
    const dose = doseMap[med.id];
    try {
      if (dose?.taken) {
        await untakeDose.mutateAsync(dose.id);
        toast.show(`${med.name} marked as not taken`, "info");
      } else if (dose?.id) {
        await markTaken.mutateAsync({ id: dose.id });
        toast.show(`${med.name} marked as taken`, "success");
      } else {
        // No dose scheduled yet — schedule now and immediately mark taken
        const res = await scheduleToday.mutateAsync();
        refetchDoses();
        toast.show(`${med.name} marked as taken`, "success");
      }
    } catch (err: any) {
      toast.show(err?.message || "Could not update", "danger");
    }
  }

  async function handleStop() {
    if (!selectedMed) return;
    try {
      await stopMedicine.mutateAsync(selectedMed.id);
      toast.show(`${selectedMed.name} stopped`, "info");
    } catch (err: any) {
      toast.show(err.message || "Failed to stop", "danger");
    } finally {
      setMoreOpen(false);
      setSelectedMed(null);
    }
  }

  async function handleDelete() {
    if (!selectedMed) return;
    try {
      await deleteMedicine.mutateAsync(selectedMed.id);
      toast.show(`${selectedMed.name} deleted`, "success");
      refetchToday();
      refetchAll();
      refetchDoses();
    } catch (err: any) {
      toast.show(err.message || "Failed to delete", "danger");
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
            accessibilityLabel="Profile"
            hitSlop={6}
          >
            <Avatar
              name={profileName || "You"}
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
            HealthHub
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Pressable
              onPress={() => router.push("/(app)/add-medicine")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add medicine"
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
              accessibilityLabel="Notifications"
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
                  DAILY PROGRESS
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
                  of today's medicines completed
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
                      {remainingCount === 0 ? "ALL DONE" : "ON TRACK"}
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
                      ? "All completed!"
                      : `${remainingCount} remaining`}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        ) : null}

        {tab === "today" && list.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Button
              title="Mark today's schedule"
              icon={Calendar}
              variant="outline"
              onPress={handleScheduleToday}
              loading={scheduleToday.isPending}
              fullWidth={false}
              size="sm"
            />
          </View>
        ) : null}

        {/* Tabs */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {TABS.map((t) => {
              const active = tab === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setTab(t.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t.label}
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
                    {t.label}
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
                  ? "Nothing scheduled today"
                  : "No medicines yet"}
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
                  ? "Enjoy your day. Add a medicine to start tracking."
                  : "Add your medicines to get timely reminders and track your health rhythm."}
              </Text>
              <Button
                title="Add medicine"
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
                      const isTaken = !!doseMap[med.id]?.taken;
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
                              <Text
                                style={[
                                  typography.title.sm,
                                  {
                                    color: colors.text,
                                    fontWeight: "800",
                                    fontSize: 16,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {med.name}
                              </Text>
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
                                {subtitleForMed(med)}
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
                                    Taken
                                  </Text>
                                </View>
                              ) : (
                                <Pressable
                                  onPress={() => toggleTaken(med)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Mark ${med.name} as taken`}
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
                                      Mark Taken
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
                                accessibilityLabel="More options"
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
        title="Medicine details"
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, fontWeight: "800" },
              ]}
            >
              {selectedMed?.name || "Medicine"}
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

          {selectedMed && tab === "today" ? (
            <Button
              title={
                doseMap[selectedMed.id]?.taken
                  ? "Mark as not taken"
                  : "Mark as taken"
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
              title="Edit medicine"
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

          {selectedMed ? (
            <Button
              title="Stop medicine"
              icon={Plus}
              onPress={handleStop}
              variant="outline"
              loading={stopMedicine.isPending}
            />
          ) : null}

          {selectedMed ? (
            <Button
              title="Delete medicine"
              icon={Trash2}
              onPress={handleDelete}
              variant="danger"
              loading={deleteMedicine.isPending}
            />
          ) : null}

          <Button
            title="Close"
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
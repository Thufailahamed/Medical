import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Check,
  X,
  Pill,
  Clock,
  Calendar,
  TrendingUp,
} from "lucide-react-native";
import {
  useMedicineStats,
  useMissedDoses,
  useMyMedicines,
  useDosesHistory,
  useSkipDose,
  useMarkDoseTaken,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, Card, Button, useToast } from "@/components/ui";

// F3: dose history + adherence analytics.
// Tabs: Overview (stats + chart), Missed (acknowledge), All (raw log).
const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

type Tab = "overview" | "missed" | "all";

export default function MedicinesHistoryScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState<number>(7);
  const [refreshing, setRefreshing] = useState(false);

  const { data: stats, refetch: refetchStats } = useMedicineStats(days);
  const { data: missed, refetch: refetchMissed } = useMissedDoses(50);
  const { data: allMeds } = useMyMedicines();
  const markTaken = useMarkDoseTaken();
  const skipDose = useSkipDose();

  // For "All" tab: pull last `days` of doses.
  const fromIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);
  const { data: history, refetch: refetchHistory } = useDosesHistory({ from: fromIso });

  const medById = useMemo(() => {
    const m: Record<string, any> = {};
    for (const med of allMeds?.medicines ?? []) {
      m[med.id] = med;
    }
    return m;
  }, [allMeds]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchStats(),
        refetchMissed(),
        refetchHistory(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function ackMissed(dose: any) {
    try {
      await skipDose.mutateAsync({ id: dose.id, notes: "Missed (acknowledged)" });
      toast.show("Acknowledged", "success");
    } catch (err: any) {
      toast.show(err?.message || "Could not acknowledge", "danger");
    }
  }

  async function takeMissed(dose: any) {
    try {
      await markTaken.mutateAsync({ id: dose.id });
      toast.show("Marked as taken", "success");
    } catch (err: any) {
      toast.show(err?.message || "Could not mark", "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* App bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <ChevronLeft size={26} color={colors.text} />
          </Pressable>
          <Text
            style={[
              typography.title.md,
              { color: colors.text, fontWeight: "800", fontSize: 20 },
            ]}
          >
            Medicine history
          </Text>
        </View>

        {/* Range selector */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {RANGES.map((r) => {
              const active = days === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setDays(r.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? colors.primary : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: active ? colors.onPrimary : colors.textMuted,
                    }}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sub-tabs */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.md,
            flexDirection: "row",
            gap: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          {(
            [
              { value: "overview", label: "Overview" },
              { value: "missed", label: `Missed (${missed?.count ?? 0})` },
              { value: "all", label: "All" },
            ] as { value: Tab; label: string }[]
          ).map((t) => {
            const active = tab === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setTab(t.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 2,
                  borderBottomColor: active ? colors.primary : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: active ? "800" : "600",
                    color: active ? colors.primary : colors.textMuted,
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tab content */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          {tab === "overview" ? (
            <OverviewTab stats={stats} days={days} />
          ) : tab === "missed" ? (
            <MissedTab
              doses={missed?.doses ?? []}
              medById={medById}
              onAck={ackMissed}
              onTakeLate={takeMissed}
            />
          ) : (
            <AllTab
              doses={history?.doses ?? []}
              medById={medById}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function OverviewTab({ stats, days }: { stats: any; days: number }) {
  const { spacing, colors, typography, radius } = useTheme();
  const daysArr: any[] = stats?.last7Days ?? [];
  const overallTotal = daysArr.reduce((s, d) => s + d.total, 0);
  const overallTaken = daysArr.reduce((s, d) => s + d.taken, 0);
  const overallPct = overallTotal > 0 ? Math.round((overallTaken / overallTotal) * 100) : 0;
  const streak = stats?.streakDays ?? 0;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Top stat row */}
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Card style={{ flex: 1, alignItems: "center", paddingVertical: spacing.lg }}>
          <Text style={[typography.overline, { color: colors.textMuted }]}>STREAK</Text>
          <Text
            style={{
              fontSize: 36,
              fontWeight: "900",
              color: colors.primary,
              marginTop: 4,
            }}
          >
            {streak}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            days in a row
          </Text>
        </Card>
        <Card style={{ flex: 1, alignItems: "center", paddingVertical: spacing.lg }}>
          <Text style={[typography.overline, { color: colors.textMuted }]}>ADHERENCE</Text>
          <Text
            style={{
              fontSize: 36,
              fontWeight: "900",
              color: overallPct >= 80 ? colors.success : colors.primary,
              marginTop: 4,
            }}
          >
            {overallPct}%
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            over {days} days
          </Text>
        </Card>
      </View>

      {/* Bar chart */}
      <Card style={{ padding: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: spacing.sm,
          }}
        >
          <TrendingUp size={16} color={colors.text} />
          <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
            Daily adherence
          </Text>
        </View>
        {daysArr.length === 0 ? (
          <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No dose data in this range.
          </Text>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 4 }}>
            {daysArr.map((d) => {
              const heightPct = d.total > 0 ? Math.max(8, d.pct) : 0;
              const bg = d.total === 0
                ? colors.surfaceMuted
                : d.pct >= 80
                ? colors.success
                : d.pct >= 50
                ? colors.primary
                : colors.warning;
              return (
                <View key={d.date} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ flex: 1, justifyContent: "flex-end", width: "100%" }}>
                    <View
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: bg,
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {/* Day labels */}
        <View style={{ flexDirection: "row", marginTop: 6, gap: 4 }}>
          {daysArr.map((d) => (
            <Text
              key={d.date}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 9,
                color: colors.textMuted,
              }}
              numberOfLines={1}
            >
              {d.date.slice(8)}
            </Text>
          ))}
        </View>
      </Card>

      {/* Missed/skipped totals */}
      <Card style={{ padding: spacing.md }}>
        <Text
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
          ]}
        >
          Breakdown
        </Text>
        <Row label="Taken" value={overallTaken} color={colors.success} />
        <Row
          label="Missed"
          value={daysArr.reduce((s, d) => s + (d.missed || 0), 0)}
          color={colors.warning}
        />
        <Row
          label="Skipped"
          value={daysArr.reduce((s, d) => s + (d.skipped || 0), 0)}
          color={colors.textMuted}
        />
      </Card>
    </View>
  );
}

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  const { spacing, typography, colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: color,
          }}
        />
        <Text style={[typography.body.sm, { color: colors.textMuted }]}>
          {label}
        </Text>
      </View>
      <Text style={[typography.body.md, { fontWeight: "800" }]}>{value}</Text>
    </View>
  );
}

function MissedTab({
  doses,
  medById,
  onAck,
  onTakeLate,
}: {
  doses: any[];
  medById: Record<string, any>;
  onAck: (d: any) => void;
  onTakeLate: (d: any) => void;
}) {
  const { spacing, colors, typography, radius } = useTheme();
  if (doses.length === 0) {
    return (
      <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
        <Check size={36} color={colors.success} strokeWidth={2.5} />
        <Text
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "800", marginTop: spacing.sm },
          ]}
        >
          Nothing missed
        </Text>
        <Text
          style={[
            typography.body.sm,
            { color: colors.textMuted, textAlign: "center", marginTop: 4 },
          ]}
        >
          All your doses are accounted for. Nice work.
        </Text>
      </Card>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {doses.map((d: any) => {
        const med = medById[d.medicineId] || {};
        const date = new Date(d.scheduledFor);
        const dateLabel = date.toLocaleDateString();
        const timeLabel = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return (
          <Card key={d.id} style={{ padding: spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.title.sm,
                    { color: colors.text, fontWeight: "800" },
                  ]}
                  numberOfLines={1}
                >
                  {med.name || "Medicine"}
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                  {med.dosage || ""} • {dateLabel} at {timeLabel}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  onPress={() => onTakeLate(d)}
                  accessibilityRole="button"
                  accessibilityLabel="Mark taken late"
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: radius.md,
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Check size={16} color={colors.primary} strokeWidth={2.5} />
                </Pressable>
                <Pressable
                  onPress={() => onAck(d)}
                  accessibilityRole="button"
                  accessibilityLabel="Acknowledge missed"
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <X size={16} color={colors.textMuted} strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

function AllTab({
  doses,
  medById,
}: {
  doses: any[];
  medById: Record<string, any>;
}) {
  const { spacing, colors, typography, radius } = useTheme();
  if (doses.length === 0) {
    return (
      <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
        <Pill size={36} color={colors.textMuted} strokeWidth={1.5} />
        <Text
          style={[
            typography.body.sm,
            { color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
          ]}
        >
          No dose log in this range.
        </Text>
      </Card>
    );
  }
  // Group by local date.
  const groups: Record<string, any[]> = {};
  for (const d of doses) {
    const key = new Date(d.scheduledFor).toLocaleDateString();
    (groups[key] = groups[key] || []).push(d);
  }
  return (
    <View style={{ gap: spacing.md }}>
      {Object.entries(groups).map(([date, items]) => (
        <View key={date}>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, fontWeight: "800", marginBottom: 6 },
            ]}
          >
            {date}
          </Text>
          <View style={{ gap: 6 }}>
            {items.map((d: any) => {
              const med = medById[d.medicineId] || {};
              const date = new Date(d.scheduledFor);
              const timeLabel = date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const taken = !!d.takenAt;
              const skipped = !!d.skipped;
              const missed = !taken && !skipped && d.scheduledFor < new Date().toISOString();
              const dotColor = taken
                ? colors.success
                : skipped
                ? colors.textMuted
                : missed
                ? colors.warning
                : colors.primary;
              const status = taken
                ? "Taken"
                : skipped
                ? "Skipped"
                : missed
                ? "Missed"
                : "Upcoming";
              return (
                <View
                  key={d.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.sm,
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: dotColor,
                      marginRight: spacing.sm,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[typography.body.sm, { color: colors.text, fontWeight: "700" }]}
                      numberOfLines={1}
                    >
                      {med.name || "Medicine"}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {timeLabel}
                    </Text>
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      { color: dotColor, fontWeight: "800" },
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
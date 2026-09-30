// @ts-nocheck

import { useMemo, useState } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock4,
  XCircle,
  RotateCcw,
  ChevronRight,
  Users,
} from "lucide-react-native";
import {
  useFollowUps,
  useUpdateFollowUpStatus,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  EmptyState,
  ErrorState,
  Skeleton,
  MetricStrip,
  SectionHeader,
  useToast,
} from "@/components/ui";

type Tab = "pending" | "completed" | "all";
type Bucket = "overdue" | "today" | "week" | "later";

const DAY_MS = 86_400_000;

/** Local calendar date as YYYY-MM-DD (follow-up dates are date-only). */
function localIso(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Whole days from today to `iso` (negative = past); null when unparseable. */
function daysFromToday(iso?: string) {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  if (isNaN(target.getTime())) return null;
  const today = new Date(`${localIso()}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

function bucketOf(days: number | null): Bucket {
  if (days === null) return "later";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

function isPending(f: any) {
  return f.status !== "completed" && f.status !== "cancelled";
}

function statusMeta(t: (k: string, opts?: any) => string, status: string | undefined) {
  switch (status) {
    case "completed":
      return { label: t("doctorFollowUps.status.done"), tone: "success" as const, icon: Check };
    case "cancelled":
      return { label: t("doctorFollowUps.status.cancelled"), tone: "danger" as const, icon: XCircle };
    default:
      return { label: t("doctorFollowUps.status.pending"), tone: "warning" as const, icon: Clock4 };
  }
}

export default function FollowUpsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  // Fetch everything once: tab counts, the summary strip and overdue items
  // (which `?upcoming=true` would drop) all derive from the same list.
  const { data, isLoading, isError, refetch, isRefetching } = useFollowUps();
  const updateStatus = useUpdateFollowUpStatus();

  const all: any[] = data?.followUps || [];

  const stats = useMemo(() => {
    const s = { pending: 0, overdue: 0, today: 0, week: 0, completed: 0 };
    for (const f of all) {
      if (f.status === "completed") s.completed++;
      if (!isPending(f)) continue;
      s.pending++;
      const b = bucketOf(daysFromToday(f.followUpDate));
      if (b === "overdue") s.overdue++;
      else if (b === "today") s.today++;
      else if (b === "week") s.week++;
    }
    return s;
  }, [all]);

  const list = useMemo(() => {
    if (tab === "pending") return all.filter(isPending);
    if (tab === "completed") return all.filter((f) => f.status === "completed");
    // Newest first once history is mixed in.
    return [...all].sort((a, b) => (b.followUpDate || "").localeCompare(a.followUpDate || ""));
  }, [all, tab]);

  // Pending view is grouped by urgency; other views stay a flat list.
  const groups = useMemo(() => {
    if (tab !== "pending") return [{ key: "flat" as const, items: list }];
    const order: Bucket[] = ["overdue", "today", "week", "later"];
    const by: Record<Bucket, any[]> = { overdue: [], today: [], week: [], later: [] };
    for (const f of list) by[bucketOf(daysFromToday(f.followUpDate))].push(f);
    return order.filter((k) => by[k].length).map((k) => ({ key: k, items: by[k] }));
  }, [list, tab]);

  const TABS: { value: Tab; label: string; count: number }[] = [
    { value: "pending", label: t("doctorFollowUps.tabs.pending"), count: stats.pending },
    { value: "completed", label: t("doctorFollowUps.tabs.completed"), count: stats.completed },
    { value: "all", label: t("doctorFollowUps.tabs.all"), count: all.length },
  ];

  const subtitle =
    isLoading || !all.length
      ? t("doctorFollowUps.subtitle")
      : stats.overdue
      ? `${t("doctorFollowUps.subtitlePending", { count: stats.pending })} · ${t("doctorFollowUps.subtitleOverdue", { count: stats.overdue })}`
      : t("doctorFollowUps.subtitlePending", { count: stats.pending });

  async function markCompleted(f: any) {
    try {
      await updateStatus.mutateAsync({ id: f.id, status: "completed" });
      toast.show(t("doctorFollowUps.markedComplete"), "success");
    } catch (err: any) {
      toast.show(err?.message || t("doctorQueue.updateError"), "danger");
    }
  }

  function confirmCancel(f: any) {
    Alert.alert(
      t("doctorFollowUps.cancelConfirmTitle"),
      t("doctorFollowUps.cancelConfirmBody", { title: f.title }),
      [
        { text: t("doctorFollowUps.keep"), style: "cancel" },
        {
          text: t("doctorFollowUps.cancelAction"),
          style: "destructive",
          onPress: async () => {
            try {
              await updateStatus.mutateAsync({ id: f.id, status: "cancelled" });
              toast.show(t("doctorFollowUps.cancelledToast"), "info");
            } catch (err: any) {
              toast.show(err?.message || t("doctorFollowUps.cancelError"), "danger");
            }
          },
        },
      ]
    );
  }

  async function reopen(f: any) {
    try {
      await updateStatus.mutateAsync({ id: f.id, status: "pending" });
      toast.show(t("doctorFollowUps.reopened"), "info");
    } catch (err: any) {
      toast.show(err?.message || t("doctorFollowUps.reopenError"), "danger");
    }
  }

  const openPatient = (patientId: string) =>
    router.push({ pathname: "/(doctor)/patient-detail", params: { id: patientId } } as any);

  const empty = {
    pending: {
      icon: CalendarCheck2,
      title: t("doctorFollowUps.empty.upcomingTitle"),
      body: t("doctorFollowUps.empty.upcomingBody"),
    },
    completed: {
      icon: CheckCircle2,
      title: t("doctorFollowUps.empty.completedTitle"),
      body: t("doctorFollowUps.empty.completedBody"),
    },
    all: {
      icon: CalendarClock,
      title: t("doctorFollowUps.empty.allTitle"),
      body: t("doctorFollowUps.empty.allBody"),
    },
  }[tab];

  return (
    <Screen
      padded={false}
      scroll
      edges={["top"]}
      bottomInset
      onRefresh={() => refetch()}
      refreshing={isRefetching && !isLoading}
    >
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorFollowUps.title")}
        subtitle={subtitle}
      />

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {!isLoading && !isError && all.length > 0 ? (
          <MetricStrip
            size="md"
            items={[
              {
                icon: AlertTriangle,
                label: t("doctorFollowUps.metrics.overdue"),
                value: stats.overdue,
                tone: stats.overdue ? "danger" : "neutral",
                live: stats.overdue > 0,
              },
              {
                icon: CalendarDays,
                label: t("doctorFollowUps.metrics.today"),
                value: stats.today,
                tone: "primary",
                live: stats.today > 0,
              },
              {
                icon: CalendarRange,
                label: t("doctorFollowUps.metrics.week"),
                value: stats.week,
                tone: "info",
              },
              {
                icon: CheckCircle2,
                label: t("doctorFollowUps.metrics.done"),
                value: stats.completed,
                tone: "success",
                onPress: () => setTab("completed"),
              },
            ]}
          />
        ) : null}

        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} showCounts={!isLoading && !isError} />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={132} radius={22} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load follow-ups")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : list.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            message={empty.body}
            tone={tab === "completed" ? "accent" : "primary"}
            actionLabel={tab === "completed" ? undefined : t("doctorFollowUps.empty.cta")}
            onAction={tab === "completed" ? undefined : () => router.push("/(doctor)/care-team" as any)}
          />
          {tab !== "completed" ? <ScheduleHint /> : null}
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
          {groups.map((g) => (
            <View key={g.key}>
              {g.key !== "flat" ? (
                <SectionHeader
                  title={t(`doctorFollowUps.groups.${g.key}`)}
                  count={g.items.length}
                  style={{ paddingTop: spacing.lg, paddingBottom: spacing.sm }}
                />
              ) : (
                <View style={{ height: spacing.md }} />
              )}
              <View style={{ gap: spacing.md }}>
                {g.items.map((f: any) => (
                  <FollowUpCard
                    key={f.id}
                    f={f}
                    onComplete={() => markCompleted(f)}
                    onCancel={() => confirmCancel(f)}
                    onReopen={() => reopen(f)}
                    onOpenPatient={f.patientId ? () => openPatient(f.patientId) : undefined}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

/** Pill-track segmented control with live counts per segment. */
function SegmentedTabs({
  tabs,
  value,
  onChange,
  showCounts,
}: {
  tabs: { value: Tab; label: string; count: number }[];
  value: Tab;
  onChange: (v: Tab) => void;
  showCounts: boolean;
}) {
  const { colors, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        padding: 4,
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: colors.fill,
      }}
    >
      {tabs.map((tb) => {
        const active = tb.value === value;
        return (
          <Pressable
            key={tb.value}
            onPress={() => onChange(tb.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={showCounts ? `${tb.label}, ${tb.count}` : tb.label}
            style={[
              {
                flex: 1,
                height: 38,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 999,
                borderCurve: "continuous",
                backgroundColor: active ? colors.surface : "transparent",
              },
              active && !isDark ? shadow.xs : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                typography.label.md,
                { color: active ? colors.text : colors.textMuted },
              ]}
            >
              {tb.label}
            </Text>
            {showCounts ? (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 6,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? colors.primary : colors.fillStrong,
                }}
              >
                <Text
                  style={[
                    typography.label.sm,
                    {
                      fontSize: 11,
                      lineHeight: 14,
                      color: active ? colors.onPrimary : colors.textMuted,
                      fontVariant: ["tabular-nums"],
                    },
                  ]}
                >
                  {tb.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function FollowUpCard({
  f,
  onComplete,
  onCancel,
  onReopen,
  onOpenPatient,
}: {
  f: any;
  onComplete: () => void;
  onCancel: () => void;
  onReopen: () => void;
  onOpenPatient?: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const meta = statusMeta(t, f.status);
  const isDone = f.status === "completed";
  const isCancelled = f.status === "cancelled";
  const pending = !isDone && !isCancelled;
  const days = daysFromToday(f.followUpDate);
  const overdue = pending && days !== null && days < 0;
  const dueToday = pending && days === 0;
  const danger = useTone("danger");

  const tone = isDone
    ? "success"
    : isCancelled
    ? "neutral"
    : overdue
    ? "danger"
    : dueToday
    ? "primary"
    : "info";

  const when =
    days === null
      ? t("doctorFollowUps.noDate")
      : days === 0
      ? t("doctorFollowUps.relative.today")
      : days === 1
      ? t("doctorFollowUps.relative.tomorrow")
      : days === -1
      ? t("doctorFollowUps.relative.yesterday")
      : days > 1
      ? t("doctorFollowUps.relative.inDays", { count: days })
      : t("doctorFollowUps.relative.daysAgo", { count: -days });

  return (
    <Card padded={false}>
      {overdue ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 18,
            bottom: 18,
            width: 4,
            borderTopRightRadius: 2,
            borderBottomRightRadius: 2,
            backgroundColor: danger.fg,
          }}
        />
      ) : null}
      <Pressable
        onPress={onOpenPatient}
        disabled={!onOpenPatient}
        accessibilityRole={onOpenPatient ? "button" : undefined}
        accessibilityLabel={onOpenPatient ? `${f.title}. ${t("doctorFollowUps.openPatientA11y")}` : undefined}
        style={({ pressed }) => ({
          padding: spacing.lg,
          paddingBottom: spacing.md,
          gap: spacing.sm,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <DateBlock iso={f.followUpDate} tone={tone} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text
              style={[
                typography.title.md,
                {
                  color: isCancelled ? colors.textMuted : colors.text,
                  textDecorationLine: isCancelled ? "line-through" : "none",
                },
              ]}
              numberOfLines={2}
            >
              {f.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              {overdue ? (
                <AlertTriangle size={12} color={danger.fg} strokeWidth={2.6} />
              ) : (
                <Clock4 size={12} color={colors.textMuted} strokeWidth={2.4} />
              )}
              <Text
                numberOfLines={1}
                style={[
                  typography.label.sm,
                  { color: overdue ? danger.fg : dueToday ? colors.primary : colors.textMuted },
                ]}
              >
                {overdue ? t("doctorFollowUps.relative.overdue", { count: -days }) : when}
              </Text>
            </View>
          </View>
          {pending ? (
            onOpenPatient ? (
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: colors.well,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.4} />
              </View>
            ) : null
          ) : (
            <PillCmp label={meta.label} tone={meta.tone} size="sm" />
          )}
        </View>

        {f.notes ? (
          <Text
            style={[typography.body.sm, { color: colors.textMuted, paddingLeft: 48 + spacing.md }]}
            numberOfLines={2}
          >
            {f.notes}
          </Text>
        ) : null}
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        {pending ? (
          <>
            <ActionPill
              icon={Check}
              label={t("doctorFollowUps.markComplete")}
              fg={colors.success}
              bg={colors.successSoft}
              onPress={onComplete}
              a11y={t("doctorFollowUps.completeA11y", { title: f.title })}
            />
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={t("doctorFollowUps.cancelA11y", { title: f.title })}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 19,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.dangerSoft : colors.well,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <XCircle size={17} color={colors.textMuted} strokeWidth={2.3} />
            </Pressable>
          </>
        ) : (
          <>
            <ActionPill
              icon={RotateCcw}
              label={t("doctorFollowUps.reopenAction")}
              fg={colors.primary}
              bg={colors.primarySoft}
              onPress={onReopen}
              a11y={t("doctorFollowUps.reopenA11y", { title: f.title })}
            />
            {onOpenPatient ? (
              <Pressable
                onPress={onOpenPatient}
                accessibilityRole="button"
                accessibilityLabel={t("doctorFollowUps.openPatientA11y")}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  borderCurve: "continuous",
                  backgroundColor: pressed ? colors.fillStrong : colors.well,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <ChevronRight size={17} color={colors.textMuted} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </Card>
  );
}

function ActionPill({
  icon: Icon,
  label,
  fg,
  bg,
  onPress,
  a11y,
}: {
  icon: any;
  label: string;
  fg: string;
  bg: string;
  onPress: () => void;
  a11y: string;
}) {
  const { typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 38,
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: bg,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={15} color={fg} strokeWidth={2.6} />
      <Text style={[typography.label.md, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Explains where follow-ups come from, so an empty list isn't a dead end. */
function ScheduleHint() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const primary = useTone("primary");
  const steps = [
    t("doctorFollowUps.hint.step1"),
    t("doctorFollowUps.hint.step2"),
    t("doctorFollowUps.hint.step3"),
  ];
  return (
    <Card variant="muted" style={{ marginTop: spacing.sm, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Users size={16} color={primary.fg} strokeWidth={2.4} />
        <Text style={[typography.label.md, { color: colors.text }]}>
          {t("doctorFollowUps.hint.title")}
        </Text>
      </View>
      {steps.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: primary.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[typography.label.sm, { color: primary.fg }]}>{i + 1}</Text>
          </View>
          <Text style={[typography.body.sm, { color: colors.textMuted, flex: 1 }]}>{s}</Text>
        </View>
      ))}
    </Card>
  );
}

/** Calendar-leaf date: short month over a bold day number. */
function DateBlock({ iso, tone }: { iso?: string; tone: "primary" | "success" | "warning" | "danger" | "info" | "neutral" }) {
  const { colors, typography, fontFamily } = useTheme();
  const palette = useTone(tone);
  const d = iso ? new Date(`${iso}T00:00:00`) : null;
  const valid = d && !isNaN(d.getTime());
  return (
    <View
      style={{
        width: 48,
        height: 52,
        borderRadius: 14,
        borderCurve: "continuous",
        backgroundColor: palette.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={[
          typography.overline,
          { fontSize: 9.5, color: palette.fg, textTransform: "uppercase", letterSpacing: 0.8 },
        ]}
      >
        {valid ? d!.toLocaleDateString("en-US", { month: "short" }) : "—"}
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.heavy,
          fontSize: 20,
          lineHeight: 23,
          letterSpacing: -0.5,
          color: tone === "neutral" ? colors.textMuted : colors.text,
          fontVariant: ["tabular-nums"],
        }}
      >
        {valid ? d!.getDate() : "?"}
      </Text>
    </View>
  );
}

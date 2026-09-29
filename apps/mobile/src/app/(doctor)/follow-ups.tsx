// @ts-nocheck

import { useState } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  Check,
  Clock4,
  XCircle,
  RotateCcw,
  ChevronRight,
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
  ChipGroup,
  useToast,
} from "@/components/ui";

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
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState("upcoming");
  const { data, isLoading, isError, refetch } = useFollowUps({ upcoming: tab === "upcoming" });
  const updateStatus = useUpdateFollowUpStatus();

  const TABS = [
    { value: "upcoming", label: t("doctorFollowUps.tabs.upcoming") },
    { value: "completed", label: t("doctorFollowUps.tabs.completed") },
    { value: "all", label: t("doctorFollowUps.tabs.all") },
  ];

  const list = (data?.followUps || []).filter((f: any) => {
    if (tab === "completed") return f.status === "completed";
    if (tab === "upcoming") {
      const today = new Date().toISOString().split("T")[0];
      const isFuture = (f.followUpDate || "") >= today;
      return isFuture && f.status !== "cancelled" && f.status !== "completed";
    }
    return true;
  });

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

  return (
    <Screen padded={false} scroll edges={["top"]} bottomInset onRefresh={() => refetch()} refreshing={false}>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorFollowUps.title")}
        subtitle={t("doctorFollowUps.subtitle")}
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <ChipGroup options={TABS} value={tab} onChange={setTab} />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={120} radius={20} />
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
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={CalendarClock}
            title={t("doctorFollowUps.empty.upcomingTitle")}
            message={
              tab === "upcoming"
                ? t("doctorFollowUps.empty.upcomingBody")
                : tab === "completed"
                ? t("doctorFollowUps.empty.completedBody")
                : t("doctorFollowUps.empty.allBody")
            }
            tone="neutral"
          />
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.md }}>
          {list.map((f: any) => {
            const today = new Date().toISOString().split("T")[0];
            const upcoming = (f.followUpDate || "") >= today;
            const meta = statusMeta(t, f.status);
            const StatusIcon = meta.icon;
            const isDone = f.status === "completed";
            const isCancelled = f.status === "cancelled";
            return (
              <Card key={f.id} padded={false}>
                <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <DateBlock
                      iso={f.followUpDate}
                      tone={isDone ? "success" : isCancelled ? "neutral" : upcoming ? "primary" : "warning"}
                    />
                    <Text
                      style={[
                        typography.title.md,
                        {
                          color: isCancelled ? colors.textMuted : colors.text,
                          flex: 1,
                          textDecorationLine: isCancelled
                            ? "line-through"
                            : "none",
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {f.title}
                    </Text>
                    <PillCmp label={meta.label} tone={meta.tone} size="sm" />
                  </View>

                  {f.notes ? (
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted },
                      ]}
                      numberOfLines={3}
                    >
                      {f.notes}
                    </Text>
                  ) : null}

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      paddingTop: spacing.md,
                      marginTop: spacing.xs,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    }}
                  >
                    {!isDone && !isCancelled ? (
                      <>
                        <Pressable
                          onPress={() => markCompleted(f)}
                          accessibilityRole="button"
                          accessibilityLabel={t("doctorFollowUps.completeA11y", { title: f.title })}
                          style={({ pressed }) => ({
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            height: 36,
                            borderRadius: 999,
                            borderCurve: "continuous",
                            backgroundColor: colors.successSoft,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Check size={14} color={colors.success} strokeWidth={2.6} />
                          <Text style={[typography.label.md, { color: colors.success }]}>
                            {t("doctorFollowUps.markComplete")}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => confirmCancel(f)}
                          accessibilityRole="button"
                          accessibilityLabel={t("doctorFollowUps.cancelA11y", { title: f.title })}
                          hitSlop={6}
                          style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            borderCurve: "continuous",
                            backgroundColor: pressed
                              ? colors.dangerSoft
                              : colors.well,
                            alignItems: "center",
                            justifyContent: "center",
                          })}
                        >
                          <XCircle
                            size={16}
                            color={colors.textMuted}
                            strokeWidth={2.4}
                          />
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        onPress={() => reopen(f)}
                        accessibilityRole="button"
                        accessibilityLabel={t("doctorFollowUps.reopenA11y", { title: f.title })}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          height: 36,
                          borderRadius: 999,
                          borderCurve: "continuous",
                          backgroundColor: colors.primarySoft,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <RotateCcw
                          size={14}
                          color={colors.primary}
                          strokeWidth={2.6}
                        />
                        <Text style={[typography.label.md, { color: colors.primary }]}>
                          {t("doctorFollowUps.reopenAction")}
                        </Text>
                      </Pressable>
                    )}

                    {f.patientId ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/(doctor)/patient-detail",
                            params: { id: f.patientId },
                          } as any)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={t("doctorFollowUps.openPatientA11y")}
                        hitSlop={6}
                        style={({ pressed }) => ({
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          borderCurve: "continuous",
                          backgroundColor: pressed
                            ? colors.fillStrong
                            : colors.well,
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                      >
                        <ChevronRight
                          size={16}
                          color={colors.textMuted}
                          strokeWidth={2.4}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
/** Calendar-leaf date: short month over a bold day number. */
function DateBlock({ iso, tone }: { iso?: string; tone: "primary" | "success" | "warning" | "neutral" }) {
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

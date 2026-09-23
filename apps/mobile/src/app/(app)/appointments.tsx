// @ts-nocheck

import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Plus, CalendarPlus, Clock, X, Loader, FileText, AlertCircle, Wallet, Video, Stethoscope, ChevronRight, Building2 } from "lucide-react-native";
import { useMyAppointments, useCancelAppointment, useActiveTeleconsultSession } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
import { api } from "@/lib/api";
import { slDayDiff } from "@healthcare/shared";
import {
  Screen,
  ScreenHeader,
  IconButton,
  Card,
  Pill,
  PillTone,
  EmptyState,
  ErrorState,
  Skeleton,
  Timeline,
  BottomSheet,
  Button,
  useToast,
} from "@/components/ui";

const STATUS_TONE: Record<string, PillTone> = {
  confirmed: "success",
  scheduled: "primary",
  in_progress: "primary",
  completed: "info",
  cancelled: "neutral",
  no_show: "danger",
};

const FILTER_VALUES = ["all", "upcoming", "missed", "past"] as const;
const MODE_FILTER_VALUES = ["all", "video", "in_person"] as const;

function dateParts(t: (k: string) => string, date?: string | null) {
  if (!date) return { day: "--", month: "—" };
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { day: m[3], month: monthName(t, +m[2]) };
  const m2 = date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return { day: m2[1], month: monthName(t, +m2[2]) };
  return { day: "--", month: "—" };
}

function monthName(_t: (k: string) => string, m: number) {
  const names = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  return names[(m - 1) % 12] || "—";
}

function sortAppointments(items: any[]) {
  return [...items].sort((a, b) => {
    const isAUpcoming = a.bucket === "today" || a.bucket === "upcoming";
    const isBUpcoming = b.bucket === "today" || b.bucket === "upcoming";

    // 1. Upcoming always comes before past/missed/cancelled
    if (isAUpcoming && !isBUpcoming) return -1;
    if (!isAUpcoming && isBUpcoming) return 1;

    // 2. Both upcoming: chronological (soonest first)
    if (isAUpcoming && isBUpcoming) {
      const aTime = a.startsAt ?? new Date(`${a.date}T${a.time || "00:00"}`).getTime();
      const bTime = b.startsAt ?? new Date(`${b.date}T${b.time || "00:00"}`).getTime();
      return aTime - bTime;
    }

    // 3. Both past/missed: reverse-chronological (most recent first)
    const aTime = a.startsAt ?? new Date(`${a.date}T${a.time || "00:00"}`).getTime();
    const bTime = b.startsAt ?? new Date(`${b.date}T${b.time || "00:00"}`).getTime();
    return bTime - aTime;
  });
}

function groupKey(t: (k: string, opts?: any) => string, a: any) {
  if (!a?.date) return t("appointments.groups.later", { defaultValue: "Upcoming" });
  const diff = slDayDiff(a.date);
  if (a.bucket === "today" || diff === 0) {
    return t("appointments.groups.today", { defaultValue: "Today" });
  }
  if (a.bucket === "upcoming" || diff > 0) {
    if (diff <= 7) return t("appointments.groups.week", { defaultValue: "This Week" });
    return t("appointments.groups.later", { defaultValue: "Upcoming" });
  }
  const d = new Date(a.date);
  return t("appointments.groups.pastMonth", {
    month: d.toLocaleString("en", { month: "short" }).toUpperCase(),
    year: d.getFullYear(),
    defaultValue: `${d.toLocaleString("en", { month: "short" }).toUpperCase()} ${d.getFullYear()}`,
  });
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const { spacing, colors, typography, radius } = useTheme();
  const { data, isLoading, isError, refetch } = useMyAppointments();
  const cancelAppointment = useCancelAppointment();
  const { data: activeSession } = useActiveTeleconsultSession();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "missed" | "past">("all");
  const [modeFilter, setModeFilter] = useState<"all" | "video" | "in_person">("all");
  const [cancelSheet, setCancelSheet] = useState<any | null>(null);
  const [cancelEstimate, setCancelEstimate] = useState<any | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  async function openCancelSheet(item: any) {
    setCancelSheet(item);
    setCancelEstimate(null);
    setLoadingEstimate(true);
    try {
      const est: any = await api(
        `/appointments/${item.id}/cancellation-estimate`
      );
      setCancelEstimate(est);
    } catch {
      setCancelEstimate({ rule: t("appointments.cancelConfirmBody", {
        date: item.date,
        time: item.time || "—",
      }) });
    } finally {
      setLoadingEstimate(false);
    }
  }

  async function performCancel() {
    if (!cancelSheet) return;
    const id = cancelSheet.id;
    setCancelSheet(null);
    setCancelEstimate(null);
    try {
      setCancellingId(id);
      await cancelAppointment.mutateAsync(id);
      toast.show(t("appointments.cancelSuccess"), "info");
    } catch (err: any) {
      toast.show(
        err?.message || t("appointments.cancelError"),
        "danger"
      );
    } finally {
      setCancellingId(null);
    }
  }

  const all: any[] = data?.appointments || [];

  // Past + filter helper — used by the pinned section + the timeline.
  const matchesDateFilter = (a: any) => {
    if (filter === "all") return true;
    if (filter === "missed") return a.bucket === "missed";
    if (filter === "upcoming") return a.bucket === "upcoming" || a.bucket === "today";
    return a.bucket === "completed" || a.bucket === "cancelled"; // "past"
  };
  const matchesModeFilter = (a: any) => {
    if (modeFilter === "all") return true;
    return a.mode === modeFilter;
  };

  const counts = useMemo(() => {
    return {
      all: all.length,
      upcoming: all.filter((a) => a.bucket === "upcoming" || a.bucket === "today").length,
      missed: all.filter((a) => a.bucket === "missed").length,
      past: all.filter((a) => a.bucket === "completed" || a.bucket === "cancelled").length,
    };
  }, [all]);

  const filtered = useMemo(
    () => sortAppointments(all.filter((a) => matchesDateFilter(a) && matchesModeFilter(a))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, filter, modeFilter]
  );

  // Pinned video rows: only visits that are live or later today.
  const upcomingVideo = useMemo(() => {
    return all
      .filter(
        (a) =>
          a.mode === "video" &&
          (a.isLive || a.bucket === "today") &&
          (a.status === "scheduled" ||
            a.status === "confirmed" ||
            a.status === "in_progress")
      )
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const showPinnedVideo =
    upcomingVideo.length > 0 &&
    (modeFilter === "all" || modeFilter === "video") &&
    (filter === "all" || filter === "upcoming");

  const upcomingCount = counts.upcoming;
  const upcomingPct = all.length
    ? Math.round((upcomingCount / all.length) * 100)
    : 0;
  const contentPadding = spacing.sm + 2;

  return (
    <Screen scroll padded={false} tabBarOffset bottomInset>
      <ScreenHeader
        title={t("appointments.title")}
        back={router.canGoBack()}
        onBack={() => router.back()}
        subtitle={t("appointments.subtitle", {
          total: all.length,
          pct: upcomingPct,
        })}
        right={
          <IconButton
            icon={Plus}
            variant="solid"
            onPress={() => router.push("/(app)/book-appointment")}
            accessibilityLabel={t("appointments.a11y.bookAppointment")}
          />
        }
      />

      <View style={{ paddingHorizontal: contentPadding, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.sm + 2,
            gap: spacing.sm,
          }}
        >
          {/* Date Filter Pills with Counts */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: "row",
              gap: spacing.xs + 2,
              alignItems: "center",
            }}
          >
            {FILTER_VALUES.map((v) => (
              <FilterPill
                key={v}
                label={t(`appointments.filter.${v}`)}
                count={counts[v]}
                active={filter === v}
                onPress={() => setFilter(v)}
              />
            ))}
          </ScrollView>

          {/* Mode filter — All vs Video visit vs In-person */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: "row",
              gap: spacing.xs + 2,
              alignItems: "center",
            }}
          >
            {MODE_FILTER_VALUES.map((v) => {
              const Icon = v === "video" ? Video : v === "in_person" ? Stethoscope : null;
              return (
                <ModePill
                  key={v}
                  label={t(
                    v === "all"
                      ? "appointments.modeFilter.all"
                      : v === "video"
                      ? "appointments.modeFilter.video"
                      : "appointments.modeFilter.inPerson"
                  )}
                  Icon={Icon}
                  active={modeFilter === v}
                  onPress={() => setModeFilter(v)}
                />
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Pinned upcoming video consultations — quick-join entries surfaced
          above the timeline whenever a video visit is approaching. */}
      {showPinnedVideo ? (
        <View style={{ paddingHorizontal: contentPadding, paddingBottom: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <Video size={16} color={colors.primary} strokeWidth={2.25} />
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {t("appointments.upcomingVideo")}
            </Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            {upcomingVideo.map((a: any) => (
              <PinnedVideoCard
                key={a.id}
                appt={a}
                isActive={
                  activeSession?.session?.appointmentId === a.id &&
                  !!activeSession.session.roomId
                }
                onJoin={() =>
                  router.push({
                    pathname: "/(app)/teleconsult/[roomId]" as any,
                    params: { roomId: activeSession.session!.roomId },
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: contentPadding, gap: spacing.sm }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={82} radius={16} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title={t("common.errorTitle", { defaultValue: "Something went wrong" })}
          message={t("appointments.errorLoad", { defaultValue: "We couldn't load your appointments. Check your connection and try again." })}
          actionLabel={t("common.retry", { defaultValue: "Retry" })}
          onAction={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title={
            filter === "missed"
              ? t("appointments.missedEmpty.title")
              : filter === "past"
              ? t("appointments.empty.pastTitle")
              : t("appointments.empty.title")
          }
          message={
            filter === "missed"
              ? t("appointments.missedEmpty.body")
              : filter === "past"
              ? t("appointments.empty.pastBody")
              : t("appointments.empty.body")
          }
          actionLabel={
            filter !== "past" ? t("appointments.empty.action") : undefined
          }
          onAction={
            filter !== "past"
              ? () => router.push("/(app)/book-appointment")
              : undefined
          }
        />
      ) : (
        <View style={{ paddingHorizontal: contentPadding }}>
          <Timeline
            data={filtered}
            groupBy={(a: any) => groupKey(t, a)}
            keyExtractor={(a: any) => a.id}
            flush
            style={{ gap: spacing.md }}
            renderItem={(item: any) => {
              const tone = STATUS_TONE[item.status] ?? "neutral";
              const { day, month } = dateParts(t, item.date);
              const isUpcoming = item.bucket === "today" || item.bucket === "upcoming";

              const doctorDisplayName = item.doctorName || null;
              const subDetails = [
                item.doctorSpecialization,
                item.hospitalName || (item.mode === "video" ? t("appointments.mode.video") : undefined),
              ].filter(Boolean).join(" · ");

              return (
                <Card padded={false} style={{ borderRadius: radius.lg, overflow: "hidden" }}>
                  <View style={{ padding: spacing.sm + 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm + 2 }}>
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/(app)/appointment-detail",
                            params: { id: item.id },
                          })
                        }
                        accessibilityRole="button"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: spacing.sm + 2,
                        }}
                      >
                        {/* Date box */}
                        {isUpcoming ? (
                          <LinearGradient
                            colors={[colors.primary, colors.primaryMuted]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{
                              width: 54,
                              height: 62,
                              borderRadius: radius.md,
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Text
                              style={[
                                typography.title.lg,
                                { color: colors.onPrimary, fontSize: 20, lineHeight: 22, fontWeight: "700" },
                              ]}
                            >
                              {day}
                            </Text>
                            <Text
                              style={[
                                typography.overline,
                                { color: colors.onPrimary, marginTop: 1, letterSpacing: 0.5 },
                              ]}
                            >
                              {month}
                            </Text>
                          </LinearGradient>
                        ) : (
                          <View
                            style={{
                              width: 54,
                              height: 62,
                              borderRadius: radius.md,
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              backgroundColor: colors.surfaceMuted,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Text
                              style={[
                                typography.title.lg,
                                { color: colors.text, fontSize: 20, lineHeight: 22, fontWeight: "700" },
                              ]}
                            >
                              {day}
                            </Text>
                            <Text
                              style={[
                                typography.overline,
                                { color: colors.textMuted, marginTop: 1, letterSpacing: 0.5 },
                              ]}
                            >
                              {month}
                            </Text>
                          </View>
                        )}

                        {/* Appointment Info */}
                        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                          {/* Badges row: mode + status */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.xs,
                              flexWrap: "wrap",
                              marginBottom: 2,
                            }}
                          >
                            {item.mode === "video" ? (
                              <Pill
                                icon={Video}
                                label={t("appointments.mode.video")}
                                tone="primary"
                                size="sm"
                              />
                            ) : item.mode === "in_person" ? (
                              <Pill
                                icon={Stethoscope}
                                label={t("appointments.mode.inPerson")}
                                tone="neutral"
                                size="sm"
                              />
                            ) : null}
                            {item.status ? (
                              <Pill
                                label={
                                  t(`appointments.statusLabel.${item.status}`, {
                                    defaultValue: item.status.replace("_", " "),
                                  }) as string
                                }
                                tone={tone}
                                size="sm"
                              />
                            ) : null}
                          </View>

                          {/* Primary title: Doctor's name or reason */}
                          <Text
                            style={[
                              typography.title.sm,
                              { color: colors.text, fontWeight: "700" },
                            ]}
                            numberOfLines={1}
                          >
                            {doctorDisplayName ||
                              item.reason ||
                              item.specialty ||
                              t("appointments.fallbackTitle")}
                          </Text>

                          {/* Subtitle: Specialization / Hospital / Reason */}
                          {subDetails ? (
                            <Text
                              style={[
                                typography.body.xs,
                                { color: colors.textMuted },
                              ]}
                              numberOfLines={1}
                            >
                              {subDetails}
                            </Text>
                          ) : null}

                          {/* Meta row: Time + Queue + Records */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.sm,
                              flexWrap: "wrap",
                              marginTop: 2,
                            }}
                          >
                            {item.time ? (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Clock size={12} color={colors.textMuted} strokeWidth={2.25} />
                                <Text style={[typography.body.xs, { color: colors.textMuted, fontWeight: "500" }]}>
                                  {item.time}
                                </Text>
                              </View>
                            ) : null}
                            {item.queueNumber ? (
                              <Text style={[typography.body.xs, { color: colors.primary, fontWeight: "600" }]}>
                                Queue #{item.queueNumber}
                              </Text>
                            ) : null}
                            {item.recordCount ? (
                              <Pill
                                icon={FileText}
                                label={t("appointments.note", {
                                  count: item.recordCount,
                                })}
                                tone="info"
                                size="sm"
                              />
                            ) : null}
                          </View>
                        </View>

                        <ChevronRight
                          size={18}
                          color={colors.textSubtle}
                          strokeWidth={2}
                          style={{ alignSelf: "center", marginLeft: 2 }}
                        />
                      </Pressable>

                      {/* Cancel button */}
                      {(item.status === "scheduled" ||
                        item.status === "confirmed") ? (
                        <Pressable
                          onPress={() => openCancelSheet(item)}
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            "appointments.a11y.cancelAppointment"
                          )}
                          hitSlop={6}
                          disabled={cancellingId === item.id}
                          style={({ pressed }) => ({
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: pressed ? colors.danger : colors.dangerSoft,
                            opacity: cancellingId === item.id ? 0.6 : 1,
                            marginLeft: 4,
                          })}
                        >
                          {cancellingId === item.id ? (
                            <Loader size={14} color={colors.danger} strokeWidth={2.25} />
                          ) : (
                            <X size={15} color={colors.danger} strokeWidth={2.5} />
                          )}
                        </Pressable>
                      ) : null}
                    </View>

                    {/* Join video visit button (rendered on a new row under details to prevent squeeze) */}
                    {activeSession?.session?.appointmentId === item.id &&
                    activeSession.session.roomId &&
                    (item.status === "scheduled" ||
                      item.status === "confirmed" ||
                      item.status === "in_progress") ? (
                      <View style={{ marginTop: spacing.sm + 4 }}>
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/(app)/teleconsult/[roomId]",
                              params: { roomId: activeSession.session!.roomId },
                            })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={t("consult.joinVideoVisit")}
                          hitSlop={6}
                          style={({ pressed }) => ({
                            height: 38,
                            borderRadius: radius.md,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: spacing.sm,
                            backgroundColor: pressed ? colors.primaryMuted : colors.primary,
                          })}
                        >
                          <Video size={16} color={colors.onPrimary} strokeWidth={2.5} />
                          <Text style={[typography.label.md, { color: colors.onPrimary }]}>
                            {t("consult.joinVideoVisit")}
                          </Text>
                        </Pressable>
                      </View>
                    ) : item.mode === "video" &&
                      (item.bucket === "today" || item.isLive) ? (
                      <View style={{ marginTop: spacing.sm + 4 }}>
                        <View
                          accessibilityRole="button"
                          accessibilityLabel={
                            item.isLive
                              ? t("appointments.waitingForDoctor")
                              : t("appointments.startsSoon")
                          }
                          style={{
                            height: 38,
                            borderRadius: radius.md,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: spacing.sm,
                            backgroundColor: colors.surfaceMuted,
                            opacity: 0.8,
                          }}
                        >
                          <Video size={16} color={colors.textMuted} strokeWidth={2.5} />
                          <Text style={[typography.label.md, { color: colors.textMuted }]}>
                            {item.isLive
                              ? t("appointments.waitingForDoctor")
                              : t("appointments.startsSoon")}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Missed visits: compact outline recovery pill */}
                    {item.bucket === "missed" ? (
                      <View style={{ marginTop: spacing.sm + 2, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderMuted || colors.border }}>
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/(app)/book-appointment" as any,
                              params: { prefillDoctorId: item.doctorId ?? "" },
                            })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={t("appointments.bookAgain")}
                          hitSlop={6}
                          style={({ pressed }) => ({
                            height: 32,
                            alignSelf: "flex-start",
                            paddingHorizontal: spacing.md,
                            borderRadius: radius.full,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            backgroundColor: pressed ? colors.primarySoft : "transparent",
                            borderWidth: 1,
                            borderColor: colors.primary,
                          })}
                        >
                          <CalendarPlus size={14} color={colors.primary} strokeWidth={2.25} />
                          <Text style={[typography.label.sm, { color: colors.primary, fontWeight: "700" }]}>
                            {t("appointments.bookAgain")}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            }}
          />
        </View>
      )}

      {/* Cancellation policy sheet — shows refund estimate before user confirms. */}
      <BottomSheet
        visible={!!cancelSheet}
        onDismiss={() => {
          setCancelSheet(null);
          setCancelEstimate(null);
        }}
        title={t("appointments.cancelConfirmTitle")}
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
            <AlertCircle size={20} color={colors.warning || "#FF9500"} strokeWidth={2} />
            <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
              {loadingEstimate
                ? t("appointments.cancelEstimating")
                : cancelEstimate?.rule ||
                  t("appointments.cancelConfirmBody", {
                    date: cancelSheet?.date,
                    time: cancelSheet?.time || "—",
                  })}
            </Text>
          </View>
          {!loadingEstimate && cancelEstimate ? (
            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "center",
                padding: spacing.md,
                backgroundColor: colors.surfaceMuted || colors.bgMuted,
                borderRadius: 12,
              }}
            >
              <Wallet size={18} color={colors.textMuted} strokeWidth={2} />
              <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
                {cancelEstimate.refundLkr > 0
                  ? t("appointments.cancelRefundEstimate", {
                      amount: `LKR ${Number(cancelEstimate.refundLkr).toLocaleString()}`,
                      pct: cancelEstimate.refundPct,
                    })
                  : t("appointments.cancelNoRefund")}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
            <Button
              title={t("appointments.cancelKeep")}
              variant="outline"
              onPress={() => {
                setCancelSheet(null);
                setCancelEstimate(null);
              }}
              fullWidth={false}
            />
            <View style={{ flex: 1 }}>
              <Button
                title={t("appointments.cancelConfirm")}
                onPress={performCancel}
                loading={!!cancellingId}
                variant="danger"
              />
            </View>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function FilterPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} ${count !== undefined ? count : ""}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.full,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={[
          typography.label.md,
          {
            color: active ? colors.onPrimary : colors.text,
            fontWeight: active ? "700" : "600",
          },
        ]}
      >
        {label}
      </Text>
      {typeof count === "number" ? (
        <View
          style={{
            minWidth: 19,
            height: 19,
            borderRadius: 10,
            paddingHorizontal: 5,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active
              ? withOpacity(colors.onPrimary, 0.22)
              : colors.surfaceMuted,
          }}
        >
          <Text
            style={[
              typography.caption,
              {
                fontSize: 11,
                lineHeight: 13,
                fontWeight: "700",
                color: active ? colors.onPrimary : colors.textMuted,
              },
            ]}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ModePill({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon: any;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 34,
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        backgroundColor: active ? colors.primarySoft : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {Icon ? <Icon size={13} color={active ? colors.primary : colors.textMuted} strokeWidth={2.25} /> : null}
      <Text
        numberOfLines={1}
        style={[
          typography.label.sm,
          {
            color: active ? colors.primary : colors.text,
            fontWeight: active ? "700" : "500",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PinnedVideoCard({
  appt,
  isActive,
  onJoin,
}: {
  appt: any;
  isActive: boolean;
  onJoin: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const { day, month } = dateParts(t, appt.date);
  return (
    <Card padded={false} style={{ borderColor: colors.primary }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.sm + 2,
          gap: spacing.sm,
        }}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryMuted]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 48,
            height: 54,
            borderRadius: radius.md,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={[typography.title.sm, { color: colors.onPrimary }]}>{day}</Text>
          <Text style={[typography.overline, { color: colors.onPrimary }]}>{month}</Text>
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
            {appt.doctorName || appt.reason || appt.specialty || t("appointments.fallbackTitle")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginTop: spacing.xs,
              flexWrap: "wrap",
            }}
          >
            {appt.time ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Clock size={13} color={colors.textMuted} strokeWidth={2.25} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {appt.time}
                </Text>
              </View>
            ) : null}
            <Pill icon={Video} label={t("appointments.mode.video")} tone="primary" size="sm" />
          </View>
        </View>
        {isActive ? (
          <Pressable
            onPress={onJoin}
            accessibilityRole="button"
            accessibilityLabel={t("consult.joinVideoVisit")}
            style={({ pressed }) => ({
              minHeight: 38,
              paddingHorizontal: spacing.sm + 2,
              borderRadius: radius.full,
              backgroundColor: pressed ? colors.primaryMuted : colors.primary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
            })}
          >
            <Video size={14} color={colors.onPrimary} strokeWidth={2.5} />
            <Text style={[typography.label.sm, { color: colors.onPrimary, fontWeight: "700" }]}>
              {t("consult.joinVideoVisit")}
            </Text>
          </Pressable>
        ) : (
          <View
            accessibilityRole="button"
            accessibilityLabel={
              appt.isLive
                ? t("appointments.waitingForDoctor")
                : t("appointments.startsSoon")
            }
            style={{
              minHeight: 38,
              paddingHorizontal: spacing.sm + 2,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceMuted || colors.bgMuted,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
              opacity: 0.8,
            }}
          >
            <Video size={14} color={colors.textMuted} strokeWidth={2.5} />
            <Text style={[typography.label.sm, { color: colors.textMuted, fontWeight: "700" }]}>
              {appt.isLive
                ? t("appointments.waitingForDoctor")
                : t("appointments.startsSoon")}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}
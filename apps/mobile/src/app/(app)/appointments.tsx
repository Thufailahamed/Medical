// @ts-nocheck

import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Plus, CalendarPlus, Clock, X, Loader, FileText, AlertCircle, Wallet, Video, Stethoscope, ChevronRight } from "lucide-react-native";
import { useMyAppointments, useCancelAppointment, useActiveTeleconsultSession } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import { slDayDiff } from "@healthcare/shared/visit-lifecycle";
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

function groupKey(t: (k: string) => string, a: any) {
  if (!a?.date) return t("appointments.groups.later");
  const diff = slDayDiff(a.date);
  if (diff === 0) return t("appointments.groups.today");
  if (diff < 0) {
    const d = new Date(a.date);
    return t("appointments.groups.pastMonth", {
      month: d.toLocaleString("en", { month: "short" }),
      year: d.getFullYear(),
      defaultValue: `${d.toLocaleString("en", { month: "long" })} ${d.getFullYear()}`,
    });
  }
  if (diff <= 7) return t("appointments.groups.week");
  return t("appointments.groups.later");
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

  const filtered = useMemo(
    () => all.filter((a) => matchesDateFilter(a) && matchesModeFilter(a)),
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

  const upcomingCount = all.filter(
    (a) => a.bucket === "upcoming" || a.bucket === "today"
  ).length;
  const upcomingPct = all.length
    ? Math.round((upcomingCount / all.length) * 100)
    : 0;
  const contentPadding = spacing.sm + 2;

  return (
    <Screen scroll padded={false} bottomInset={false}>
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

      <View style={{ paddingHorizontal: contentPadding, paddingTop: spacing.xs }}>
        <LinearGradient
          colors={[colors.primarySoft, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.sm + 2,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {FILTER_VALUES.map((v) => (
              <FilterPill
                key={v}
                label={t(`appointments.filter.${v}`)}
                active={filter === v}
                onPress={() => setFilter(v)}
              />
            ))}
          </View>

          {/* Mode filter — Online (video) vs Offline (in-person) vs All.
              Independent of the date filter so users can drill in either axis. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: "row",
              gap: spacing.sm,
              alignItems: "center",
              paddingRight: spacing.xs,
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
        </LinearGradient>
      </View>

      <View
        style={{
          paddingHorizontal: contentPadding,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={[typography.title.sm, { color: colors.text }]}>
          {t(`appointments.filter.${filter}`)}
        </Text>
        <View
          style={{
            minWidth: 30,
            height: 30,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.full,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={[typography.label.md, { color: colors.primary }]}>
            {filtered.length}
          </Text>
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
              return (
                <Card padded={false} style={{ borderRadius: radius.lg }}>
                  <View style={{ padding: spacing.sm + 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
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
                          alignItems: "center",
                          gap: spacing.sm,
                        }}
                      >
                        <LinearGradient
                          colors={[colors.primary, colors.primaryMuted]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            width: 56,
                            height: 66,
                            borderRadius: radius.md,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={[
                              typography.title.lg,
                              { color: colors.onPrimary, fontSize: 22, lineHeight: 24 },
                            ]}
                          >
                            {day}
                          </Text>
                          <Text
                            style={[
                              typography.overline,
                              { color: colors.onPrimary, marginTop: 1 },
                            ]}
                          >
                            {month}
                          </Text>
                        </LinearGradient>

                        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs + 2 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.xs,
                              flexWrap: "wrap",
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
                          <Text
                            style={[typography.title.sm, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {item.reason ||
                              item.specialty ||
                              t("appointments.fallbackTitle")}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.xs,
                              flexWrap: "wrap",
                            }}
                          >
                            {item.time ? (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Clock size={13} color={colors.textMuted} strokeWidth={2.25} />
                                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                                  {item.time}
                                </Text>
                              </View>
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
                        <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.25} />
                      </Pressable>

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
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: pressed ? colors.danger : colors.dangerSoft,
                            opacity: cancellingId === item.id ? 0.6 : 1,
                          })}
                        >
                          {cancellingId === item.id ? (
                            <Loader size={16} color={colors.danger} strokeWidth={2.25} />
                          ) : (
                            <X size={16} color={colors.danger} strokeWidth={2.5} />
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
                      <View style={{ marginTop: spacing.md }}>
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
                      <View style={{ marginTop: spacing.md }}>
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
                            backgroundColor: colors.surfaceMuted || colors.bgMuted,
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

                    {/* Missed visits: one-tap recovery */}
                    {item.bucket === "missed" ? (
                      <View style={{ marginTop: spacing.md }}>
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
                            height: 38,
                            borderRadius: radius.md,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: spacing.sm,
                            backgroundColor: pressed ? colors.primaryMuted : colors.primarySoft,
                            borderWidth: 1,
                            borderColor: colors.primary,
                          })}
                        >
                          <CalendarPlus size={16} color={colors.primary} strokeWidth={2.5} />
                          <Text style={[typography.label.md, { color: colors.primary }]}>
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
  active,
  onPress,
}: {
  label: string;
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
        flex: 1,
        minHeight: 42,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
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
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
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
        minHeight: 36,
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
      {Icon ? <Icon size={14} color={active ? colors.primary : colors.textMuted} strokeWidth={2.25} /> : null}
      <Text
        numberOfLines={1}
        style={[
          typography.label.md,
          {
            color: active ? colors.primary : colors.text,
            fontWeight: "700",
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
          <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text }]}>
            {appt.reason || appt.specialty || t("appointments.fallbackTitle")}
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
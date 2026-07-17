// @ts-nocheck

import { useMemo, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Plus, CalendarPlus, Clock, X, Loader, FileText, AlertCircle, Wallet, Video, Stethoscope } from "lucide-react-native";
import { useMyAppointments, useCancelAppointment, useActiveTeleconsultSession } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
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
  pending: "warning",
  scheduled: "primary",
  in_progress: "primary",
  completed: "info",
  cancelled: "danger",
  no_show: "danger",
};

const FILTER_VALUES = ["all", "upcoming", "past"] as const;
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
  const d = new Date(a.date);
  if (isNaN(d.getTime())) return t("appointments.groups.later");
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return t("appointments.groups.today");
  if (d < now) {
    // Past appointments get grouped by year + month for scannability.
    return t("appointments.groups.pastMonth", {
      month: d.toLocaleString("en", { month: "short" }),
      year: d.getFullYear(),
      defaultValue: `${d.toLocaleString("en", { month: "long" })} ${d.getFullYear()}`,
    });
  }
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
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
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
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

  const now = new Date();
  const todayStart = new Date(now.toDateString());

  // Past + filter helper — used by the pinned section + the timeline.
  const matchesDateFilter = (a: any) => {
    if (filter === "all") return true;
    const d = a.date ? new Date(a.date) : null;
    if (!d || isNaN(d.getTime())) return filter === "upcoming";
    if (filter === "upcoming") return d >= todayStart;
    return d < todayStart;
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

  // Pinned "Upcoming video consultations" — surface the next up-to-3
  // video-mode appointments that are still in the future. Shown above the
  // Timeline when the user is on the Upcoming tab (or All) so the doctor
  // can join from one tap, regardless of filters applied below.
  const upcomingVideo = useMemo(() => {
    return all
      .filter((a) => {
        if (a.mode !== "video") return false;
        if (!a.date) return false;
        const d = new Date(a.date);
        if (isNaN(d.getTime()) || d < todayStart) return false;
        return ["scheduled", "confirmed", "pending"].includes(a.status);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const showPinnedVideo =
    upcomingVideo.length > 0 &&
    (modeFilter === "all" || modeFilter === "video") &&
    (filter === "all" || filter === "upcoming");

  const upcomingCount = all.filter((a) => {
    if (!a.date) return false;
    const d = new Date(a.date);
    return !isNaN(d.getTime()) && d >= todayStart;
  }).length;
  const upcomingPct = all.length
    ? Math.round((upcomingCount / all.length) * 100)
    : 0;

  return (
    <Screen scroll bottomInset={false}>
      <ScreenHeader
        title={t("appointments.title")}
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

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: "row",
          gap: spacing.sm,
        }}
      >
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
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          flexDirection: "row",
          gap: spacing.sm,
          alignItems: "center",
          flexWrap: "wrap",
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
      </View>

      {/* Pinned upcoming video consultations — quick-join entries surfaced
          above the timeline whenever a video visit is approaching. */}
      {showPinnedVideo ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
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
                    params: { roomId: activeSession?.session?.roomId ?? "__pending__" },
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={92} radius={20} />
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
            filter === "past"
              ? t("appointments.empty.pastTitle")
              : t("appointments.empty.title")
          }
          message={
            filter === "past"
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
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Timeline
            data={filtered}
            groupBy={(a: any) => groupKey(t, a)}
            keyExtractor={(a: any) => a.id}
            flush
            renderItem={(item: any) => {
              const tone = STATUS_TONE[item.status] ?? "neutral";
              const { day, month } = dateParts(t, item.date);
              return (
                <Card padded={false}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      padding: spacing.lg,
                    }}
                  >
                    <View
                      style={{
                        width: 60,
                        height: 68,
                        borderRadius: radius.lg,
                        backgroundColor: colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={[
                          typography.title.md,
                          {
                            color: colors.primary,
                            fontSize: 22,
                            lineHeight: 24,
                          },
                        ]}
                      >
                        {day}
                      </Text>
                      <Text
                        style={[
                          typography.overline,
                          { color: colors.primary, marginTop: 2 },
                        ]}
                      >
                        {month}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/(app)/appointment-detail",
                          params: { id: item.id },
                        })
                      }
                      style={{ flex: 1, gap: 6, minWidth: 0 }}
                    >
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
                          gap: spacing.sm,
                          flexWrap: "wrap",
                        }}
                      >
                        {item.time ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Clock
                              size={13}
                              color={colors.textMuted}
                              strokeWidth={2.25}
                            />
                            <Text
                              style={[
                                typography.body.sm,
                                { color: colors.textMuted },
                              ]}
                            >
                              {item.time}
                            </Text>
                          </View>
                        ) : null}
                        {item.status ? (
                          <Pill
                            label={item.status.replace("_", " ")}
                            tone={tone}
                            size="sm"
                          />
                        ) : null}
                        {item.mode === "video" ? (
                          <Pill
                            icon={Video}
                            label={t("appointments.mode.video")}
                            tone="primary"
                            size="sm"
                          />
                        ) : item.mode === "in_person" ? (
                          <Pill
                            label={t("appointments.mode.inPerson")}
                            tone="neutral"
                            size="sm"
                          />
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
                    </Pressable>
                    {(item.status === "scheduled" ||
                      item.status === "confirmed" ||
                      item.status === "pending") ? (
                      <Pressable
                        onPress={() => openCancelSheet(item)}
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          "appointments.a11y.cancelAppointment"
                        )}
                        hitSlop={6}
                        disabled={cancellingId === item.id}
                        style={({ pressed }) => ({
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: pressed
                            ? colors.danger
                            : colors.dangerSoft,
                          opacity: cancellingId === item.id ? 0.6 : 1,
                          marginRight: spacing.sm,
                        })}
                      >
                        {cancellingId === item.id ? (
                          <Loader
                            size={16}
                            color={colors.danger}
                            strokeWidth={2.25}
                          />
                        ) : (
                          <X
                            size={16}
                            color={colors.danger}
                            strokeWidth={2.5}
                          />
                        )}
                      </Pressable>
                    ) : null}
                    {activeSession?.session?.appointmentId === item.id &&
                    activeSession.session.roomId ? (
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
                          height: 36,
                          paddingHorizontal: spacing.md,
                          borderRadius: 18,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: pressed
                            ? colors.primary
                            : colors.primarySoft,
                        })}
                      >
                        <Video size={15} color={colors.primary} strokeWidth={2.5} />
                        <Text
                          style={[
                            typography.label.sm,
                            { color: colors.primary, fontWeight: "700" },
                          ]}
                        >
                          {t("consult.joinVideoVisit")}
                        </Text>
                      </Pressable>
                    ) : null}
                    {/* Round 5: video-mode appointments get a join CTA
                        *before* the doctor opens a room — taps navigate
                        to the waiting screen, which polls /me/active and
                        shows the doctor when they start. */}
                    {item.mode === "video" &&
                    (item.status === "scheduled" ||
                      item.status === "confirmed" ||
                      item.status === "pending") &&
                    activeSession?.session?.appointmentId !== item.id ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/(app)/teleconsult/[roomId]" as any,
                            params: { roomId: "__pending__" },
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={t("appointments.joinVideo")}
                        hitSlop={6}
                        style={({ pressed }) => ({
                          height: 36,
                          paddingHorizontal: spacing.md,
                          borderRadius: 18,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: pressed
                            ? colors.primary
                            : colors.primarySoft,
                        })}
                      >
                        <Video size={15} color={colors.primary} strokeWidth={2.5} />
                        <Text
                          style={[
                            typography.label.sm,
                            { color: colors.primary, fontWeight: "700" },
                          ]}
                        >
                          {t("appointments.joinVideo")}
                        </Text>
                      </Pressable>
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
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
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
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? colors.primarySoft : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      {Icon ? <Icon size={13} color={active ? colors.primary : colors.textMuted} strokeWidth={2.25} /> : null}
      <Text
        style={[
          typography.label.sm,
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
    <Card padded={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.md,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={[typography.title.sm, { color: colors.primary }]}>{day}</Text>
          <Text style={[typography.overline, { color: colors.primary }]}>{month}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={[typography.title.sm, { color: colors.text }]}
          >
            {appt.reason || appt.specialty || t("appointments.fallbackTitle")}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 4, flexWrap: "wrap" }}>
            {appt.time ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Clock size={12} color={colors.textMuted} strokeWidth={2.25} />
                <Text style={[typography.body.xs, { color: colors.textMuted }]}>
                  {appt.time}
                </Text>
              </View>
            ) : null}
            <Pill icon={Video} label={t("appointments.mode.video")} tone="primary" size="sm" />
          </View>
        </View>
        <Pressable
          onPress={onJoin}
          accessibilityRole="button"
          accessibilityLabel={
            isActive ? t("consult.joinVideoVisit") : t("appointments.joinVideo")
          }
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: pressed ? colors.primary : colors.primarySoft,
            borderWidth: 1,
            borderColor: colors.primary,
          })}
        >
          <Text
            style={[
              typography.label.sm,
              { color: colors.primary, fontWeight: "700" },
            ]}
          >
            {isActive ? t("consult.joinVideoVisit") : t("appointments.joinVideo")}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
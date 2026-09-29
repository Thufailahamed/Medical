// @ts-nocheck

import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Clock,
  UserRound,
  Play,
  CheckCircle2,
  XCircle,
  Sparkles,
  UserPlus,
  Video,
} from "lucide-react-native";
import {
  useDoctorQueue,
  useUpdateAppointmentStatus,
  useUpdateWalkIn,
  useCreateTeleconsultSession,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Avatar,
  Pill,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
  MetricStrip,
  useToast,
} from "@/components/ui";

function statusLabel(t: (k: string, opts?: any) => string, s: string): string {
  return t(`status.${s}`, { defaultValue: s.replace(/_/g, " ") });
}

export default function DoctorQueue() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const { data, isLoading, isError, refetch } = useDoctorQueue();
  const updateStatus = useUpdateAppointmentStatus();
  const createTeleconsult = useCreateTeleconsultSession();

  const [busyId, setBusyId] = useState<string | null>(null);

  const queue = data?.queue || [];
  const waitingN = queue.filter(
    (q: any) => q.status === "scheduled" || q.status === "confirmed" || q.status === "waiting"
  ).length;
  const activeN = queue.filter(
    (q: any) => q.status === "in_progress" || q.status === "in_consultation"
  ).length;
  const doneN = queue.filter((q: any) => q.status === "completed").length;

  async function setStatus(
    id: string,
    status: "in_progress" | "completed" | "no_show" | "cancelled"
  ) {
    setBusyId(id);
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.show(statusLabel(t, status), "success");
    } catch (err: any) {
      toast.show(err?.message || t("doctorQueue.updateError"), "danger");
    } finally {
      setBusyId(null);
    }
  }

  function statusTone(s: string): "primary" | "success" | "warning" | "danger" | "neutral" {
    switch (s) {
      case "in_progress":
        return "warning";
      case "completed":
        return "success";
      case "cancelled":
      case "no_show":
        return "danger";
      default:
        return "primary";
    }
  }

  return (
    <Screen padded={false} scroll edges={["top"]} bottomInset onRefresh={() => refetch()} refreshing={false}>
      <ScreenHeader
        kicker={data?.date || undefined}
        title={t("doctorQueue.title")}
        back
        onBack={() => router.back()}
      />

      {!isLoading && !isError && queue.length > 0 ? (
        <MetricStrip
          size="md"
          style={{ marginHorizontal: spacing.lg, marginTop: spacing.xs }}
          items={[
            {
              icon: Clock,
              label: t("doctorQueue.summary.waiting", "Waiting"),
              value: waitingN,
              tone: "primary",
              live: waitingN > 0,
            },
            {
              icon: Play,
              label: t("doctorQueue.summary.inProgress", "In progress"),
              value: activeN,
              tone: "warning",
            },
            {
              icon: CheckCircle2,
              label: t("doctorQueue.summary.done", "Done"),
              value: doneN,
              tone: "success",
            },
          ]}
        />
      ) : null}

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={88} radius={20} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load queue")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : queue.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={Clock}
            title={t("doctorQueue.emptyTitle")}
            message={t("doctorQueue.emptyBody")}
            tone="neutral"
          />
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
          {queue.map((q: any) => {
            const tone = statusTone(q.status);
            const canStart = q.status === "scheduled" || q.status === "confirmed";
            const canComplete = q.status === "in_progress";
            const isWalkIn = q.kind === "walkin";
            const key = q.appointmentId || q.walkInId || `${q.patientId}-${q.time}`;
            return (
              <Card key={key} padded={false}>
                <View style={{ padding: spacing.lg, gap: spacing.md }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <View>
                      <Avatar
                        name={q.patientName}
                        size="md"
                        tone={isWalkIn ? "warning" : "primary"}
                        source={q.patientPhoto ? { uri: q.patientPhoto } : undefined}
                      />
                      {!isWalkIn && q.queueNumber != null ? (
                        <View
                          style={{
                            position: "absolute",
                            right: -6,
                            bottom: -4,
                            minWidth: 22,
                            height: 20,
                            paddingHorizontal: 5,
                            borderRadius: 10,
                            backgroundColor: colors.text,
                            borderWidth: 2,
                            borderColor: colors.surface,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={[
                              typography.label.xs,
                              { fontSize: 10, color: colors.surface, fontVariant: ["tabular-nums"] },
                            ]}
                          >
                            {q.queueNumber}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[typography.title.md, { color: colors.text }]}>
                        {q.patientName || t("doctorQueue.patientFallback")}
                      </Text>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted, marginTop: 2 },
                        ]}
                        numberOfLines={1}
                      >
                        {q.reason || t("doctorQueue.noReason")}
                      </Text>
                      {q.time || q.bloodGroup || q.hospitalName ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 4,
                          }}
                        >
                          {q.time ? <Clock size={11} color={colors.textSubtle} strokeWidth={2.4} /> : null}
                          <Text
                            numberOfLines={1}
                            style={[
                              typography.caption,
                              { color: colors.textSubtle, fontVariant: ["tabular-nums"], flexShrink: 1 },
                            ]}
                          >
                            {[q.time, q.bloodGroup, q.hospitalName].filter(Boolean).join("  ·  ")}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                      <Pill label={statusLabel(t, q.status)} tone={tone} size="sm" />
                      {isWalkIn ? (
                        <Pill
                          icon={UserPlus}
                          label={t("doctorQueue.walkIn")}
                          tone={q.priority === "urgent" ? "danger" : "warning"}
                          size="sm"
                        />
                      ) : null}
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                      flexWrap: "wrap",
                      paddingTop: spacing.md,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    }}
                  >
                    <Button
                      title={t("doctorQueue.actions.open")}
                      icon={UserRound}
                      variant="primary"
                      size="sm"
                      fullWidth={false}
                      onPress={() =>
                        router.push({
                          pathname: "/(doctor)/patient-detail",
                          params: { id: q.patientId },
                        })
                      }
                    />
                    {isWalkIn ? (
                      <WalkInActions walkInId={q.walkInId} status={q.status} />
                    ) : (
                      <>
                        {canStart ? (
                          <Button
                            title={t("doctorQueue.actions.start")}
                            icon={Play}
                            variant="secondary"
                            size="sm"
                            fullWidth={false}
                            loading={busyId === q.appointmentId}
                            onPress={() => setStatus(q.appointmentId, "in_progress")}
                          />
                        ) : null}
                        {canStart && q.mode === "video" && q.appointmentId ? (
                          <Button
                            title={t("consult.startVideoVisit")}
                            icon={Video}
                            variant="primary"
                            size="sm"
                            fullWidth={false}
                            loading={createTeleconsult.isPending && busyId === q.appointmentId}
                            onPress={async () => {
                              if (!q.appointmentId) return;
                              setBusyId(q.appointmentId);
                              try {
                                const res = await createTeleconsult.mutateAsync({
                                  appointmentId: q.appointmentId,
                                });
                                router.push({
                                  pathname: "/(doctor)/teleconsult/[roomId]" as any,
                                  params: { roomId: res.roomId },
                                });
                              } catch (err: any) {
                                toast.show(
                                  err?.message || t("consult.startVideoError"),
                                  "danger"
                                );
                              } finally {
                                setBusyId(null);
                              }
                            }}
                          />
                        ) : null}
                        {canComplete ? (
                          <>
                            <Button
                              title={t("doctorQueue.actions.completeVisit")}
                              icon={Sparkles}
                              variant="primary"
                              size="sm"
                              fullWidth={false}
                              onPress={() =>
                                router.push({
                                  pathname: "/(doctor)/visit-summary",
                                  params: {
                                    patientId: q.patientId,
                                    appointmentId: q.appointmentId,
                                  },
                                })
                              }
                            />
                            <Button
                              title={t("doctorQueue.actions.markDone")}
                              icon={CheckCircle2}
                              variant="ghost"
                              size="sm"
                              fullWidth={false}
                              loading={busyId === q.appointmentId}
                              onPress={() => setStatus(q.appointmentId, "completed")}
                            />
                          </>
                        ) : null}
                        {q.status !== "completed" &&
                        q.status !== "cancelled" &&
                        q.status !== "no_show" ? (
                          <Button
                            title={t("doctorQueue.actions.noShow")}
                            icon={XCircle}
                            variant="danger"
                            size="sm"
                            fullWidth={false}
                            onPress={() => setStatus(q.appointmentId, "no_show")}
                          />
                        ) : null}
                      </>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <View style={{ height: 24 }} />
    </Screen>
  );
}

function WalkInActions({ walkInId, status }: { walkInId: string; status: string }) {
  const updateWalkIn = useUpdateWalkIn();
  const toast = useToast();
  const { t } = useTranslation();

  async function set(s: "in_consultation" | "completed" | "no_show") {
    try {
      await updateWalkIn.mutateAsync({ id: walkInId, status: s });
      toast.show(t("doctorQueue.statusUpdated", { status: s.replace(/_/g, " ") }), "info");
    } catch (err: any) {
      toast.show(err?.message || t("doctorQueue.updateError"), "danger");
    }
  }

  if (status === "waiting") {
    return (
      <Button
        title={t("doctorQueue.actions.startConsult")}
        icon={Play}
        variant="secondary"
        size="sm"
        fullWidth={false}
        onPress={() => set("in_consultation")}
      />
    );
  }
  if (status === "in_consultation") {
    return (
      <Button
        title={t("doctorQueue.actions.markDone")}
        icon={CheckCircle2}
        variant="primary"
        size="sm"
        fullWidth={false}
        onPress={() => set("completed")}
      />
    );
  }
  return null;
}
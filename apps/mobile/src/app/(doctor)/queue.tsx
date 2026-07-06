// @ts-nocheck

import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Clock,
  UserRound,
  Play,
  CheckCircle2,
  XCircle,
  Hash,
  Sparkles,
  UserPlus,
} from "lucide-react-native";
import {
  useDoctorQueue,
  useUpdateAppointmentStatus,
  useUpdateWalkIn,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Avatar,
  Pill,
  EmptyState,
  Skeleton,
  Button,
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

  const { data, isLoading } = useDoctorQueue();
  const updateStatus = useUpdateAppointmentStatus();

  const [busyId, setBusyId] = useState<string | null>(null);

  const queue = data?.queue || [];

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
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        title={t("doctorQueue.title")}
        subtitle={data?.date || ""}
        back
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={88} radius={20} />
          ))}
        </View>
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
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
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
                    <Avatar
                      name={q.patientName}
                      size="md"
                      tone={isWalkIn ? "warning" : "primary"}
                      source={q.patientPhoto ? { uri: q.patientPhoto } : undefined}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.title.sm, { color: colors.text }]}>
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
                    </View>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {isWalkIn ? (
                        <Pill
                          icon={UserPlus}
                          label={t("doctorQueue.walkIn")}
                          tone={q.priority === "urgent" ? "danger" : "warning"}
                          size="sm"
                        />
                      ) : null}
                      <Pill label={statusLabel(t, q.status)} tone={tone} size="sm" />
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {q.time ? (
                      <Pill icon={Clock} label={q.time || "—"} tone="neutral" size="sm" />
                    ) : null}
                    {!isWalkIn ? (
                      <Pill
                        icon={Hash}
                        label={`#${q.queueNumber ?? "—"}`}
                        tone="neutral"
                        size="sm"
                      />
                    ) : null}
                    {q.bloodGroup ? (
                      <Pill label={q.bloodGroup} tone="info" size="sm" />
                    ) : null}
                    {q.hospitalName ? (
                      <Pill label={q.hospitalName} tone="neutral" size="sm" />
                    ) : null}
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                      flexWrap: "wrap",
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
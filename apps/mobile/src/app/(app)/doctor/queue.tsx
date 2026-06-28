import { useState } from "react";
import { View, Text, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import {
  Clock,
  UserRound,
  ChevronRight,
  Play,
  CheckCircle2,
  XCircle,
  Hash,
} from "lucide-react-native";
import {
  useDoctorQueue,
  useUpdateAppointmentStatus,
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

export default function DoctorQueue() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const { data, isLoading, refetch, isRefetching } = useDoctorQueue();
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
      toast.show(`Marked ${status}`, "success");
    } catch (err: any) {
      toast.show(err?.message || "Could not update", "danger");
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
        title="Today's queue"
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
            title="No appointments today"
            message="When patients book, they'll show up here."
            tone="neutral"
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {queue.map((q: any) => {
            const tone = statusTone(q.status);
            const canStart = q.status === "scheduled" || q.status === "confirmed";
            const canComplete = q.status === "in_progress";
            return (
              <Card key={q.appointmentId} padded={false}>
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
                      tone="primary"
                      source={q.patientPhoto ? { uri: q.patientPhoto } : undefined}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.title.sm, { color: colors.text }]}>
                        {q.patientName || "Patient"}
                      </Text>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted, marginTop: 2 },
                        ]}
                        numberOfLines={1}
                      >
                        {q.reason || "No reason given"}
                      </Text>
                    </View>
                    <Pill label={q.status} tone={tone} size="sm" />
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Pill
                      icon={Clock}
                      label={q.time || "—"}
                      tone="neutral"
                      size="sm"
                    />
                    <Pill
                      icon={Hash}
                      label={`#${q.queueNumber ?? "—"}`}
                      tone="neutral"
                      size="sm"
                    />
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
                      title="Open"
                      icon={UserRound}
                      variant="primary"
                      size="sm"
                      fullWidth={false}
                      onPress={() =>
                        router.push({
                          pathname: "/doctor/patient-detail",
                          params: { id: q.patientId },
                        })
                      }
                    />
                    {canStart ? (
                      <Button
                        title="Start"
                        icon={Play}
                        variant="secondary"
                        size="sm"
                        fullWidth={false}
                        loading={busyId === q.appointmentId}
                        onPress={() => setStatus(q.appointmentId, "in_progress")}
                      />
                    ) : null}
                    {canComplete ? (
                      <Button
                        title="Complete"
                        icon={CheckCircle2}
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        loading={busyId === q.appointmentId}
                        onPress={() => setStatus(q.appointmentId, "completed")}
                      />
                    ) : null}
                    {q.status !== "completed" &&
                    q.status !== "cancelled" &&
                    q.status !== "no_show" ? (
                      <Button
                        title="No-show"
                        icon={XCircle}
                        variant="danger"
                        size="sm"
                        fullWidth={false}
                        onPress={() => setStatus(q.appointmentId, "no_show")}
                      />
                    ) : null}
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
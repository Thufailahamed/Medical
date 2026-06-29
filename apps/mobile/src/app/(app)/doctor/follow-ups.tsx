import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
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
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  EmptyState,
  Skeleton,
  ChipGroup,
  useToast,
} from "@/components/ui";

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

function statusMeta(status: string | undefined) {
  switch (status) {
    case "completed":
      return { label: "Done", tone: "success" as const, icon: Check };
    case "cancelled":
      return { label: "Cancelled", tone: "danger" as const, icon: XCircle };
    default:
      return { label: "Pending", tone: "warning" as const, icon: Clock4 };
  }
}

export default function FollowUpsScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState("upcoming");
  const { data, isLoading } = useFollowUps({ upcoming: tab === "upcoming" });
  const updateStatus = useUpdateFollowUpStatus();

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
      toast.show("Follow-up marked complete", "success");
    } catch (err: any) {
      toast.show(err?.message || "Could not update", "danger");
    }
  }

  function confirmCancel(f: any) {
    Alert.alert(
      "Cancel follow-up?",
      `“${f.title}” will be marked cancelled and the patient will be notified.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel follow-up",
          style: "destructive",
          onPress: async () => {
            try {
              await updateStatus.mutateAsync({ id: f.id, status: "cancelled" });
              toast.show("Follow-up cancelled", "info");
            } catch (err: any) {
              toast.show(err?.message || "Could not cancel", "danger");
            }
          },
        },
      ]
    );
  }

  async function reopen(f: any) {
    try {
      await updateStatus.mutateAsync({ id: f.id, status: "pending" });
      toast.show("Reopened", "info");
    } catch (err: any) {
      toast.show(err?.message || "Could not reopen", "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Follow-ups"
        subtitle="Pending, completed and cancelled"
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
      ) : list.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={CalendarClock}
            title="No follow-ups"
            message={
              tab === "upcoming"
                ? "Nothing pending on the schedule."
                : tab === "completed"
                ? "Mark a follow-up complete to see it here."
                : "Schedule a follow-up from any patient detail screen."
            }
            tone="neutral"
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, paddingBottom: 80, gap: spacing.md }}>
          {list.map((f: any) => {
            const today = new Date().toISOString().split("T")[0];
            const upcoming = (f.followUpDate || "") >= today;
            const meta = statusMeta(f.status);
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
                      gap: spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor:
                          isDone
                            ? "rgba(16, 185, 129, 0.14)"
                            : isCancelled
                            ? "rgba(239, 68, 68, 0.12)"
                            : colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <StatusIcon
                        size={16}
                        color={
                          isDone
                            ? "#10B981"
                            : isCancelled
                            ? colors.danger
                            : colors.primary
                        }
                        strokeWidth={2.3}
                      />
                    </View>
                    <Text
                      style={[
                        typography.title.sm,
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

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <PillCmp
                      label={f.followUpDate || "No date"}
                      tone={upcoming ? "primary" : "neutral"}
                      size="sm"
                    />
                    {upcoming && !isDone && !isCancelled ? (
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textMuted },
                        ]}
                      >
                        Scheduled
                      </Text>
                    ) : null}
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
                      paddingTop: spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    {!isDone && !isCancelled ? (
                      <>
                        <Pressable
                          onPress={() => markCompleted(f)}
                          accessibilityRole="button"
                          accessibilityLabel={`Mark ${f.title} as complete`}
                          style={({ pressed }) => ({
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 8,
                            borderRadius: radius.md,
                            backgroundColor: pressed
                              ? colors.success
                              : "rgba(16, 185, 129, 0.14)",
                            borderWidth: 1,
                            borderColor: "rgba(16, 185, 129, 0.4)",
                          })}
                        >
                          <Check size={14} color="#10B981" strokeWidth={2.6} />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: "#10B981",
                            }}
                          >
                            Mark complete
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => confirmCancel(f)}
                          accessibilityRole="button"
                          accessibilityLabel={`Cancel ${f.title}`}
                          hitSlop={6}
                          style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: pressed
                              ? colors.danger
                              : colors.surfaceMuted,
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
                        accessibilityLabel={`Reopen ${f.title}`}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          paddingVertical: 8,
                          borderRadius: radius.md,
                          backgroundColor: pressed
                            ? colors.primary
                            : colors.surfaceMuted,
                        })}
                      >
                        <RotateCcw
                          size={14}
                          color={colors.primary}
                          strokeWidth={2.6}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "800",
                            color: colors.primary,
                          }}
                        >
                          Reopen
                        </Text>
                      </Pressable>
                    )}

                    {f.patientId ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/doctor/patient-detail",
                            params: { id: f.patientId },
                          } as any)
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Open patient"
                        hitSlop={6}
                        style={({ pressed }) => ({
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: pressed
                            ? colors.primarySoft
                            : colors.bg,
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                      >
                        <ChevronRight
                          size={16}
                          color={colors.primary}
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
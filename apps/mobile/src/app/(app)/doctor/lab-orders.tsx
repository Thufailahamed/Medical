import { useState } from "react";
import { View, Text, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import {
  FlaskConical,
  Filter,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  ChevronRight,
  User,
} from "lucide-react-native";
import { useLabOrders, useUpdateLabOrder } from "@/hooks/useApi";
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
  Button,
} from "@/components/ui";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "ordered", label: "Ordered" },
  { value: "sample_collected", label: "Sample" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

function statusTone(s: string): any {
  switch (s) {
    case "completed":
      return "success";
    case "in_progress":
      return "warning";
    case "sample_collected":
      return "info";
    case "cancelled":
      return "danger";
    default:
      return "primary";
  }
}

function statusIcon(s: string) {
  switch (s) {
    case "completed":
      return CheckCircle2;
    case "in_progress":
      return CircleDot;
    case "sample_collected":
      return CircleDashed;
    default:
      return CircleDashed;
  }
}

export default function LabOrdersList() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const [status, setStatus] = useState("");
  const { data, isLoading, refetch, isRefetching } = useLabOrders(status);
  const updateOrder = useUpdateLabOrder();

  const orders = data?.orders || [];

  async function advance(id: string, current: string) {
    const next: Record<string, string> = {
      ordered: "sample_collected",
      sample_collected: "in_progress",
      in_progress: "completed",
    };
    const target = next[current];
    if (!target) return;
    try {
      await updateOrder.mutateAsync({ id, status: target as any });
      toast.show(`Marked ${target.replace("_", " ")}`, "success");
    } catch (err: any) {
      toast.show(err?.message || "Update failed", "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Lab orders"
        subtitle="Track progress and results"
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <ChipGroup
          options={STATUS_TABS}
          value={status}
          onChange={setStatus}
        />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={88} radius={20} />
          ))}
        </View>
      ) : orders.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={FlaskConical}
            title="No lab orders"
            message="Order tests from a patient detail screen."
            tone="neutral"
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {orders.map((o: any) => {
            const tests = (() => {
              try {
                return JSON.parse(o.tests);
              } catch {
                return [];
              }
            })();
            const Icon = statusIcon(o.status);
            const canAdvance =
              o.status === "ordered" ||
              o.status === "sample_collected" ||
              o.status === "in_progress";
            return (
              <Card key={o.id} padded={false}>
                <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <FlaskConical
                      size={18}
                      color={
                        o.priority === "stat"
                          ? colors.danger
                          : o.priority === "urgent"
                          ? colors.warning
                          : colors.primary
                      }
                      strokeWidth={2.2}
                    />
                    <Text
                      style={[typography.title.sm, { color: colors.text, flex: 1 }]}
                      numberOfLines={2}
                    >
                      {tests.join(", ") || "Lab order"}
                    </Text>
                    <PillCmp label={o.status.replace("_", " ")} tone={statusTone(o.status)} size="sm" />
                  </View>

                  <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
                    <PillCmp
                      label={o.priority}
                      tone={
                        o.priority === "stat"
                          ? "danger"
                          : o.priority === "urgent"
                          ? "warning"
                          : "neutral"
                      }
                      size="sm"
                    />
                    <PillCmp
                      label={new Date(o.orderedAt).toLocaleDateString()}
                      tone="neutral"
                      size="sm"
                    />
                  </View>

                  {o.resultSummary ? (
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted },
                      ]}
                    >
                      Result: {o.resultSummary}
                    </Text>
                  ) : null}

                  {canAdvance ? (
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Button
                        title="Advance"
                        icon={Icon}
                        variant="primary"
                        size="sm"
                        fullWidth={false}
                        onPress={() => advance(o.id, o.status)}
                      />
                      <Button
                        title="Complete"
                        icon={CheckCircle2}
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        onPress={() =>
                          updateOrder.mutate({ id: o.id, status: "completed" })
                        }
                      />
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
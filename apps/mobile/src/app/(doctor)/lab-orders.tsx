// @ts-nocheck

import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";
import {
  FlaskConical,
  CheckCircle2,
  CircleDashed,
  CircleDot,
} from "lucide-react-native";
import { useLabOrders, useUpdateLabOrder } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
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
  Button,
} from "@/components/ui";

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
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const STATUS_TABS = [
    { value: "", label: t("doctorLabOrders.tabs.all") },
    { value: "ordered", label: t("doctorLabOrders.tabs.ordered") },
    { value: "sample_collected", label: t("doctorLabOrders.tabs.sampleCollected") },
    { value: "in_progress", label: t("doctorLabOrders.tabs.inProgress") },
    { value: "completed", label: t("doctorLabOrders.tabs.completed") },
  ];

  const [status, setStatus] = useState("");
  const { data, isLoading, isError, refetch } = useLabOrders(status);
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
      toast.show(t("doctorLabOrders.marked", { status: target.replace("_", " ") }), "success");
    } catch (err: any) {
      toast.show(err?.message || t("doctorLabOrders.updateError"), "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorLabOrders.title")}
        subtitle={t("doctorLabOrders.subtitle")}
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
      ) : isError ? (
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load lab orders")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : orders.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={FlaskConical}
            title={t("doctorLabOrders.emptyTitle")}
            message={t("doctorLabOrders.emptyBody")}
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
                      {tests.join(", ") || t("doctorLabOrders.fallbackName")}
                    </Text>
                    <PillCmp
                      label={t(`status.${o.status}`, { defaultValue: o.status.replace(/_/g, " ") })}
                      tone={statusTone(o.status)}
                      size="sm"
                    />
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
                      label={fmtDate(new Date(o.orderedAt), locale)}
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
                      {t("doctorLabOrders.result", { value: o.resultSummary })}
                    </Text>
                  ) : null}

                  {canAdvance ? (
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Button
                        title={t("doctorLabOrders.advance")}
                        icon={Icon}
                        variant="primary"
                        size="sm"
                        fullWidth={false}
                        onPress={() => advance(o.id, o.status)}
                      />
                      <Button
                        title={t("doctorLabOrders.complete")}
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
// @ts-nocheck
// Operator enrollment list (read-only).

import { useMemo } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import { Users, ShieldCheck } from "lucide-react-native";
import { useOperatorEnrollments } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
  IconTile,
} from "@/components/ui";

export default function OperatorEnrollmentsScreen() {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const list = useOperatorEnrollments();
  const rows = useMemo(() => list.data?.enrollments ?? [], [list.data?.enrollments]);

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("operator.enrollmentsTitle")}
        subtitle={t("operator.enrollmentsSubtitle")}
        kicker="INSURANCE"
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isFetching && !list.isLoading}
            onRefresh={() => list.refetch()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {list.isLoading ? (
          <Skeleton height={120} radius={20} />
        ) : list.isError ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title={t("operator.emptyEnrollments")} />
        ) : (
          rows.map((e: any, idx: number) => (
            <Card key={e.id ?? idx} style={{ padding: spacing.lg, gap: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconTile
                  icon={ShieldCheck}
                  tone={e.status === "active" ? "success" : "neutral"}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
                    {e.userName ?? e.policyNumber ?? e.id}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {e.planName ?? ""}
                    {e.policyNumber ? ` · ${e.policyNumber}` : ""}
                  </Text>
                  {typeof e.premiumAmountLkr === "number" ? (
                    <Text style={[typography.caption, { color: colors.textSubtle }]}>
                      LKR {Number(e.premiumAmountLkr).toLocaleString()} · {e.billingCycle ?? ""}
                    </Text>
                  ) : null}
                </View>
                <Chip label={String(e.status ?? "")} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

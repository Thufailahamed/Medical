// @ts-nocheck
// Insurance-operator claims queue with status filters.

import { useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react-native";
import { useOperatorClaims } from "@/hooks/useApi";
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

const FILTERS = ["submitted", "under_review", "more_info_needed", "approved", "rejected", "paid", "all"] as const;

export default function OperatorClaimsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

  const [filter, setFilter] = useState<string>("submitted");
  const list = useOperatorClaims(filter === "all" ? undefined : filter);
  const rows = useMemo(() => list.data?.claims ?? [], [list.data?.claims]);

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("operator.claimsTitle")}
        subtitle={t("operator.claimsSubtitle")}
        kicker="INSURANCE"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={t(`operator.statuses.${f}`)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>

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
          <EmptyState icon={FileText} title={t("operator.empty")} />
        ) : (
          rows.map((c: any, idx: number) => (
            <Card
              key={c.id ?? idx}
              style={{ padding: spacing.lg, gap: spacing.xs }}
              onPress={() => router.push(`/(operator)/claim-detail?id=${c.id}` as any)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconTile
                  icon={FileText}
                  tone={c.status === "approved" || c.status === "paid" ? "success" : c.status === "rejected" ? "danger" : c.status === "submitted" ? "warning" : "primary"}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
                    {c.patientName ?? c.policyNumber ?? c.id}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {t("operator.amountRequested")}: LKR {Number(c.amountRequestedLkr ?? 0).toLocaleString()}
                    {c.policyNumber ? ` · ${c.policyNumber}` : ""}
                  </Text>
                </View>
                <Chip label={t(`operator.statuses.${c.status}`, { defaultValue: c.status })} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

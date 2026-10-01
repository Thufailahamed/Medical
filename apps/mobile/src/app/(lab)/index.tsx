// @ts-nocheck
// Lab dashboard: workload stats at a glance.

import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  CalendarDays,
  Clock,
  CheckCircle2,
  FlaskConical,
} from "lucide-react-native";
import { useLabStats } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  ErrorState,
  Skeleton,
  IconTile,
} from "@/components/ui";

export default function LabDashboardScreen() {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const stats = useLabStats();
  const s = stats.data?.stats ?? {};

  const cards = [
    { icon: ClipboardList, tone: "primary", label: t("lab.stats.total"), value: s.totalBookings ?? "—" },
    { icon: CalendarDays, tone: "accent", label: t("lab.stats.today"), value: s.todayBookings ?? "—" },
    { icon: Clock, tone: "warning", label: t("lab.stats.pending"), value: s.pendingBookings ?? "—" },
    { icon: CheckCircle2, tone: "success", label: t("lab.stats.completed"), value: s.completedBookings ?? "—" },
    { icon: FlaskConical, tone: "neutral", label: t("lab.stats.activeTests"), value: s.activeTests ?? "—" },
  ];

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("lab.homeTitle")}
        subtitle={t("lab.homeSubtitle")}
        kicker="LABORATORY"
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
            refreshing={stats.isFetching && !stats.isLoading}
            onRefresh={() => stats.refetch()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {stats.isLoading ? (
          <Skeleton height={160} radius={20} />
        ) : stats.isError ? (
          <ErrorState onRetry={() => stats.refetch()} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {cards.map((c) => (
              <Card key={c.label} style={{ flexBasis: "47%", flexGrow: 1, padding: spacing.lg, gap: spacing.sm }}>
                <IconTile icon={c.icon} tone={c.tone} />
                <Text style={[typography.display.sm, { color: colors.text }]}>
                  {String(c.value)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {c.label}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// @ts-nocheck
// Insurance-operator dashboard. Unbound `insurance` accounts (no org)
// get a no-org state instead of numbers.

import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Users,
  BadgeCheck,
  Clock,
  CheckCircle2,
  Banknote,
  Building2,
} from "lucide-react-native";
import { useOperatorDashboard } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  IconTile,
} from "@/components/ui";

export default function OperatorDashboardScreen() {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const dash = useOperatorDashboard();
  const s = dash.data?.stats ?? {};
  const noOrg = (dash.error as any)?.message?.includes?.("org");

  const cards = [
    { icon: Users, tone: "primary", label: t("operator.stats.enrollments"), value: s.totalEnrollments ?? "—" },
    { icon: BadgeCheck, tone: "success", label: t("operator.stats.active"), value: s.activeEnrollments ?? "—" },
    { icon: Clock, tone: "warning", label: t("operator.stats.pendingClaims"), value: s.pendingClaims ?? "—" },
    { icon: CheckCircle2, tone: "accent", label: t("operator.stats.approvedMtd"), value: s.approvedClaimsMtd ?? "—" },
    { icon: Banknote, tone: "neutral", label: t("operator.stats.premiumMtd"), value: s.premiumCollectedMtd ?? "—" },
  ];

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("operator.homeTitle")}
        subtitle={t("operator.homeSubtitle")}
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
            refreshing={dash.isFetching && !dash.isLoading}
            onRefresh={() => dash.refetch()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {dash.isLoading ? (
          <Skeleton height={160} radius={20} />
        ) : dash.isError ? (
          noOrg ? (
            <EmptyState icon={Building2} title={t("operator.noOrg")} />
          ) : (
            <ErrorState onRetry={() => dash.refetch()} />
          )
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

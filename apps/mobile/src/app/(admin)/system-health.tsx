import React from "react";
import { View, Text } from "react-native";
import {
  Database,
  AlertTriangle,
  Users,
  UserCheck,
  Stethoscope,
  FileText,
  UserPlus,
  ShieldQuestion,
  Bell,
  HeartPulse,
  Timer,
} from "lucide-react-native";
import { Screen, Pill } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminHealth,
  useAdminHealthErrors,
  useAdminCronRuns,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminSection,
  AdminCard,
  AdminStat,
  StatGrid,
  IconTile,
  ListSkeleton,
  AdminError,
  FilterChips,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const CRONS = [
  { label: "Booking", value: "booking" },
  { label: "Dose", value: "dose" },
  { label: "Refill", value: "refill" },
  { label: "Reclassify", value: "reclassify" },
  { label: "Vaccination", value: "vaccination" },
];

export default function AdminHealthScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading, isError, refetch, isRefetching } = useAdminHealth();
  const { data: errors } = useAdminHealthErrors();
  const [cron, setCron] = React.useState("booking");
  const { data: cronRuns, isLoading: cronLoading } = useAdminCronRuns(cron);

  const c = data?.counts;
  const storage = data?.storage;
  const errorCount = errors?.items?.length ?? 0;

  const fmtBytes = (b?: number | null) => {
    if (b == null) return "—";
    if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`;
    if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    return `${Math.round(b / 1024)} KB`;
  };

  return (
    <Screen
      scroll
      padded={false}
      refreshing={isRefetching}
      onRefresh={refetch}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="System"
          title="System health"
          subtitle="Live platform overview"
          icon={HeartPulse}
          stats={[
            { value: String(c?.activeUsers ?? "—"), label: "Active" },
            { value: String(c?.pendingApprovals ?? "—"), label: "Pending" },
            { value: String(errorCount), label: "Errors" },
          ]}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xl,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        {isError ? <AdminError message="Couldn't load system health." /> : null}
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : c ? (
          <>
            <View>
              <AdminSection title="Platform" />
              <StatGrid>
                <AdminStat
                  icon={Users}
                  label="Total users"
                  value={c.totalUsers}
                  tone="primary"
                />
                <AdminStat
                  icon={UserCheck}
                  label="Active users"
                  value={c.activeUsers}
                  tone="success"
                />
                <AdminStat
                  icon={Stethoscope}
                  label="Doctors"
                  value={c.totalDoctors}
                  tone="info"
                />
                <AdminStat
                  icon={FileText}
                  label="Prescriptions"
                  value={c.totalRecords}
                  tone="neutral"
                />
                <AdminStat
                  icon={UserPlus}
                  label="Pending approvals"
                  value={c.pendingApprovals}
                  tone={c.pendingApprovals > 0 ? "warning" : "success"}
                />
                <AdminStat
                  icon={ShieldQuestion}
                  label="Open DSAR"
                  value={c.pendingDsar}
                  tone={c.pendingDsar > 0 ? "warning" : "success"}
                />
                <AdminStat
                  icon={Bell}
                  label="Unread notifs"
                  value={c.unreadNotifications}
                  tone="accent2"
                />
                <AdminStat
                  icon={Database}
                  label="DB storage"
                  value={fmtBytes(storage?.d1Bytes)}
                  tone="primary"
                />
              </StatGrid>
            </View>

            <View>
              <AdminSection
                title="Cron history"
                count={cronRuns?.items?.length ?? 0}
              />
              <FilterChips
                options={CRONS}
                value={cron}
                onChange={setCron}
                size="sm"
                flush
              />
              <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                {cronLoading ? (
                  <ListSkeleton rows={2} />
                ) : (cronRuns?.items ?? []).length === 0 ? (
                  <AdminCard>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textSubtle, textAlign: "center" },
                      ]}
                    >
                      No runs recorded for {cron}
                    </Text>
                  </AdminCard>
                ) : (
                  (cronRuns?.items ?? []).map((r: any) => (
                    <AdminCard key={r.id} style={{ padding: spacing.md + 2 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: spacing.md,
                        }}
                      >
                        <IconTile icon={Timer} tone="primary" size={34} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[
                              typography.body.sm,
                              { color: colors.text, fontWeight: "600" },
                            ]}
                            numberOfLines={2}
                          >
                            {r.action?.replace(/_/g, " ")}
                          </Text>
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSubtle, marginTop: 2 },
                            ]}
                          >
                            {r.createdAt
                              ? fmtDateTime(r.createdAt, locale as any)
                              : ""}
                            {r.resource ? ` · ${r.resource}` : ""}
                          </Text>
                        </View>
                      </View>
                    </AdminCard>
                  ))
                )}
              </View>
            </View>

            <View>
              <AdminSection title="Recent errors" count={errorCount} />
              {errorCount === 0 ? (
                <AdminCard tone="success">
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <Pill label="Healthy" tone="success" size="sm" />
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, flex: 1 },
                      ]}
                    >
                      No error events recorded
                    </Text>
                  </View>
                </AdminCard>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {(errors?.items ?? []).map((e: any) => (
                    <AdminCard key={e.id} style={{ padding: spacing.md + 2 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: spacing.md,
                        }}
                      >
                        <IconTile icon={AlertTriangle} tone="danger" size={34} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[
                              typography.body.sm,
                              { color: colors.text, fontWeight: "600" },
                            ]}
                            numberOfLines={2}
                          >
                            {e.action?.replace(/_/g, " ")}
                          </Text>
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSubtle, marginTop: 2 },
                            ]}
                          >
                            {e.createdAt
                              ? fmtDateTime(e.createdAt, locale as any)
                              : ""}
                            {e.resource ? ` · ${e.resource}` : ""}
                          </Text>
                        </View>
                      </View>
                    </AdminCard>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

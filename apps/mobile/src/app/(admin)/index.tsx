import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  UserCheck,
  Stethoscope,
  ShieldAlert,
  Wallet,
  FileLock2,
  CalendarClock,
  BadgeCheck,
  Activity,
  Megaphone,
  ClipboardList,
  ChevronRight,
  Users as UsersIcon,
  HeartPulse,
} from "lucide-react-native";
import {
  Screen,
  ListItem,
  Pressable,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/stores/auth";
import { useAdminDashboard, useAdminVerifications } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminSection,
  AdminStat,
  StatGrid,
  AdminCard,
  IconTile,
  CountBadge,
  RowDivider,
  ListSkeleton,
  AdminError,
} from "@/components/admin/ui";
import type { LucideIcon } from "lucide-react-native";

export default function AdminDashboard() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminDashboard();
  const { data: verifs } = useAdminVerifications("pending");
  const pendingVerifs = verifs?.verifications?.length ?? 0;

  const totals = useMemo(() => {
    const rows = data?.users.byRoleAndStatus ?? [];
    let total = 0;
    let active = 0;
    for (const r of rows) {
      total += Number(r.count) || 0;
      if (r.status === "active" || !r.status) active += Number(r.count) || 0;
    }
    return { total, active };
  }, [data]);

  const attention: {
    icon: LucideIcon;
    label: string;
    count: number;
    route: string;
    tone:
      | "primary"
      | "accent"
      | "accent2"
      | "warning"
      | "danger"
      | "info"
      | "success"
      | "neutral";
  }[] = [
    {
      icon: UserCheck,
      label: "Pending account approvals",
      count: data?.users.pendingApprovals ?? 0,
      route: "/(admin)/approvals",
      tone: "warning",
    },
    {
      icon: Stethoscope,
      label: "Doctors awaiting SLMC verification",
      count: data?.doctors.slmcUnverified ?? 0,
      route: "/(admin)/doctors",
      tone: "primary",
    },
    {
      icon: BadgeCheck,
      label: "Caretaker verifications",
      count: pendingVerifs,
      route: "/(admin)/verifications",
      tone: "accent",
    },
    {
      icon: ShieldAlert,
      label: "Open insurance claims",
      count: data?.operations.openInsuranceClaims ?? 0,
      route: "/(admin)/claims",
      tone: "info",
    },
    {
      icon: Wallet,
      label: "Pending doctor payouts",
      count: data?.operations.pendingPayouts ?? 0,
      route: "/(admin)/payouts",
      tone: "success",
    },
    {
      icon: FileLock2,
      label: "Open data (DSAR) requests",
      count: data?.operations.openDsarRequests ?? 0,
      route: "/(admin)/dsar",
      tone: "danger",
    },
    {
      icon: ClipboardList,
      label: "New demo requests",
      count: data?.operations.newDemoRequests ?? 0,
      route: "/(admin)/demo-requests",
      tone: "accent2",
    },
  ];

  const attentionTotal = attention.reduce((s, i) => s + i.count, 0);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Screen
      scroll
      padded={false}
      tabBarOffset
      refreshing={isRefetching}
      onRefresh={refetch}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          eyebrow={`Admin console · ${today}`}
          title={`Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
          subtitle={
            attentionTotal > 0
              ? `${attentionTotal} items need your attention`
              : "All queues are clear"
          }
          right={
            <Pressable
              onPress={() => router.push("/(admin)/system-health" as any)}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="System health"
              hitSlop={8}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
              }}
            >
              <HeartPulse size={20} color="#FFFFFF" strokeWidth={2.25} />
            </Pressable>
          }
          stats={[
            {
              icon: UsersIcon,
              value: String(totals.total),
              label: "Users",
            },
            {
              icon: UserCheck,
              value: String(attentionTotal),
              label: "To review",
            },
            {
              icon: CalendarClock,
              value: String(data?.today.appointments ?? 0),
              label: "Appts today",
            },
          ]}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xl,
          marginTop: spacing.xl,
        }}
      >
        {isError ? (
          <AdminError message="Couldn't load the dashboard. Pull to refresh." />
        ) : null}

        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : (
          <>
            {/* ─── Needs attention ─── */}
            <View>
              <AdminSection title="Needs attention" count={attentionTotal} />
              <AdminCard style={{ padding: 0 }}>
                {attention.map((item, i) => (
                  <React.Fragment key={item.label}>
                    {i > 0 ? <RowDivider inset={spacing.lg + 40 + spacing.md} /> : null}
                    <AttentionRow
                      icon={item.icon}
                      tone={item.tone}
                      label={item.label}
                      count={item.count}
                      onPress={() => router.push(item.route as any)}
                    />
                  </React.Fragment>
                ))}
              </AdminCard>
            </View>

            {/* ─── Platform metrics ─── */}
            <View>
              <AdminSection title="Platform" />
              <StatGrid>
                <AdminStat
                  icon={UsersIcon}
                  label="Total users"
                  value={totals.total}
                  hint={`${totals.active} active`}
                  tone="primary"
                  onPress={() => router.push("/(admin)/users" as any)}
                />
                <AdminStat
                  icon={Stethoscope}
                  label="Verified doctors"
                  value={data?.doctors.slmcVerified ?? 0}
                  hint={`${data?.doctors.slmcUnverified ?? 0} unverified`}
                  tone="accent"
                  onPress={() => router.push("/(admin)/doctors" as any)}
                />
                <AdminStat
                  icon={CalendarClock}
                  label="Appointments today"
                  value={data?.today.appointments ?? 0}
                  tone="info"
                />
                <AdminStat
                  icon={Activity}
                  label="Audit events today"
                  value={data?.today.auditEvents ?? 0}
                  tone="neutral"
                  onPress={() => router.push("/(admin)/audit" as any)}
                />
              </StatGrid>
            </View>

            {/* ─── Growth ─── */}
            <View>
              <AdminSection title="Engagement" />
              <StatGrid>
                <AdminStat
                  icon={ClipboardList}
                  label="Waitlist signups"
                  value={data?.marketing.waitlistTotal ?? 0}
                  tone="accent2"
                  onPress={() => router.push("/(admin)/waitlist" as any)}
                />
                <AdminStat
                  icon={Megaphone}
                  label="Broadcasts sent"
                  value={data?.marketing.broadcastsSent ?? 0}
                  hint={`${data?.marketing.broadcastsLast7d ?? 0} this week`}
                  tone="warning"
                  onPress={() => router.push("/(admin)/broadcast" as any)}
                />
              </StatGrid>
            </View>

            {/* ─── Quick actions ─── */}
            <View>
              <AdminSection title="Quick actions" />
              <AdminCard style={{ padding: 0 }}>
                <ListItem
                  icon={Megaphone}
                  iconTone="warning"
                  title="Send broadcast"
                  subtitle="Push a notification to a role or everyone"
                  onPress={() => router.push("/(admin)/broadcast" as any)}
                  showChevron
                  bordered={false}
                />
                <RowDivider inset={spacing.lg + 44 + spacing.md} />
                <ListItem
                  icon={ClipboardList}
                  iconTone="info"
                  title="Audit log"
                  subtitle="Every admin & system action"
                  onPress={() => router.push("/(admin)/audit" as any)}
                  showChevron
                  bordered={false}
                />
                <RowDivider inset={spacing.lg + 44 + spacing.md} />
                <ListItem
                  icon={UsersIcon}
                  iconTone="primary"
                  title="Manage admins"
                  subtitle="Promote, demote or suspend super admins"
                  onPress={() => router.push("/(admin)/admins" as any)}
                  showChevron
                  bordered={false}
                />
              </AdminCard>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function AttentionRow({
  icon,
  tone,
  label,
  count,
  onPress,
}: {
  icon: LucideIcon;
  tone:
    | "primary"
    | "accent"
    | "accent2"
    | "warning"
    | "danger"
    | "info"
    | "success"
    | "neutral";
  label: string;
  count: number;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const hot = count > 0;
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${count}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        opacity: hot ? 1 : 0.55,
      }}
    >
      <IconTile icon={icon} tone={hot ? tone : "neutral"} size={40} />
      <Text
        style={[
          typography.body.sm,
          { color: colors.text, flex: 1, fontWeight: "600" },
        ]}
      >
        {label}
      </Text>
      <CountBadge count={count} />
      <ChevronRight size={16} color={colors.textSubtle} />
    </Pressable>
  );
}

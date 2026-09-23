import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  Inbox,
  UserCheck,
  Stethoscope,
  BadgeCheck,
  ShieldAlert,
  Wallet,
  FileLock2,
  ClipboardList,
  ChevronRight,
  type LucideIcon,
} from "lucide-react-native";
import { Screen, EmptyState, Pill } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import type { Tone } from "@/theme/tone";
import {
  useAdminDashboard,
  useAdminVerifications,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  IconTile,
  CountBadge,
  AdminSection,
  ListSkeleton,
  AdminError,
} from "@/components/admin/ui";

type QueueItem = {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  count: number;
  route: string;
};

export default function AdminInboxScreen() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminDashboard();
  const { data: verifs } = useAdminVerifications("pending");
  const pendingVerifs = verifs?.verifications?.length ?? 0;

  const items: QueueItem[] = [
    {
      icon: UserCheck,
      tone: "warning",
      title: "Account approvals",
      count: data?.users.pendingApprovals ?? 0,
      route: "/(admin)/approvals",
    },
    {
      icon: Stethoscope,
      tone: "primary",
      title: "SLMC verifications",
      count: data?.doctors.slmcUnverified ?? 0,
      route: "/(admin)/doctors",
    },
    {
      icon: BadgeCheck,
      tone: "accent",
      title: "Caretaker verifications",
      count: pendingVerifs,
      route: "/(admin)/verifications",
    },
    {
      icon: ShieldAlert,
      tone: "info",
      title: "Insurance claims",
      count: data?.operations.openInsuranceClaims ?? 0,
      route: "/(admin)/claims",
    },
    {
      icon: Wallet,
      tone: "success",
      title: "Pending payouts",
      count: data?.operations.pendingPayouts ?? 0,
      route: "/(admin)/payouts",
    },
    {
      icon: FileLock2,
      tone: "danger",
      title: "Privacy (DSAR) requests",
      count: data?.operations.openDsarRequests ?? 0,
      route: "/(admin)/dsar",
    },
    {
      icon: ClipboardList,
      tone: "accent2",
      title: "New demo requests",
      count: data?.operations.newDemoRequests ?? 0,
      route: "/(admin)/demo-requests",
    },
  ];

  const total = items.reduce((s, i) => s + i.count, 0);
  const open = items.filter((i) => i.count > 0).length;

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
          eyebrow="Operations"
          title="Inbox"
          subtitle={
            total > 0
              ? `${total} items need attention`
              : "All queues are clear"
          }
          icon={Inbox}
          stats={[
            { value: String(total), label: "Open" },
            { value: String(open), label: "Queues" },
            { value: String(items.length), label: "Total" },
          ]}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        <AdminSection title="Queues" count={open} />
        <View style={{ gap: spacing.sm }}>
          {isError ? <AdminError message="Couldn't load the inbox." /> : null}
          {isLoading ? (
            <ListSkeleton rows={7} />
          ) : total === 0 ? (
            <EmptyState
              icon={Inbox}
              title="All caught up"
              message="Nothing needs your attention right now."
            />
          ) : (
            items.map((item) => (
              <QueueRow
                key={item.route}
                item={item}
                onPress={() => router.push(item.route as any)}
              />
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

function QueueRow({ item, onPress }: { item: QueueItem; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const hot = item.count > 0;
  return (
    <AdminCard onPress={onPress} style={{ opacity: hot ? 1 : 0.55 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <IconTile
          icon={item.icon}
          tone={hot ? item.tone : "neutral"}
          size={42}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.title.sm, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {hot ? `${item.count} waiting` : "Nothing pending"}
          </Text>
        </View>
        {hot ? (
          <CountBadge count={item.count} />
        ) : (
          <Pill label="clear" tone="success" size="sm" />
        )}
        <ChevronRight size={16} color={colors.textSubtle} />
      </View>
    </AdminCard>
  );
}

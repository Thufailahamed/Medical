import React from "react";
import { View, Text, StyleSheet } from "react-native";
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
  ArrowRight,
  Check,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react-native";
import { Screen, Pressable } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  useAdminDashboard,
  useAdminVerifications,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  IconTile,
  RowDivider,
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
  const hot = items.filter((i) => i.count > 0).sort((a, b) => b.count - a.count);
  const clear = items.filter((i) => i.count === 0);
  const unavailable = isError && !data;

  const subtitle = unavailable
    ? "Live data unavailable right now"
    : isLoading
    ? "Checking your queues…"
    : total > 0
    ? `${total} item${total === 1 ? "" : "s"} need${total === 1 ? "s" : ""} attention`
    : "All queues are clear";

  return (
    <Screen
      scroll
      padded={false}
      refreshing={isRefetching}
      onRefresh={refetch}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero compact back eyebrow="Operations" title="Inbox" subtitle={subtitle}>
          {!unavailable && !isLoading ? (
            <QueueMeter clearCount={clear.length} totalQueues={items.length} />
          ) : null}
        </AdminHero>
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
          gap: spacing.xl,
        }}
      >
        {isError ? (
          <AdminError
            title="Couldn't load the inbox"
            message="Check your connection, then retry or pull to refresh."
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : null}

        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : unavailable ? null : (
          <>
            {/* ─── Needs action ─── */}
            <View>
              <SectionLabel text="Needs action" />
              {hot.length > 0 ? (
                <View style={{ gap: spacing.md }}>
                  {hot.map((item) => (
                    <HotQueueCard
                      key={item.route}
                      item={item}
                      onPress={() => router.push(item.route as any)}
                    />
                  ))}
                </View>
              ) : (
                <AdminCard tone="success" style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.surface,
                    }}
                  >
                    <CheckCircle2 size={22} color={colors.success} strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.title.sm, { color: colors.text }]}>You're all caught up</Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      Nothing needs your attention right now.
                    </Text>
                  </View>
                </AdminCard>
              )}
            </View>

            {/* ─── Clear queues ─── */}
            {clear.length > 0 ? (
              <View>
                <SectionLabel text={`Clear · ${clear.length}`} />
                <AdminCard style={{ padding: 0 }}>
                  {clear.map((item, i) => (
                    <React.Fragment key={item.route}>
                      {i > 0 ? <RowDivider inset={spacing.lg + 36 + spacing.md} /> : null}
                      <ClearRow item={item} onPress={() => router.push(item.route as any)} />
                    </React.Fragment>
                  ))}
                </AdminCard>
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Text
      style={[
        typography.overline,
        { color: colors.textSubtle, marginBottom: spacing.sm, marginLeft: 4 },
      ]}
    >
      {text.toUpperCase()}
    </Text>
  );
}

/** Segmented progress bar on the hero: one segment per queue, lit when clear. */
function QueueMeter({ clearCount, totalQueues }: { clearCount: number; totalQueues: number }) {
  const { spacing, typography } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {Array.from({ length: totalQueues }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: i < clearCount ? "#6EE7B7" : "rgba(255,255,255,0.22)",
            }}
          />
        ))}
      </View>
      <Text style={[typography.label.sm, { color: "rgba(255,255,255,0.8)", marginTop: spacing.sm }]}>
        {clearCount} of {totalQueues} queues clear
      </Text>
    </View>
  );
}

function HotQueueCard({ item, onPress }: { item: QueueItem; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const { fg } = useTone(item.tone);
  return (
    <AdminCard onPress={onPress} style={{ padding: spacing.md + 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconTile icon={item.icon} tone={item.tone} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]} numberOfLines={1}>
            {item.count} waiting for review
          </Text>
        </View>
        <Text
          style={[
            typography.display.sm,
            { color: fg, fontVariant: ["tabular-nums"] },
          ]}
        >
          {item.count > 99 ? "99+" : item.count}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: spacing.md,
          paddingTop: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <Text style={[typography.label.md, { color: colors.primary }]}>Open queue</Text>
        <ArrowRight size={16} color={colors.primary} strokeWidth={2.4} />
      </View>
    </AdminCard>
  );
}

function ClearRow({ item, onPress }: { item: QueueItem; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, nothing pending`}
      style={({ pressed }: { pressed: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        minHeight: 56,
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <IconTile icon={item.icon} tone={item.tone} size={36} />
      <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Check size={16} color={colors.success} strokeWidth={2.6} />
      <ChevronRight size={16} color={colors.textSubtle} />
    </Pressable>
  );
}

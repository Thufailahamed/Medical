// @ts-nocheck

import { useState, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell,
  Pill as PillIcon,
  CalendarDays,
  FlaskConical,
  FileText,
  Siren,
  CheckCheck,
  ChevronRight,
  Sparkles,
  Inbox,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllRead,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  Pressable,
  Button,
} from "@/components/ui";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";

const TYPE_META: Record<
  string,
  { icon: LucideIcon; tone: Tone; label: string }
> = {
  medicine: { icon: PillIcon, tone: "accent2", label: "Medication" },
  appointment: { icon: CalendarDays, tone: "primary", label: "Appointment" },
  lab_ready: { icon: FlaskConical, tone: "warning", label: "Lab Report" },
  prescription: { icon: FileText, tone: "accent", label: "Prescription" },
  emergency: { icon: Siren, tone: "danger", label: "Emergency" },
  general: { icon: Bell, tone: "neutral", label: "Update" },
};

function timeAgo(t: (key: string, opts?: any) => string, locale: string, ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("notifications.timeAgo.justNow", "Just now");
  if (m < 60) return t("notifications.timeAgo.minutesAgo", { count: m, defaultValue: `${m}m ago` });
  const h = Math.floor(m / 60);
  if (h < 24) return t("notifications.timeAgo.hoursAgo", { count: h, defaultValue: `${h}h ago` });
  const days = Math.floor(h / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return t("notifications.timeAgo.daysAgo", { count: days, defaultValue: `${days}d ago` });
  return fmtDate(d, locale as any);
}

function groupByTime(ts?: string | null) {
  if (!ts) return "older";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "older";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const itemTime = d.getTime();
  if (itemTime >= startOfToday) return "today";
  if (itemTime >= startOfToday - 86400000) return "yesterday";
  if (itemTime >= startOfToday - 86400000 * 7) return "week";
  return "older";
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography, radius } = useTheme();
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const all: any[] = data?.notifications || [];
  const unreadCount = all.filter((n) => !n.read).length;
  const filtered = filter === "unread" ? all.filter((n) => !n.read) : all;

  async function handleMarkAll() {
    try {
      await markAll.mutateAsync();
    } catch {
      // Handled by query invalidation
    }
  }

  function handleNotificationPress(item: any) {
    if (!item.read) {
      markRead.mutate(item.id);
    }

    let payload: any = {};
    if (typeof item.data === "string") {
      try {
        payload = JSON.parse(item.data);
      } catch {
        payload = {};
      }
    } else if (typeof item.data === "object" && item.data !== null) {
      payload = item.data;
    }

    const apptId = payload.appointmentId || payload.id;
    const prescId = payload.prescriptionId || payload.recordId;
    const recordId = payload.recordId;

    if (item.type === "appointment" && apptId) {
      router.push({
        pathname: "/(app)/appointment-detail",
        params: { id: String(apptId) },
      } as any);
      return;
    }

    if (item.type === "prescription" && prescId) {
      router.push({
        pathname: "/(app)/record-detail",
        params: { id: String(prescId) },
      } as any);
      return;
    }

    if (item.type === "medicine") {
      router.push("/(app)/medicines" as any);
      return;
    }

    if (item.type === "lab_ready") {
      if (recordId) {
        router.push({
          pathname: "/(app)/record-detail",
          params: { id: String(recordId) },
        } as any);
      } else {
        router.push("/(app)/records" as any);
      }
      return;
    }

    if (item.type === "emergency") {
      router.push("/(app)/emergency" as any);
      return;
    }
  }

  const groups = useMemo(() => {
    const map: Record<string, any[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };
    for (const item of filtered) {
      const key = groupByTime(item.createdAt);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return [
      { key: "today", label: t("notifications.group.today", "Today"), items: map.today },
      { key: "yesterday", label: t("notifications.group.yesterday", "Yesterday"), items: map.yesterday },
      { key: "week", label: t("notifications.group.week", "Earlier this week"), items: map.week },
      { key: "older", label: t("notifications.group.older", "Earlier"), items: map.older },
    ].filter((g) => g.items.length > 0);
  }, [filtered, t]);

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScreenHeader
        back
        title={t("notifications.title", "Notifications")}
        subtitle={
          unreadCount > 0
            ? t("notifications.subtitle", { count: unreadCount })
            : undefined
        }
        right={
          unreadCount > 0 ? (
            <Pressable
              onPress={handleMarkAll}
              disabled={markAll.isPending}
              accessibilityRole="button"
              accessibilityLabel={t("notifications.markAll.accessibilityLabel", "Mark all as read")}
              haptic="light"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: spacing.sm + 4,
                paddingVertical: spacing.xs + 2,
                borderRadius: 999,
                backgroundColor: colors.primarySoft,
                opacity: markAll.isPending ? 0.5 : 1,
              }}
            >
              <CheckCheck size={14} color={colors.primary} strokeWidth={2.5} />
              <Text
                style={[
                  typography.caption,
                  { color: colors.primary, fontWeight: "700" },
                ]}
              >
                {t("notifications.markAll.label", "Mark all")}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Segmented Filter Control */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xs,
            paddingBottom: spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              padding: 3,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => setFilter("all")}
              haptic="light"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: filter === "all" ? colors.surface : "transparent",
                shadowColor: "#000",
                shadowOpacity: filter === "all" ? 0.08 : 0,
                shadowRadius: 3,
                elevation: filter === "all" ? 1 : 0,
              }}
            >
              <Text
                style={[
                  typography.label.md,
                  {
                    color: filter === "all" ? colors.text : colors.textMuted,
                    fontWeight: filter === "all" ? "700" : "500",
                  },
                ]}
              >
                {t("notifications.filter.all", "All")}
              </Text>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 999,
                  backgroundColor: filter === "all" ? colors.primarySoft : colors.border,
                }}
              >
                <Text
                  style={[
                    typography.caption,
                    {
                      color: filter === "all" ? colors.primary : colors.textMuted,
                      fontWeight: "700",
                      fontSize: 10.5,
                    },
                  ]}
                >
                  {all.length}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setFilter("unread")}
              haptic="light"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: filter === "unread" ? colors.surface : "transparent",
                shadowColor: "#000",
                shadowOpacity: filter === "unread" ? 0.08 : 0,
                shadowRadius: 3,
                elevation: filter === "unread" ? 1 : 0,
              }}
            >
              <Text
                style={[
                  typography.label.md,
                  {
                    color: filter === "unread" ? colors.text : colors.textMuted,
                    fontWeight: filter === "unread" ? "700" : "500",
                  },
                ]}
              >
                {t("notifications.filter.unread", "Unread")}
              </Text>
              {unreadCount > 0 ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: "#FFFFFF", fontWeight: "800", fontSize: 10.5 },
                    ]}
                  >
                    {unreadCount}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 999,
                    backgroundColor: colors.border,
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, fontWeight: "700", fontSize: 10.5 },
                    ]}
                  >
                    0
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={84} radius={18} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load notifications")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : filtered.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
            <EmptyState
              icon={filter === "unread" ? Sparkles : Inbox}
              title={
                filter === "unread"
                  ? t("notifications.empty.unread.title", "All caught up")
                  : t("notifications.empty.all.title", "No notifications")
              }
              message={
                filter === "unread"
                  ? t("notifications.empty.unread.message", "You've read all your notifications")
                  : t("notifications.empty.all.message", "We'll let you know when something important happens")
              }
              actionLabel={filter === "unread" ? t("notifications.filter.all", "View all") : undefined}
              onAction={filter === "unread" ? () => setFilter("all") : undefined}
              tone="primary"
            />
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg }}>
            {groups.map((group) => (
              <View key={group.key} style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
                <SectionHeader label={group.label} count={group.items.length} />
                {group.items.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    locale={locale}
                    onPress={() => handleNotificationPress(item)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  const { spacing, typography, colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 4,
        paddingHorizontal: spacing.xs,
      }}
    >
      <Text
        style={[
          typography.overline,
          {
            color: colors.textMuted,
            letterSpacing: 1.1,
            fontWeight: "700",
          },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <View
        style={{
          paddingHorizontal: 7,
          paddingVertical: 1.5,
          borderRadius: 999,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, fontWeight: "700", fontSize: 11 },
          ]}
        >
          {count}
        </Text>
      </View>
    </View>
  );
}

function NotificationCard({
  item,
  onPress,
  locale,
}: {
  item: any;
  onPress: () => void;
  locale: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const meta = TYPE_META[item.type] || TYPE_META.general;
  const pal = useTone(meta.tone);
  const time = timeAgo(t, locale, item.createdAt);
  const Icon = meta.icon;

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      style={{
        borderRadius: radius.xl,
        overflow: "hidden",
        backgroundColor: colors.surface,
        borderWidth: item.read ? 1 : 1.5,
        borderColor: item.read ? colors.border : colors.primary,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: item.read ? 0.03 : 0.07,
        shadowRadius: item.read ? 4 : 8,
        elevation: item.read ? 1 : 3,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          padding: spacing.md + 2,
          gap: spacing.md,
        }}
      >
        {/* Left icon with active indicator */}
        <View style={{ position: "relative" }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pal.bg,
            }}
          >
            <Icon size={20} color={pal.fg} strokeWidth={2.2} />
          </View>
          {!item.read && (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 11,
                height: 11,
                borderRadius: 6,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.surface,
              }}
            />
          )}
        </View>

        {/* Center content */}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          {/* Metadata row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={[
                  typography.caption,
                  {
                    color: pal.fg,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    fontSize: 10.5,
                    letterSpacing: 0.5,
                  },
                ]}
              >
                {meta.label}
              </Text>
              {!item.read && (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 999,
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.primary, fontWeight: "700", fontSize: 10 },
                    ]}
                  >
                    NEW
                  </Text>
                </View>
              )}
            </View>

            {time ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, fontSize: 11.5 },
                ]}
              >
                {time}
              </Text>
            ) : null}
          </View>

          {/* Title */}
          <Text
            style={[
              typography.title.sm,
              {
                color: colors.text,
                fontWeight: item.read ? "600" : "800",
                marginTop: 1,
              },
            ]}
            numberOfLines={1}
          >
            {item.title || t("notifications.fallbackTitle", "Notification")}
          </Text>

          {/* Body */}
          {item.body ? (
            <Text
              style={[
                typography.body.sm,
                {
                  color: colors.textMuted,
                  lineHeight: 18,
                  marginTop: 1,
                },
              ]}
              numberOfLines={2}
            >
              {item.body}
            </Text>
          ) : null}
        </View>

        {/* Chevron */}
        <View style={{ alignSelf: "center", paddingLeft: spacing.xs }}>
          <ChevronRight size={16} color={colors.textSubtle} />
        </View>
      </View>
    </Pressable>
  );
}
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  Bell,
  Pill,
  CalendarDays,
  FlaskConical,
  FileText,
  Siren,
  CheckCheck,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllRead,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  ListItem,
  Timeline,
} from "@/components/ui";
import type { Tone } from "@/theme/tone";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";

const TYPE_META: Record<string, { icon: any; tone: Tone }> = {
  medicine: { icon: Pill, tone: "primary" },
  appointment: { icon: CalendarDays, tone: "info" },
  lab_ready: { icon: FlaskConical, tone: "warning" },
  prescription: { icon: FileText, tone: "accent" },
  emergency: { icon: Siren, tone: "danger" },
  general: { icon: Bell, tone: "primary" },
};

const FILTERS = [
  { value: "all", key: "notifications.filter.all" },
  { value: "unread", key: "notifications.filter.unread" },
];

function timeAgo(t: (key: string, opts?: any) => string, locale: string, ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("notifications.timeAgo.justNow");
  if (m < 60) return t("notifications.timeAgo.minutesAgo", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("notifications.timeAgo.hoursAgo", { count: h });
  const days = Math.floor(h / 24);
  if (days < 7) return t("notifications.timeAgo.daysAgo", { count: days });
  return fmtDate(d, locale as any);
}

function groupByTime(ts?: string | null) {
  if (!ts) return "older";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "older";
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 1) return "today";
  if (diff < 7) return "week";
  return "older";
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography } = useTheme();
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // API returns FLAT notification objects
  const all: any[] = data?.notifications || [];

  const filtered =
    filter === "unread" ? all.filter((n) => !n.read) : all;

  const unreadCount = all.filter((n) => !n.read).length;

  async function handleMarkAll() {
    try {
      await markAll.mutateAsync();
    } catch {
      // Already surfaces via query invalidation; nothing to do
    }
  }

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader
        back
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle", { count: unreadCount })}
        right={
          unreadCount > 0 ? (
            <Pressable
              onPress={handleMarkAll}
              disabled={markAll.isPending}
              accessibilityRole="button"
              accessibilityLabel={t("notifications.markAll.accessibilityLabel")}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: spacing.sm + 2,
                paddingVertical: spacing.xs + 1,
                borderRadius: 999,
                backgroundColor: pressed ? colors.primarySoft : "transparent",
                opacity: markAll.isPending ? 0.5 : 1,
              })}
            >
              <CheckCheck size={16} color={colors.primary} strokeWidth={2.5} />
              <Text
                style={[
                  typography.label.md,
                  { color: colors.primary, fontWeight: "700" },
                ]}
              >
                {t("notifications.markAll.label")}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: "row",
          gap: spacing.sm,
        }}
      >
        {FILTERS.map((f) => (
          <FilterPill
            key={f.value}
            label={t(f.key)}
            active={filter === f.value}
            onPress={() => setFilter(f.value as any)}
          />
        ))}
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={90} radius={20} />
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
        <EmptyState
          icon={Bell}
          title={
            filter === "unread"
              ? t("notifications.empty.unread.title")
              : t("notifications.empty.all.title")
          }
          message={
            filter === "unread"
              ? t("notifications.empty.unread.message")
              : t("notifications.empty.all.message")
          }
          tone="primary"
        />
      ) : (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Timeline
            data={filtered}
            groupBy={(n: any) => groupByTime(n.createdAt)}
            groupMeta={{
              today: { label: t("notifications.group.today"), tone: "primary" },
              week: { label: t("notifications.group.week"), tone: "info" },
              older: { label: t("notifications.group.older"), tone: "neutral" },
            }}
            keyExtractor={(n: any) => n.id}
            flush
            renderItem={(item: any) => {
              const meta = TYPE_META[item.type] || TYPE_META.general;
              const time = timeAgo(t, locale, item.createdAt);
              const subtitle = item.body
                ? t("notifications.itemSubtitle", { body: item.body, time })
                : time;
              const status = item.read
                ? t("notifications.status.read")
                : t("notifications.status.unread");
              return (
                <ListItem
                  icon={meta.icon}
                  iconTone={meta.tone}
                  variant="default"
                  title={item.title || t("notifications.fallbackTitle")}
                  subtitle={subtitle}
                  subtitleMaxLines={2}
                  trailing={
                    item.read ? null : (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: colors.primary,
                        }}
                      />
                    )
                  }
                  showChevron
                  onPress={() => !item.read && markRead.mutate(item.id)}
                  accessibilityLabel={t("notifications.accessibilityLabel", {
                    title: item.title,
                    status,
                  })}
                  style={
                    item.read
                      ? undefined
                      : { borderColor: colors.primary, borderWidth: 1.5 }
                  }
                />
              );
            }}
          />
        </View>
      )}
    </Screen>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text
        style={[
          typography.label.md,
          {
            color: active ? colors.onPrimary : colors.text,
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
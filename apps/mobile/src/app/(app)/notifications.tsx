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
  Skeleton,
  ListItem,
  Timeline,
} from "@/components/ui";
import type { Tone } from "@/theme/tone";

const TYPE_META: Record<string, { icon: any; tone: Tone }> = {
  medicine: { icon: Pill, tone: "primary" },
  appointment: { icon: CalendarDays, tone: "info" },
  lab_ready: { icon: FlaskConical, tone: "warning" },
  prescription: { icon: FileText, tone: "accent" },
  emergency: { icon: Siren, tone: "danger" },
  general: { icon: Bell, tone: "primary" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
];

function timeAgo(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
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
  const { spacing, colors, typography } = useTheme();
  const { data, isLoading } = useNotifications();
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
        title="Notifications"
        subtitle={`${unreadCount} unread`}
        right={
          unreadCount > 0 ? (
            <Pressable
              onPress={handleMarkAll}
              disabled={markAll.isPending}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
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
                Mark all
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
            label={f.label}
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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? "All caught up" : "No notifications"}
          message={
            filter === "unread"
              ? "You've read all your notifications"
              : "We'll let you know when something important happens"
          }
          tone="primary"
        />
      ) : (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Timeline
            data={filtered}
            groupBy={(n: any) => groupByTime(n.createdAt)}
            groupMeta={{
              today: { label: "Today", tone: "primary" },
              week: { label: "Earlier this week", tone: "info" },
              older: { label: "Older", tone: "neutral" },
            }}
            keyExtractor={(n: any) => n.id}
            flush
            renderItem={(item: any) => {
              const meta = TYPE_META[item.type] || TYPE_META.general;
              return (
                <ListItem
                  icon={meta.icon}
                  iconTone={meta.tone}
                  variant="default"
                  title={item.title || "Notification"}
                  subtitle={`${item.body ? item.body + " · " : ""}${timeAgo(item.createdAt)}`}
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
                  accessibilityLabel={`${item.title}, ${item.read ? "read" : "unread"}`}
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
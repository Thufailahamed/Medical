// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import {
  FileText,
  Activity,
  AlertTriangle,
  Pill,
  Calendar,
  StickyNote,
  History,
} from "lucide-react-native";
import {
  useUnifiedTimeline,
  type TimelineEvent,
  type TimelineEventKind,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Chip,
  ChipGroup,
  Timeline,
  EmptyState,
  Card,
} from "@/components/ui";

const FILTERS: { value: TimelineEventKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "record", label: "Records" },
  { value: "vital", label: "Vitals" },
  { value: "symptom", label: "Symptoms" },
  { value: "medicine_start", label: "Meds" },
  { value: "appointment", label: "Visits" },
  { value: "note", label: "Notes" },
];

const KIND_ICONS: Record<TimelineEventKind, any> = {
  record: FileText,
  vital: Activity,
  symptom: AlertTriangle,
  medicine_start: Pill,
  medicine_stop: Pill,
  appointment: Calendar,
  note: StickyNote,
};

function groupKey(dateIso: string | null): string {
  if (!dateIso) return "Unknown";
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return "Unknown";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  )
    return "Yesterday";
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 7) return "This week";
  if (days < 30) return "This month";
  if (days < 365)
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return d.getFullYear().toString();
}

export default function TimelineScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const [filter, setFilter] = useState<TimelineEventKind | "all">("all");

  const { data, isLoading, refetch, isFetching } = useUnifiedTimeline({
    type: filter,
  });

  const events: TimelineEvent[] = data?.events ?? [];
  const counts = data?.counts ?? {};

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title="Timeline"
        subtitle={
          events.length === 0
            ? "Your entire record, in one stream"
            : `${events.length} event${events.length === 1 ? "" : "s"}`
        }
        onBack={() => router.back()}
        right={<History size={20} color={colors.textMuted} />}
      />

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
        }}
      >
        <ChipGroup
          options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={filter}
          onChange={(v) => setFilter(v as any)}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={History}
            title="No events yet"
            message={
              filter === "all"
                ? "Add a record, vital, or medicine to start building your timeline."
                : `No ${filter.replace(/_/g, " ")} events found.`
            }
          />
        ) : (
          <Timeline
            data={events}
            groupBy={(e) => groupKey(e.date)}
            keyExtractor={(e) => e.id}
            renderItem={(e) => {
              const Icon = KIND_ICONS[e.kind] || FileText;
              const toneColor =
                e.color === "primary"
                  ? colors.primary
                  : e.color === "info"
                  ? colors.info
                  : e.color === "warning"
                  ? colors.warning
                  : e.color === "success"
                  ? colors.success
                  : e.color === "danger"
                  ? colors.danger
                  : colors.textMuted;

              return (
                <Card padded>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.md,
                      alignItems: "flex-start",
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: toneColor + "22",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={18} color={toneColor} strokeWidth={2.25} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          typography.label.sm,
                          {
                            color: toneColor,
                            textTransform: "uppercase",
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {e.label}
                      </Text>
                      <Text
                        style={[
                          typography.title.sm,
                          { color: colors.text, marginTop: 2 },
                        ]}
                        numberOfLines={2}
                      >
                        {e.title}
                      </Text>
                      {!!e.subtitle && (
                        <Text
                          style={[
                            typography.body.sm,
                            { color: colors.textMuted, marginTop: 2 },
                          ]}
                          numberOfLines={2}
                        >
                          {e.subtitle}
                        </Text>
                      )}
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textSubtle, marginTop: 4 },
                        ]}
                      >
                        {e.date ? new Date(e.date).toLocaleString() : "—"}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            }}
          />
        )}

        {filter === "all" && Object.keys(counts).length > 0 && (
          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={[typography.overline, { color: colors.textMuted }]}>
              SUMMARY
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
                marginTop: spacing.xs,
              }}
            >
              {Object.entries(counts).map(([k, n]) => (
                <Chip
                  key={k}
                  label={`${k.replace(/_/g, " ")} · ${n}`}
                  tone="neutral"
                  size="sm"
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
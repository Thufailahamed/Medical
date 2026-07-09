// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
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
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtMonthYear, fmtDateTime } from "@/lib/format";
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
  ErrorState,
  Skeleton,
  Card,
} from "@/components/ui";

const FILTERS: { value: TimelineEventKind | "all"; key: string }[] = [
  { value: "all", key: "timeline.filter.all" },
  { value: "record", key: "timeline.filter.record" },
  { value: "vital", key: "timeline.filter.vital" },
  { value: "symptom", key: "timeline.filter.symptom" },
  { value: "medicine_start", key: "timeline.filter.medicineStart" },
  { value: "appointment", key: "timeline.filter.appointment" },
  { value: "note", key: "timeline.filter.note" },
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

// Returns a stable i18n key for the group label rather than a raw string;
// the display label is resolved at render time via t(). Date formatting for
// older-than-30-days groups uses the active locale via fmtMonthYear.
function groupKey(dateIso: string | null, locale: ReturnType<typeof useLocaleStore.getState>["locale"]): string {
  if (!dateIso) return "unknown";
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return "unknown";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  )
    return "yesterday";
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 7) return "week";
  if (days < 30) return "month";
  if (days < 365) return fmtMonthYear(d, locale);
  return d.getFullYear().toString();
}

function filterLabel(t: (k: string) => string, value: string): string {
  const humanized = value.replace(/_/g, " ");
  const k = `timeline.filter.${value}`;
  return t(k, { defaultValue: humanized });
}

export default function TimelineScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const [filter, setFilter] = useState<TimelineEventKind | "all">("all");

  const { data, isLoading, isError, refetch, isFetching } = useUnifiedTimeline({
    type: filter,
  });

  const events: TimelineEvent[] = data?.events ?? [];
  const counts = data?.counts ?? {};

  const subtitle =
    events.length === 0
      ? t("timeline.subtitleEmpty")
      : t("timeline.subtitleCount", { count: events.length });

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("timeline.title")}
        subtitle={subtitle}
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
          options={FILTERS.map((f) => ({ value: f.value, label: t(f.key) }))}
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
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <Skeleton width={"100%"} height={88} radius={radius.lg} />
            <Skeleton width={"100%"} height={88} radius={radius.lg} />
            <Skeleton width={"100%"} height={88} radius={radius.lg} />
            <Skeleton width={"40%"} height={16} radius={radius.sm} />
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle")}
            message={t("recordDetail.errorBody")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={History}
            title={t("timeline.empty.title")}
            message={
              filter === "all"
                ? t("timeline.empty.allMessage")
                : t("timeline.empty.filteredMessage", {
                    filter: filterLabel(t, filter as string),
                  })
            }
          />
        ) : (
          <Timeline
            data={events}
            groupBy={(e) => groupKey(e.date, locale)}
            groupMeta={{
              today: { label: t("timeline.group.today"), tone: "primary" },
              yesterday: { label: t("timeline.group.yesterday"), tone: "info" },
              week: { label: t("timeline.group.week"), tone: "info" },
              month: { label: t("timeline.group.month"), tone: "neutral" },
              unknown: { label: t("timeline.group.unknown"), tone: "neutral" },
            }}
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
                        {e.date ? fmtDateTime(new Date(e.date), locale) : "—"}
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
              {t("timeline.summary.heading")}
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
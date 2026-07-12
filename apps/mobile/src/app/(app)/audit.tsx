// @ts-nocheck

// Patient-visible access log. Shows every PHI access against the
// caller's record in the recent past so the patient can spot anything
// unexpected. Same payload as the web `/audit/me` route — the server
// filters rows so only entries where the patient is the resource
// owner are returned.

import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { ScrollText } from "lucide-react-native";

import { api } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  Skeleton,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import { intlLocale } from "@/lib/format";

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorId: string | null;
  actorName?: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

type FilterKey = "all" | "records" | "prescriptions" | "appointments";

const FILTERS: FilterKey[] = ["all", "records", "prescriptions", "appointments"];

function fmtTime(d: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale as any), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(d));
  } catch {
    return d;
  }
}

// Day-bucket: "today" / "yesterday" / "this_week" / "earlier".
// Bucket key used as i18n suffix so all copy is translated.
function bucketOf(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const startOfDay = (t: number) => {
    const x = new Date(t);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const today = startOfDay(now);
  const that = startOfDay(d.getTime());
  const diffDays = Math.floor((today - that) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "this_week";
  return "earlier";
}

export default function AuditLogScreen() {
  const { t, i18n } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit", "me", filter],
    queryFn: () => api<{ entries: AuditEntry[] }>(`/audit/me?limit=200&filter=${filter}`),
  });

  const entries = data?.entries ?? [];

  const grouped = useMemo(() => {
    const order = ["today", "yesterday", "this_week", "earlier"];
    const buckets: Record<string, AuditEntry[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };
    for (const e of entries) {
      const k = bucketOf(e.createdAt);
      buckets[k].push(e);
    }
    return order
      .filter((k) => buckets[k].length > 0)
      .map((k) => ({ key: k, items: buckets[k] }));
  }, [entries]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        title={t("audit.title")}
        subtitle={t("audit.subtitle")}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
        }}
      >
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: 999,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  color: active ? colors.onPrimary : colors.text,
                  fontSize: 13,
                  fontWeight: active ? "600" : "500",
                }}
              >
                {t(`audit.filter.${f}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {error ? (
          <ErrorState
            title={t("audit.errorTitle")}
            message={t("audit.errorBody")}
            actionLabel={t("audit.retry")}
            onAction={() => refetch()}
          />
        ) : isLoading ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={56} radius={14} />
            <Skeleton height={56} radius={14} />
            <Skeleton height={56} radius={14} />
            <Skeleton height={56} radius={14} />
          </View>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t("audit.emptyTitle")}
            message={t("audit.emptyBody")}
          />
        ) : (
          <View style={{ gap: spacing.lg }}>
            {grouped.map((g) => (
              <View key={g.key} style={{ gap: spacing.sm }}>
                <Text
                  style={[
                    typography.title.sm,
                    { color: colors.textMuted, marginLeft: spacing.xs },
                  ]}
                >
                  {t(`audit.group.${g.key}`)}
                </Text>
                {g.items.map((e) => (
                  <Card key={e.id} padded>
                    <View style={{ gap: 6 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.xs,
                          flexWrap: "wrap",
                        }}
                      >
                        <PillCmp label={e.action} tone="accent" size="sm" />
                        <PillCmp label={e.resource} tone="neutral" size="sm" />
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: spacing.sm,
                        }}
                      >
                        <PillCmp
                          label={e.actorName || e.actorId || t("audit.actorSystem")}
                          tone="muted"
                          size="sm"
                        />
                        <PillCmp
                          label={fmtTime(e.createdAt, i18n.language)}
                          tone="muted"
                          size="sm"
                        />
                      </View>
                      {e.details ? (
                        <PillCmp label={e.details} tone="muted" size="sm" />
                      ) : null}
                    </View>
                  </Card>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
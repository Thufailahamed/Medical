// @ts-nocheck
// Lab booking queue with status filters.

import { useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ClipboardList, MapPin } from "lucide-react-native";
import { useLabBookings, type LabBookingFilter } from "@/hooks/useApi";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
  IconTile,
} from "@/components/ui";

const FILTERS: LabBookingFilter[] = [
  "pending", "confirmed", "phlebotomist_assigned", "sample_collection_en_route",
  "sample_collected", "in_progress", "completed", "cancelled", "all",
];

export default function LabBookingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);

  const [filter, setFilter] = useState<LabBookingFilter>("pending");
  const list = useLabBookings(filter === "all" ? undefined : filter);
  const rows = useMemo(() => list.data?.bookings ?? [], [list.data?.bookings]);

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("lab.bookingsTitle")}
        subtitle={t("lab.bookingsSubtitle")}
        kicker="LABORATORY"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={t(`lab.statuses.${f}`)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isFetching && !list.isLoading}
            onRefresh={() => list.refetch()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {list.isLoading ? (
          <Skeleton height={120} radius={20} />
        ) : list.isError ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t("lab.empty")} />
        ) : (
          rows.map((b: any, idx: number) => (
            <Card
              key={b.id ?? idx}
              style={{ padding: spacing.lg, gap: spacing.xs }}
              onPress={() => router.push(`/(lab)/booking-detail?id=${b.id}` as any)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconTile
                  icon={ClipboardList}
                  tone={b.status === "completed" ? "success" : b.status === "cancelled" ? "danger" : b.status === "pending" ? "warning" : "primary"}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
                    {b.patientName ?? b.itemName ?? b.id}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {b.itemName && b.patientName ? `${b.itemName} · ` : ""}
                    {b.scheduledDate ? fmtDate(new Date(b.scheduledDate), locale) : ""}
                    {b.scheduledTimeSlot ? ` · ${b.scheduledTimeSlot}` : ""}
                  </Text>
                </View>
                <Chip label={t(`lab.statuses.${b.status}`, { defaultValue: b.status })} />
              </View>
              {b.collectionAddress?.city ? (
                <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                  <MapPin size={12} /> {b.collectionAddress.city}
                  {b.collectionAddress?.district ? `, ${b.collectionAddress.district}` : ""}
                </Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

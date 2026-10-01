// @ts-nocheck
// Pharmacy dispense queue. Defaults to `signed` — what a pharmacist
// needs at login. Mirrors web `portal/(portal)/pharmacy`.

import { useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pill as PillIcon, CalendarDays, X } from "lucide-react-native";
import {
  usePharmacyPrescriptions,
  type PharmacyRxFilter,
} from "@/hooks/useApi";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
  IconTile,
} from "@/components/ui";

const FILTERS: PharmacyRxFilter[] = ["signed", "dispensed", "cancelled", "all"];

export default function PharmacyQueueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patient?: string }>();
  const patientFilter = params.patient ? String(params.patient) : null;
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);

  const [filter, setFilter] = useState<PharmacyRxFilter>("signed");
  const list = usePharmacyPrescriptions({ status: filter, patientId: patientFilter });
  const rows = useMemo(() => list.data?.prescriptions ?? [], [list.data?.prescriptions]);

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("pharmacy.queueTitle")}
        subtitle={t("pharmacy.queueSubtitle")}
        kicker="PHARMACY"
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={t(`pharmacy.filters.${f}`)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      {patientFilter ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <Card style={{ padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
              {t("pharmacy.patientFilter")}
            </Text>
            <Button
              title={t("pharmacy.clearFilter")}
              icon={X}
              size="sm"
              variant="secondary"
              onPress={() => router.setParams({ patient: undefined } as any)}
            />
          </Card>
        </View>
      ) : null}

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
          <EmptyState
            icon={PillIcon}
            title={t("pharmacy.empty")}
            message={t("pharmacy.emptyBody")}
          />
        ) : (
          rows.map((rx: any, idx: number) => (
            <Card
              key={rx.id ?? idx}
              style={{ padding: spacing.lg, gap: spacing.sm }}
              onPress={() => router.push(`/(pharmacist)/prescription-detail?id=${rx.id}` as any)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconTile
                  icon={PillIcon}
                  tone={rx.status === "signed" ? "warning" : rx.status === "dispensed" ? "success" : "neutral"}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
                    {rx.patient?.name ?? rx.diagnosis ?? rx.id}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {t("pharmacy.medicines")}: {rx.medicineCount ?? "?"}
                    {rx.createdAt ? ` · ${fmtDate(new Date(rx.createdAt), locale)}` : ""}
                  </Text>
                </View>
                <Chip label={t(`pharmacy.filters.${rx.status}`, { defaultValue: rx.status })} />
              </View>
              {rx.patient?.nic ? (
                <Text style={[typography.caption, { color: colors.textSubtle }]}>
                  NIC {rx.patient.nic}
                </Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

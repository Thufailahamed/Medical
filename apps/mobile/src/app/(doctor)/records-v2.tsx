// @ts-nocheck
// Doctor-side records-v2 view: lists patients whose care-team grants
// include a "records_recent" or "records_all" scope. Each row taps
// into the patient's unified record hub.

import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  Screen,
  ScreenHeader,
  Avatar,
  EmptyState,
  ErrorState,
  Skeleton,
  SearchField,
} from "@/components/ui";
import { useConsentsIssued } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { ShieldCheck, ChevronRight, FolderOpen, History, CalendarClock, Search } from "lucide-react-native";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_DAYS = 30;

type Filter = "all" | "full" | "recent" | "expiring";

/** Days until `iso` (negative when past); null when missing/invalid. */
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return null;
  return Math.ceil((ts - Date.now()) / DAY_MS);
}

function monthYear(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function DoctorRecordsV2() {
  const { t } = useTranslation();
  const router = useRouter();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.hairline;
  const { data, isLoading, isError, refetch, isRefetching } = useConsentsIssued();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo(
    () =>
      (data?.items ?? [])
        .filter(
          (c: any) =>
            c.scope?.defaultScope?.includes("records_all") ||
            c.scope?.defaultScope?.includes("records_recent") ||
            c.scope?.kinds?.includes?.("*")
        )
        .map((c: any) => {
          const days = daysUntil(c.expiresAt);
          return {
            ...c,
            displayName: c.patientName || c.label || `Patient ${String(c.patientId).slice(0, 8)}`,
            full: !!(c.scope?.defaultScope?.includes("records_all") || c.scope?.kinds?.includes?.("*")),
            days,
            expiring: days != null && days <= EXPIRING_DAYS,
          };
        })
        // Soonest-to-lapse first so the doctor sees what needs renewing.
        .sort((a: any, b: any) => (a.days ?? Infinity) - (b.days ?? Infinity)),
    [data]
  );

  const counts = useMemo(
    () => ({
      all: items.length,
      full: items.filter((c) => c.full).length,
      recent: items.filter((c) => !c.full).length,
      expiring: items.filter((c) => c.expiring).length,
    }),
    [items]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (filter === "full" && !c.full) return false;
      if (filter === "recent" && c.full) return false;
      if (filter === "expiring" && !c.expiring) return false;
      if (!q) return true;
      return (
        c.displayName.toLowerCase().includes(q) ||
        String(c.purpose || "").toLowerCase().includes(q)
      );
    });
  }, [items, filter, search]);

  const title = t("doctorPatientDetail.recordsTab", "Patient Records");

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]}>
        <ScreenHeader title={title} back />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={84} radius={radius.card} />
          <Skeleton height={260} radius={radius.card} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen padded>
        <ScreenHeader title={title} back />
        <ErrorState
          title={t("doctorPatientDetail.errorTitle", "Couldn't load records")}
          message={t("doctorPatientDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      <ScreenHeader
        title={title}
        subtitle={t("doctorPatientDetail.recordsSubtitle", "Patients who granted you record access")}
        back
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 140, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("doctorPatientDetail.empty", "No records shared yet")}
            message={t(
              "doctorPatientDetail.emptyBody",
              "When patients grant you access to their digital health records, they will appear here."
            )}
            tone="neutral"
          />
        ) : (
          <>
            {/* Access summary — doubles as the filter */}
            <View
              style={{
                flexDirection: "row",
                padding: 5,
                gap: 5,
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: hairline,
                ...(isDark ? {} : shadow.card),
              }}
            >
              <SummaryTile
                icon={FolderOpen}
                value={counts.full}
                label={t("doctorPatientDetail.accessFull", "Full access")}
                tone="success"
                active={filter === "full"}
                onPress={() => setFilter(filter === "full" ? "all" : "full")}
              />
              <SummaryTile
                icon={History}
                value={counts.recent}
                label={t("doctorPatientDetail.accessRecent", "Recent only")}
                tone="info"
                active={filter === "recent"}
                onPress={() => setFilter(filter === "recent" ? "all" : "recent")}
              />
              <SummaryTile
                icon={CalendarClock}
                value={counts.expiring}
                label={t("doctorPatientDetail.accessExpiring", "Expiring soon")}
                tone="warning"
                active={filter === "expiring"}
                onPress={() => setFilter(filter === "expiring" ? "all" : "expiring")}
              />
            </View>

            {items.length > 4 ? (
              <SearchField
                value={search}
                onChangeText={setSearch}
                placeholder={t("doctorPatientDetail.recordsSearch", "Search patient or purpose")}
              />
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 4,
                marginTop: 2,
              }}
            >
              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                {t("careTeam.resultCount", { count: visible.length, defaultValue: `${visible.length} patients` })}
              </Text>
              {filter !== "all" ? (
                <Pressable onPress={() => setFilter("all")} hitSlop={8}>
                  <Text style={[typography.label.sm, { color: colors.primary }]}>
                    {t("doctorPatientDetail.showAll", "Show all")}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {visible.length === 0 ? (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: spacing.xxl,
                  gap: spacing.sm,
                  borderRadius: radius.card,
                  backgroundColor: colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: hairline,
                }}
              >
                <Search size={22} color={colors.textSubtle} strokeWidth={2} />
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                  {t("doctorPatientDetail.noMatch", "No patients match this view")}
                </Text>
              </View>
            ) : (
              <View
                style={{
                  borderRadius: radius.card,
                  borderCurve: "continuous",
                  backgroundColor: colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: hairline,
                  overflow: "hidden",
                  ...(isDark ? {} : shadow.card),
                }}
              >
                {visible.map((c: any, idx: number) => (
                  <ConsentRow
                    key={c.id}
                    item={c}
                    first={idx === 0}
                    onPress={() =>
                      router.push({
                        pathname: "/patient-detail" as any,
                        params: { id: c.patientId },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function SummaryTile({
  icon: Icon,
  value,
  label,
  tone,
  active,
  onPress,
}: {
  icon: any;
  value: number;
  label: string;
  tone: "success" | "info" | "warning";
  active: boolean;
  onPress: () => void;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const fg = colors[tone];
  const bg = colors[`${tone}Soft`];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 10,
        gap: 6,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: active ? bg : pressed ? colors.fill : "transparent",
        borderWidth: 1,
        borderColor: active ? fg : "transparent",
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? colors.surface : bg,
        }}
      >
        <Icon size={14} color={fg} strokeWidth={2.4} />
      </View>
      <Text
        style={{
          fontFamily: fontFamily.heavy,
          fontSize: 22,
          lineHeight: 26,
          letterSpacing: -0.6,
          color: colors.text,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[typography.caption, { color: colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ConsentRow({ item: c, first, onPress }: { item: any; first: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();

  const expired = c.days != null && c.days < 0;
  const expiry = expired
    ? { label: t("doctorPatientDetail.expired", "Expired"), fg: colors.danger, bg: colors.dangerSoft }
    : c.expiring
      ? {
          label: t("doctorPatientDetail.expiresInDays", { count: Math.max(0, c.days), defaultValue: `${c.days} days left` }),
          fg: colors.warning,
          bg: colors.warningSoft,
        }
      : null;
  const until = monthYear(c.expiresAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.displayName}. ${c.full ? t("doctorPatientDetail.accessFull", "Full access") : t("doctorPatientDetail.accessRecent", "Recent only")}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingLeft: spacing.md,
        paddingRight: spacing.md,
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      {!first ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            left: spacing.md + 44 + spacing.md,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
          }}
        />
      ) : null}

      <Avatar
        name={c.displayName}
        size="md"
        tone="primary"
        source={c.patientPhoto ? { uri: c.patientPhoto } : undefined}
      />

      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text }]}>
          {c.displayName}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              height: 18,
              paddingHorizontal: 6,
              borderRadius: 6,
              backgroundColor: c.full ? colors.successSoft : colors.infoSoft,
            }}
          >
            {c.full ? (
              <FolderOpen size={10} color={colors.success} strokeWidth={2.6} />
            ) : (
              <History size={10} color={colors.info} strokeWidth={2.6} />
            )}
            <Text style={[typography.label.xs, { fontSize: 10, color: c.full ? colors.success : colors.info }]}>
              {c.full
                ? t("doctorPatientDetail.accessFull", "Full access")
                : t("doctorPatientDetail.accessRecent", "Recent only")}
            </Text>
          </View>
          {c.purpose ? (
            <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted, flexShrink: 1 }]}>
              {c.purpose}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {expiry ? (
          <View
            style={{
              height: 20,
              paddingHorizontal: 7,
              justifyContent: "center",
              borderRadius: 10,
              backgroundColor: expiry.bg,
            }}
          >
            <Text style={[typography.label.xs, { fontSize: 10.5, color: expiry.fg }]}>{expiry.label}</Text>
          </View>
        ) : until ? (
          <Text style={[typography.caption, { fontSize: 11, color: colors.textSubtle, fontVariant: ["tabular-nums"] }]}>
            {t("doctorPatientDetail.until", { date: until, defaultValue: `Until ${until}` })}
          </Text>
        ) : null}
        <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

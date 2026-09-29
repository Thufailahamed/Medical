// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { FileText, Download } from "lucide-react-native";
import { useDoctorPrescriptions, downloadPrescriptionPdf } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  IconTile,
  SearchField,
  useToast,
} from "@/components/ui";

export default function DoctorPrescriptionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useDoctorPrescriptions();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("");
  const [scope, setScope] = useState<"all" | "recent">("recent");
  const [query, setQuery] = useState("");

  const all = data?.prescriptions || [];

  // Phase 3.1 slice 2: per-row PDF download. Tapping the download icon
  // pulls the rendered PDF from the API and opens the OS share sheet so
  // the doctor can AirDrop, Save to Files, or hand it to another app.
  // We swallow the error and toast instead of throwing so a single bad
  // row doesn't break the list.
  async function handleDownload(id: string) {
    try {
      await downloadPrescriptionPdf(id);
    } catch (err: any) {
      const msg =
        err?.message && err.message !== "{}" && err.message !== "[object Object]"
          ? err.message
          : t("doctorPrescriptionDetail.error");
      toast.show(msg, "danger");
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = all;
    if (scope === "recent") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutIso = cutoff.toISOString().slice(0, 10);
      list = list.filter((r: any) => (r.date || "") >= cutIso);
    }
    const text = query.trim().toLowerCase();
    if (q || text) {
      list = list.filter((r: any) => {
        const hay = [
          r.title,
          r.diagnosis,
          r.summary,
          r.patient?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (!q || hay.includes(q)) && (!text || hay.includes(text));
      });
    }
    return list;
  }, [all, filter, scope, query]);

  async function onRefresh() {
    try {
      setRefreshing(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("doctorPrescriptions.title")}
        subtitle={t("doctorPrescriptions.subtitle", { count: all.length })}
        onBack={() => router.back()}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Search + quick filters */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t("doctorPrescriptions.searchPlaceholder", "Search patient or diagnosis")}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm + 2,
          }}
        >
          <FilterChip
            active={!filter && scope === "all"}
            label={t("doctorPrescriptions.filters.all")}
            onPress={() => {
              setFilter("");
              setScope("all");
            }}
          />
          <FilterChip
            active={scope === "recent"}
            label={t("doctorPrescriptions.filters.last90")}
            onPress={() => setScope(scope === "recent" ? "all" : "recent")}
          />
          <FilterChip
            active={filter === "diabetes"}
            label={t("doctorPrescriptions.filters.diabetes")}
            onPress={() => setFilter(filter === "diabetes" ? "" : "diabetes")}
          />
          <FilterChip
            active={filter === "hypertension"}
            label={t("doctorPrescriptions.filters.hypertension")}
            onPress={() => setFilter(filter === "hypertension" ? "" : "hypertension")}
          />
          <FilterChip
            active={filter === "antibiotic"}
            label={t("doctorPrescriptions.filters.antibiotic")}
            onPress={() => setFilter(filter === "antibiotic" ? "" : "antibiotic")}
          />
        </ScrollView>

        {isLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={92} radius={18} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load prescriptions")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            style={{ marginTop: spacing.xl }}
            icon={FileText}
            title={filter ? t("doctorPrescriptions.emptySearchTitle") : t("doctorPrescriptions.emptyTitle")}
            message={
              filter
                ? t("doctorPrescriptions.emptySearchBody")
                : t("doctorPrescriptions.emptyBody")
            }
          />
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
            <View
              style={{
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isDark ? colors.borderStrong : colors.hairline,
                paddingVertical: 4,
                ...(isDark ? {} : shadow.card),
              }}
            >
            {filtered.map((r: any, idx: number) => (
              <Pressable
                key={r.id}
                onPress={() =>
                  router.push({
                    pathname: "/(doctor)/prescription-detail",
                    params: { id: r.id },
                  } as any)
                }
                accessibilityRole="button"
                accessibilityLabel={t("doctorPrescriptions.itemA11y", {
                  name: r.patient?.name || t("doctorPrescriptions.unknownPatient"),
                  date: r.date,
                })}
                style={({ pressed }) => ({
                  marginHorizontal: 5,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  backgroundColor: pressed ? colors.fill : "transparent",
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingVertical: 14,
                    paddingHorizontal: spacing.md,
                  }}
                >
                  {idx < filtered.length - 1 ? (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: spacing.md,
                        left: spacing.md + 40 + spacing.md,
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: colors.separator,
                      }}
                    />
                  ) : null}
                  <IconTile icon={FileText} tone="primary" appearance="soft" size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[typography.title.sm, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {r.patient?.name || t("doctorPrescriptions.unknownPatient")}
                    </Text>
                    <Text
                      style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}
                      numberOfLines={1}
                    >
                      {r.diagnosis || r.title || t("doctorPrescriptions.fallbackTitle")}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 5,
                      }}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textSubtle, fontVariant: ["tabular-nums"] },
                        ]}
                      >
                        {[r.date, t("doctorPrescriptions.medCount", { count: r.medicineCount || 0 })]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </Text>
                      {r.followUpDate ? (
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                            borderRadius: 6,
                            backgroundColor: colors.warningSoft,
                          }}
                        >
                          <Text style={[typography.label.xs, { fontSize: 10, color: colors.warning }]}>
                            {t("doctorPrescriptions.fuPrefix")} {r.followUpDate}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => handleDownload(r.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("doctorPrescriptions.downloadA11y", {
                      name: r.patient?.name || t("doctorPrescriptions.unknownPatient"),
                    })}
                    style={({ pressed }) => ({
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: pressed ? colors.primarySoft : colors.well,
                    })}
                  >
                    <Download size={16} color={colors.primary} strokeWidth={2.3} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        height: 34,
        justifyContent: "center",
        borderRadius: 17,
        borderCurve: "continuous",
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: active ? 0 : StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.hairline,
        ...(active || isDark ? {} : shadow.xs),
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={[
          typography.label.md,
          { color: active ? colors.onPrimary : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

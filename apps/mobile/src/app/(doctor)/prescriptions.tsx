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
import {
  FileText,
  Search,
  Pill,
  ChevronRight,
  CalendarDays,
  Download,
} from "lucide-react-native";
import { useDoctorPrescriptions, downloadPrescriptionPdf } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  IconButton,
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
    if (q) {
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
        return hay.includes(q);
      });
    }
    return list;
  }, [all, filter, scope]);

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
        {/* Filter bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingLeft: spacing.md,
              paddingRight: 4,
              backgroundColor: colors.fill,
              borderRadius: 12,
              borderCurve: "continuous",
              minHeight: 44,
            }}
          >
            <Search size={16} color={colors.textSubtle} strokeWidth={2.2} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.xs,
              }}
            >
              <Pressable
                onPress={() => setFilter("")}
                style={{
                  paddingHorizontal: 12,
                  height: 30,
                  justifyContent: "center",
                  borderRadius: 999,
                  borderCurve: "continuous",
                  backgroundColor: !filter ? colors.surface : "transparent",
                  ...(!filter ? shadow.xs : shadow.none),
                }}
              >
                <Text
                  style={[
                    typography.label.sm,
                    { color: !filter ? colors.text : colors.textMuted },
                  ]}
                >
                  {t("doctorPrescriptions.filters.all")}
                </Text>
              </Pressable>
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
                onPress={() =>
                  setFilter(filter === "hypertension" ? "" : "hypertension")
                }
              />
              <FilterChip
                active={filter === "antibiotic"}
                label={t("doctorPrescriptions.filters.antibiotic")}
                onPress={() =>
                  setFilter(filter === "antibiotic" ? "" : "antibiotic")
                }
              />
            </ScrollView>
          </View>
        </View>

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
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              gap: spacing.sm,
            }}
          >
            {filtered.map((r: any) => (
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
                  backgroundColor: pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                  borderRadius: radius.xl,
                  borderCurve: "continuous",
                  padding: spacing.md,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: isDark ? colors.borderStrong : colors.separator,
                  ...(isDark ? {} : shadow.xs),
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 13,
                      borderCurve: "continuous",
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText
                      size={20}
                      color={colors.primary}
                      strokeWidth={2.25}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.title.md,
                        { color: colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {r.title || t("doctorPrescriptions.fallbackTitle")}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, marginTop: 2 },
                      ]}
                      numberOfLines={1}
                    >
                      {r.patient?.name || t("doctorPrescriptions.unknownPatient")}
                      {r.diagnosis ? ` · ${r.diagnosis}` : ""}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        marginTop: 6,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <CalendarDays
                          size={11}
                          color={colors.textSubtle}
                          strokeWidth={2.2}
                        />
                        <Text style={[typography.caption, { color: colors.textSubtle }]}>
                          {(r.date || "").toUpperCase()}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Pill
                          size={11}
                          color={colors.textSubtle}
                          strokeWidth={2.2}
                        />
                        <Text style={[typography.caption, { color: colors.textSubtle }]}>
                          {t("doctorPrescriptions.medCount", { count: r.medicineCount || 0 })}
                        </Text>
                      </View>
                      {r.followUpDate ? (
                        <Text
                          style={[
                            typography.label.xs,
                            {
                              color: colors.warning,
                              backgroundColor: colors.warningSoft,
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 6,
                              overflow: "hidden",
                            },
                          ]}
                        >
                          {t("doctorPrescriptions.fuPrefix")} {(r.followUpDate || "").toUpperCase()}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View pointerEvents="box-only">
                    <IconButton
                      icon={Download}
                      accessibilityLabel={t(
                        "doctorPrescriptions.downloadA11y",
                        {
                          name:
                            r.patient?.name ||
                            t("doctorPrescriptions.unknownPatient"),
                        }
                      )}
                      variant="ghost"
                      onPress={() => handleDownload(r.id)}
                      style={{
                        backgroundColor: colors.fill,
                      }}
                    />
                  </View>
                  <ChevronRight
                    size={18}
                    color={colors.textSubtle}
                    strokeWidth={2.2}
                  />
                </View>
              </Pressable>
            ))}
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
  const { colors, spacing, typography, shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        height: 30,
        justifyContent: "center",
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: active ? colors.surface : "transparent",
        ...(active ? shadow.xs : shadow.none),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={[
          typography.label.sm,
          { color: active ? colors.primary : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
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
  Skeleton,
  IconButton,
  useToast,
} from "@/components/ui";

export default function DoctorPrescriptionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data, isLoading, refetch } = useDoctorPrescriptions();
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
              paddingHorizontal: spacing.md,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
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
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: !filter ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: !filter ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: !filter ? colors.onPrimary : colors.text,
                  }}
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
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
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
                      width: 44,
                      height: 44,
                      borderRadius: 14,
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
                        typography.title.sm,
                        { color: colors.text, fontWeight: "700" },
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
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: colors.textSubtle,
                            letterSpacing: 0.3,
                          }}
                        >
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
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: colors.textSubtle,
                            letterSpacing: 0.3,
                          }}
                        >
                          {t("doctorPrescriptions.medCount", { count: r.medicineCount || 0 })}
                        </Text>
                      </View>
                      {r.followUpDate ? (
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: "#F59E0B",
                            letterSpacing: 0.3,
                          }}
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
                        backgroundColor: colors.primarySoft,
                        borderWidth: 1,
                        borderColor: colors.primary + "20",
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
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: active ? colors.onPrimary : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
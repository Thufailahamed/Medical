// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtMonthYear, fmtDateLong } from "@/lib/format";
import { Search, Archive, FileText, X, Check, Users } from "lucide-react-native";
import {
  useDoctorRecords,
  useBulkTagRecords,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  EmptyState,
  useToast,
} from "@/components/ui";
import { metaFor, type RecordType } from "@/lib/recordImportance";
import { searchRecords, flattenOCR } from "@/lib/recordSearch";
import { RecordsActionBar } from "@/components/RecordsActionBar";
import { TagPickerSheet } from "@/components/TagPickerSheet";

type FilterValue = "all" | RecordType | "archived";

type SortMode = "newest" | "oldest" | "relevance";

export default function DoctorRecordsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, fontFamily, radius } = useTheme();
  const toast = useToast();
  const bulkTag = useBulkTagRecords();
  const locale = useLocaleStore((s) => s.locale);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);

  const [selection, setSelection] = useState<Set<string>>(new Set());
  const selectionMode = selection.size > 0;

  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const FILTER_ORDER: { value: FilterValue; label: string }[] = useMemo(
    () => [
      { value: "all", label: t("doctorRecords.filters.all") },
      { value: "lab_report", label: t("doctorRecords.filters.lab_report") },
      { value: "prescription", label: t("doctorRecords.filters.prescription") },
      { value: "imaging", label: t("doctorRecords.filters.imaging") },
      { value: "hospital_visit", label: t("doctorRecords.filters.hospital_visit") },
      { value: "vaccination", label: t("doctorRecords.filters.vaccination") },
      { value: "surgery", label: t("doctorRecords.filters.surgery") },
      { value: "archived", label: t("doctorRecords.filters.archived") },
    ],
    [t]
  );

  const queryOpts = useMemo(
    () => ({
      limit: 200,
      query: search.trim() || undefined,
      type: filter !== "all" && filter !== "archived" ? filter : undefined,
      archived:
        showArchivedOnly || filter === "archived"
          ? ("only" as const)
          : undefined,
      sort: search.trim() && sort === "relevance"
        ? ("relevance" as const)
        : (sort as "newest" | "oldest"),
    }),
    [search, filter, sort, showArchivedOnly]
  );

  const {
    data: recordsData,
    isLoading,
    refetch,
    isRefetching,
  } = useDoctorRecords(queryOpts);

  const records: any[] = recordsData?.records ?? [];

  const ranked = useMemo(() => {
    if (!search.trim()) return records;
    return searchRecords(records, search, [
      "title",
      "diagnosis",
      "summary",
      "notes",
      "recordType",
      (r) => r.doctor?.name,
      (r) => r.hospital?.name,
      (r) => r.patient?.name,
      (r) => flattenOCR(r.extractedData),
    ]);
  }, [records, search]);

  const groupedSections = useMemo(() => {
    const sections: { title: string; data: any[] }[] = [];
    const map: Record<string, any[]> = {};
    for (const rec of ranked) {
      const patientLabel = rec.patient?.name || t("doctorRecords.unknownPatient");
      const monthKey = getMonthKey(locale, rec.date);
      const key = `${patientLabel} · ${monthKey}`;
      if (!map[key]) {
        map[key] = [];
        sections.push({ title: key, data: map[key] });
      }
      map[key].push(rec);
    }
    return sections;
  }, [ranked, t]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: records.length };
    for (const r of records as any[]) {
      base[r.recordType] = (base[r.recordType] || 0) + 1;
    }
    base.archived = records.filter((r: any) => r.archivedAt).length;
    return base;
  }, [records]);

  const tagSuggestions = useMemo(() => {
    const tally = new Map<string, number>();
    for (const r of records as any[]) {
      for (const tag of r.tags || []) {
        tally.set(tag, (tally.get(tag) || 0) + 1);
      }
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }, [records]);

  const allSelectedArchived = useMemo(() => {
    if (selection.size === 0) return false;
    return Array.from(selection).every((id) =>
      records.find((r) => r.id === id)?.archivedAt
    );
  }, [selection, records]);

  function toggleSelected(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelection(new Set());
  }

  function longPressRow(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    toggleSelected(id);
  }

  function applyTagBulk(nextTags: string[]) {
    const ids = Array.from(selection);
    bulkTag.mutate(
      { ids, add: nextTags },
      {
        onSuccess: (res: any) => {
          toast.show(
            res.denied?.length
              ? `Tagged ${res.updated}, ${res.denied.length} denied`
              : `Tagged ${res.updated}`,
            res.denied?.length ? "warning" : "success"
          );
          clearSelection();
        },
        onError: (err: any) =>
          toast.show(err?.message || "Tag failed", "danger"),
      }
    );
  }

  function onFilterChipPress(v: FilterValue) {
    setFilter(v);
    setShowArchivedOnly(v === "archived");
  }

  function getCategoryStyle(type: string) {
    switch (type) {
      case "lab_report":
        return { bg: "#F8F3E9", text: "#9A7228" };
      case "prescription":
        return { bg: "#F0EDF6", text: colors.primary };
      case "imaging":
        return { bg: "#E6F0FA", text: "#4A90E2" };
      default:
        return { bg: "#F4F2F8", text: colors.primary };
    }
  }

  function renderItemRow(rec: any) {
    const meta = metaFor(rec.recordType);
    const catStyle = getCategoryStyle(rec.recordType);
    const IconComponent = meta.icon;
    const dateLabel = formatItemDateLabel(locale, rec.date);
    const firstAttachment = rec.attachments?.first;
    const isSelected = selection.has(rec.id);
    const patientName = rec.patient?.name || t("doctorRecords.unknownPatient");

    return (
      <Pressable
        key={rec.id}
        onPress={() => {
          if (selectionMode) {
            toggleSelected(rec.id);
            return;
          }
          router.push({
            pathname: "/(app)/record-detail",
            params: { id: rec.id },
          });
        }}
        onLongPress={() => longPressRow(rec.id)}
        delayLongPress={250}
        style={({ pressed }) => ({
          flexDirection: "row",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: isSelected
            ? `${colors.primary}1A`
            : pressed
            ? `${colors.primary}0D`
            : "transparent",
          gap: spacing.md,
        })}
      >
        {selectionMode ? (
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              marginTop: 10,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : "transparent",
            }}
          >
            {isSelected ? (
              <Check size={14} color={colors.onPrimary} strokeWidth={3} />
            ) : null}
          </View>
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: catStyle.bg,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            <IconComponent size={20} color={catStyle.text} strokeWidth={2} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "500",
                color: "#7F7B8C",
                fontFamily: fontFamily.body,
              }}
            >
              {dateLabel}
            </Text>
            <View
              style={{ flexDirection: "row", gap: 4, alignItems: "center" }}
            >
              {rec.archivedAt ? (
                <Archive size={12} color={colors.warning} strokeWidth={2.5} />
              ) : null}
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: catStyle.text,
                  letterSpacing: 0.8,
                  fontFamily: fontFamily.displayBold,
                }}
              >
                {meta.label.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#1D1B20",
              fontFamily: fontFamily.displayBold,
              lineHeight: 22,
              marginBottom: 4,
            }}
          >
            {rec.title}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "#7F7B8C",
              fontFamily: fontFamily.body,
              lineHeight: 18,
            }}
          >
            {[patientName, rec.hospital?.name].filter(Boolean).join(" • ")}
          </Text>

          {rec.tags?.length ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 6,
              }}
            >
              {rec.tags.slice(0, 4).map((tag: string) => (
                <View
                  key={tag}
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: colors.textMuted,
                      fontFamily: fontFamily.bodyBold,
                    }}
                  >
                    #{tag}
                  </Text>
                </View>
              ))}
              {rec.tags.length > 4 ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    fontFamily: fontFamily.body,
                  }}
                >
                  +{rec.tags.length - 4}
                </Text>
              ) : null}
            </View>
          ) : null}

          {firstAttachment && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <FileText size={14} color={colors.primary} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.primary,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {t("doctorRecords.attachmentCount", { count: rec.attachments?.count || 1 })}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      {/* ─── Top App Bar ─────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#F4F2F8",
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.primary,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            {t("doctorRecords.backLabel")}
          </Text>
        </Pressable>

        <Text
          style={[
            typography.title.lg,
            {
              color: colors.primary,
              fontWeight: "800",
              fontSize: 22,
              fontFamily: fontFamily.displayBold,
            },
          ]}
        >
          {selectionMode ? t("doctorRecords.selected", { count: selection.size }) : t("doctorRecords.title")}
        </Text>

        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        style={{ backgroundColor: "#FAF9FC" }}
        contentContainerStyle={{ paddingBottom: selectionMode ? 200 : 150 }}
      >
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.lg,
            marginBottom: spacing.xs,
          }}
        >
          <Text
            style={[
              typography.display.sm,
              {
                color: "#1D1B20",
                fontWeight: "800",
                fontSize: 26,
                fontFamily: fontFamily.displayBold,
              },
            ]}
          >
            {selectionMode ? t("doctorRecords.selectTitle") : t("doctorRecords.heroAll")}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: "#7F7B8C",
              fontWeight: "500",
              fontFamily: fontFamily.body,
              marginTop: 2,
            }}
          >
            {t("doctorRecords.totalGrouped", { count: recordsData?.total ?? records.length })}
          </Text>
        </View>

        {/* ─── Search bar ────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            backgroundColor: "#FFFFFF",
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "#EFEAF4",
          }}
        >
          <Search size={18} color="#7F7B8C" strokeWidth={2.25} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("doctorRecords.searchPlaceholder")}
            placeholderTextColor="#9C97AC"
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 15,
              color: "#1D1B20",
              fontFamily: fontFamily.body,
            }}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={6}>
              <X size={16} color="#7F7B8C" strokeWidth={2.5} />
            </Pressable>
          ) : null}
        </View>

        {/* ─── Filter chips ──────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            gap: 8,
          }}
        >
          {FILTER_ORDER.map((f) => {
            const active = filter === f.value;
            const count = counts[f.value] ?? 0;
            return (
              <Pressable
                key={f.value}
                onPress={() => onFilterChipPress(f.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? colors.primary : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: active ? colors.primary : "#EFEAF4",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: active ? colors.onPrimary : "#5C5870",
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {f.label}
                  {count > 0 ? ` · ${count}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── Sort toggle ───────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
            gap: 8,
          }}
        >
          {(["newest", "oldest", "relevance"] as SortMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setSort(m)}
              hitSlop={4}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: sort === m ? "#1D1B20" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: sort === m ? "#FFFFFF" : "#5C5870",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {t(`doctorRecords.sort.${m}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ─── Loading ───────────────────────────────────── */}
        {isLoading ? (
          <View style={{ paddingTop: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : groupedSections.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? t("doctorRecords.emptySearchTitle") : t("doctorRecords.emptyTitle")}
            subtitle={
              search
                ? t("doctorRecords.emptySearchBody")
                : t("doctorRecords.emptyBody")
            }
          />
        ) : (
          groupedSections.map((section) => (
            <View key={section.title}>
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.md,
                  paddingBottom: 4,
                  backgroundColor: "#FAF9FC",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: "#7F7B8C",
                    letterSpacing: 0.8,
                    fontFamily: fontFamily.displayBold,
                  }}
                >
                  {section.title.toUpperCase()}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  marginHorizontal: spacing.lg,
                  borderRadius: radius.lg,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "#EFEAF4",
                  marginBottom: spacing.md,
                }}
              >
                {section.data.map(renderItemRow)}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {selectionMode ? (
        <RecordsActionBar
          selectedIds={Array.from(selection)}
          allArchived={allSelectedArchived}
          hideMove
          onClose={clearSelection}
          onTagPress={() => setTagPickerOpen(true)}
          onMovePress={() => {}}
        />
      ) : null}

      <TagPickerSheet
        visible={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        suggestions={tagSuggestions}
        onApply={applyTagBulk}
      />
    </Screen>
  );
}

function getMonthKey(locale: ReturnType<typeof useLocaleStore.getState>["locale"], dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return fmtMonthYear(d, locale);
}

function formatItemDateLabel(locale: ReturnType<typeof useLocaleStore.getState>["locale"], dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return fmtDateLong(d, locale);
}
// @ts-nocheck

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Search,
  FileText,
  Bell,
  ArrowUpDown,
  Eye,
  Archive,
  Bookmark,
  X,
  Check,
} from "lucide-react-native";
import {
  useMedicalRecords,
  useRecordStats,
  usePatientProfile,
  useUnreadCount,
  useBulkTagRecords,
  useBulkMoveRecords,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Card,
  Avatar,
  EmptyState,
  Button,
  useToast,
} from "@/components/ui";
import { metaFor, type RecordType } from "@/lib/recordImportance";
import { searchRecords, flattenOCR } from "@/lib/recordSearch";
import { useRecordsPrefsStore } from "@/stores/recordsPrefs";
import { RecordsActionBar } from "@/components/RecordsActionBar";
import { FamilyPickerSheet } from "@/components/FamilyPickerSheet";
import { TagPickerSheet } from "@/components/TagPickerSheet";
import { SaveFilterSheet } from "@/components/SaveFilterSheet";

type FilterValue = "all" | RecordType | "archived";

const FILTER_ORDER: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lab_report", label: "Lab" },
  { value: "prescription", label: "Rx" },
  { value: "imaging", label: "Imaging" },
  { value: "hospital_visit", label: "Visits" },
  { value: "vaccination", label: "Vaccines" },
  { value: "surgery", label: "Surgery" },
  { value: "archived", label: "Archived" },
];

type DateRange = "all" | "30d" | "1y";

const DATE_RANGES: { value: DateRange; label: string; ms: number | null }[] = [
  { value: "all", label: "All time", ms: null },
  { value: "1y", label: "Past year", ms: 365 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Past 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

type SortMode = "newest" | "oldest" | "relevance";

export default function RecordsScreen() {
  const router = useRouter();
  const { spacing, colors, typography, fontFamily, radius } = useTheme();
  const toast = useToast();
  const prefs = useRecordsPrefsStore();
  const { data: profileData } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { data: stats } = useRecordStats();
  const bulkTag = useBulkTagRecords();
  const bulkMove = useBulkMoveRecords();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [range, setRange] = useState<DateRange>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);

  // ─── Selection state ─────────────────────────────────
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const selectionMode = selection.size > 0;

  // ─── Picker sheet visibility ─────────────────────────
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [familyPickerOpen, setFamilyPickerOpen] = useState(false);
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);

  // ─── Server query opts ───────────────────────────────
  const queryOpts = useMemo(
    () => ({
      limit: 100,
      query: search.trim() || undefined,
      type: filter !== "all" && filter !== "archived" ? filter : undefined,
      archived: showArchivedOnly || filter === "archived" ? ("only" as const) : undefined,
      scope: prefs.familyScope === "own" ? ("own" as const) : ("family" as const),
      sort: search.trim() && sort === "relevance" ? ("relevance" as const) : (sort as "newest" | "oldest"),
    }),
    [search, filter, sort, showArchivedOnly, prefs.familyScope]
  );

  const {
    data: recordsData,
    isLoading,
    refetch,
    isRefetching,
  } = useMedicalRecords(queryOpts);

  const records: any[] = recordsData?.records ?? [];

  const userPhoto = profileData?.patient?.users?.photo;
  const userName = profileData?.patient?.users?.name || "";

  // Remember searches (debounced via the effect).
  useEffect(() => {
    const t = search.trim();
    if (t.length >= 2) prefs.rememberSearch(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ─── Type / date pre-filter on the server already
  // applies those; this block layers client-side relevance
  // ranking on top when q is present and groups by month.
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
      (r) => flattenOCR(r.extractedData),
    ]);
  }, [records, search]);

  const filtered = useMemo(() => {
    // Apply range filter locally (server already paginates by 100).
    const rangeMs =
      DATE_RANGES.find((r) => r.value === range)?.ms ?? null;
    const now = Date.now();
    let list = ranked;
    if (rangeMs) {
      list = list.filter((rec: any) => {
        const d = new Date(rec.date).getTime();
        if (Number.isNaN(d)) return false;
        return now - d <= rangeMs;
      });
    }
    // For date sort modes, server already returns sorted. For relevance
    // mode, searchRecords returns ranked. No re-sort here.
    return list;
  }, [ranked, range]);

  // ─── Per-filter counts (from current page) ───────────
  const counts = useMemo(() => {
    const base: Record<string, number> = { all: records.length };
    for (const r of records as any[]) {
      base[r.recordType] = (base[r.recordType] || 0) + 1;
    }
    base.archived = records.filter((r: any) => r.archivedAt).length;
    return base;
  }, [records]);

  // ─── Top tag suggestions from the current page ────────
  const tagSuggestions = useMemo(() => {
    const tally = new Map<string, number>();
    for (const r of records as any[]) {
      for (const t of r.tags || []) {
        tally.set(t, (tally.get(t) || 0) + 1);
      }
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t]) => t);
  }, [records]);

  // ─── Group by family member + month-year ─────────────
  const groupedSections = useMemo(() => {
    const sections: { title: string; data: any[] }[] = [];
    const map: Record<string, any[]> = {};
    for (const rec of filtered) {
      const owner =
        rec.familyMember?.name
          ? `${rec.familyMember.name}`
          : "You";
      const monthKey = getGroupKey(rec.date);
      const key = `${owner} · ${monthKey}`;
      if (!map[key]) {
        map[key] = [];
        sections.push({ title: key, data: map[key] });
      }
      map[key].push(rec);
    }
    return sections;
  }, [filtered]);

  // ─── Selection helpers ───────────────────────────────
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

  // ─── Saved filter apply/save ─────────────────────────
  function applySavedFilter(f: any) {
    setSearch(f.query || "");
    setFilter(f.type || (f.archivedOnly ? "archived" : "all"));
    setRange(f.range || "all");
    setSort(f.sort || "newest");
    setShowArchivedOnly(!!f.archivedOnly);
    if (f.scope) prefs.setFamilyScope(f.scope === "own" ? "own" : "all");
    toast.show(`Loaded "${f.name}"`, "info");
  }

  function handleSaveCurrentFilter(name: string) {
    prefs.saveFilter(name, {
      query: search.trim() || undefined,
      type: filter !== "all" && filter !== "archived" ? filter : undefined,
      range,
      sort,
      archivedOnly: showArchivedOnly || filter === "archived",
      scope: prefs.familyScope,
    });
    toast.show(`Saved "${name}"`, "success");
  }

  // ─── Bulk actions (called from the action bar) ───────
  function onTagPressActionBar() {
    if (selection.size === 0) return;
    setTagPickerOpen(true);
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

  function applyMoveBulk(familyMemberId: string | null) {
    const ids = Array.from(selection);
    bulkMove.mutate(
      { ids, familyMemberId },
      {
        onSuccess: (res: any) => {
          toast.show(
            res.denied?.length
              ? `Moved ${res.moved}, ${res.denied.length} denied`
              : `Moved ${res.moved}`,
            res.denied?.length ? "warning" : "success"
          );
          clearSelection();
        },
        onError: (err: any) =>
          toast.show(err?.message || "Move failed", "danger"),
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
    const dateLabel = formatItemDateLabel(rec.date);
    const firstAttachment = rec.attachments?.first;
    const isSelected = selection.has(rec.id);

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
            <View style={{ flexDirection: "row", gap: 4 }}>
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
            {rec.doctor?.name || rec.hospital?.name
              ? [rec.doctor?.name, rec.hospital?.name].filter(Boolean).join(" • ")
              : rec.diagnosis || rec.summary || rec.notes || ""}
          </Text>

          {/* Tags row */}
          {rec.tags?.length ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 6,
              }}
            >
              {rec.tags.slice(0, 4).map((t: string) => (
                <View
                  key={t}
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
                    #{t}
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
            <View style={{ marginTop: 8 }}>
              {firstAttachment.type === "pdf" ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <FileText size={16} color={colors.primary} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: colors.primary,
                      textDecorationLine: "underline",
                      fontFamily: fontFamily.bodyBold,
                    }}
                  >
                    View Results (PDF)
                  </Text>
                </View>
              ) : firstAttachment.type === "image" ? (
                <View
                  style={{
                    position: "relative",
                    marginTop: 10,
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "#E6E4EA",
                  }}
                >
                  <Image
                    source={{
                      uri: `${process.env.EXPO_PUBLIC_API_URL}/files/download/${encodeURIComponent(
                        firstAttachment.r2Key
                      )}?stream=1`,
                    }}
                    style={{
                      width: "100%",
                      height: 180,
                      resizeMode: "cover",
                    }}
                  />
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      backgroundColor: "rgba(0, 0, 0, 0.05)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 8,
                        elevation: 4,
                      }}
                    >
                      <Eye size={22} color={colors.primary} strokeWidth={2} />
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  // Whether all selected records are currently archived (drives the
  // Archive/Unarchive toggle on the action bar).
  const allSelectedArchived = useMemo(() => {
    if (selection.size === 0) return false;
    return Array.from(selection).every((id) =>
      records.find((r) => r.id === id)?.archivedAt
    );
  }, [selection, records]);

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
        <Pressable onPress={() => router.push("/(app)/profile")}>
          <Avatar
            name={userName || "You"}
            source={userPhoto ? { uri: userPhoto } : undefined}
            size="sm"
          />
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
          {selectionMode ? `${selection.size} selected` : "HealthHub"}
        </Text>

        <Pressable onPress={() => router.push("/(app)/notifications")}>
          <View
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <Bell size={24} color={colors.primary} strokeWidth={2} />
            {unread?.count ? (
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.danger || "#FF3B30",
                }}
              />
            ) : null}
          </View>
        </Pressable>
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
        contentContainerStyle={{
          paddingBottom: selectionMode ? 200 : 150,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
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
            {selectionMode ? "Manage records" : "Your Records"}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: "#7F7B8C",
              fontWeight: "500",
              fontFamily: fontFamily.body,
            }}
          >
            {filtered.length} total
          </Text>
        </View>

        {/* ─── Search Bar ─────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginVertical: spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              borderWidth: 1,
              borderColor: "#E6E4EA",
              paddingHorizontal: spacing.md,
              height: 48,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.02,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Search
              size={20}
              color="#9E9AA7"
              style={{ marginRight: spacing.xs }}
            />
            <TextInput
              placeholder="Search records, OCR text, doctor…"
              placeholderTextColor="#9E9AA7"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
              style={{
                flex: 1,
                fontSize: 15,
                color: "#1D1B20",
                fontFamily: fontFamily.body,
                padding: 0,
              }}
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <X size={16} color="#9E9AA7" strokeWidth={2.5} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ─── Scope toggle + Save ────────────────────────── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#F4F2F8",
              borderRadius: 999,
              padding: 2,
            }}
          >
            {(
              [
                { v: "own", label: "You" },
                { v: "family", label: "You + Family" },
              ] as const
            ).map((opt) => {
              const sel = prefs.familyScope === opt.v;
              return (
                <Pressable
                  key={opt.v}
                  onPress={() => prefs.setFamilyScope(opt.v)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: sel ? colors.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: sel ? "#FFFFFF" : "#3F3844",
                      fontFamily: sel ? fontFamily.bodyBold : fontFamily.body,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => setSaveFilterOpen(true)}
            hitSlop={6}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Bookmark size={14} color={colors.primary} strokeWidth={2.25} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.primary,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              Save filter
            </Text>
          </Pressable>
        </View>

        {/* ─── Saved filters row ──────────────────────────── */}
        {prefs.savedFilters.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.xs,
              marginBottom: spacing.sm,
            }}
          >
            {prefs.savedFilters.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => applySavedFilter(f)}
                onLongPress={() => {
                  Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Light
                  ).catch(() => {});
                  Alert(
                    "Delete filter?",
                    `Remove "${f.name}" from saved filters?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          prefs.removeFilter(f.id);
                          toast.show("Filter removed", "info");
                        },
                      },
                    ]
                  );
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Bookmark size={12} color={colors.primary} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.text,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* ─── Filter chips with counts ───────────────────── */}
        <View style={{ marginBottom: spacing.md }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.sm,
            }}
          >
            {FILTER_ORDER.map((f) => {
              const count = counts[f.value] || 0;
              const isSelected = filter === f.value;
              const Icon = f.value === "archived" ? Archive : null;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => onFilterChipPress(f.value)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: isSelected ? colors.primary : "#F4F2F8",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {Icon ? (
                    <Icon
                      size={14}
                      color={isSelected ? "#FFFFFF" : colors.textMuted}
                      strokeWidth={2.25}
                    />
                  ) : null}
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: isSelected ? "#FFFFFF" : "#3F3844",
                      fontFamily: isSelected
                        ? fontFamily.bodySemibold
                        : fontFamily.body,
                    }}
                  >
                    {f.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "500",
                      color: isSelected
                        ? "rgba(255,255,255,0.7)"
                        : "#8E8A9A",
                      fontFamily: fontFamily.body,
                    }}
                  >
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Date range + sort row ───────────────────────── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.lg,
          }}
        >
          <View
            style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}
          >
            {DATE_RANGES.map((r) => {
              const isSelected = range === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setRange(r.value)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    backgroundColor: isSelected
                      ? `${colors.primary}1A`
                      : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: isSelected ? "700" : "500",
                      color: isSelected ? colors.primary : "#7F7B8C",
                      fontFamily: isSelected
                        ? fontFamily.bodyBold
                        : fontFamily.body,
                    }}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() =>
              setSort((s) =>
                s === "newest" ? "oldest" : s === "oldest" ? "relevance" : "newest"
              )
            }
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <ArrowUpDown size={14} color={colors.primary} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.primary,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              {sort === "newest"
                ? "Newest"
                : sort === "oldest"
                ? "Oldest"
                : "Best match"}
            </Text>
          </Pressable>
        </View>

        {(search || filter !== "all" || range !== "all" || showArchivedOnly) && (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: "#7F7B8C",
                fontFamily: fontFamily.body,
              }}
            >
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
              {search ? ` for "${search}"` : ""}
            </Text>
            <Pressable
              onPress={() => {
                setSearch("");
                setFilter("all");
                setRange("all");
                setShowArchivedOnly(false);
                setSort("newest");
              }}
              hitSlop={6}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: colors.primary,
                  fontWeight: "700",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                Clear filters
              </Text>
            </Pressable>
          </View>
        )}

        {/* ─── Grouped Records List ────────────────────────── */}
        {isLoading ? (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xl,
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : records.length === 0 ? (
          <EmptyState
            style={{ marginTop: spacing.xl }}
            icon={FileText}
            title="No records yet"
            message="Upload your first record, or log your medical notes."
            actionLabel="Add record"
            onAction={() => router.push("/(app)/add-record" as any)}
          />
        ) : filtered.length === 0 ? (
          <View
            style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}
          >
            <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <FileText size={40} color="#9E9AA7" strokeWidth={1.5} />
              <Text
                style={[
                  typography.title.md,
                  {
                    color: colors.text,
                    fontWeight: "700",
                    marginTop: spacing.sm,
                  },
                ]}
              >
                Nothing matches
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  {
                    color: colors.textMuted,
                    textAlign: "center",
                    marginTop: spacing.xs,
                  },
                ]}
              >
                Try a different search term or clear the filters.
              </Text>
              <Button
                title="Clear filters"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setSearch("");
                  setFilter("all");
                  setRange("all");
                  setShowArchivedOnly(false);
                }}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          </View>
        ) : (
          <View>
            {groupedSections.map((section) => (
              <View key={section.title} style={{ marginBottom: spacing.md }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#7F7B8C",
                    letterSpacing: 1,
                    paddingHorizontal: spacing.lg,
                    marginBottom: spacing.xs,
                    marginTop: spacing.sm,
                    fontFamily: fontFamily.displayBold,
                  }}
                >
                  {section.title}
                </Text>

                <View
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: "#F4F2F8",
                  }}
                >
                  {section.data.map((rec, index) => (
                    <View key={rec.id}>
                      {renderItemRow(rec)}
                      {index < section.data.length - 1 ? (
                        <View
                          style={{
                            height: 1,
                            backgroundColor: "#F4F2F8",
                            marginLeft:
                              spacing.lg + (selectionMode ? 24 + spacing.md : 44 + spacing.md),
                          }}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ─── Selection action bar (pinned) ────────────────── */}
      {selectionMode ? (
        <RecordsActionBar
          selectedIds={Array.from(selection)}
          allArchived={allSelectedArchived}
          onClose={clearSelection}
          onTagPress={onTagPressActionBar}
          onMovePress={() => setFamilyPickerOpen(true)}
        />
      ) : null}

      {/* ─── Sheets ───────────────────────────────────────── */}
      <TagPickerSheet
        visible={tagPickerOpen}
        onDismiss={() => setTagPickerOpen(false)}
        currentTags={[]}
        suggestions={tagSuggestions}
        onApply={applyTagBulk}
      />
      <FamilyPickerSheet
        visible={familyPickerOpen}
        onDismiss={() => setFamilyPickerOpen(false)}
        onPick={applyMoveBulk}
      />
      <SaveFilterSheet
        visible={saveFilterOpen}
        onDismiss={() => setSaveFilterOpen(false)}
        onSave={handleSaveCurrentFilter}
      />
    </Screen>
  );
}

// Local helper that wraps RN's Alert without importing it (records.tsx
// already pulls in too many things — keep this lightweight).
function Alert(
  title: string,
  message: string,
  buttons: Array<{ text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void }>
) {
  // Lazy require so the bundle stays clean if user never long-presses a saved filter.
  const { Alert: RNAlert } = require("react-native");
  RNAlert.alert(title, message, buttons);
}

function getGroupKey(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "UNKNOWN DATE";
    return d
      .toLocaleDateString("en-US", { month: "long", year: "numeric" })
      .toUpperCase();
  } catch {
    return "UNKNOWN DATE";
  }
}

function formatItemDateLabel(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
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
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtMonthYear, fmtDateLong, intlLocale } from "@/lib/format";
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
  Plus,
  Clock,
  Share2,
  ListFilter,
} from "lucide-react-native";
import {
  useMedicalRecords,
  useRecordStats,
  usePatientProfile,
  useUnreadCount,
  useBulkTagRecords,
  useBulkMoveRecords,
  useRecordSearch,
  useConsentsMine,
  readAiGuess,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/stores/auth";
import {
  Screen,
  Card,
  Avatar,
  EmptyState,
  Button,
  useToast,
  FloatingActionButton,
} from "@/components/ui";
import { metaFor, type RecordType } from "@/lib/recordImportance";
import { searchRecords, flattenOCR, didYouMean } from "@/lib/recordSearch";
import { useRecordsPrefsStore } from "@/stores/recordsPrefs";
import { RecordsActionBar } from "@/components/RecordsActionBar";
import { FamilyPickerSheet } from "@/components/FamilyPickerSheet";
import { TagPickerSheet } from "@/components/TagPickerSheet";
import { SaveFilterSheet } from "@/components/SaveFilterSheet";

type ViewTab = "all" | "timeline" | "sharing";

const VIEW_TABS: ViewTab[] = ["all", "timeline", "sharing"];

const TAB_META: Record<ViewTab, { icon: React.ComponentType<any> }> = {
  all: { icon: ListFilter },
  timeline: { icon: Clock },
  sharing: { icon: Share2 },
};

type DateRange = "all" | "30d" | "1y";

const DATE_RANGE_VALUES: DateRange[] = ["all", "1y", "30d"];

type SortMode = "newest" | "oldest" | "relevance";

const SORT_ORDER: SortMode[] = ["newest", "oldest", "relevance"];

export default function RecordsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, fontFamily, radius } = useTheme();
  const toast = useToast();
  const prefs = useRecordsPrefsStore();
  const locale = useLocaleStore((s) => s.locale);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === "doctor") {
      router.replace("/(doctor)/records" as any);
    }
  }, [user]);

  const { data: profileData } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { data: stats } = useRecordStats();
  const { data: consentsMine } = useConsentsMine();
  const bulkTag = useBulkTagRecords();
  const bulkMove = useBulkMoveRecords();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ViewTab>("all");
  const [range, setRange] = useState<DateRange>("all");
  const [sort, setSort] = useState<SortMode>("newest");

  // ─── Selection state ─────────────────────────────────
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const selectionMode = selection.size > 0;

  // ─── Picker sheet visibility ─────────────────────────
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [familyPickerOpen, setFamilyPickerOpen] = useState(false);
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);

  // ─── Server query opts ───────────────────────────────
  // "all"      → return every record (default scope).
  // "timeline" → same as "all" but the client enforces strict date-desc
  //              grouping + renders the date stamp prominently. The server
  //              is asked for the freshest slice first.
  // "sharing"  → only records that have an active consent grant, so the
  //              user can see exactly what's shared with hospitals/doctors.
  const queryOpts = useMemo(
    () => ({
      limit: tab === "sharing" ? 200 : 100,
      query: search.trim() || undefined,
      scope: prefs.familyScope === "own" ? ("own" as const) : ("family" as const),
      sort:
        search.trim() && sort === "relevance"
          ? ("relevance" as const)
          : tab === "timeline"
          ? ("newest" as const)
          : (sort as "newest" | "oldest"),
    }),
    [search, sort, prefs.familyScope, tab]
  );

  const {
    data: recordsData,
    isLoading,
    refetch,
    isRefetching,
  } = useMedicalRecords(queryOpts);

  const records: any[] = recordsData?.records ?? [];

  // Phase 2.1: trilingual server FTS5 search. Activates only when the
  // user types ≥ 2 chars. Server returns BM25-ranked records across
  // own + family scope. Falls back to client scoring while a query is
  // mid-flight so the existing UX (typing → narrow → expand) still
  // works without waiting on the network roundtrip.
  const {
    data: serverSearch,
    isFetching: isSearching,
  } = useRecordSearch(search, { limit: 100 });

  const userPhoto = profileData?.patient?.users?.photo;
  const userName = profileData?.patient?.users?.name || "";

  // Remember searches (debounced via the effect).
  useEffect(() => {
    const searchTerm = search.trim();
    if (searchTerm.length >= 2) prefs.rememberSearch(searchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ─── Type / date pre-filter on the server already
  // applies those; this block layers client-side relevance
  // ranking on top when q is present and groups by month.
  //
  // Phase 2.1: prefer the server FTS result when it's available —
  // it understands Sinhala/Tamil token boundaries via unicode61, so
  // it catches cross-script matches that client substring scoring
  // would miss. Fall back to client scoring only when the server
  // result hasn't arrived yet.
  const ranked = useMemo(() => {
    const trimmed = search.trim();
    if (trimmed.length >= 2 && serverSearch?.records) {
      return serverSearch.records;
    }
    if (!trimmed) return records;
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
  }, [records, search, serverSearch]);

  // Phase 2.1: "did you mean" suggestions when the typed query has no
  // hits at all. Drawn from the local candidate pool only — server
  // already returned 0 matches, so there's nothing to mine there.
  const didYouMeanSuggestions = useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed || trimmed.length < 2) return [];
    if (ranked.length > 0) return [];
    return didYouMean(trimmed, records, [
      "title",
      "diagnosis",
      "summary",
      (r) => r.doctor?.name,
      (r) => r.hospital?.name,
    ]);
  }, [search, ranked, records]);

  const RANGE_MS: Record<DateRange, number | null> = {
    all: null,
    "1y": 365 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  // Set of record IDs that currently have an active consent grant — drives
  // the "sharing" tab. Computed once from the consent list so the filter
  // remains cheap even when consents have large scope blobs.
  const sharedRecordIds = useMemo(() => {
    const out = new Set<string>();
    const items = (consentsMine as any)?.items ?? [];
    for (const c of items) {
      if (c.status && c.status !== "active") continue;
      const scope = c.scope ?? {};
      const ids: string[] = Array.isArray(scope.recordIds)
        ? scope.recordIds
        : [];
      for (const id of ids) if (id) out.add(id);
    }
    return out;
  }, [consentsMine]);

  const filtered = useMemo(() => {
    // Apply range filter locally (server already paginates by 100).
    const rangeMs = RANGE_MS[range];
    const now = Date.now();
    let list = ranked;
    if (rangeMs) {
      list = list.filter((rec: any) => {
        const d = new Date(rec.date).getTime();
        if (Number.isNaN(d)) return false;
        return now - d <= rangeMs;
      });
    }
    // Sharing tab: keep only records covered by an active consent.
    if (tab === "sharing") {
      list = list.filter((rec: any) => sharedRecordIds.has(rec.id));
    }
    return list;
  }, [ranked, range, tab, sharedRecordIds]);

  // ─── Per-tab counts (drives the segmented control badges) ──
  const counts = useMemo(() => {
    const base: Record<string, number> = {
      all: records.length,
      timeline: records.length,
      sharing: 0,
    };
    for (const r of records as any[]) {
      if (sharedRecordIds.has(r.id)) base.sharing += 1;
    }
    return base;
  }, [records, sharedRecordIds]);

  // ─── Top tag suggestions from the current page ────────
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

  // ─── Group by family member + month-year ─────────────
  // "timeline" tab → ignore family grouping, sort strict date desc, and
  // bucket by YYYY-MM so the rendered sections read like a true timeline.
  // ─── Group by family member + month-year ─────────────
  // Sort across ALL tabs: newest first by createdAt (falling back to
  // record date). Timeline tab ignores family grouping; all/sharing keep
  // it. Sections are emitted in the order their earliest record appears,
  // so months always read newest-first regardless of which tab is open.
  const groupedSections = useMemo(() => {
    const sections: { title: string; data: any[] }[] = [];
    const map: Record<string, any[]> = {};
    // Sort by createdAt desc (then by date desc as a stable fallback)
    // for every tab so the list always reads newest-first.
    const sorted = [...filtered].sort((a: any, b: any) => {
      const ca = new Date(a.createdAt || a.date).getTime();
      const cb = new Date(b.createdAt || b.date).getTime();
      const da = Number.isNaN(ca) ? new Date(a.date).getTime() : ca;
      const db = Number.isNaN(cb) ? new Date(b.date).getTime() : cb;
      return (Number.isNaN(db) ? 0 : db) - (Number.isNaN(da) ? 0 : da);
    });
    for (const rec of sorted) {
      const owner = rec.familyMember?.name
        ? `${rec.familyMember.name}`
        : t("records.group.you");
      const monthKey = getGroupKey(t, locale, rec.date);
      const key = tab === "timeline" ? monthKey : `${owner} · ${monthKey}`;
      if (!map[key]) {
        map[key] = [];
        sections.push({ title: key, data: map[key] });
      }
      map[key].push(rec);
    }
    return sections;
  }, [filtered, t, tab, locale]);

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
    setTab("all");
    setRange(f.range || "all");
    setSort(f.sort || "newest");
    if (f.scope) prefs.setFamilyScope(f.scope === "own" ? "own" : "all");
    toast.show(t("records.toast.loadedFilter", { name: f.name }), "info");
  }

  function handleSaveCurrentFilter(name: string) {
    prefs.saveFilter(name, {
      query: search.trim() || undefined,
      range,
      sort,
      scope: prefs.familyScope,
    });
    toast.show(t("records.toast.savedFilter", { name }), "success");
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
              ? t("records.toast.taggedPartial", {
                  updated: res.updated,
                  denied: res.denied.length,
                })
              : t("records.toast.tagged", { count: res.updated }),
            res.denied?.length ? "warning" : "success"
          );
          clearSelection();
        },
        onError: (err: any) =>
          toast.show(err?.message || t("records.toast.tagError"), "danger"),
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
              ? t("records.toast.movedPartial", {
                  moved: res.moved,
                  denied: res.denied.length,
                })
              : t("records.toast.moved", { count: res.moved }),
            res.denied?.length ? "warning" : "success"
          );
          clearSelection();
        },
        onError: (err: any) =>
          toast.show(err?.message || t("records.toast.moveError"), "danger"),
      }
    );
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
    const dateLabel = formatItemDateLabel(t, locale, rec.date);
    const firstAttachment = rec.attachments?.first;
    const isSelected = selection.has(rec.id);
    // Phase 2.1: AI-guess pill when classification ran but wasn't
    // confident enough to upgrade recordType silently. Tapping opens
    // the edit screen so the user can confirm / correct.
    const aiGuess = readAiGuess(rec);

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
                {getRecordTypeLabel(t, rec.recordType).toUpperCase()}
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
          {aiGuess ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(app)/edit-record",
                  params: { id: rec.id },
                })
              }
              hitSlop={4}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
                marginTop: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: "#FFF7E0",
                borderWidth: 1,
                borderColor: "#F0D58A",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: "#8A6D17",
                  letterSpacing: 0.5,
                  fontFamily: fontFamily.displayBold,
                }}
              >
                {t("records.aiGuess.pill")}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: "#5C4A0F",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {getRecordTypeLabel(t, aiGuess.recordType)}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: "#8A6D17",
                  fontFamily: fontFamily.body,
                }}
              >
                {Math.round(aiGuess.confidence * 100)}%
              </Text>
            </Pressable>
          ) : null}
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
                    {t("records.viewResultsPdf")}
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
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      {/* ─── Top App Bar (compact) ─────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
          backgroundColor: "#FFFFFF",
        }}
      >
        <Pressable onPress={() => router.push("/(app)/profile")}>
          <Avatar
            name={userName || t("records.youFallback")}
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
          {selectionMode ? t("records.selected", { count: selection.size }) : t("records.brandName")}
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
        {/* ─── Hero (round rectangular, gradient — mirrors home page) ─ */}
        {!selectionMode ? (
          <View
            style={{
              marginHorizontal: spacing.lg,
              borderRadius: radius.xxxl,
              overflow: "hidden",
              shadowColor: "#0B2B64",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.18,
              shadowRadius: 24,
              elevation: 6,
            }}
          >
            {/* Base gradient */}
            <LinearGradient
              colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Radial accent overlays */}
            <View
              style={{
                position: "absolute",
                top: -80,
                right: -60,
                width: 220,
                height: 220,
                borderRadius: 110,
                backgroundColor: "rgba(56, 189, 248, 0.32)",
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: -100,
                left: -60,
                width: 240,
                height: 240,
                borderRadius: 120,
                backgroundColor: "rgba(14, 165, 233, 0.28)",
              }}
            />
            {/* Top sheen */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: "rgba(255, 255, 255, 0.25)",
              }}
            />

            <View style={{ padding: spacing.lg }}>
              {/* Header row: title + add button */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: "rgba(255,255,255,0.7)",
                      letterSpacing: 1.4,
                      fontFamily: fontFamily.displayBold,
                    }}
                  >
                    {t("records.hero.eyebrow")}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={{
                      color: "#FFFFFF",
                      fontSize: 28,
                      lineHeight: 34,
                      letterSpacing: -0.6,
                      fontWeight: "800",
                      marginTop: 2,
                      fontFamily: fontFamily.displayBold,
                    }}
                  >
                    {t("records.title")}
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.push("/(app)/add-record" as any)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t("records.hero.add")}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: "rgba(255,255,255,0.18)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
                </Pressable>
              </View>

              {/* Glass mini card — stats */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginTop: spacing.xs,
                }}
              >
                <HeroStat
                  value={filtered.length}
                  label={t("records.hero.total")}
                />
                <HeroStat
                  value={counts.sharing || 0}
                  label={t("records.hero.shared")}
                  accent
                />
                <HeroStat
                  value={prefs.savedFilters.length}
                  label={t("records.hero.folders")}
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* ─── Section title (visible in selection mode; hero hides it) ─ */}
        {selectionMode ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: spacing.lg,
              marginTop: spacing.md,
              marginBottom: spacing.xs,
            }}
          >
            <Text
              style={[
                typography.display.sm,
                {
                  color: "#1D1B20",
                  fontWeight: "800",
                  fontSize: 22,
                  fontFamily: fontFamily.displayBold,
                },
              ]}
            >
              {t("records.manageTitle")}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#7F7B8C",
                fontWeight: "500",
                fontFamily: fontFamily.body,
              }}
            >
              {t("records.selected", { count: selection.size })}
            </Text>
          </View>
        ) : null}

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
              placeholder={t("records.searchPlaceholder")}
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
            {(["own", "family"] as const).map((opt) => {
              const sel = prefs.familyScope === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => prefs.setFamilyScope(opt)}
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
                    {opt === "own" ? t("records.scope.own") : t("records.scope.family")}
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
              {t("records.saveFilter")}
            </Text>
          </Pressable>
        </View>

        {/* ─── Smart folders row (evenly aligned, smaller icons) ── */}
        {prefs.savedFilters.length ? (
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: spacing.lg,
              gap: 6,
              marginBottom: spacing.sm,
            }}
          >
            {prefs.savedFilters.slice(0, 4).map((f) => (
              <Pressable
                key={f.id}
                onPress={() => applySavedFilter(f)}
                onLongPress={() => {
                  Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Light
                  ).catch(() => {});
                  Alert(
                    t("records.savedFilters.delete.title"),
                    t("records.savedFilters.delete.message", { name: f.name }),
                    [
                      { text: t("common.cancel"), style: "cancel" },
                      {
                        text: t("records.savedFilters.delete.remove"),
                        style: "destructive",
                        onPress: () => {
                          prefs.removeFilter(f.id);
                          toast.show(t("records.savedFilters.removed"), "info");
                        },
                      },
                    ]
                  );
                }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: "#FFFFFF",
                  minWidth: 0,
                }}
              >
                <Bookmark size={11} color={colors.primary} strokeWidth={2.25} />
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11.5,
                    fontWeight: "700",
                    color: colors.text,
                    fontFamily: fontFamily.bodyBold,
                    flexShrink: 1,
                  }}
                >
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ─── View tabs: All / Timeline / Sharing (evenly split, vertical) ── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#F4F2F8",
              borderRadius: 16,
              padding: 4,
              gap: 4,
            }}
          >
            {VIEW_TABS.map((v) => {
              const isSelected = tab === v;
              const Icon = TAB_META[v].icon;
              const count = counts[v] || 0;
              return (
                <Pressable
                  key={v}
                  onPress={() => setTab(v)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t(`records.view.${v}`)}
                  hitSlop={4}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 6,
                    borderRadius: 12,
                    backgroundColor: isSelected ? colors.surface : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isSelected ? 0.06 : 0,
                    shadowRadius: 2,
                    elevation: isSelected ? 1 : 0,
                  }}
                >
                  <Icon
                    size={15}
                    color={isSelected ? colors.primary : colors.textMuted}
                    strokeWidth={2.25}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: isSelected ? colors.text : "#3F3844",
                      fontFamily: isSelected ? fontFamily.bodyBold : fontFamily.body,
                      marginTop: 3,
                    }}
                  >
                    {t(`records.view.${v}`)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: isSelected ? colors.primary : "#8E8A9A",
                      fontFamily: fontFamily.bodyBold,
                      marginTop: 1,
                    }}
                  >
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
            {DATE_RANGE_VALUES.map((rv) => {
              const isSelected = range === rv;
              return (
                <Pressable
                  key={rv}
                  onPress={() => setRange(rv)}
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
                    {t(`records.range.${rv}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              const idx = SORT_ORDER.indexOf(sort);
              const next = SORT_ORDER[(idx + 1) % SORT_ORDER.length];
              setSort(next);
            }}
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
              {t(`records.sort.${sort}`)}
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
              {t("records.results", { count: filtered.length })}
              {search ? t("records.resultsFor", { query: search }) : ""}
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
                {t("records.clearFilters")}
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
            title={t("records.empty.title")}
            message={t("records.empty.message")}
            actionLabel={t("records.empty.action")}
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
                {t("records.noMatch.title")}
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
                {t("records.noMatch.body")}
              </Text>
              {didYouMeanSuggestions.length > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: spacing.sm,
                  }}
                >
                  {didYouMeanSuggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setSearch(s)}
                      hitSlop={4}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        backgroundColor: `${colors.primary}14`,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: colors.primary,
                          fontFamily: fontFamily.bodyBold,
                        }}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Button
                title={t("records.clearFilters")}
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
  const { Alert: RNAlert } = require("react-native");
  RNAlert.alert(title, message, buttons);
}

function getRecordTypeLabel(t: (k: string) => string, type: string): string {
  return t(`records.type.${type}`, { defaultValue: (type || "").replace(/_/g, " ") });
}

// Glass stat tile used inside the records hero. Mirrors the glass pills
// in the home page hero so the visual language stays consistent.
function HeroStat({
  value,
  label,
  accent = false,
}: {
  value: number | string;
  label: string;
  accent?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: accent
          ? "rgba(255,255,255,0.22)"
          : "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: "#FFFFFF",
          fontSize: 18,
          fontWeight: "800",
          letterSpacing: -0.4,
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: "rgba(255,255,255,0.85)",
          fontSize: 10.5,
          fontWeight: "700",
          marginTop: 2,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function getGroupKey(t: (k: string) => string, locale: ReturnType<typeof useLocaleStore.getState>["locale"], dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return t("records.unknownDate");
    return fmtMonthYear(d, locale).toUpperCase();
  } catch {
    return t("records.unknownDate");
  }
}

function formatItemDateLabel(t: (k: string) => string, locale: ReturnType<typeof useLocaleStore.getState>["locale"], dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return t("records.date.today");
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return t("records.date.yesterday");
    return fmtDateLong(d, locale);
  } catch {
    return dateStr;
  }
}
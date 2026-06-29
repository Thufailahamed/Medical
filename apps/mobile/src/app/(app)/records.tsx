// @ts-nocheck

import { useMemo, useState } from "react";
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
import {
  Search,
  FileText,
  Bell,
  ChevronRight,
  ArrowUpDown,
  Eye,
} from "lucide-react-native";
import {
  useMedicalRecords,
  useRecordStats,
  usePatientProfile,
  useUnreadCount,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Card,
  Avatar,
  EmptyState,
  Button,
} from "@/components/ui";
import { metaFor, type RecordType } from "@/lib/recordImportance";

type FilterValue = "all" | RecordType;

const FILTER_ORDER: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lab_report", label: "Lab" },
  { value: "prescription", label: "Rx" },
  { value: "imaging", label: "Imaging" },
  { value: "hospital_visit", label: "Visits" },
  { value: "vaccination", label: "Vaccines" },
  { value: "surgery", label: "Surgery" },
];

type DateRange = "all" | "30d" | "1y";

const DATE_RANGES: { value: DateRange; label: string; ms: number | null }[] = [
  { value: "all", label: "All time", ms: null },
  { value: "1y", label: "Past year", ms: 365 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Past 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

type SortMode = "newest" | "oldest";

export default function RecordsScreen() {
  const router = useRouter();
  const { spacing, colors, typography, fontFamily, radius } = useTheme();
  const { data: profileData } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { data: stats } = useRecordStats();
  const {
    data: recordsData,
    isLoading,
    refetch,
    isRefetching,
  } = useMedicalRecords({ limit: 100 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [range, setRange] = useState<DateRange>("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const records: any[] = recordsData?.records ?? [];

  const userPhoto = profileData?.patient?.users?.photo;
  const userName = profileData?.patient?.users?.name || "";

  // ─── Filter pipeline: type → date range → search → sort ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const rangeMs = DATE_RANGES.find((r) => r.value === range)?.ms ?? null;

    const list = records.filter((rec: any) => {
      if (filter !== "all" && rec.recordType !== filter) return false;
      if (rangeMs) {
        const d = new Date(rec.date).getTime();
        if (Number.isNaN(d)) return false;
        if (now - d > rangeMs) return false;
      }
      if (!q) return true;
      return (
        rec.title?.toLowerCase().includes(q) ||
        rec.diagnosis?.toLowerCase().includes(q) ||
        rec.summary?.toLowerCase().includes(q) ||
        rec.notes?.toLowerCase().includes(q) ||
        rec.recordType?.toLowerCase().includes(q) ||
        rec.doctor?.name?.toLowerCase().includes(q) ||
        rec.hospital?.name?.toLowerCase().includes(q)
      );
    });

    list.sort((a: any, b: any) => {
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      return sort === "newest" ? db - da : da - db;
    });
    return list;
  }, [records, search, filter, range, sort]);

  // ─── Per-filter counts ──────────────────────────────────
  const counts = useMemo(() => {
    const base: Record<string, number> = { all: records.length };
    for (const r of records as any[]) {
      base[r.recordType] = (base[r.recordType] || 0) + 1;
    }
    return base;
  }, [records]);

  // ─── Group by Month-Year ────────────────────────────────
  const groupedSections = useMemo(() => {
    const sections: { title: string; data: any[] }[] = [];
    const map: Record<string, any[]> = {};

    for (const rec of filtered) {
      const key = getGroupKey(rec.date);
      if (!map[key]) {
        map[key] = [];
        sections.push({ title: key, data: map[key] });
      }
      map[key].push(rec);
    }
    return sections;
  }, [filtered]);

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

    return (
      <Pressable
        key={rec.id}
        onPress={() =>
          router.push({
            pathname: "/(app)/record-detail",
            params: { id: rec.id },
          })
        }
        style={({ pressed }) => ({
          flexDirection: "row",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? `${colors.primary}0D` : "transparent",
          gap: spacing.md,
        })}
      >
        {/* Left Icon */}
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

        {/* Right Content */}
        <View style={{ flex: 1 }}>
          {/* Header Line */}
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

          {/* Title */}
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

          {/* Subtitle / Details */}
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

          {/* Special Attachments */}
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
                  {/* Rounded thumbnail */}
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
                  {/* Absolute eye icon overlay */}
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
            { color: colors.primary, fontWeight: "800", fontSize: 22, fontFamily: fontFamily.displayBold }
          ]}
        >
          HealthHub
        </Text>

        <Pressable onPress={() => router.push("/(app)/notifications")}>
          <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", position: "relative" }}>
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
        contentContainerStyle={{ paddingBottom: 150 }}
      >
        {/* ─── Title & Total Count ────────────────────────── */}
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
              { color: "#1D1B20", fontWeight: "800", fontSize: 26, fontFamily: fontFamily.displayBold }
            ]}
          >
            Your Records
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
        <View style={{ paddingHorizontal: spacing.lg, marginVertical: spacing.md }}>
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
            <Search size={20} color="#9E9AA7" style={{ marginRight: spacing.xs }} />
            <TextInput
              placeholder="Search records, labs, images..."
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
          </View>
        </View>

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
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setFilter(f.value)}
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
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: isSelected ? "#FFFFFF" : "#3F3844",
                      fontFamily: isSelected ? fontFamily.bodySemibold : fontFamily.body,
                    }}
                  >
                    {f.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "500",
                      color: isSelected ? "rgba(255,255,255,0.7)" : "#8E8A9A",
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
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
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
                    backgroundColor: isSelected ? `${colors.primary}1A` : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: isSelected ? "700" : "500",
                      color: isSelected ? colors.primary : "#7F7B8C",
                      fontFamily: isSelected ? fontFamily.bodyBold : fontFamily.body,
                    }}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
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
              New/Old
            </Text>
          </Pressable>
        </View>

        {/* ─── Active filter clear trigger ─────────────────── */}
        {(search || filter !== "all" || range !== "all") && (
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
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xl }}>
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
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <FileText size={40} color="#9E9AA7" strokeWidth={1.5} />
              <Text
                style={[
                  typography.title.md,
                  { color: colors.text, fontWeight: "700", marginTop: spacing.sm },
                ]}
              >
                Nothing matches
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
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
                }}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          </View>
        ) : (
          <View>
            {groupedSections.map((section) => (
              <View key={section.title} style={{ marginBottom: spacing.md }}>
                {/* Section Month-Year Header */}
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

                {/* Section List Items */}
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
                      {index < section.data.length - 1 && (
                        <View
                          style={{
                            height: 1,
                            backgroundColor: "#F4F2F8",
                            marginLeft: spacing.lg + 44 + spacing.md, // Align line with text start
                          }}
                        />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// ─── Local date formatter helpers ─────────────────────────
function getGroupKey(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "UNKNOWN DATE";
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
  } catch {
    return "UNKNOWN DATE";
  }
}

function formatItemDateLabel(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;

    // Check if today
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return "Today";
    }
    // Check if yesterday
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

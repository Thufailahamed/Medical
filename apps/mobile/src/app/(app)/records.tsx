// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Upload,
  Search,
  FlaskConical,
  ScrollText,
  Image as ImageIcon,
  FileText,
  Bell,
  Stethoscope,
  Syringe,
  Scissors,
  AlertCircle,
  ShieldCheck,
  Dumbbell,
  Building2,
  FileBadge,
  NotebookPen,
  Receipt,
  HeartPulse,
  Paperclip,
  Sparkles,
  ChevronRight,
} from "lucide-react-native";
import {
  useMedicalRecords,
  useRecordStats,
  usePatientProfile,
  useUnreadCount,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useToast,
  Screen,
  Card,
  Avatar,
  TextInput,
  Chip,
  Timeline,
  Skeleton,
  Pill,
  EmptyState,
  Button,
} from "@/components/ui";

type RecordType =
  | "lab_report"
  | "imaging"
  | "prescription"
  | "hospital_visit"
  | "vaccination"
  | "surgery"
  | "allergy"
  | "insurance"
  | "fitness"
  | "discharge_summary"
  | "medical_certificate"
  | "operation_note"
  | "invoice";

const TYPE_META: Record<
  RecordType,
  { label: string; icon: any; iconColor: string; bgTone: string }
> = {
  lab_report: { label: "Lab", icon: FlaskConical, iconColor: "#765b00", bgTone: "#ffdf93" },
  imaging: { label: "Imaging", icon: ImageIcon, iconColor: "#63597c", bgTone: "#e1d4fd" },
  prescription: { label: "Prescription", icon: ScrollText, iconColor: "#4f378a", bgTone: "#e9ddff" },
  hospital_visit: { label: "Visit", icon: Stethoscope, iconColor: "#006a6a", bgTone: "#a4f0f0" },
  vaccination: { label: "Vaccine", icon: Syringe, iconColor: "#7a5900", bgTone: "#fff0c2" },
  surgery: { label: "Surgery", icon: Scissors, iconColor: "#ba1a1a", bgTone: "#ffdad6" },
  allergy: { label: "Allergy", icon: AlertCircle, iconColor: "#ba1a1a", bgTone: "#ffdad6" },
  insurance: { label: "Insurance", icon: ShieldCheck, iconColor: "#006b54", bgTone: "#a8f0d4" },
  fitness: { label: "Fitness", icon: Dumbbell, iconColor: "#4f378a", bgTone: "#e9ddff" },
  discharge_summary: { label: "Discharge", icon: FileBadge, iconColor: "#4f378a", bgTone: "#e9ddff" },
  medical_certificate: { label: "Certificate", icon: NotebookPen, iconColor: "#4f378a", bgTone: "#e9ddff" },
  operation_note: { label: "Op Note", icon: HeartPulse, iconColor: "#ba1a1a", bgTone: "#ffdad6" },
  invoice: { label: "Invoice", icon: Receipt, iconColor: "#765b00", bgTone: "#ffdf93" },
};

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

function metaFor(type?: string) {
  return TYPE_META[type as RecordType] ?? {
    label: type ? type.replace(/_/g, " ") : "Record",
    icon: FileText,
    iconColor: "#7a7582",
    bgTone: "#e6e0e9",
  };
}

// ─── Highlight helper ─────────────────────────────────────
// Splits text around query and returns marked segments so we can bold matches.
function highlight(text: string, q: string) {
  if (!q) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  if (!lower.includes(ql)) return [{ text, hit: false }];
  const out: { text: string; hit: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(ql, i);
    if (idx < 0) {
      out.push({ text: text.slice(i), hit: false });
      break;
    }
    if (idx > i) out.push({ text: text.slice(i, idx), hit: false });
    out.push({ text: text.slice(idx, idx + ql.length), hit: true });
    i = idx + ql.length;
  }
  return out;
}

// ─── Skeleton ─────────────────────────────────────────────
function RecordsSkeleton() {
  const { spacing } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.md }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flexDirection: "row", gap: spacing.md }}>
          <Skeleton width={48} height={48} radius={24} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={12} />
            <Skeleton width="90%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function RecordsScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
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

  // ─── Group by year-month ────────────────────────────────
  const groups = useMemo(() => {
    const map: Record<string, { items: any[]; latest: number }> = {};
    for (const rec of filtered) {
      const d = new Date(rec.date);
      let key: string;
      if (Number.isNaN(d.getTime())) {
        key = "Undated";
      } else {
        const month = d.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
        const year = d.getFullYear();
        key = `${month} ${year}`;
      }
      const bucket = (map[key] ??= { items: [], latest: 0 });
      bucket.items.push(rec);
      const t = new Date(rec.date).getTime() || 0;
      if (t > bucket.latest) bucket.latest = t;
    }
    // Order groups by their latest record, newest first.
    return Object.entries(map)
      .sort(([, a], [, b]) => b.latest - a.latest)
      .reduce<Record<string, any[]>>((acc, [k, v]) => {
        acc[k] = v.items;
        return acc;
      }, {});
  }, [filtered]);

  const groupKeys = Object.keys(groups);

  // ─── Per-filter counts ──────────────────────────────────
  const counts = useMemo(() => {
    const base: Record<string, number> = { all: records.length };
    for (const r of records as any[]) {
      base[r.recordType] = (base[r.recordType] || 0) + 1;
    }
    return base;
  }, [records]);

  const totalLabel = stats?.total != null ? `${stats.total} total` : `${records.length} shown`;

  // ─── Render item for Timeline ───────────────────────────
  function renderItem(rec: any) {
    const meta = metaFor(rec.recordType);
    const IconComponent = meta.icon;
    return (
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(app)/record-detail",
            params: { id: rec.id },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`${meta.label} record: ${rec.title}`}
        style={({ pressed }) => ({
          flex: 1,
          marginLeft: spacing.md,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.03,
          shadowRadius: 6,
          elevation: 1,
        })}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.xs,
          }}
        >
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: 6,
              backgroundColor: `${meta.bgTone}80`,
              borderWidth: 1,
              borderColor: `${meta.iconColor}33`,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: meta.iconColor,
                letterSpacing: 0.2,
              }}
            >
              {meta.label}
            </Text>
          </View>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, fontWeight: "500" },
            ]}
          >
            {formatItemDate(rec.date)}
          </Text>
        </View>

        <HighlightedText
          text={rec.title || ""}
          query={search}
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "800", fontSize: 16 },
          ]}
        />

        <HighlightedText
          text={rec.diagnosis || rec.summary || rec.notes || `${meta.label} record`}
          query={search}
          numberOfLines={2}
          style={[
            typography.body.sm,
            { color: colors.textMuted, marginTop: 2 },
          ]}
        />

        {/* Doctor / hospital line */}
        {(rec.doctor?.name || rec.hospital?.name) && (
          <Text
            numberOfLines={1}
            style={[
              typography.caption,
              { color: colors.textMuted, marginTop: spacing.xs },
            ]}
          >
            {[rec.doctor?.name, rec.hospital?.name].filter(Boolean).join(" · ")}
          </Text>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginTop: spacing.sm,
            flexWrap: "wrap",
          }}
        >
          {rec.attachments?.count > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <Paperclip size={12} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {rec.attachments.count}{" "}
                {rec.attachments.count === 1 ? "attachment" : "attachments"}
              </Text>
            </View>
          ) : null}
          {rec.followUpDate ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <Building2 size={12} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Follow-up: {formatItemDate(rec.followUpDate)}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 150 }}
      >
        {/* ─── Top App Bar ─────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push("/(app)/profile")}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              hitSlop={6}
            >
              <Avatar
                name={userName || "You"}
                source={userPhoto ? { uri: userPhoto } : undefined}
                size="md"
                tone="primary"
              />
            </Pressable>
            <Text
              style={[
                typography.title.lg,
                { color: colors.primary, fontWeight: "800", fontSize: 20 },
              ]}
            >
              HealthHub
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Pressable
              onPress={() => router.push("/(app)/add-record" as any)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add record"
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Upload size={22} color={colors.primary} strokeWidth={2.25} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(app)/notifications")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Bell size={22} color={colors.primary} strokeWidth={2.25} />
              {unread?.count ? (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* ─── Hero ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <LinearGradient
            colors={["#0EA5B7", "#078B9C"]}
            style={{
              padding: spacing.lg,
              borderRadius: radius.xxl,
              position: "relative",
              overflow: "hidden",
              shadowColor: "#0EA5B7",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.15,
              shadowRadius: 15,
              elevation: 6,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: -30,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: "rgba(255, 255, 255, 0.1)",
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: -50,
                left: -50,
                width: 160,
                height: 160,
                borderRadius: 80,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
              }}
            />

            <View style={{ zIndex: 10, gap: spacing.xs }}>
              <Text
                style={[
                  typography.overline,
                  {
                    color: "rgba(255,255,255,0.85)",
                    letterSpacing: 1.5,
                    fontWeight: "700",
                  },
                ]}
              >
                MEDICAL HISTORY
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={[
                    typography.display.sm,
                    { color: "#FFFFFF", fontWeight: "800", fontSize: 28 },
                  ]}
                >
                  Your Records
                </Text>
                <Pill label={totalLabel} tone="neutral" size="sm" />
              </View>

              <View style={{ marginTop: spacing.md }}>
                <TextInput
                  placeholder="Search title, diagnosis, doctor..."
                  placeholderTextColor="rgba(29, 27, 32, 0.5)"
                  value={search}
                  onChangeText={setSearch}
                  leadingIcon={Search}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.95)",
                    borderRadius: radius.md,
                  }}
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ─── Filter chips with counts ───────────────────── */}
        <View style={{ marginTop: spacing.lg }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.sm,
            }}
          >
            {FILTER_ORDER.map((f) => {
              const c = counts[f.value] || 0;
              return (
                <Chip
                  key={f.value}
                  label={`${f.label} · ${c}`}
                  selected={filter === f.value}
                  tone={filter === f.value ? "primary" : "neutral"}
                  onPress={() => setFilter(f.value)}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Date range + sort row ───────────────────────── */}
        <View
          style={{
            marginTop: spacing.md,
            paddingHorizontal: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
            style={{ flexGrow: 0 }}
          >
            {DATE_RANGES.map((r) => (
              <Chip
                key={r.value}
                label={r.label}
                selected={range === r.value}
                tone={range === r.value ? "info" : "neutral"}
                size="sm"
                onPress={() => setRange(r.value)}
              />
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["newest", "oldest"] as SortMode[]).map((s) => (
              <Chip
                key={s}
                label={s === "newest" ? "↓ New" : "↑ Old"}
                selected={sort === s}
                tone={sort === s ? "primary" : "neutral"}
                size="sm"
                onPress={() => setSort(s)}
              />
            ))}
          </View>
        </View>

        {/* ─── Active filter summary / result count ────────── */}
        {(search || filter !== "all" || range !== "all") && (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              marginTop: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={[typography.caption, { color: colors.textMuted }]}>
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
              <Text style={[typography.caption, { color: colors.primary, fontWeight: "700" }]}>
                Clear filters
              </Text>
            </Pressable>
          </View>
        )}

        {/* ─── Records list ────────────────────────────────── */}
        {isLoading ? (
          <RecordsSkeleton />
        ) : records.length === 0 ? (
          <EmptyState
            style={{ marginTop: spacing.xl }}
            icon={FileText}
            title="No records yet"
            message="Upload your first record, or generate an AI summary of your medical history."
            actionLabel="Add record"
            onAction={() => router.push("/(app)/add-record" as any)}
          />
        ) : filtered.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <FileText size={40} color={colors.textMuted} strokeWidth={1.5} />
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
          <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
            <Timeline
              data={filtered}
              keyExtractor={(r) => r.id}
              groupBy={(r) => groupKeyFor(r.date)}
              renderItem={(r) => renderItem(r)}
              groupMeta={Object.fromEntries(
                groupKeys.map((k) => [k, { label: k, tone: "neutral" }])
              )}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// ─── Local helpers ────────────────────────────────────────
function formatItemDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function groupKeyFor(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Undated";
  const month = d.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  return `${month} ${d.getFullYear()}`;
}

// ─── Highlighted text ─────────────────────────────────────
function HighlightedText({
  text,
  query,
  style,
  numberOfLines,
}: {
  text: string;
  query: string;
  style?: any;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const parts = highlight(text || "", query);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.hit ? (
          <Text
            key={i}
            style={{
              backgroundColor: `${colors.warning}55`,
              color: colors.text,
              fontWeight: "900",
            }}
          >
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        )
      )}
    </Text>
  );
}

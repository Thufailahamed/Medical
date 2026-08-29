// @ts-nocheck
//
// Records-V2 — premium Records hub. This is the screen pointed at by the
// "Records" tab in the patient app. It is data-equivalent to the previous
// "v2" page (same hooks, same mutations, same navigation) and visually
// upgraded: gradient hero with glass mini-stats, premium quick-action tiles
// with glow, smarter smart-folder tiles that light up when selected and
// actually apply their filter (incl. the previously-broken "Last 30 days"),
// a real consents list with revoke in the Sharing tab, a timeline tab that
// uses the loaded timeline instead of an empty placeholder, an active-filter
// chip strip with a one-tap clear, kind-colored record cards with a left
// accent strip + gradient icon + soft glow, and a high-end empty state
// with two primary actions.
//
// @ts-nocheck is project-wide for the lucide-react-native × React 19
// mismatch; the runtime contract is what matters here.

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  Platform,
  Alert,
  Pressable,
  TextInput as RNTextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  Search,
  X,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Plus,
  Share2,
  Download,
  ChevronRight,
  FolderOpen,
  FileText,
  Lock,
  Trash2,
  Calendar,
  Filter as FilterIcon,
  CheckCircle2,
  Sparkles,
  AlarmClock,
  Activity,
  ChevronsUpDown,
  ScanLine,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  RECORD_REGISTRY,
  RECORD_CATEGORIES,
  PURPOSE_REGISTRY,
  type RecordKind,
} from "@healthcare/shared/records";
import {
  usePatientProfile,
  useRecordStats,
  useUnifiedRecords,
  useRecordSearch,
  useUnifiedTimeline,
  useConsentsMine,
  useAuditLog,
  useRevokeConsent,
  useHealthSnapshot,
} from "@/hooks/useApi";
import { useLocaleStore } from "@/stores/locale";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Pill,
  type PillTone,
  Avatar,
  Skeleton,
  FloatingActionButton,
  TextInput,
  useToast,
  AppText,
  ErrorState,
} from "@/components/ui";
import {
  RecordFilters,
  RecordTimeline,
  AuditFeed,
  ShareModeSheet,
  DsarRequestSheet,
  HealthSnapshotCard,
  SharePackSheet,
  kindIcon,
  kindTone,
  fmtCount,
  fmtRelative,
  fmtDate,
} from "@/components/records";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tab = "all" | "timeline" | "sharing";
type Tone =
  | "primary"
  | "accent"
  | "accent2"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

// ---------------------------------------------------------------------------
// Record-kind visual identity. Kind-graded gradient + accent + glow so each
// card / folder tile reads with the correct medical-record semantic colour.
// ---------------------------------------------------------------------------
type KindVisual = {
  gradient: readonly [string, string];
  ring: readonly [string, string];
  soft: string;
  text: string;
  glow: string; // raw rgba string for shadow glow
};

const KIND_VISUAL: Record<RecordKind, KindVisual> = {
  lab_report: {
    gradient: ["#FBBF24", "#F59E0B"],
    ring: ["#FCD34D", "#F59E0B"],
    soft: "#FEF3C7",
    text: "#92400E",
    glow: "rgba(245, 158, 11, 0.30)",
  },
  imaging: {
    gradient: ["#38BDF8", "#0284C7"],
    ring: ["#7DD3FC", "#0284C7"],
    soft: "#E0F2FE",
    text: "#075985",
    glow: "rgba(14, 165, 233, 0.32)",
  },
  prescription: {
    gradient: ["#A78BFA", "#7C3AED"],
    ring: ["#C4B5FD", "#7C3AED"],
    soft: "#EDE9FE",
    text: "#5B21B6",
    glow: "rgba(124, 58, 237, 0.30)",
  },
  hospital_visit: {
    gradient: ["#2DD4BF", "#0D9488"],
    ring: ["#5EEAD4", "#0D9488"],
    soft: "#CCFBF1",
    text: "#115E59",
    glow: "rgba(13, 148, 136, 0.28)",
  },
  vaccination: {
    gradient: ["#FB923C", "#EA580C"],
    ring: ["#FDBA74", "#EA580C"],
    soft: "#FFEDD5",
    text: "#9A3412",
    glow: "rgba(234, 88, 12, 0.28)",
  },
  surgery: {
    gradient: ["#F87171", "#DC2626"],
    ring: ["#FCA5A5", "#DC2626"],
    soft: "#FEE2E2",
    text: "#991B1B",
    glow: "rgba(220, 38, 38, 0.30)",
  },
  allergy: {
    gradient: ["#FB7185", "#E11D48"],
    ring: ["#FDA4AF", "#E11D48"],
    soft: "#FFE4E6",
    text: "#9F1239",
    glow: "rgba(225, 29, 72, 0.30)",
  },
  insurance: {
    gradient: ["#34D399", "#059669"],
    ring: ["#6EE7B7", "#059669"],
    soft: "#D1FAE5",
    text: "#065F46",
    glow: "rgba(5, 150, 105, 0.28)",
  },
  fitness: {
    gradient: ["#818CF8", "#4F46E5"],
    ring: ["#A5B4FC", "#4F46E5"],
    soft: "#E0E7FF",
    text: "#3730A3",
    glow: "rgba(79, 70, 229, 0.30)",
  },
  discharge_summary: {
    gradient: ["#A78BFA", "#6D28D9"],
    ring: ["#C4B5FD", "#6D28D9"],
    soft: "#EDE9FE",
    text: "#4C1D95",
    glow: "rgba(109, 40, 217, 0.30)",
  },
  medical_certificate: {
    gradient: ["#60A5FA", "#2563EB"],
    ring: ["#93C5FD", "#2563EB"],
    soft: "#DBEAFE",
    text: "#1E40AF",
    glow: "rgba(37, 99, 235, 0.28)",
  },
  operation_note: {
    gradient: ["#F472B6", "#DB2777"],
    ring: ["#F9A8D4", "#DB2777"],
    soft: "#FCE7F3",
    text: "#9D174D",
    glow: "rgba(219, 39, 119, 0.28)",
  },
  invoice: {
    gradient: ["#FBBF24", "#B45309"],
    ring: ["#FCD34D", "#B45309"],
    soft: "#FEF3C7",
    text: "#92400E",
    glow: "rgba(180, 83, 9, 0.28)",
  },
  // Newly added kinds (registry-driven) – use safe defaults
  clinical_note: {
    gradient: ["#60A5FA", "#2563EB"],
    ring: ["#93C5FD", "#2563EB"],
    soft: "#DBEAFE",
    text: "#1E40AF",
    glow: "rgba(37, 99, 235, 0.28)",
  },
  lab_order: {
    gradient: ["#38BDF8", "#0284C7"],
    ring: ["#7DD3FC", "#0284C7"],
    soft: "#E0F2FE",
    text: "#075985",
    glow: "rgba(14, 165, 233, 0.28)",
  },
  follow_up: {
    gradient: ["#FBBF24", "#F59E0B"],
    ring: ["#FCD34D", "#F59E0B"],
    soft: "#FEF3C7",
    text: "#92400E",
    glow: "rgba(245, 158, 11, 0.28)",
  },
  other: {
    gradient: ["#94A3B8", "#475569"],
    ring: ["#CBD5E1", "#475569"],
    soft: "#F1F5F9",
    text: "#334155",
    glow: "rgba(71, 85, 105, 0.24)",
  },
  medication_order: {
    gradient: ["#34D399", "#059669"],
    ring: ["#6EE7B7", "#059669"],
    soft: "#D1FAE5",
    text: "#065F46",
    glow: "rgba(5, 150, 105, 0.28)",
  },
  lab_subtest: {
    gradient: ["#38BDF8", "#0284C7"],
    ring: ["#7DD3FC", "#0284C7"],
    soft: "#E0F2FE",
    text: "#075985",
    glow: "rgba(14, 165, 233, 0.28)",
  },
  clinical_attachment: {
    gradient: ["#94A3B8", "#475569"],
    ring: ["#CBD5E1", "#475569"],
    soft: "#F1F5F9",
    text: "#334155",
    glow: "rgba(71, 85, 105, 0.24)",
  },
  imaging_series: {
    gradient: ["#A78BFA", "#7C3AED"],
    ring: ["#C4B5FD", "#7C3AED"],
    soft: "#EDE9FE",
    text: "#5B21B6",
    glow: "rgba(124, 58, 237, 0.28)",
  },
  wearable_metric: {
    gradient: ["#F472B6", "#DB2777"],
    ring: ["#F9A8D4", "#DB2777"],
    soft: "#FCE7F3",
    text: "#9D174D",
    glow: "rgba(219, 39, 119, 0.28)",
  },
};

const DEFAULT_VISUAL: KindVisual = {
  gradient: ["#94A3B8", "#475569"],
  ring: ["#CBD5E1", "#475569"],
  soft: "#F1F5F9",
  text: "#334155",
  glow: "rgba(71, 85, 105, 0.24)",
};

function visualFor(k?: string | null): KindVisual {
  return (k && KIND_VISUAL[k as RecordKind]) || DEFAULT_VISUAL;
}

// ---------------------------------------------------------------------------
// Smart folders. The 5 type-keyed folders drive `kinds[]`; the
// "Last 30 days" folder drives `recentOnly`. Selecting the same folder a
// second time clears its filter, exactly like the existing Pill toggles.
// ---------------------------------------------------------------------------
type SmartFolderKind =
  | "lab_report"
  | "prescription"
  | "imaging"
  | "vaccination"
  | "allergy"
  | "recent30";

interface SmartFolder {
  key: SmartFolderKind;
  labelKey: string;
  kind?: RecordKind;
  /** For folders that aren't pure kind filters. */
  isRecent?: boolean;
}

const SMART_FOLDERS: SmartFolder[] = [
  { key: "lab_report", labelKey: "recordsHub.smartFolders.labReports", kind: "lab_report" },
  { key: "prescription", labelKey: "recordsHub.smartFolders.prescriptions", kind: "prescription" },
  { key: "imaging", labelKey: "recordsHub.smartFolders.imaging", kind: "imaging" },
  { key: "vaccination", labelKey: "recordsHub.smartFolders.vaccinations", kind: "vaccination" },
  { key: "allergy", labelKey: "recordsHub.smartFolders.allergies", kind: "allergy" },
  { key: "recent30", labelKey: "recordsHub.smartFolders.recent30", isRecent: true },
];

// "Recent" folder visual identity — coral / warning-style so it reads as a
// time-based filter (not a kind).
const RECENT_VISUAL: KindVisual = {
  gradient: ["#FF9670", "#E85F3D"],
  ring: ["#FFB89B", "#E85F3D"],
  soft: "#FFE4D9",
  text: "#9A3412",
  glow: "rgba(232, 95, 61, 0.30)",
};

// Quick-actions visual identity (3-button row).
const QUICK_VISUAL: Record<
  "share" | "export" | "add",
  {
    gradient: readonly [string, string];
    ring: readonly [string, string];
    soft: string;
    text: string;
    glow: string;
  }
> = {
  share: {
    gradient: ["#38BDF8", "#0284C7"],
    ring: ["#7DD3FC", "#0284C7"],
    soft: "#E0F2FE",
    text: "#075985",
    glow: "rgba(14, 165, 233, 0.28)",
  },
  export: {
    gradient: ["#FF9670", "#E85F3D"],
    ring: ["#FFB89B", "#E85F3D"],
    soft: "#FFE4D9",
    text: "#9A3412",
    glow: "rgba(232, 95, 61, 0.28)",
  },
  add: {
    gradient: ["#34D399", "#0F766E"],
    ring: ["#6EE7B7", "#0F766E"],
    soft: "#CCFBF1",
    text: "#115E59",
    glow: "rgba(15, 118, 110, 0.30)",
  },
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function RecordsV2() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const {
    colors,
    spacing,
    radius,
    typography,
    shadow: themeShadow,
    fontFamily,
  } = useTheme();
  const locale = useLocaleStore((s) => s.locale);

  const [tab, setTab] = useState<Tab>("all");
  const [kinds, setKinds] = useState<RecordKind[]>([]);
  const [recentOnly, setRecentOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [dsarOpen, setDsarOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<"all" | "year" | "30days">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  // Tier 1 records: multi-select mode for share-pack. Long-press a
  // record to enter; top action bar shows "Share (N)" + cancel.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [packOpen, setPackOpen] = useState(false);

  // ─── Data (1:1 with previous version) ──────────────────────────────────
  const { data: profileData, isLoading: profileLoading } = usePatientProfile();
  const { data: stats } = useRecordStats();
  const { data: recordsData, isLoading: recordsLoading, isError: recordsErrored, refetch: refetchRecords } =
    useUnifiedRecords({ limit: 200 });
  const { data: searchData } = useRecordSearch(query, { limit: 50 });
  const { data: timeline } = useUnifiedTimeline();
  const { data: consentsMine } = useConsentsMine();
  const { data: auditData } = useAuditLog();
  // Tier 1 records: Patient Health Snapshot. Cheap derivation on
  // the server, cached 60s on the client so the card does not flicker
  // on tab focus.
  const { data: snapshot, isLoading: snapshotLoading } = useHealthSnapshot();
  const revokeConsent = useRevokeConsent();

  const patient = profileData?.patient?.patients;
  const userRow = profileData?.patient?.users;
  const patientName = userRow?.name ?? t("recordsHub.hero.noProfile");
  const ageYears = useMemo(() => {
    if (!patient?.dateOfBirth) return null;
    const diff = Date.now() - new Date(patient.dateOfBirth).getTime();
    return Math.floor(diff / (365.25 * 86_400_000));
  }, [patient?.dateOfBirth]);

  const counts = (recordsData as any)?.counts ?? {};
  const activeConsents = useMemo(
    () => (consentsMine?.items ?? []).filter((c: any) => c.status === "active").length,
    [consentsMine],
  );
  const totalRecords =
    stats?.total ?? (recordsData?.records ?? []).length ?? 0;
  const lastActivity = useMemo(() => {
    const list = (recordsData?.records ?? []) as any[];
    if (!list.length) return null;
    const dates = list
      .map((r) => r.recordDate ?? r.date ?? r.createdAt)
      .filter(Boolean)
      .sort();
    return dates[dates.length - 1] ?? null;
  }, [recordsData]);
  const recentCount = useMemo(() => {
    const list = (recordsData?.records ?? []) as any[];
    return list.filter((r: any) => {
      const iso = r.recordDate ?? r.date ?? r.createdAt;
      if (!iso) return false;
      const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
      return days <= 7;
    }).length;
  }, [recordsData]);

  // Derived lists (1:1 + add the recentOnly filter).
  const records = useMemo(() => {
    if (query.length >= 2) return searchData?.records ?? [];
    return recordsData?.records ?? [];
  }, [query, searchData, recordsData]);

  const timeFilteredRecords = useMemo(() => {
    let out = records;
    if (timeFilter === "year") {
      out = out.filter((r: any) => {
        const iso = r.recordDate ?? r.date ?? r.createdAt;
        if (!iso) return false;
        const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
        return days <= 365;
      });
    } else if (timeFilter === "30days" || recentOnly) {
      out = out.filter((r: any) => {
        const iso = r.recordDate ?? r.date ?? r.createdAt;
        if (!iso) return false;
        const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
        return days <= 30;
      });
    }
    return out;
  }, [records, timeFilter, recentOnly]);

  const filteredRecords = useMemo(() => {
    let out = timeFilteredRecords;
    if (kinds.length > 0) {
      const set = new Set(kinds);
      out = out.filter((r: any) => set.has((r.kind ?? r.recordType) as RecordKind));
    }

    // Client-side local query search filter (instant response)
    if (query.trim().length > 0) {
      const q = query.toLowerCase().trim();
      out = out.filter((r: any) => {
        const title = (r.title ?? "").toLowerCase();
        const provider = (r.provider ?? r.doctor ?? "").toLowerCase();
        const diagnosis = (r.diagnosis ?? "").toLowerCase();
        const facility = (r.facility ?? r.hospital ?? "").toLowerCase();
        const summary = (r.summary ?? "").toLowerCase();
        return (
          title.includes(q) ||
          provider.includes(q) ||
          diagnosis.includes(q) ||
          facility.includes(q) ||
          summary.includes(q)
        );
      });
    }

    // Arrange according to date created (newest first or oldest first)
    const sorted = [...out].sort((a, b) => {
      const getVal = (item: any) => {
        const d = item.recordDate ?? item.date ?? item.createdAt;
        if (!d) return 0;
        const time = new Date(d).getTime();
        return Number.isNaN(time) ? 0 : time;
      };
      if (sortOrder === "newest") {
        return getVal(b) - getVal(a);
      } else {
        return getVal(a) - getVal(b);
      }
    });
    return sorted;
  }, [timeFilteredRecords, kinds, query, sortOrder]);

  // Pull-to-refresh (1:1).
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([refetchRecords()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchRecords]);

  // Subtitle = age + blood group (1:1, just lifted into the hero layout).
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (ageYears != null) parts.push(t("recordsHub.hero.ageYears", { n: ageYears }));
    if (patient?.bloodGroup) {
      parts.push(t("recordsHub.hero.bloodGroup", { value: patient.bloodGroup }));
    }
    return parts.join(" · ");
  }, [ageYears, patient?.bloodGroup, t]);

  const isInitialLoading = profileLoading && recordsLoading;
  void timeline;
  void auditData;

  // Folder helpers removed — category pills + time segments own filtering now.

  const clearFilters = useCallback(() => {
    setKinds([]);
    setRecentOnly(false);
  }, []);

  const handleRevokeConsent = useCallback(
    (consent: any) => {
      Alert.alert(
        t("recordsHub.sharing.revokeTitle"),
        t("recordsHub.sharing.revokeBody", {
          label:
            consent.label ||
            consent.purpose ||
            t("recordsHub.sharing.fallbackLabel"),
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("recordsHub.sharing.revoke"),
            style: "destructive",
            onPress: async () => {
              try {
                await revokeConsent.mutateAsync(consent.id);
                toast.show(t("recordsHub.sharing.revoked"), { tone: "success" });
              } catch (err) {
                toast.show(
                  `${t("recordsHub.sharing.revokeFailed")}: ${(err as Error).message}`,
                  { tone: "danger" },
                );
              }
            },
          },
        ],
      );
    },
    [revokeConsent, toast, t],
  );

  return (
    <Screen padded={false} tabBarOffset={false} bottomInset={false} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ─── Header Bar w/ Title and Actions ─────────────────── */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <AppText
            style={{
              fontSize: 24,
              fontWeight: "900",
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            Records
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              onPress={() => setShareOpen(true)}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "rgba(0,0,0,0.02)",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 4,
                elevation: 1,
              })}
            >
              <Share2 size={18} color={colors.primary} strokeWidth={2.25} />
            </Pressable>
            <Pressable
              onPress={() => setDsarOpen(true)}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "rgba(0,0,0,0.02)",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 4,
                elevation: 1,
              })}
            >
              <Download size={18} color={colors.primary} strokeWidth={2.25} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/add-record")}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "rgba(0,0,0,0.02)",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 4,
                elevation: 1,
              })}
            >
              <Plus size={20} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>


        {/* ─── Premium hero (gradient + glass mini-stats) ──────────────── */}
        {isInitialLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Skeleton height={28} width="60%" radius={8} />
            <Skeleton height={56} width="40%" radius={12} />
            <Skeleton height={120} width="100%" radius={24} />
          </View>
        ) : (
          <PremiumHero
            eyebrow={t("recordsHub.hero.eyebrow")}
            total={totalRecords}
            recentCount={recentCount}
            activeConsents={activeConsents}
            encryptedLabel="Synced"
            lastActivityLabel={
              lastActivity
                ? fmtRelative(lastActivity, locale)
                : null
            }
            patientName={patientName}
            subtitle={subtitle || patientName}
            avatarName={patientName}
            onAddRecord={() => router.push("/(app)/add-record" as any)}
            onScan={() => router.push("/(app)/add-record" as any)}
            onShare={() => router.push("/(app)/share" as any)}
          />
        )}

        {/* ─── Tabs + list controls ─────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.lg,
            gap: spacing.md,
          }}
        >
          <SlidingTabs tab={tab} onChange={setTab} />

          {tab === "all" ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                gap: spacing.md,
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.04,
                shadowRadius: 16,
                elevation: 2,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.sm,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <AppText
                    style={{
                      fontSize: 17,
                      fontWeight: "800",
                      color: colors.text,
                      fontFamily: fontFamily.bodyBold,
                      letterSpacing: -0.2,
                    }}
                  >
                    Your records
                  </AppText>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: colors.primarySoft,
                    }}
                  >
                    <AppText
                      style={{
                        fontSize: 11.5,
                        fontWeight: "800",
                        color: colors.primary,
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
                      {filteredRecords.length}
                    </AppText>
                  </View>
                </View>

                <Pressable
                  onPress={() =>
                    setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    sortOrder === "newest" ? "Sort oldest first" : "Sort newest first"
                  }
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: pressed ? colors.surfaceMuted : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <ChevronsUpDown size={13} color={colors.primary} strokeWidth={2.5} />
                  <AppText
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.primary,
                      fontFamily: fontFamily.bodyBold,
                    }}
                  >
                    {sortOrder === "newest" ? "Newest" : "Oldest"}
                  </AppText>
                </Pressable>
              </View>

              <PremiumSearchBar
                value={query}
                onChangeText={setQuery}
                placeholder="Search records, labs, images..."
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
              >
                {(() => {
                  const categories = [
                    {
                      label: "All",
                      count: timeFilteredRecords.length,
                      key: "all",
                      kinds: [] as RecordKind[],
                      tint: colors.primary,
                      soft: colors.primarySoft,
                    },
                    {
                      label: "Lab",
                      count: timeFilteredRecords.filter(
                        (r) => (r.kind ?? r.recordType) === "lab_report",
                      ).length,
                      key: "lab",
                      kinds: ["lab_report"] as RecordKind[],
                      tint: "#D97706",
                      soft: "#FEF3C7",
                    },
                    {
                      label: "Rx",
                      count: timeFilteredRecords.filter(
                        (r) => (r.kind ?? r.recordType) === "prescription",
                      ).length,
                      key: "rx",
                      kinds: ["prescription"] as RecordKind[],
                      tint: "#7C3AED",
                      soft: "#F3E8FF",
                    },
                    {
                      label: "Imaging",
                      count: timeFilteredRecords.filter(
                        (r) => (r.kind ?? r.recordType) === "imaging",
                      ).length,
                      key: "imaging",
                      kinds: ["imaging"] as RecordKind[],
                      tint: "#4F46E5",
                      soft: "#E0E7FF",
                    },
                    {
                      label: "Vaccines",
                      count: timeFilteredRecords.filter(
                        (r) => (r.kind ?? r.recordType) === "vaccination",
                      ).length,
                      key: "vaccines",
                      kinds: ["vaccination"] as RecordKind[],
                      tint: "#0D9488",
                      soft: "#CCFBF1",
                    },
                    {
                      label: "Allergy",
                      count: timeFilteredRecords.filter(
                        (r) => (r.kind ?? r.recordType) === "allergy",
                      ).length,
                      key: "allergy",
                      kinds: ["allergy"] as RecordKind[],
                      tint: "#DC2626",
                      soft: "#FEE2E2",
                    },
                  ];

                  return categories.map((cat) => {
                    const isActive =
                      cat.key === "all"
                        ? kinds.length === 0 && !recentOnly
                        : kinds.length === 1 && kinds[0] === cat.kinds[0] && !recentOnly;
                    return (
                      <Pressable
                        key={cat.key}
                        onPress={() => {
                          setRecentOnly(false);
                          setKinds(cat.kinds);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        style={({ pressed }) => ({
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: isActive ? "transparent" : colors.border,
                          backgroundColor: isActive
                            ? cat.tint
                            : pressed
                              ? cat.soft
                              : colors.surfaceMuted,
                          flexDirection: "row",
                          alignItems: "center",
                          minHeight: 36,
                        })}
                      >
                        <AppText
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: isActive ? "#FFFFFF" : colors.text,
                            fontFamily: fontFamily.bodyBold,
                          }}
                        >
                          {cat.label}
                        </AppText>
                        <AppText
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: isActive
                              ? "rgba(255,255,255,0.8)"
                              : colors.textMuted,
                            marginLeft: 5,
                            fontFamily: fontFamily.bodyBold,
                          }}
                        >
                          {cat.count}
                        </AppText>
                      </Pressable>
                    );
                  });
                })()}
              </ScrollView>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 12,
                  padding: 3,
                  gap: 2,
                }}
              >
                {[
                  { label: "All time", key: "all" },
                  { label: "Year", key: "year" },
                  { label: "30 days", key: "30days" },
                ].map((opt) => {
                  const isActive = timeFilter === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setTimeFilter(opt.key as any)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        alignItems: "center",
                        backgroundColor: isActive
                          ? colors.surface
                          : pressed
                            ? "rgba(255,255,255,0.5)"
                            : "transparent",
                        borderWidth: isActive ? 1 : 0,
                        borderColor: isActive ? colors.border : "transparent",
                      })}
                    >
                      <AppText
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? "800" : "600",
                          color: isActive ? colors.text : colors.textMuted,
                          fontFamily: isActive
                            ? fontFamily.bodyBold
                            : fontFamily.bodySemibold,
                        }}
                      >
                        {opt.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              {(kinds.length > 0 || recentOnly || timeFilter !== "all" || query.trim()) ? (
                <Pressable
                  onPress={() => {
                    clearFilters();
                    setTimeFilter("all");
                    setQuery("");
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Clear filters"
                  style={{ alignSelf: "flex-start" }}
                >
                  <AppText
                    style={{
                      fontSize: 12.5,
                      fontWeight: "700",
                      color: colors.primary,
                      fontFamily: fontFamily.bodyBold,
                    }}
                  >
                    Clear filters
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* ─── Tab content ─────────────────────────────────────────────── */}
        {tab === "all" ? (
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            {/* List */}
            {recordsLoading ? (
              <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.sm }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    height={84}
                    radius={20}
                    style={{ marginBottom: 4 }}
                  />
                ))}
              </View>
            ) : recordsErrored ? (
              <ErrorState
                style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}
                title={t("common.errorTitle")}
                message={t("common.errorLoad")}
                actionLabel={t("common.retry")}
                onAction={() => refetchRecords()}
              />
            ) : filteredRecords.length === 0 ? (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  marginTop: spacing.md,
                }}
              >
                <PremiumRecordsEmpty
                  filtered={kinds.length > 0 || recentOnly || timeFilter !== "all"}
                  onAdd={() => router.push("/add-record")}
                  onClearFilters={() => {
                    clearFilters();
                    setTimeFilter("all");
                  }}
                />
              </View>
            ) : (
              <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
                {(() => {
                  // Group records by Month Year (e.g. "OCTOBER 2023")
                  const grouped: { monthYear: string; data: any[] }[] = [];
                  filteredRecords.forEach((record) => {
                    const d = record.recordDate ?? record.date ?? record.createdAt;
                    if (!d) return;
                    const dateObj = new Date(d);
                    if (Number.isNaN(dateObj.getTime())) return;
                    
                    const monthYear = dateObj.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    }).toUpperCase();
                    
                    let group = grouped.find((g) => g.monthYear === monthYear);
                    if (!group) {
                      group = { monthYear, data: [] };
                      grouped.push(group);
                    }
                    group.data.push(record);
                  });

                  return grouped.map((group) => (
                    <View key={group.monthYear} style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                      {/* Month Header */}
                      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: 4 }}>
                        <AppText
                          style={{
                            fontSize: 13,
                            fontWeight: "800",
                            color: colors.textSubtle,
                            fontFamily: fontFamily.bodyBold,
                            letterSpacing: 0.5,
                          }}
                        >
                          {group.monthYear}
                        </AppText>
                      </View>
                      {/* Cards list */}
                      <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
                        {group.data.map((item) => (
                          <RecordCard
                            key={item.id}
                            item={item}
                            locale={locale}
                            selectionMode={selectionMode}
                            selectedIds={selectedIds}
                            onToggleSelected={(id) => {
                              setSelectedIds((prev) =>
                                prev.includes(id)
                                  ? prev.filter((x) => x !== id)
                                  : [...prev, id]
                              );
                            }}
                            onEnterSelectionMode={() => setSelectionMode(true)}
                          />
                        ))}
                      </View>
                    </View>
                  ));
                })()}
              </View>
            )}
          </View>
        ) : null}

        {tab === "timeline" ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <TimelineShell
              loading={recordsLoading}
              hasData={(timeline as any)?.events?.length > 0}
            >
              <RecordTimeline />
            </TimelineShell>
          </View>
        ) : null}

        {tab === "sharing" ? (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              marginTop: spacing.md,
              gap: spacing.md,
            }}
          >
            <ConsentsList
              items={(consentsMine?.items ?? []) as any[]}
              loading={false}
              onRevoke={handleRevokeConsent}
            />
            <AuditFeed />
          </View>
        ) : null}

        {/* Bottom safe area */}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>



      {/* ─── Sheets (1:1) ───────────────────────────────────────────── */}
      <ShareModeSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        recordIds={selectionMode ? selectedIds : undefined}
      />
      <DsarRequestSheet open={dsarOpen} onClose={() => setDsarOpen(false)} />
      {/* Tier 1 records: share-pack sheet (multi-record bundle). */}
      <SharePackSheet
        open={packOpen}
        onClose={() => {
          setPackOpen(false);
          setSelectionMode(false);
          setSelectedIds([]);
        }}
        defaultRecordIds={selectedIds}
      />

      {/* Tier 1 records: selection action bar. Shown only when
          selectionMode is on; replaces the regular FAB row so the
          "Share (N)" CTA is unmissable. */}
      {selectionMode && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.primary,
            paddingVertical: 14,
            paddingHorizontal: 20,
            gap: 12,
          }}
        >
          <Pressable onPress={() => { setSelectionMode(false); setSelectedIds([]); }}>
            <AppText variant="body.sm" weight="700" style={{ color: "#fff" }}>
              Cancel
            </AppText>
          </Pressable>
          <AppText variant="body.sm" weight="700" style={{ color: "#fff" }}>
            {selectedIds.length} selected
          </AppText>
          <Pressable
            onPress={() => setPackOpen(true)}
            disabled={selectedIds.length === 0}
          >
            <AppText
              variant="body.sm"
              weight="700"
              style={{
                color: selectedIds.length > 0 ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              Share pack →
            </AppText>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Premium hero — multi-stop gradient with radial depth, decorative orbs,
// subtle pattern, glass stats strip and quick-action row. Mirrors the hero
// pattern used on home, medicines, profile, family, appointments so the
// user lands on a familiar affordance.
// ---------------------------------------------------------------------------
function PremiumHero({
  eyebrow,
  total,
  recentCount,
  activeConsents,
  encryptedLabel,
  lastActivityLabel,
  patientName,
  subtitle,
  avatarName,
  onAddRecord,
  onScan,
  onShare,
}: {
  eyebrow: string;
  total: number;
  recentCount?: number;
  activeConsents: number;
  encryptedLabel: string;
  lastActivityLabel: string | null;
  patientName: string;
  subtitle: string;
  avatarName: string;
  onAddRecord?: () => void;
  onScan?: () => void;
  onShare?: () => void;
}) {
  const { t } = useTranslation();
  const {
    colors,
    spacing,
    typography,
    radius,
    shadow: themeShadow,
    fontFamily,
  } = useTheme();
  void typography;
  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        borderRadius: radius.xxxl,
        overflow: "hidden",
        ...themeShadow.hero,
      }}
    >
      {/* Multi-stop base gradient — rich deep navy → electric cyan → medical teal */}
      <LinearGradient
        colors={["#0A2540", "#0C4A6E", "#0284C7", "#0D9488"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft radial highlight — top-left */}
      <View
        style={{
          position: "absolute",
          top: -100,
          left: -80,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: "rgba(56, 189, 248, 0.28)",
        }}
      />
      {/* Ambient teal orb — top-right */}
      <View
        style={{
          position: "absolute",
          top: -40,
          right: -50,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: "rgba(45, 212, 191, 0.22)",
        }}
      />
      {/* Soft emerald orb — bottom-right */}
      <View
        style={{
          position: "absolute",
          bottom: -90,
          right: -60,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: "rgba(13, 148, 136, 0.25)",
        }}
      />
      {/* Subtle dotted pattern overlay */}
      <View
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.30,
        }}
        pointerEvents="none"
      >
        {Array.from({ length: 12 }).map((_, row) =>
          Array.from({ length: 6 }).map((_, col) => (
            <View
              key={`${row}-${col}`}
              style={{
                position: "absolute",
                top: 18 + row * 22,
                left: 12 + col * 22,
                width: 1.5,
                height: 1.5,
                borderRadius: 1,
                backgroundColor: "rgba(255,255,255,0.22)",
              }}
            />
          ))
        )}
      </View>
      {/* White sheen at top edge */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1.5,
          backgroundColor: "rgba(255,255,255,0.35)",
        }}
      />

      <View
        style={{
          paddingHorizontal: spacing.lg + 2,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md + 4,
        }}
      >
        {/* Top row — identity + avatar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, marginRight: spacing.md }}>
            {/* Eyebrow with live green pulse dot */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: "#34D399",
                  shadowColor: "#34D399",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              />
              <TextMuted
                color="rgba(255,255,255,0.85)"
                size={11}
                weight="800"
                letterSpacing={1.4}
                fontFamily={fontFamily.bodyBold}
                style={{ textTransform: "uppercase" }}
              >
                {eyebrow}
              </TextMuted>
            </View>
            <TextMuted
              color="#FFFFFF"
              size={25}
              weight="900"
              fontFamily={fontFamily.bodyBold}
              style={{ marginTop: 4, letterSpacing: -0.6 }}
              numberOfLines={1}
            >
              {patientName}
            </TextMuted>
            {subtitle ? (
              <TextMuted
                color="rgba(255,255,255,0.82)"
                size={13}
                weight="600"
                fontFamily={fontFamily.bodySemibold}
                numberOfLines={1}
                style={{ marginTop: 2 }}
              >
                {subtitle}
              </TextMuted>
            ) : null}
          </View>

          {/* Avatar with matching cyan-emerald gradient ring + soft glow */}
          <View
            style={{
              shadowColor: "#38BDF8",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <View
              style={{
                padding: 2.5,
                borderRadius: 999,
                backgroundColor: "transparent",
              }}
            >
              <LinearGradient
                colors={["#38BDF8", "#34D399", "#2DD4BF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                }}
              />
              <View
                style={{
                  padding: 2,
                  borderRadius: 999,
                  backgroundColor: "#0A2540",
                }}
              >
                <Avatar name={avatarName} size="lg" />
              </View>
            </View>
          </View>
        </View>

        {/* Glass stats strip — perfectly balanced 3-column layout */}
        <View
          style={{
            marginTop: spacing.lg - 2,
            borderRadius: 18,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.22)",
            backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(255,255,255,0.12)",
          }}
        >
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={35}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View
            style={{
              flexDirection: "row",
              paddingVertical: 14,
              paddingHorizontal: 4,
              alignItems: "center",
            }}
          >
            {/* Stat 1: total records */}
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingHorizontal: 4,
                borderRightWidth: 1,
                borderColor: "rgba(255,255,255,0.16)",
              }}
            >
              <View style={{ height: 24, justifyContent: "center" }}>
                <TextMuted
                  color="#FFFFFF"
                  size={21}
                  weight="800"
                  fontFamily={fontFamily.heavy}
                  letterSpacing={-0.5}
                  numberOfLines={1}
                >
                  {fmtCount(total)}
                </TextMuted>
              </View>
              <TextMuted
                color="rgba(255,255,255,0.75)"
                size={9.5}
                weight="700"
                letterSpacing={0.6}
                fontFamily={fontFamily.bodyBold}
                style={{ textTransform: "uppercase" }}
              >
                {t("recordsHub.hero.total")}
              </TextMuted>
            </View>

            {/* Stat 2: this week */}
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingHorizontal: 4,
                borderRightWidth: 1,
                borderColor: "rgba(255,255,255,0.16)",
              }}
            >
              <View
                style={{
                  height: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}
              >
                <TrendingUp
                  size={14}
                  color="#34D399"
                  strokeWidth={2.5}
                />
                <TextMuted
                  color="#FFFFFF"
                  size={21}
                  weight="800"
                  fontFamily={fontFamily.heavy}
                  letterSpacing={-0.5}
                  numberOfLines={1}
                >
                  +{recentCount ?? 0}
                </TextMuted>
              </View>
              <TextMuted
                color="rgba(255,255,255,0.75)"
                size={9.5}
                weight="700"
                letterSpacing={0.6}
                fontFamily={fontFamily.bodyBold}
                style={{ textTransform: "uppercase" }}
              >
                This week
              </TextMuted>
            </View>

            {/* Stat 3: encrypted / synced with 100% indicator */}
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingHorizontal: 4,
              }}
            >
              <View
                style={{
                  height: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <ShieldCheck size={16} color="#34D399" strokeWidth={2.5} />
                <TextMuted
                  color="#FFFFFF"
                  size={21}
                  weight="800"
                  fontFamily={fontFamily.heavy}
                  letterSpacing={-0.5}
                  numberOfLines={1}
                >
                  100%
                </TextMuted>
              </View>
              <TextMuted
                color="rgba(255,255,255,0.75)"
                size={9.5}
                weight="700"
                letterSpacing={0.6}
                fontFamily={fontFamily.bodyBold}
                style={{ textTransform: "uppercase" }}
              >
                {encryptedLabel}
              </TextMuted>
            </View>
          </View>
        </View>

        {/* Quick action row — unified button height and crisp styling */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: spacing.md,
          }}
        >
          {onAddRecord ? (
            <Pressable
              onPress={onAddRecord}
              accessibilityRole="button"
              accessibilityLabel={t("recordsHub.hero.addCta", "Add record")}
              style={({ pressed }) => ({
                flex: 1,
                height: 42,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: pressed
                  ? "rgba(255,255,255,0.92)"
                  : "#FFFFFF",
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: pressed ? 0.20 : 0.12,
                shadowRadius: 8,
                elevation: 3,
              })}
            >
              <Plus size={15} color="#0C4A6E" strokeWidth={2.5} />
              <TextMuted
                color="#0C4A6E"
                size={13}
                weight="800"
                fontFamily={fontFamily.bodyBold}
                letterSpacing={-0.1}
              >
                Add record
              </TextMuted>
            </Pressable>
          ) : null}
          {onScan ? (
            <Pressable
              onPress={onScan}
              accessibilityRole="button"
              accessibilityLabel={t("recordsHub.hero.scanCta", "Scan")}
              style={({ pressed }) => ({
                flex: 1,
                height: 42,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: pressed
                  ? "rgba(255,255,255,0.28)"
                  : "rgba(255,255,255,0.18)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.32)",
              })}
            >
              <ScanLine size={15} color="#FFFFFF" strokeWidth={2.5} />
              <TextMuted
                color="#FFFFFF"
                size={13}
                weight="800"
                fontFamily={fontFamily.bodyBold}
                letterSpacing={-0.1}
              >
                Scan
              </TextMuted>
            </Pressable>
          ) : null}
          {onShare ? (
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel={t("recordsHub.hero.shareCta", "Share")}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                backgroundColor: pressed
                  ? "rgba(255,255,255,0.28)"
                  : "rgba(255,255,255,0.18)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.32)",
              })}
            >
              <Share2 size={16} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero mini-stat — translucent column inside the glass strip. The icon tile
// is gradient-filled; on iOS it sits over the BlurView, on Android it sits
// over the rgba backdrop.
// ---------------------------------------------------------------------------
function HeroMiniStat({
  icon: Icon,
  label,
  value,
  accent,
  isLast,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  accent: string;
  isLast: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRightWidth: isLast ? 0 : 1,
        borderColor: "rgba(255,255,255,0.16)",
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0.12)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Icon size={14} color="#FFFFFF" strokeWidth={2.25} />
      </View>
      <View style={{ alignItems: "center" }}>
        {value != null ? (
          <TextMuted
            color="#FFFFFF"
            size={13.5}
            weight="800"
            numberOfLines={1}
            style={{ textAlign: "center" }}
          >
            {value}
          </TextMuted>
        ) : null}
        <TextMuted
          color="rgba(255,255,255,0.78)"
          size={9.5}
          weight="600"
          numberOfLines={1}
          style={{ letterSpacing: 0.1, textAlign: "center" }}
        >
          {label}
        </TextMuted>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Quick action — gradient icon tile + label, glow shadow on press.
// ---------------------------------------------------------------------------
function PremiumQuickAction({
  kind,
  icon: Icon,
  label,
  onPress,
}: {
  kind: "share" | "export" | "add";
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const {
    colors,
    spacing,
    radius,
    typography,
    fontFamily,
    shadow: themeShadow,
  } = useTheme();
  void typography;
  void themeShadow;
  const v = QUICK_VISUAL[kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: radius.xl,
        backgroundColor: pressed ? v.soft : colors.surface,
        borderWidth: 1,
        borderColor: pressed ? v.ring[1] : colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: 6,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: pressed ? v.glow : "transparent",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: pressed ? 0.6 : 0,
        shadowRadius: 14,
        elevation: pressed ? 6 : 0,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {({ pressed }) => (
        <>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: v.glow,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.6,
              shadowRadius: 14,
              elevation: 4,
            }}
          >
            <LinearGradient
              colors={v.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Icon size={14} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <TextMuted
            color={pressed ? v.text : colors.text}
            size={12.5}
            weight="800"
            fontFamily={fontFamily.bodyBold}
            style={{ marginTop: 8, letterSpacing: 0.1 }}
            numberOfLines={1}
          >
            {label}
          </TextMuted>
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Smart-folder tile — kind-graded gradient icon + soft background + count
// + active-state ring when this folder is selected.
// ---------------------------------------------------------------------------
function SmartFolderTile({
  icon: Icon,
  label,
  count,
  visual,
  isActive,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  visual: KindVisual;
  isActive?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontFamily } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${count}`}
      accessibilityState={{ selected: !!isActive }}
      style={[
        {
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: 4,
          borderRadius: 14,
          backgroundColor: isActive ? visual.soft : colors.surface,
          borderWidth: isActive ? 1.5 : 1,
          borderColor: isActive ? visual.text : colors.border,
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
        },
      ]}
    >
      {isActive ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: visual.text,
          }}
        />
      ) : null}

      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: visual.glow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isActive ? 0.6 : 0.45,
          shadowRadius: isActive ? 6 : 4,
          elevation: isActive ? 3 : 2,
        }}
      >
        <LinearGradient
          colors={visual.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Icon size={12} color="#FFFFFF" strokeWidth={2.5} />
      </View>

      <TextMuted
        color={colors.text}
        size={9.5}
        weight="800"
        fontFamily={fontFamily.bodyBold}
        style={{ marginTop: 6, textAlign: "center" }}
        numberOfLines={2}
      >
        {label}
      </TextMuted>

      <View
        style={{
          marginTop: 4,
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: 8,
          backgroundColor: isActive ? "#FFFFFF" : colors.surfaceMuted,
        }}
      >
        <TextMuted
          color={isActive ? visual.text : colors.textMuted}
          size={9.5}
          weight="800"
          fontFamily={fontFamily.bodyBold}
        >
          {fmtCount(count)}
        </TextMuted>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Sliding segmented control — replaces the older flat chip row. Active tab
// gets the gradient fill + glow; inactive sits on the muted track.
// ---------------------------------------------------------------------------
function SlidingTabs({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  const { t } = useTranslation();
  const { colors, fontFamily } = useTheme();
  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: t("recordsHub.tabs.all") },
    { value: "timeline", label: t("recordsHub.tabs.timeline") },
    { value: "sharing", label: t("recordsHub.tabs.sharing") },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
        width: "100%",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 1,
      }}
    >
      {tabs.map((tt) => {
        const active = tt.value === tab;
        return (
          <Pressable
            key={tt.value}
            onPress={() => onChange(tt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tt.label}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              opacity: pressed && !active ? 0.7 : 1,
            })}
          >
            {active ? (
              <LinearGradient
                colors={["#38BDF8", "#0C8B8C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <TextMuted
              color={active ? "#FFFFFF" : colors.textMuted}
              size={13}
              weight="800"
              fontFamily={active ? fontFamily.bodyBold : fontFamily.bodySemibold}
              style={{ letterSpacing: 0.15 }}
            >
              {tt.label}
            </TextMuted>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Premium search bar — glass-tinted surface, leading search icon, trailing
// clear-button.
// ---------------------------------------------------------------------------
function PremiumSearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const { colors, spacing, fontFamily } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: 2,
        borderRadius: 14,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 44,
      }}
    >
      <Search size={16} color={colors.textMuted} strokeWidth={2.25} />
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          flex: 1,
          fontSize: 14,
          color: colors.text,
          fontFamily: fontFamily.body,
          paddingVertical: 10,
          paddingHorizontal: 4,
        }}
        placeholderTextColor={colors.textMuted}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <X size={12} color={colors.textMuted} strokeWidth={2.5} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Record card — left color accent strip + gradient icon tile w/ glow +
// title row + chip row (date / files) + attachments hint. Same onPress
// pushes to the record detail route.
// ---------------------------------------------------------------------------
function RecordCard({
  item,
  locale,
  selectionMode,
  selectedIds,
  onToggleSelected,
  onEnterSelectionMode,
}: {
  item: any;
  locale: string;
  selectionMode?: boolean;
  selectedIds?: string[];
  onToggleSelected?: (id: string) => void;
  onEnterSelectionMode?: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    colors,
    spacing,
    radius,
    typography,
    fontFamily,
    shadow: themeShadow,
  } = useTheme();
  void radius;
  void typography;
  const kind = (item.kind ?? item.recordType) as RecordKind;
  const def = RECORD_REGISTRY[kind];
  const Icon = kindIcon(kind);

  // Custom visual settings matching the screenshot's color themes
  const customVisual = (() => {
    switch (kind) {
      case "lab_report":
        return { bg: "#FEF3C7", fg: "#D97706", tag: "LAB" };
      case "prescription":
        return { bg: "#F3E8FF", fg: "#9333EA", tag: "RX" };
      case "imaging":
        return { bg: "#E0E7FF", fg: "#4F46E5", tag: "IMAGING" };
      case "vaccination":
        return { bg: "#CCFBF1", fg: "#0D9488", tag: "VACCINE" };
      default:
        return { bg: "#E2E8F0", fg: "#475569", tag: (kind || "").toUpperCase().replace(/_/g, " ") };
    }
  })();

  const formatCardDate = (isoStr: string) => {
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return "";
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const dateText = formatCardDate(item.recordDate ?? item.date ?? item.createdAt);
  const titleText = item.title ?? t("recordsHub.row.fallbackTitle");

  // Determine subtitle
  const subtitleText = (() => {
    if (kind === "prescription") {
      return item.notes ?? item.summary ?? item.diagnosis ?? "";
    }
    const parts = [];
    if (item.doctor ?? item.provider) parts.push(item.doctor ?? item.provider);
    if (item.facility ?? item.hospital) parts.push(item.facility ?? item.hospital);
    if (parts.length > 0) return parts.join(" • ");
    return item.diagnosis ?? item.summary ?? "";
  })();

  const fileCount = item.fileCount ?? item.files?.length ?? 0;

  return (
    <Pressable
      onPress={() => {
        // Tier 1 records: share-pack. Long-press enters selection mode;
        // subsequent taps toggle membership instead of opening detail.
        if (selectionMode) {
          onToggleSelected?.(item.id);
        } else {
          router.push(`/record-detail?id=${item.id}`);
        }
      }}
      onLongPress={() => {
        if (!selectionMode) onEnterSelectionMode?.();
        onToggleSelected?.(item.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={titleText}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.md + 2,
        flexDirection: "row",
        alignItems: "center",
        opacity: pressed ? 0.9 : 1,
        shadowColor: "rgba(0, 0, 0, 0.03)",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      {/* Circle Icon Badge */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: customVisual.bg,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        }}
      >
        <Icon size={20} color={customVisual.fg} strokeWidth={2.25} />
      </View>

      {/* Card Content */}
      <View style={{ flex: 1, gap: 3 }}>
        {/* Top Meta Row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.textMuted,
              fontFamily: fontFamily.bodyMedium,
            }}
          >
            {dateText}
          </AppText>
          <AppText
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: customVisual.fg,
              fontFamily: fontFamily.bodyBold,
              letterSpacing: 0.5,
            }}
          >
            {customVisual.tag}
          </AppText>
        </View>

        {/* Title */}
        <AppText
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: colors.text,
            fontFamily: fontFamily.bodyBold,
            marginTop: 2,
          }}
          numberOfLines={2}
        >
          {titleText}
        </AppText>

        {/* Subtitle */}
        {subtitleText ? (
          <AppText
            style={{
              fontSize: 13,
              fontWeight: "500",
              color: colors.textMuted,
              fontFamily: fontFamily.body,
              marginTop: 1,
            }}
            numberOfLines={2}
          >
            {subtitleText}
          </AppText>
        ) : null}

        {/* PDF Link Action (Card 1 visual) */}
        {fileCount > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 6,
            }}
          >
            <FileText size={13} color="#4F46E5" strokeWidth={2.25} />
            <AppText
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: "#4F46E5",
                fontFamily: fontFamily.bodyBold,
                textDecorationLine: "underline",
              }}
            >
              View Results (PDF)
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Premium empty state — gradient orbs, glowing icon tile, gradient CTA.
// Two modes: "library is empty" (primary add action) and "no matches"
// (clear-filters action).
// ---------------------------------------------------------------------------
function PremiumRecordsEmpty({
  filtered,
  onAdd,
  onClearFilters,
}: {
  filtered: boolean;
  onAdd: () => void;
  onClearFilters?: () => void;
}) {
  const { t } = useTranslation();
  const {
    colors,
    spacing,
    typography,
    radius,
    shadow: themeShadow,
    fontFamily,
  } = useTheme();
  void radius;
  const title = filtered
    ? t("recordsHub.empty.filteredTitle")
    : t("recordsHub.empty.title");
  const body = filtered
    ? t("recordsHub.empty.filteredBody")
    : t("recordsHub.empty.body");
  const primaryLabel = filtered
    ? t("recordsHub.smartFolders.seeAll")
    : t("recordsHub.empty.action");

  return (
    <View
      style={{
        borderRadius: 28,
        padding: 32,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        overflow: "hidden",
        position: "relative",
        ...themeShadow.md,
      }}
    >
      {/* Subtle background orbs */}
      <View
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: colors.primarySoft,
          opacity: 0.45,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -30,
          left: -30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: colors.accentSoft,
          opacity: 0.4,
        }}
      />

      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          shadowColor: "#0EA5E9",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 18,
          elevation: 6,
          marginBottom: 16,
        }}
      >
        <LinearGradient
          colors={["#38BDF8", "#0284C7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {filtered ? (
          <Sparkles size={32} color="#FFFFFF" strokeWidth={2} />
        ) : (
          <FolderOpen size={32} color="#FFFFFF" strokeWidth={2} />
        )}
      </View>

      <TextMuted
        color={colors.text}
        size={17}
        weight="800"
        fontFamily={fontFamily.bodyBold}
        style={{ textAlign: "center", letterSpacing: -0.2 }}
      >
        {title}
      </TextMuted>
      <TextMuted
        color={colors.textMuted}
        size={13}
        weight="500"
        style={{
          textAlign: "center",
          marginTop: 6,
          paddingHorizontal: 12,
          lineHeight: 20,
        }}
      >
        {body}
      </TextMuted>
      <View style={{ marginTop: 20, flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={filtered && onClearFilters ? onClearFilters : onAdd}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          style={({ pressed }) => ({
            borderRadius: 14,
            overflow: "hidden",
            shadowColor: "#0EA5E9",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 4,
          })}
        >
          {({ pressed }) => (
            <LinearGradient
              colors={["#38BDF8", "#0C8B8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 22,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                opacity: pressed ? 0.9 : 1,
              }}
            >
              {filtered ? (
                <X size={16} color="#FFFFFF" strokeWidth={3} />
              ) : (
                <Plus size={16} color="#FFFFFF" strokeWidth={3} />
              )}
              <TextMuted
                color="#FFFFFF"
                size={14}
                weight="800"
                fontFamily={fontFamily.bodyBold}
              >
                {primaryLabel}
              </TextMuted>
            </LinearGradient>
          )}
        </Pressable>
        {!filtered ? (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={t("recordsHub.quickActions.import")}
            style={({ pressed }) => ({
              borderRadius: 14,
              paddingHorizontal: 18,
              paddingVertical: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <TextMuted
              color={colors.text}
              size={14}
              weight="800"
              fontFamily={fontFamily.bodyBold}
            >
              {t("recordsHub.quickActions.import")}
            </TextMuted>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// TimelineShell — wraps <RecordTimeline /> in a loader + empty-state so the
// tab is meaningful even before the data lands.
// ---------------------------------------------------------------------------
function TimelineShell({
  loading,
  hasData,
  children,
}: {
  loading: boolean;
  hasData: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  if (loading) {
    return (
      <View style={{ padding: spacing.sm, gap: spacing.sm }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={70} radius={20} />
        ))}
      </View>
    );
  }
  if (!hasData) {
    return (
      <View style={{ paddingTop: spacing.md }}>
        <TimelineEmptyState />
      </View>
    );
  }
  return <>{children}</>;
}

function TimelineEmptyState() {
  const { t } = useTranslation();
  const { colors, spacing, fontFamily } = useTheme();
  return (
    <View
      style={{
        padding: 28,
        borderRadius: 24,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Activity size={28} color={colors.primary} strokeWidth={1.8} />
      </View>
      <TextMuted
        color={colors.text}
        size={16}
        weight="800"
        fontFamily={fontFamily.bodyBold}
        style={{ textAlign: "center" }}
      >
        {t("recordsHub.timeline.emptyTitle")}
      </TextMuted>
      <TextMuted
        color={colors.textMuted}
        size={13}
        weight="500"
        style={{ textAlign: "center", lineHeight: 20 }}
      >
        {t("recordsHub.timeline.emptyBody")}
      </TextMuted>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sharing header card — gradient count badge + Issue CTA.
// ---------------------------------------------------------------------------
function SharingHeaderCard({
  activeConsents,
  totalConsents,
  onIssue,
}: {
  activeConsents: number;
  totalConsents: number;
  onIssue: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, radius, fontFamily } = useTheme();
  return (
    <View
      style={{
        borderRadius: 22,
        padding: spacing.lg,
        backgroundColor: "#F0F9FF",
        borderWidth: 1,
        borderColor: "#BAE6FD",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <LinearGradient
        colors={["rgba(56,189,248,0.18)", "rgba(13,148,136,0.10)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <TextMuted
            color="#075985"
            size={11}
            weight="800"
            letterSpacing={1.4}
            style={{ textTransform: "uppercase" }}
            fontFamily={fontFamily.bodyBold}
          >
            {t("recordsHub.sharing.title")}
          </TextMuted>
          <TextMuted
            color="#0C4A6E"
            size={22}
            weight="800"
            style={{ marginTop: 4, letterSpacing: -0.5 }}
            fontFamily={fontFamily.heavy}
          >
            {t("recordsHub.sharing.activeN", { n: activeConsents })}
          </TextMuted>
          <TextMuted
            color="#0369A1"
            size={12.5}
            weight="500"
            style={{ marginTop: 2 }}
          >
            {t("recordsHub.sharing.totalN", { count: totalConsents })}
          </TextMuted>
        </View>
        <Pressable
          onPress={onIssue}
          accessibilityRole="button"
          accessibilityLabel={t("recordsHub.sharing.issueNew")}
          style={({ pressed }) => ({
            borderRadius: 14,
            overflow: "hidden",
            shadowColor: "#0284C7",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 4,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <LinearGradient
            colors={["#38BDF8", "#0C8B8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={14} color="#FFFFFF" strokeWidth={3} />
            <TextMuted
              color="#FFFFFF"
              size={13}
              weight="800"
              fontFamily={fontFamily.bodyBold}
            >
              {t("recordsHub.sharing.issueNew")}
            </TextMuted>
          </LinearGradient>
        </Pressable>
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: spacing.md,
        }}
      >
        <Pill tone="success" size="sm" icon={CheckCircle2}>
          {t("recordsHub.sharing.active")}
        </Pill>
        <Pill tone="info" size="sm" icon={ShieldCheck}>
          {t("recordsHub.sharing.encrypted")}
        </Pill>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Consents list — renders real active consents with a one-tap revoke.
// ---------------------------------------------------------------------------
function ConsentsList({
  items,
  loading,
  onRevoke,
}: {
  items: any[];
  loading: boolean;
  onRevoke: (c: any) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontFamily } = useTheme();
  if (loading) {
    return (
      <View style={{ padding: spacing.sm, gap: spacing.sm }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={72} radius={18} />
        ))}
      </View>
    );
  }
  if (!items.length) {
    return (
      <View
        style={{
          padding: 24,
          borderRadius: 22,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          gap: 6,
        }}
      >
        <ShieldAlert size={28} color={colors.textMuted} strokeWidth={1.7} />
        <TextMuted
          color={colors.text}
          size={15}
          weight="800"
          fontFamily={fontFamily.bodyBold}
          style={{ textAlign: "center" }}
        >
          {t("recordsHub.sharing.noConsentsTitle")}
        </TextMuted>
        <TextMuted
          color={colors.textMuted}
          size={12.5}
          weight="500"
          style={{ textAlign: "center", lineHeight: 18 }}
        >
          {t("recordsHub.sharing.noConsentsBody")}
        </TextMuted>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((c) => (
        <ConsentRow key={c.id} consent={c} onRevoke={onRevoke} />
      ))}
    </View>
  );
}

function ConsentRow({
  consent,
  onRevoke,
}: {
  consent: any;
  onRevoke: (c: any) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontFamily } = useTheme();
  void spacing;
  const purposeLabel =
    (consent.purpose && PURPOSE_REGISTRY[consent.purpose]?.labelKey?.split(".").pop()) ||
    consent.purpose ||
    t("recordsHub.sharing.fallbackLabel");
  const displayLabel = consent.label || purposeLabel;
  const isActive = consent.status === "active";
  const expiresAt = consent.expiresAt
    ? fmtDate(consent.expiresAt, "en")
    : null;
  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: isActive ? "#DCFCE7" : colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ShieldCheck
          size={18}
          color={isActive ? "#16A34A" : colors.textMuted}
          strokeWidth={2}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextMuted
          color={colors.text}
          size={14}
          weight="800"
          numberOfLines={1}
          fontFamily={fontFamily.bodyBold}
          style={{ letterSpacing: -0.1 }}
        >
          {displayLabel}
        </TextMuted>
        <TextMuted
          color={colors.textMuted}
          size={11.5}
          weight="500"
          numberOfLines={1}
          style={{ marginTop: 2 }}
        >
          {isActive
            ? t("recordsHub.sharing.activePurpose", { purpose: purposeLabel })
            : t("recordsHub.sharing.revokedPurpose", {
                purpose: purposeLabel,
                when: fmtRelative(consent.revokedAt ?? consent.updatedAt, "en"),
              })}
          {expiresAt
            ? t("recordsHub.sharing.expires", { when: expiresAt })
            : null}
        </TextMuted>
      </View>
      {isActive ? (
        <Pill tone="success" size="sm">
          {t("recordsHub.sharing.activeBadge")}
        </Pill>
      ) : (
        <Pill tone="neutral" size="sm">
          {t("recordsHub.sharing.revokedBadge")}
        </Pill>
      )}
      {isActive ? (
        <Pressable
          onPress={() => onRevoke(consent)}
          accessibilityRole="button"
          accessibilityLabel={t("recordsHub.sharing.revoke")}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: pressed ? "#FEE2E2" : colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Trash2 size={16} color="#DC2626" strokeWidth={2.25} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tiny text helper — drop-in style-aware `<Text>` wrapper so each style
// stays declarative inline without an explosion of StyleSheet entries.
// ---------------------------------------------------------------------------
function TextMuted({
  color,
  size,
  weight,
  letterSpacing,
  lineHeight,
  fontFamily,
  numberOfLines,
  style,
  children,
}: {
  color: string;
  size: number;
  weight?: "400" | "500" | "600" | "700" | "800";
  letterSpacing?: number;
  lineHeight?: number;
  fontFamily?: string;
  numberOfLines?: number;
  style?: any;
  children?: React.ReactNode;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color,
          fontSize: size,
          fontWeight: weight || "500",
          letterSpacing: letterSpacing ?? 0,
          lineHeight: lineHeight ?? size * 1.3,
          fontFamily,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// Touch categories in RECORD_CATEGORIES import keeps it alive for future use.
void RECORD_CATEGORIES;
void Activity;

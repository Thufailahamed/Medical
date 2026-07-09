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
  ShareConsentSheet,
  DsarRequestSheet,
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
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);

  // ─── Data (1:1 with previous version) ──────────────────────────────────
  const { data: profileData, isLoading: profileLoading } = usePatientProfile();
  const { data: stats } = useRecordStats();
  const { data: recordsData, isLoading: recordsLoading, isError: recordsErrored, refetch: refetchRecords } =
    useUnifiedRecords({ limit: 200 });
  const { data: searchData } = useRecordSearch(query, { limit: 50 });
  const { data: timeline } = useUnifiedTimeline();
  const { data: consentsMine } = useConsentsMine();
  const { data: auditData } = useAuditLog();
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

  // Folder tap: toggles kinds[] / recentOnly. Second click on the same
  // folder clears the filter (so users can come back to "all" without
  // hunting for a pill).
  const handleFolderPress = useCallback(
    (folder: SmartFolder) => {
      if (folder.kind) {
        setKinds((prev) => {
          const isActive = prev.length === 1 && prev[0] === folder.kind;
          return isActive ? [] : [folder.kind];
        });
        setRecentOnly(false);
      } else if (folder.isRecent) {
        setKinds((prev) => (prev.length === 0 ? prev : []));
        setRecentOnly((prev) => !prev);
      }
      setQuery("");
      setTab("all");
    },
    [],
  );

  // The currently active folder (one only) — drives the visual "selected"
  // state on the smart folder tile.
  const activeFolder: SmartFolderKind | null = useMemo(() => {
    if (recentOnly && kinds.length === 0) return "recent30";
    if (!recentOnly && kinds.length === 1) return kinds[0] as SmartFolderKind;
    return null;
  }, [recentOnly, kinds]);

  const activeFolderDetails = useMemo(() => {
    if (activeFolder === null) {
      return {
        label: "All Folders",
        icon: FolderOpen,
        count: records.length,
        visual: { bg: "#F1F5F9", fg: "#475569" },
      };
    }
    if (activeFolder === "recent30") {
      const count = (recordsData?.records ?? []).filter((r: any) => {
        const iso = r.recordDate ?? r.date ?? r.createdAt;
        if (!iso) return false;
        const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
        return days <= 30;
      }).length;
      return {
        label: t("recordsHub.smartFolders.recent30"),
        icon: AlarmClock,
        count,
        visual: { bg: "#FEE2E2", fg: "#EF4444" },
      };
    }
    // Specific folder kind
    const Icon = kindIcon(activeFolder as RecordKind);
    const count = counts[activeFolder as RecordKind] ?? 0;
    const visual = visualFor(activeFolder as RecordKind);
    const label = t(`recordsHub.smartFolders.${activeFolder === "lab_report" ? "labReports" : activeFolder === "prescription" ? "prescriptions" : activeFolder === "imaging" ? "imaging" : activeFolder === "vaccination" ? "vaccinations" : "allergies"}`);
    const customVisual = (() => {
      switch (activeFolder) {
        case "lab_report": return { bg: "#FEF3C7", fg: "#D97706" };
        case "prescription": return { bg: "#F3E8FF", fg: "#9333EA" };
        case "imaging": return { bg: "#E0E7FF", fg: "#4F46E5" };
        case "vaccination": return { bg: "#CCFBF1", fg: "#0D9488" };
        default: return { bg: "#E2E8F0", fg: "#475569" };
      }
    })();
    return { label, icon: Icon, count, visual: customVisual };
  }, [activeFolder, records, counts, recordsData, t]);

  // Active filter chip (with clear) shown right above the record list.
  const activeFilterChip = useMemo(() => {
    if (kinds.length === 0 && !recentOnly) return null;
    const kindLabel =
      kinds.length > 0
        ? RECORD_REGISTRY[kinds[0] as RecordKind]?.key.replace(/_/g, " ") ??
          kinds[0]
        : null;
    const label = recentOnly
      ? t("recordsHub.smartFolders.recent30")
      : kindLabel ?? "";
    if (!label) return null;
    const tone = recentOnly ? "warning" : "primary";
    return { label: label.toString(), tone: tone as PillTone };
  }, [kinds, recentOnly, t]);

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
          />
        )}

        {/* ─── Smart folders dropdown selector ──────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: spacing.lg,
            marginTop: spacing.xl,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TextMuted
            color={colors.textSubtle}
            size={11}
            weight="800"
            letterSpacing={1.4}
            style={{ textTransform: "uppercase" }}
            fontFamily={fontFamily.bodyBold}
          >
            {t("recordsHub.smartFolders.title")}
          </TextMuted>
          {activeFolder !== null ? (
            <Pressable
              onPress={() => {
                clearFilters();
                setFolderDropdownOpen(false);
              }}
              hitSlop={6}
              accessibilityRole="button"
            >
              <TextMuted
                color={colors.primary}
                size={12}
                weight="700"
                fontFamily={fontFamily.bodyBold}
              >
                Clear filter
              </TextMuted>
            </Pressable>
          ) : null}
        </View>

        {/* Dropdown Selector Button */}
        <Pressable
          onPress={() => setFolderDropdownOpen((prev) => !prev)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            padding: 8,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            marginHorizontal: spacing.lg,
            marginTop: spacing.sm,
            shadowColor: "rgba(0,0,0,0.01)",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 4,
            elevation: 1,
          })}
        >
          {/* Active folder icon */}
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              backgroundColor: activeFolderDetails.visual.bg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.sm,
            }}
          >
            {React.createElement(activeFolderDetails.icon, {
              size: 12,
              color: activeFolderDetails.visual.fg,
              strokeWidth: 2.5,
            })}
          </View>
          <AppText
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            {activeFolderDetails.label}
          </AppText>
          {/* Count + Arrow */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginLeft: "auto",
              gap: 6,
            }}
          >
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <AppText
                style={{
                  fontSize: 10.5,
                  fontWeight: "800",
                  color: colors.textMuted,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {activeFolderDetails.count}
              </AppText>
            </View>
            <ChevronsUpDown size={14} color={colors.textMuted} strokeWidth={2} />
          </View>
        </Pressable>

        {/* Dropdown Options List */}
        {folderDropdownOpen ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              marginHorizontal: spacing.lg,
              marginTop: 6,
              padding: spacing.xs,
              shadowColor: "rgba(0,0,0,0.04)",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 1,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            {[
              {
                key: "all",
                label: "All Folders",
                icon: FolderOpen,
                count: records.length,
                visual: { bg: "#F1F5F9", fg: "#475569" },
                kind: undefined,
              },
              ...SMART_FOLDERS.map((f) => {
                const count =
                  f.kind !== undefined
                    ? counts[f.kind] ?? 0
                    : (recordsData?.records ?? []).filter((r: any) => {
                        const iso = r.recordDate ?? r.date ?? r.createdAt;
                        if (!iso) return false;
                        const days =
                          (Date.now() - new Date(iso).getTime()) / 86_400_000;
                        return days <= 30;
                      }).length;
                const Icon = f.kind !== undefined ? kindIcon(f.kind) : AlarmClock;
                const customVisual = (() => {
                  switch (f.kind) {
                    case "lab_report":
                      return { bg: "#FEF3C7", fg: "#D97706" };
                    case "prescription":
                      return { bg: "#F3E8FF", fg: "#9333EA" };
                    case "imaging":
                      return { bg: "#E0E7FF", fg: "#4F46E5" };
                    case "vaccination":
                      return { bg: "#CCFBF1", fg: "#0D9488" };
                    default:
                      return { bg: "#E2E8F0", fg: "#475569" };
                  }
                })();
                return {
                  key: f.key,
                  label: t(f.labelKey),
                  icon: Icon,
                  count,
                  visual: customVisual,
                  kind: f.kind,
                };
              }),
            ].map((opt) => {
              const isSelected =
                activeFolder === opt.key ||
                (activeFolder === null && opt.key === "all");
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    if (opt.key === "all") {
                      clearFilters();
                    } else {
                      if (opt.kind !== undefined) {
                        setKinds([opt.kind]);
                        setRecentOnly(false);
                      } else {
                        setKinds([]);
                        setRecentOnly(true);
                      }
                    }
                    setFolderDropdownOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md - 4,
                    borderRadius: 12,
                    backgroundColor: isSelected
                      ? colors.surfaceMuted
                      : pressed
                        ? colors.surfaceMuted
                        : "transparent",
                  })}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: opt.visual.bg,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: spacing.md,
                    }}
                  >
                    {React.createElement(opt.icon, {
                      size: 13,
                      color: opt.visual.fg,
                      strokeWidth: 2.5,
                    })}
                  </View>
                  <AppText
                    style={{
                      fontSize: 14.5,
                      fontWeight: isSelected ? "800" : "600",
                      color: isSelected ? colors.primary : colors.text,
                      fontFamily: isSelected
                        ? fontFamily.bodyBold
                        : fontFamily.bodySemibold,
                    }}
                  >
                    {opt.label}
                  </AppText>
                  <View
                    style={{
                      marginLeft: "auto",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 8,
                      backgroundColor: isSelected
                        ? colors.surface
                        : colors.surfaceMuted,
                    }}
                  >
                    <AppText
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isSelected ? colors.primary : colors.textMuted,
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
                      {opt.count}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* ─── Tab segmented control ───────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.xxl,
            marginBottom: spacing.md,
          }}
        >
          <SlidingTabs tab={tab} onChange={setTab} />
        </View>

        {/* ─── Tab content ─────────────────────────────────────────────── */}
        {tab === "all" ? (
          <View style={{ gap: spacing.md }}>
            {/* Custom section header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingHorizontal: spacing.lg,
                marginTop: spacing.sm,
              }}
            >
              <AppText
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.text,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                Your Records
              </AppText>
              <AppText
                style={{
                  fontSize: 14,
                  color: colors.textMuted,
                  fontWeight: "600",
                  fontFamily: fontFamily.bodySemibold,
                }}
              >
                {filteredRecords.length} total
              </AppText>
            </View>

            {/* Premium search bar */}
            <View style={{ paddingHorizontal: spacing.lg }}>
              <PremiumSearchBar
                value={query}
                onChangeText={setQuery}
                placeholder="Search records, labs, images..."
              />
            </View>

            {/* Category pills with counts */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                gap: spacing.sm,
                paddingVertical: spacing.xs,
              }}
            >
              {(() => {
                const categories = [
                  { label: "All", count: timeFilteredRecords.length, key: "all", kinds: [] },
                  { label: "Lab", count: timeFilteredRecords.filter(r => (r.kind ?? r.recordType) === "lab_report").length, key: "lab", kinds: ["lab_report"] },
                  { label: "Rx", count: timeFilteredRecords.filter(r => (r.kind ?? r.recordType) === "prescription").length, key: "rx", kinds: ["prescription"] },
                  { label: "Imaging", count: timeFilteredRecords.filter(r => (r.kind ?? r.recordType) === "imaging").length, key: "imaging", kinds: ["imaging"] },
                  { label: "Vaccines", count: timeFilteredRecords.filter(r => (r.kind ?? r.recordType) === "vaccination").length, key: "vaccines", kinds: ["vaccination"] },
                ];

                return categories.map((cat) => {
                  const isActive = cat.key === "all" ? kinds.length === 0 : (kinds.length === 1 && kinds[0] === cat.kinds[0]);
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => setKinds(cat.kinds as RecordKind[])}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: isActive ? "transparent" : colors.border,
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <AppText
                        style={{
                          fontSize: 14,
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
                          fontWeight: "600",
                          color: isActive ? "rgba(255, 255, 255, 0.75)" : colors.textMuted,
                          marginLeft: 6,
                          fontFamily: fontFamily.bodySemibold,
                        }}
                      >
                        {cat.count}
                      </AppText>
                    </Pressable>
                  );
                });
              })()}
            </ScrollView>

            {/* Time & Sort filter row */}
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: spacing.lg,
                alignItems: "center",
                gap: 8,
                marginTop: spacing.xs,
              }}
            >
              {[
                { label: "All time", key: "all" },
                { label: "Past year", key: "year" },
                { label: "Past 30 days", key: "30days" },
              ].map((opt) => {
                const isActive = timeFilter === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setTimeFilter(opt.key as any)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: isActive ? colors.primarySoft : "transparent",
                    }}
                  >
                    <AppText
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? "700" : "500",
                        color: isActive ? colors.primary : colors.textMuted,
                        fontFamily: isActive ? fontFamily.bodyBold : fontFamily.body,
                      }}
                    >
                      {opt.label}
                    </AppText>
                  </Pressable>
                );
              })}

              {/* New/Old Sort toggle */}
              <Pressable
                onPress={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginLeft: "auto",
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                }}
              >
                <ChevronsUpDown size={14} color={colors.primary} strokeWidth={2.5} />
                <AppText
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.primary,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  New/Old
                </AppText>
              </Pressable>
            </View>

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
                          <RecordCard key={item.id} item={item} locale={locale} />
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
      <ShareConsentSheet open={shareOpen} onClose={() => setShareOpen(false)} />
      <DsarRequestSheet open={dsarOpen} onClose={() => setDsarOpen(false)} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Premium hero — gradient sky/teal field with floating orbs, big numeral,
// white sheen, and a glass mini-stats strip at the bottom (encrypted +
// last activity + active consents). Mirrors the hero pattern used on home,
// medicines, profile, family, appointments so the user lands on a familiar
// affordance.
// ---------------------------------------------------------------------------
function PremiumHero({
  eyebrow,
  total,
  activeConsents,
  encryptedLabel,
  lastActivityLabel,
  patientName,
  subtitle,
  avatarName,
}: {
  eyebrow: string;
  total: number;
  activeConsents: number;
  encryptedLabel: string;
  lastActivityLabel: string | null;
  patientName: string;
  subtitle: string;
  avatarName: string;
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
      <LinearGradient
        colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* ambient orbs */}
      <View
        style={{
          position: "absolute",
          top: -90,
          right: -70,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: "rgba(56, 189, 248, 0.32)",
        }}
      />
      {/* white sheen at top */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.25)",
        }}
      />

      <View
        style={{
          paddingHorizontal: spacing.lg + 2,
          paddingVertical: spacing.md + 2,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left Text Column Stack */}
        <View style={{ flex: 1, gap: 1, marginRight: spacing.md }}>
          <TextMuted
            color="rgba(255,255,255,0.7)"
            size={10.5}
            weight="800"
            letterSpacing={1.2}
            fontFamily={fontFamily.bodyBold}
            style={{ textTransform: "uppercase" }}
          >
            {eyebrow}
          </TextMuted>
          <TextMuted
            color="#FFFFFF"
            size={20}
            weight="800"
            fontFamily={fontFamily.bodyBold}
            style={{ marginTop: 2 }}
            numberOfLines={1}
          >
            {patientName}
          </TextMuted>
          {subtitle ? (
            <TextMuted
              color="rgba(255,255,255,0.7)"
              size={12.5}
              weight="500"
              fontFamily={fontFamily.body}
              numberOfLines={1}
            >
              {subtitle}
            </TextMuted>
          ) : null}

          {/* Numeral row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 4,
              marginTop: 4,
            }}
          >
            <TextMuted
              color="#FFFFFF"
              size={28}
              weight="800"
              lineHeight={32}
              letterSpacing={-0.5}
              fontFamily={fontFamily.heavy}
            >
              {fmtCount(total)}
            </TextMuted>
            <TextMuted
              color="rgba(255,255,255,0.7)"
              size={14}
              weight="700"
              letterSpacing={-0.2}
              fontFamily={fontFamily.bodyBold}
            >
              {t("recordsHub.hero.total")}
            </TextMuted>
          </View>
        </View>

        {/* Right column: Avatar */}
        <Avatar name={avatarName} size="lg" ring />
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
        backgroundColor: colors.surfaceMuted,
        borderRadius: 12,
        padding: 3,
        borderWidth: 1,
        borderColor: colors.border,
        width: "100%",
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
              paddingVertical: 8,
              borderRadius: 9,
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
              size={12.5}
              weight="800"
              fontFamily={active ? fontFamily.bodyBold : fontFamily.bodySemibold}
              style={{ letterSpacing: 0.2 }}
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
  const { colors, spacing, shadow: themeShadow, fontFamily } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        ...themeShadow.sm,
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
          paddingVertical: 8,
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
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
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
}: {
  item: any;
  locale: string;
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
      onPress={() => router.push(`/record-detail?id=${item.id}`)}
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

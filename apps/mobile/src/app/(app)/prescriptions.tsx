// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
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
  Stethoscope,
  ShieldCheck,
  PackageCheck,
  XCircle,
  X,
  Repeat,
  Sparkles,
  ArrowRight,
  ClipboardList,
} from "lucide-react-native";
import { useMyPrescriptions } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong } from "@/lib/format";
import {
  Screen,
  ScreenHeader,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Pressable,
  Button,
} from "@/components/ui";

function formatDate(iso: string | null | undefined, locale: any): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return fmtDateLong(d, locale);
}

export default function MyPrescriptionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, scheme } = useTheme();
  const isDark = scheme === "dark";
  const locale = useLocaleStore((s) => s.locale);

  const { data, isLoading, isError, refetch } = useMyPrescriptions();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "signed" | "dispensed" | "cancelled">("all");

  const all: any[] = data?.prescriptions || [];

  // Filter counts
  const signedCount = useMemo(
    () => all.filter((r) => r.status === "signed" || r.status === "active").length,
    [all]
  );
  const dispensedCount = useMemo(
    () => all.filter((r) => r.status === "dispensed" || r.status === "completed").length,
    [all]
  );
  const cancelledCount = useMemo(
    () => all.filter((r) => r.status === "cancelled").length,
    [all]
  );

  const filtered = useMemo(() => {
    let list = all;

    // Filter by status tab
    if (selectedFilter === "signed") {
      list = list.filter((r) => r.status === "signed" || r.status === "active");
    } else if (selectedFilter === "dispensed") {
      list = list.filter((r) => r.status === "dispensed" || r.status === "completed");
    } else if (selectedFilter === "cancelled") {
      list = list.filter((r) => r.status === "cancelled");
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((r: any) => {
      const medNames = (r.medicines || []).map((m: any) => m.name).join(" ");
      const hay = [
        r.diagnosis,
        r.notes,
        r.doctorName,
        r.doctorSpecialization,
        medNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [all, selectedFilter, searchQuery]);

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
        title={t("myPrescriptions.title")}
        subtitle={t("myPrescriptions.subtitle", { count: all.length })}
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
        {/* Top Clinical Hero Hub */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
          <View
            style={{
              backgroundColor: isDark
                ? "rgba(59, 130, 246, 0.12)"
                : colors.primarySoft,
              borderRadius: radius.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(59, 130, 246, 0.25)"
                : "rgba(37, 99, 235, 0.18)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={22} color={colors.onPrimary} strokeWidth={2.4} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "800" },
                    ]}
                  >
                    {t("myPrescriptions.heroTitle")}
                  </Text>
                  <Sparkles size={14} color={colors.primary} />
                </View>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2, lineHeight: 18 },
                  ]}
                >
                  {t("myPrescriptions.heroSubtitle")}
                </Text>

                {/* Quick actions inside hero */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    marginTop: spacing.sm,
                  }}
                >
                  <Pressable
                    onPress={() => router.push("/(app)/refill")}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: colors.primary,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 7,
                      borderRadius: radius.full,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Repeat size={13} color={colors.onPrimary} strokeWidth={2.4} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: colors.onPrimary,
                      }}
                    >
                      {t("myPrescriptions.requestRefill")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Real Search Bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceMuted,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
              height: 46,
            }}
          >
            <Search size={18} color={colors.textSubtle} strokeWidth={2.2} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("myPrescriptions.searchPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={{
                flex: 1,
                paddingHorizontal: spacing.sm,
                fontSize: 14,
                color: colors.text,
                height: "100%",
              }}
              returnKeyType="search"
              clearButtonMode="never"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={14} color={colors.text} strokeWidth={2.4} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Filter Chips Horizontal Carousel */}
        <View style={{ marginTop: spacing.sm }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.xs,
              paddingVertical: 4,
            }}
          >
            <FilterChip
              label={t("myPrescriptions.filters.all")}
              count={all.length}
              active={selectedFilter === "all"}
              onPress={() => setSelectedFilter("all")}
            />
            <FilterChip
              label={t("myPrescriptions.filters.signed")}
              count={signedCount}
              active={selectedFilter === "signed"}
              onPress={() => setSelectedFilter("signed")}
            />
            <FilterChip
              label={t("myPrescriptions.filters.dispensed")}
              count={dispensedCount}
              active={selectedFilter === "dispensed"}
              onPress={() => setSelectedFilter("dispensed")}
            />
            {cancelledCount > 0 && (
              <FilterChip
                label={t("myPrescriptions.filters.cancelled")}
                count={cancelledCount}
                active={selectedFilter === "cancelled"}
                onPress={() => setSelectedFilter("cancelled")}
              />
            )}
          </ScrollView>
        </View>

        {/* Prescription List Content */}
        {isLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={130} radius={18} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            style={{ marginTop: spacing.xl }}
            title={t("common.errorTitle", { defaultValue: "Something went wrong" })}
            message={t("prescriptions.errorLoad", {
              defaultValue:
                "We couldn't load your prescriptions. Check your connection and try again.",
            })}
            actionLabel={t("common.retry", { defaultValue: "Retry" })}
            onAction={() => refetch()}
          />
        ) : filtered.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <EmptyState
              style={{ marginTop: spacing.xl }}
              icon={searchQuery || selectedFilter !== "all" ? Search : FileText}
              title={
                searchQuery || selectedFilter !== "all"
                  ? t("myPrescriptions.emptySearchTitle")
                  : t("myPrescriptions.emptyTitle")
              }
              message={
                searchQuery || selectedFilter !== "all"
                  ? t("myPrescriptions.emptySearchBody")
                  : t("myPrescriptions.emptyBody")
              }
              actionLabel={
                searchQuery || selectedFilter !== "all"
                  ? t("myPrescriptions.clearSearch")
                  : undefined
              }
              onAction={
                searchQuery || selectedFilter !== "all"
                  ? () => {
                      setSearchQuery("");
                      setSelectedFilter("all");
                    }
                  : undefined
              }
            />
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              gap: spacing.md,
            }}
          >
            {filtered.map((r: any) => (
              <PrescriptionCard
                key={r.id}
                prescription={r}
                locale={locale}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/prescription-detail",
                    params: { id: r.id },
                  } as any)
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.full,
        backgroundColor: active ? colors.primary : colors.surfaceMuted,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? "700" : "600",
          color: active ? colors.onPrimary : colors.text,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: 999,
          backgroundColor: active
            ? "rgba(255, 255, 255, 0.25)"
            : colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: active ? colors.onPrimary : colors.textMuted,
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function PrescriptionCard({
  prescription,
  locale,
  onPress,
}: {
  prescription: any;
  locale: any;
  onPress: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, scheme } = useTheme();
  const isDark = scheme === "dark";

  const r = prescription;
  const medicines: any[] = r.medicines || [];
  const medCount = r.medicineCount || medicines.length || 0;
  const dateFormatted = formatDate(r.date || r.createdAt, locale);

  const isSigned = r.status === "signed" || r.status === "active";
  const isDispensed = r.status === "dispensed" || r.status === "completed";
  const isCancelled = r.status === "cancelled";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0 : 0.04,
        shadowRadius: 6,
        elevation: 1,
      })}
    >
      {/* Card Header: Rx Icon Avatar + Title + Status Pill */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: isDark
                ? "rgba(59, 130, 246, 0.15)"
                : colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ClipboardList
              size={22}
              color={colors.primary}
              strokeWidth={2.2}
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
              {r.diagnosis || t("myPrescriptions.fallbackTitle")}
            </Text>

            {/* Doctor with Stethoscope */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                marginTop: 2,
              }}
            >
              <Stethoscope
                size={12}
                color={colors.primary}
                strokeWidth={2.4}
              />
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, flex: 1, fontWeight: "500" },
                ]}
                numberOfLines={1}
              >
                {r.doctorName || "Licensed Practitioner"}
                {r.doctorSpecialization
                  ? ` · ${r.doctorSpecialization}`
                  : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Pill with Icon */}
        <StatusBadge status={r.status} />
      </View>

      {/* Meta Row: Formatted Date & Medicine Count */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          marginTop: spacing.md,
          paddingTop: spacing.xs,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <CalendarDays
            size={13}
            color={colors.textSubtle}
            strokeWidth={2.2}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.textSubtle,
            }}
          >
            {dateFormatted}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Pill
            size={13}
            color={colors.textSubtle}
            strokeWidth={2.2}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.textSubtle,
            }}
          >
            {medCount === 1
              ? t("myPrescriptions.medCount_one")
              : t("myPrescriptions.medCount_other", { count: medCount })}
          </Text>
        </View>
      </View>

      {/* Prescribed Medicines Inline Preview Chips */}
      {medicines.length > 0 && (
        <View
          style={{
            marginTop: spacing.sm,
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : colors.surfaceMuted,
            borderRadius: radius.md,
            padding: spacing.xs + 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
            }}
          >
            {medicines.slice(0, 3).map((med, idx) => (
              <View
                key={med.id || idx}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: colors.surface,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.primary,
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                  numberOfLines={1}
                >
                  {med.name}
                  {med.dosage ? ` (${med.dosage})` : ""}
                </Text>
              </View>
            ))}

            {medicines.length > 3 && (
              <View
                style={{
                  paddingHorizontal: spacing.xs + 2,
                  paddingVertical: 3,
                  borderRadius: radius.sm,
                  backgroundColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: colors.textMuted,
                  }}
                >
                  +{medicines.length - 3} more
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Footer Navigation Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: spacing.sm,
          paddingTop: spacing.xs,
          borderTopWidth: 1,
          borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: colors.primary,
          }}
        >
          {t("myPrescriptions.viewDetails")}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {isSigned && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                router.push("/(app)/refill");
              }}
              hitSlop={6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.full,
                backgroundColor: isDark
                  ? "rgba(59, 130, 246, 0.15)"
                  : colors.primarySoft,
                marginRight: spacing.xs,
              }}
            >
              <Repeat size={11} color={colors.primary} strokeWidth={2.4} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.primary,
                }}
              >
                {t("myPrescriptions.requestRefill")}
              </Text>
            </Pressable>
          )}
          <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
        </View>
      </View>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  const isSigned = status === "signed" || status === "active";
  const isDispensed = status === "dispensed" || status === "completed";
  const isCancelled = status === "cancelled";

  if (isSigned) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: radius.full,
          backgroundColor: colors.successSoft,
        }}
      >
        <ShieldCheck size={12} color={colors.success} strokeWidth={2.6} />
        <Text
          style={{
            fontSize: 10,
            fontWeight: "800",
            color: colors.success,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {t("myPrescriptions.status.signed")}
        </Text>
      </View>
    );
  }

  if (isDispensed) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: radius.full,
          backgroundColor: colors.primarySoft,
        }}
      >
        <PackageCheck size={12} color={colors.primary} strokeWidth={2.6} />
        <Text
          style={{
            fontSize: 10,
            fontWeight: "800",
            color: colors.primary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {t("myPrescriptions.status.dispensed")}
        </Text>
      </View>
    );
  }

  if (isCancelled) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: radius.full,
          backgroundColor: colors.dangerSoft ?? colors.surfaceMuted,
        }}
      >
        <XCircle size={12} color={colors.danger ?? colors.textMuted} strokeWidth={2.6} />
        <Text
          style={{
            fontSize: 10,
            fontWeight: "800",
            color: colors.danger ?? colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {t("myPrescriptions.status.cancelled")}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "800",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {status}
      </Text>
    </View>
  );
}

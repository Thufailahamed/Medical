// @ts-nocheck

import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Search,
  TestTube2,
  Droplets,
  FlaskConical,
  Heart,
  Brain,
  Bone,
  Shield,
  Pill,
  Beaker,
  Microscope,
  Syringe,
  Activity,
  Clock,
  Zap,
  ChevronRight,
  X,
  AlertCircle,
  Home,
  Package,
  Droplet,
  Wind,
  Sparkles,
} from "lucide-react-native";
import {
  useTestCatalog,
  useTestCategories,
  type DiagnosticTest,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { PackageThumbnail } from "./test-packages";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  Skeleton,
} from "@/components/ui";

const CATEGORY_CONFIG: Record<
  string,
  { icon: any; color: string; soft: string; label: string }
> = {
  // `soft` = tone colour at ~12% alpha so tiles work in light and dark mode.
  blood: { icon: Droplets, color: "#DC2626", soft: "#DC26261F", label: "Blood Tests" },
  urine: { icon: FlaskConical, color: "#D97706", soft: "#D977061F", label: "Urine Tests" },
  stool: { icon: Beaker, color: "#7C3AED", soft: "#7C3AED1F", label: "Stool Tests" },
  cardiac: { icon: Heart, color: "#DB2777", soft: "#DB27771F", label: "Cardiac" },
  diabetes: { icon: Activity, color: "#2563EB", soft: "#2563EB1F", label: "Diabetes" },
  thyroid: { icon: Shield, color: "#059669", soft: "#0596691F", label: "Thyroid" },
  liver: { icon: Beaker, color: "#EA580C", soft: "#EA580C1F", label: "Liver" },
  kidney: { icon: Droplets, color: "#0891B2", soft: "#0891B21F", label: "Kidney" },
  lipid: { icon: Pill, color: "#7C3AED", soft: "#7C3AED1F", label: "Lipid Panel" },
  vitamin: { icon: Syringe, color: "#0D9488", soft: "#0D94881F", label: "Vitamins" },
  hormone: { icon: Brain, color: "#DB2777", soft: "#DB27771F", label: "Hormones" },
  cancer_marker: { icon: Microscope, color: "#DC2626", soft: "#DC26261F", label: "Cancer Markers" },
  infection: { icon: Shield, color: "#D97706", soft: "#D977061F", label: "Infection" },
  allergy: { icon: Zap, color: "#059669", soft: "#0596691F", label: "Allergy" },
  genetic: { icon: Brain, color: "#7C3AED", soft: "#7C3AED1F", label: "Genetic" },
  imaging: { icon: Activity, color: "#2563EB", soft: "#2563EB1F", label: "Imaging" },
  other: { icon: TestTube2, color: "#64748B", soft: "#64748B1F", label: "Other" },
};

function getCategoryIcon(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
}

// Sample-type glyph — TestTube2 reads as a pencil at chip size.
function sampleIcon(sampleType?: string) {
  const s = (sampleType || "").toLowerCase();
  if (s.includes("urine")) return FlaskConical;
  if (s.includes("stool")) return Beaker;
  if (s.includes("swab") || s.includes("breath")) return Wind;
  return Droplet;
}

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

export default function TestCatalogScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
  const router = useRouter();
  const surface = scheme === "dark" ? colors.surfaceElevated : colors.surface;
  const cardLift = scheme === "dark" ? null : shadow.xs;

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data: categoriesData } = useTestCategories();
  const {
    data: testsData,
    isLoading,
    error,
  } = useTestCatalog({
    category: selectedCategory || undefined,
    search: debouncedSearch || undefined,
    limit: 50,
  });

  const categoryChips = useMemo(() => {
    if (!categoriesData?.categories) return [];
    const counts = new Map<string, number>();
    for (const it of (testsData?.items as any[]) || []) {
      const key = (it.categorySlug ?? (it as any).category ?? "") as string;
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return (categoriesData.categories as any[])
      .map((c: any) => {
        const slug = c.slug ?? c.category;
        return {
          value: slug,
          label: t(`testCatalog.categories.${slug}`, {
            defaultValue: CATEGORY_CONFIG[slug]?.label || c.name || slug,
          }),
          count: typeof c.count === "number" ? c.count : (counts.get(slug) ?? 0),
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [categoriesData, testsData, t]);

  const items: any[] = testsData?.items || [];

  const renderTestCard = useCallback(
    ({ item }: { item: DiagnosticTest }) => {
      const slug = (item as any).categorySlug ?? (item as any).category ?? "other";
      const cat = getCategoryIcon(slug);
      const CatIcon = cat.icon;
      const SampleIcon = sampleIcon(item.sampleType);
      const price = (item as any).minPrice ?? item.discountPrice ?? item.price;
      const labCount = (item as any).laboratoryCount ?? (item as any).availableAt?.length ?? 0;
      const hasDiscount = !!item.discountPrice && item.discountPrice < item.price;

      return (
        <Pressable
          onPress={() => router.push(`/test-detail/${item.slug}`)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${formatPrice(price)}`}
          style={({ pressed }) => [
            {
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              borderRadius: radius.card,
              borderCurve: "continuous",
              backgroundColor: surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.hairline,
              opacity: pressed ? 0.94 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
            cardLift,
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, padding: spacing.lg }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                borderCurve: "continuous",
                backgroundColor: cat.soft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CatIcon size={22} color={cat.color} strokeWidth={2.3} />
            </View>

            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <Text numberOfLines={2} style={[typography.title.md, { color: colors.text }]}>
                {item.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <MetaChip
                  icon={<SampleIcon size={11} color={colors.textMuted} strokeWidth={2.4} />}
                  label={item.sampleType}
                  bg={colors.fill}
                  fg={colors.textMuted}
                />
                {item.homeCollectionAvailable ? (
                  <MetaChip
                    icon={<Home size={11} color={colors.success} strokeWidth={2.4} />}
                    label={t("testCatalog.v2.home", "Home visit")}
                    bg={colors.successSoft}
                    fg={colors.success}
                  />
                ) : null}
                {item.fastingRequired ? (
                  <MetaChip
                    icon={<Clock size={11} color={colors.warning} strokeWidth={2.4} />}
                    label={t("testCatalog.fasting", { hours: item.fastingHours })}
                    bg={colors.warningSoft}
                    fg={colors.warning}
                  />
                ) : null}
              </View>
            </View>
          </View>

          {/* Footer: turnaround · price */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.separator,
            }}
          >
            <Zap size={13} color={colors.textSubtle} strokeWidth={2.4} />
            <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
              {t("testCatalog.resultsIn", { hours: item.turnaroundHours })}
              {labCount > 0
                ? ` · ${t("testCatalog.v2.labs", { count: labCount, defaultValue: "{{count}} labs" })}`
                : ""}
            </Text>
            {hasDiscount ? (
              <Text style={[typography.caption, { color: colors.textSubtle, textDecorationLine: "line-through" }]}>
                {formatPrice(item.price)}
              </Text>
            ) : null}
            <Text style={[typography.title.md, { color: colors.text, letterSpacing: -0.3 }]}>
              {(item as any).minPrice && labCount > 1
                ? t("testCatalog.v2.from", { price: formatPrice(price), defaultValue: "from {{price}}" })
                : formatPrice(price)}
            </Text>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={15} color={colors.onPrimary} strokeWidth={2.6} />
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, router, spacing, typography, radius, surface, cardLift, t]
  );

  const listHeader = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      {/* Search */}
      <View
        style={[
          {
            marginHorizontal: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: surface,
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.hairline,
            paddingHorizontal: 14,
            minHeight: 50,
            gap: 10,
          },
          cardLift,
        ]}
      >
        <Search size={18} color={colors.textSubtle} strokeWidth={2.4} />
        <TextInput
          placeholder={t("testCatalog.searchPlaceholder", "Search tests...")}
          placeholderTextColor={colors.textSubtle}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          selectionColor={colors.primary}
          style={{ flex: 1, ...typography.body.md, color: colors.text, paddingVertical: 12 }}
        />
        {search.length > 0 ? (
          <Pressable
            onPress={() => setSearch("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.clear", "Clear")}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.fill,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={12} color={colors.textMuted} strokeWidth={2.6} />
          </Pressable>
        ) : null}
      </View>

      {/* Packages promo */}
      <Pressable
        onPress={() => router.push("/(app)/test-packages")}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginHorizontal: spacing.lg,
          borderRadius: radius.card,
          borderCurve: "continuous",
          backgroundColor: colors.primarySoft,
          padding: spacing.md,
          paddingRight: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <PackageThumbnail item={{ slug: "full-body-health-checkup" }} size={56} borderRadius={16} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Package size={12} color={colors.primary} strokeWidth={2.5} />
            <Text style={[typography.overline, { color: colors.primary, fontSize: 10 }]}>
              {t("testCatalog.v2.packagesKicker", "Health packages")}
            </Text>
          </View>
          <Text style={[typography.title.md, { color: colors.text }]}>
            {t("testCatalog.v2.packagesTitle", "Bundle tests & save")}
          </Text>
          <Text style={[typography.body.sm, { color: colors.textMuted }]} numberOfLines={1}>
            {t("testCatalog.v2.packagesBody", "Curated panels for full check-ups")}
          </Text>
        </View>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={16} color={colors.primary} strokeWidth={2.5} />
        </View>
      </Pressable>

      {/* Categories */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ value: null, label: t("testCatalog.all", "All"), count: 0 }, ...categoryChips]}
        keyExtractor={(item) => item.value || "all"}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
        renderItem={({ item }) => {
          const active = selectedCategory === item.value;
          const cfg = item.value ? getCategoryIcon(item.value) : null;
          const Icon = cfg?.icon ?? Sparkles;
          return (
            <Pressable
              onPress={() => setSelectedCategory(item.value === selectedCategory ? null : item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                paddingLeft: 5,
                paddingRight: 14,
                borderRadius: 20,
                borderCurve: "continuous",
                backgroundColor: active ? colors.primary : pressed ? colors.fillStrong : surface,
                borderWidth: active ? 0 : StyleSheet.hairlineWidth,
                borderColor: colors.hairline,
                height: 40,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
              })}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? "rgba(255,255,255,0.22)" : cfg?.soft ?? colors.primarySoft,
                }}
              >
                <Icon
                  size={14}
                  color={active ? colors.onPrimary : cfg?.color ?? colors.primary}
                  strokeWidth={2.4}
                />
              </View>
              <Text style={[typography.label.md, { color: active ? colors.onPrimary : colors.text }]}>
                {item.label}
              </Text>
              {item.count > 0 ? (
                <Text
                  style={[typography.label.xs, { color: active ? "rgba(255,255,255,0.8)" : colors.textSubtle }]}
                >
                  {item.count}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      {!isLoading && !error && items.length > 0 ? (
        <Text style={[typography.overline, { color: colors.textMuted, marginHorizontal: spacing.lg + 4, marginBottom: -4 }]}>
          {t("testCatalog.v2.count", { count: items.length, defaultValue: "{{count}} tests" })}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen padded={false} bottomInset={false} edges={["top"]}>
      <ScreenHeader
        title={t("testCatalog.title", "Book a Test")}
        subtitle={t("testCatalog.subtitle", "Home sample collection")}
        back
      />

      {isLoading ? (
        <View style={{ paddingTop: spacing.sm }}>
          {listHeader}
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={124} radius={radius.card} />
            ))}
          </View>
        </View>
      ) : error ? (
        <View style={{ paddingTop: spacing.sm }}>
          {listHeader}
          <View style={{ paddingHorizontal: spacing.lg }}>
            <EmptyState
              icon={AlertCircle}
              title={t("testCatalog.v2.loadError", "Failed to load tests")}
              message={t("testCatalog.v2.loadErrorBody", "Please check your connection and try again.")}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderTestCard}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon={Search}
              title={t("testCatalog.noTests", "No tests found")}
              message={
                search
                  ? t("testCatalog.noResults", { search })
                  : t("testCatalog.noTestsDesc", "No tests available in this category.")
              }
            />
          }
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

function MetaChip({
  icon,
  label,
  bg,
  fg,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  fg: string;
}) {
  const { typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderCurve: "continuous",
      }}
    >
      {icon}
      <Text style={{ ...typography.label.xs, color: fg, textTransform: "capitalize" }}>{label}</Text>
    </View>
  );
}

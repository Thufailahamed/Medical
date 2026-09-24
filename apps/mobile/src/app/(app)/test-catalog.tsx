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

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

export default function TestCatalogScreen() {
  const { colors, spacing, fontFamily, typography, radius, shadow, scheme } =
    useTheme();
  const router = useRouter();
  const cardBorder = scheme === "dark" ? colors.borderStrong : colors.separator;
  const cardLift = scheme === "dark" ? null : shadow.sm;

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
    for (const t of (testsData?.items as any[]) || []) {
      const key = (t.categorySlug ?? (t as any).category ?? "") as string;
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return (categoriesData.categories as any[])
      .map((c: any) => ({
        value: c.slug ?? c.category,
        label: CATEGORY_CONFIG[c.slug ?? c.category]?.label || c.name || c.slug,
        count: typeof c.count === "number" ? c.count : (counts.get(c.slug) ?? 0),
        color: CATEGORY_CONFIG[c.slug ?? c.category]?.color || colors.primary,
      }))
      .sort((a, b) => b.count - a.count);
  }, [categoriesData, testsData, colors.primary]);

  const renderTestCard = useCallback(
    ({ item }: { item: DiagnosticTest }) => {
      const slug = (item as any).categorySlug ?? (item as any).category ?? "other";
      const cat = getCategoryIcon(slug);
      const CatIcon = cat.icon;
      const price = (item as any).minPrice ?? item.discountPrice ?? item.price;
      const labCount = (item as any).laboratoryCount ?? (item as any).availableAt?.length ?? 0;

      return (
        <Pressable
          onPress={() => router.push(`/test-detail/${item.slug}`)}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          style={({ pressed }) => ({
            marginHorizontal: spacing.lg,
            marginBottom: spacing.md,
            borderRadius: radius.card,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: cardBorder,
            padding: spacing.lg,
            opacity: pressed ? 0.94 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
            ...cardLift,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
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
              <Text
                numberOfLines={2}
                style={{
                  ...typography.title.sm,
                  fontFamily: typography.title.md.fontFamily,
                  color: colors.text,
                }}
              >
                {item.name}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <MetaChip
                  icon={<TestTube2 size={11} color={colors.textMuted} strokeWidth={2.4} />}
                  label={item.sampleType}
                  bg={colors.surfaceMuted}
                  fg={colors.textMuted}
                />
                {item.homeCollectionAvailable ? (
                  <MetaChip
                    icon={<Home size={11} color={colors.success} strokeWidth={2.4} />}
                    label="Home"
                    bg={colors.successSoft}
                    fg={colors.success}
                  />
                ) : null}
                {item.fastingRequired ? (
                  <MetaChip
                    icon={<Clock size={11} color={colors.warning} strokeWidth={2.4} />}
                    label={`${item.fastingHours}h fast`}
                    bg={colors.warningSoft}
                    fg={colors.warning}
                  />
                ) : null}
              </View>

              <Text
                style={{
                  ...typography.caption,
                  color: colors.textSubtle,
                }}
              >
                Results in {item.turnaroundHours}h{labCount > 0 ? ` · ${labCount} lab${labCount === 1 ? "" : "s"}` : ""}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end", gap: 2, paddingTop: 1 }}>
              <Text
                style={{
                  ...typography.title.md,
                  letterSpacing: -0.4,
                  color: colors.text,
                }}
              >
                {formatPrice(price)}
              </Text>
              {item.discountPrice ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSubtle,
                    textDecorationLine: "line-through",
                  }}
                >
                  {formatPrice(item.price)}
                </Text>
              ) : null}
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 6,
                }}
              >
                <ChevronRight size={15} color={colors.primary} strokeWidth={2.5} />
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, fontFamily, router, spacing, typography, radius, cardBorder, cardLift]
  );

  const listHeader = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      {/* Packages shortcut */}
      <Pressable
        onPress={() => router.push("/(app)/test-packages")}
        style={({ pressed }) => ({
          marginHorizontal: spacing.lg,
          borderRadius: radius.card,
          borderCurve: "continuous",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: cardBorder,
          backgroundColor: pressed ? colors.primarySoft : colors.surface,
          padding: spacing.md,
          paddingRight: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          ...cardLift,
        })}
      >
        <PackageThumbnail item={{ slug: "full-body-health-checkup" }} size={52} borderRadius={16} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...typography.title.md,
              color: colors.text,
            }}
          >
            Test packages
          </Text>
          <Text style={{ ...typography.body.sm, color: colors.textMuted, marginTop: 2 }}>
            Save more with curated panels
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.4} />
      </Pressable>

      {/* Search */}
      <View
        style={{
          marginHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.fill,
          borderRadius: radius.md,
          borderCurve: "continuous",
          paddingHorizontal: 12,
          minHeight: 44,
          gap: 8,
        }}
      >
        <Search size={17} color={colors.textSubtle} strokeWidth={2.25} />
        <TextInput
          placeholder="Search tests..."
          placeholderTextColor={colors.textSubtle}
          value={search}
          onChangeText={setSearch}
          style={{
            flex: 1,
            ...typography.body.md,
            color: colors.text,
            paddingVertical: 10,
          }}
        />
        {search.length > 0 ? (
          <Pressable
            onPress={() => setSearch("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderCurve: "continuous",
                backgroundColor: colors.fillStrong,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={12} color={colors.textMuted} strokeWidth={2.5} />
            </View>
          </Pressable>
        ) : null}
      </View>

      {/* Categories */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ value: null, label: "All", count: 0, color: colors.primary }, ...categoryChips]}
        keyExtractor={(item) => item.value || "all"}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: 8,
        }}
        renderItem={({ item }) => {
          const active = selectedCategory === item.value;
          return (
            <Pressable
              onPress={() =>
                setSelectedCategory(
                  item.value === selectedCategory ? null : item.value
                )
              }
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                borderRadius: 999,
                borderCurve: "continuous",
                backgroundColor: active
                  ? colors.primary
                  : pressed
                    ? colors.fillStrong
                    : colors.surface,
                borderWidth: active ? 0 : StyleSheet.hairlineWidth,
                borderColor: cardBorder,
                minHeight: 36,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              })}
            >
              <Text
                style={{
                  ...typography.label.md,
                  color: active ? colors.onPrimary : colors.text,
                }}
              >
                {item.label}
              </Text>
              {item.count > 0 ? (
                <Text
                  style={{
                    ...typography.label.xs,
                    color: active ? "rgba(255,255,255,0.8)" : colors.textSubtle,
                  }}
                >
                  {item.count}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );

  return (
    <Screen padded={false} bottomInset={false} edges={["top"]}>
      <ScreenHeader
        title="Book a Test"
        subtitle="Home sample collection"
        back
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {listHeader}
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={104} radius={radius.card} />
          ))}
        </View>
      ) : error ? (
        <View style={{ padding: spacing.lg }}>
          {listHeader}
          <EmptyState
            icon={AlertCircle}
            title="Failed to load tests"
            message="Please check your connection and try again."
          />
        </View>
      ) : (
        <FlatList
          data={testsData?.items || []}
          keyExtractor={(item) => item.id}
          renderItem={renderTestCard}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              icon={Search}
              title="No tests found"
              message={
                search
                  ? `No results for "${search}"`
                  : "No tests available in this category."
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
      <Text
        style={{
          ...typography.label.xs,
          color: fg,
          textTransform: "capitalize",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// @ts-nocheck

import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Image,
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
  blood: { icon: Droplets, color: "#DC2626", soft: "#FEE2E2", label: "Blood Tests" },
  urine: { icon: FlaskConical, color: "#D97706", soft: "#FEF3C7", label: "Urine Tests" },
  stool: { icon: Beaker, color: "#7C3AED", soft: "#EDE9FE", label: "Stool Tests" },
  cardiac: { icon: Heart, color: "#DB2777", soft: "#FCE7F3", label: "Cardiac" },
  diabetes: { icon: Activity, color: "#2563EB", soft: "#DBEAFE", label: "Diabetes" },
  thyroid: { icon: Shield, color: "#059669", soft: "#D1FAE5", label: "Thyroid" },
  liver: { icon: Beaker, color: "#EA580C", soft: "#FFEDD5", label: "Liver" },
  kidney: { icon: Droplets, color: "#0891B2", soft: "#CFFAFE", label: "Kidney" },
  lipid: { icon: Pill, color: "#7C3AED", soft: "#EDE9FE", label: "Lipid Panel" },
  vitamin: { icon: Syringe, color: "#0D9488", soft: "#CCFBF1", label: "Vitamins" },
  hormone: { icon: Brain, color: "#DB2777", soft: "#FCE7F3", label: "Hormones" },
  cancer_marker: { icon: Microscope, color: "#DC2626", soft: "#FEE2E2", label: "Cancer Markers" },
  infection: { icon: Shield, color: "#D97706", soft: "#FEF3C7", label: "Infection" },
  allergy: { icon: Zap, color: "#059669", soft: "#D1FAE5", label: "Allergy" },
  genetic: { icon: Brain, color: "#7C3AED", soft: "#EDE9FE", label: "Genetic" },
  imaging: { icon: Activity, color: "#2563EB", soft: "#DBEAFE", label: "Imaging" },
  other: { icon: TestTube2, color: "#64748B", soft: "#F1F5F9", label: "Other" },
};

function getCategoryIcon(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
}

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

export default function TestCatalogScreen() {
  const { colors, spacing, fontFamily } = useTheme();
  const router = useRouter();

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
    return categoriesData.categories
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((c) => ({
        value: c.category,
        label: CATEGORY_CONFIG[c.category]?.label || c.category,
        count: c.count,
        color: CATEGORY_CONFIG[c.category]?.color || colors.primary,
      }));
  }, [categoriesData, colors.primary]);

  const renderTestCard = useCallback(
    ({ item }: { item: DiagnosticTest }) => {
      const cat = getCategoryIcon(item.category);
      const CatIcon = cat.icon;
      const price = item.discountPrice ?? item.price;

      return (
        <Pressable
          onPress={() => router.push(`/test-detail/${item.slug}`)}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          style={({ pressed }) => ({
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            borderRadius: 18,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: pressed ? cat.color : colors.border,
            padding: spacing.md,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: cat.color,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: cat.color,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <CatIcon size={22} color="#FFFFFF" strokeWidth={2.3} />
            </View>

            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: colors.text,
                  fontFamily: fontFamily.bodyBold,
                  letterSpacing: -0.2,
                  lineHeight: 20,
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
                    icon={<Home size={11} color="#059669" strokeWidth={2.4} />}
                    label="Home"
                    bg="#ECFDF5"
                    fg="#047857"
                  />
                ) : null}
                {item.fastingRequired ? (
                  <MetaChip
                    icon={<Clock size={11} color="#B45309" strokeWidth={2.4} />}
                    label={`${item.fastingHours}h fast`}
                    bg="#FEF3C7"
                    fg="#92400E"
                  />
                ) : null}
              </View>

              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontWeight: "600",
                }}
              >
                Results in {item.turnaroundHours}h
              </Text>
            </View>

            <View style={{ alignItems: "flex-end", gap: 4, paddingTop: 2 }}>
              {item.discountPrice ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    textDecorationLine: "line-through",
                    fontWeight: "600",
                  }}
                >
                  {formatPrice(item.price)}
                </Text>
              ) : null}
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: item.discountPrice ? "#059669" : colors.text,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {formatPrice(price)}
              </Text>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                }}
              >
                <ChevronRight size={14} color={colors.primary} strokeWidth={2.5} />
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, fontFamily, router, spacing]
  );

  const listHeader = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      {/* Packages shortcut */}
      <Pressable
        onPress={() => router.push("/(app)/test-packages")}
        style={({ pressed }) => ({
          marginHorizontal: spacing.lg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.primarySoft : colors.surface,
          padding: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        })}
      >
        <PackageThumbnail item={{ slug: "full-body-health-checkup" }} size={46} borderRadius={14} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            Test packages
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            Save more with curated panels
          </Text>
        </View>
        <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
      </Pressable>

      {/* Search */}
      <View
        style={{
          marginHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: 14,
          paddingHorizontal: 14,
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 10,
        }}
      >
        <Search size={18} color={colors.textMuted} strokeWidth={2.25} />
        <TextInput
          placeholder="Search tests..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          style={{
            flex: 1,
            fontSize: 15,
            color: colors.text,
            fontFamily: fontFamily.body,
            paddingVertical: 12,
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
                width: 22,
                height: 22,
                borderRadius: 11,
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
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: active
                  ? colors.primary
                  : pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                minHeight: 36,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: active ? colors.onPrimary : colors.text,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {item.label}
              </Text>
              {item.count > 0 ? (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: active ? "rgba(255,255,255,0.8)" : colors.textMuted,
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
            <Skeleton key={i} height={92} radius={18} />
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
          data={testsData?.tests || []}
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
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: bg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: fg,
          textTransform: "capitalize",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// @ts-nocheck

import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
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
} from "lucide-react-native";
import {
  useTestCatalog,
  useTestCategories,
  type DiagnosticTest,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Skeleton,
  Badge,
} from "@/components/ui";

const CATEGORY_CONFIG: Record<
  string,
  { icon: any; color: string; label: string }
> = {
  blood: { icon: Droplets, color: "#EF4444", label: "Blood Tests" },
  urine: { icon: FlaskConical, color: "#F59E0B", label: "Urine Tests" },
  stool: { icon: Beaker, color: "#8B5CF6", label: "Stool Tests" },
  cardiac: { icon: Heart, color: "#EC4899", label: "Cardiac" },
  diabetes: { icon: Activity, color: "#3B82F6", label: "Diabetes" },
  thyroid: { icon: Shield, color: "#10B981", label: "Thyroid" },
  liver: { icon: Beaker, color: "#F97316", label: "Liver" },
  kidney: { icon: Droplets, color: "#06B6D4", label: "Kidney" },
  lipid: { icon: Pill, color: "#8B5CF6", label: "Lipid Panel" },
  vitamin: { icon: Syringe, color: "#14B8A6", label: "Vitamins" },
  hormone: { icon: Brain, color: "#EC4899", label: "Hormones" },
  cancer_marker: { icon: Microscope, color: "#EF4444", label: "Cancer Markers" },
  infection: { icon: Shield, color: "#F59E0B", label: "Infection" },
  allergy: { icon: Zap, color: "#10B981", label: "Allergy" },
  genetic: { icon: Brain, color: "#8B5CF6", label: "Genetic" },
  imaging: { icon: Activity, color: "#3B82F6", label: "Imaging" },
  other: { icon: TestTube2, color: "#6B7280", label: "Other" },
};

function getCategoryIcon(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
}

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

export default function TestCatalogScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
      }));
  }, [categoriesData]);

  const renderTestCard = useCallback(
    ({ item }: { item: DiagnosticTest }) => {
      const cat = getCategoryIcon(item.category);
      const CatIcon = cat.icon;

      return (
        <Pressable
          onPress={() => router.push(`/test-detail/${item.slug}`)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Card
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              padding: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              {/* Category Icon */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: cat.color + "15",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <CatIcon size={22} color={cat.color} />
              </View>

              {/* Test Info */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  {item.name}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  {/* Sample type badge */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.card,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <TestTube2 size={12} color={colors.textSecondary} />
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textSecondary,
                        marginLeft: 4,
                        textTransform: "capitalize",
                      }}
                    >
                      {item.sampleType}
                    </Text>
                  </View>

                  {/* Fasting badge */}
                  {item.fastingRequired && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#FEF3C7",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Clock size={12} color="#D97706" />
                      <Text
                        style={{
                          fontSize: 11,
                          color: "#D97706",
                          marginLeft: 4,
                        }}
                      >
                        Fasting {item.fastingHours}h
                      </Text>
                    </View>
                  )}

                  {/* Home collection badge */}
                  {item.homeCollectionAvailable && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#ECFDF5",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: "#059669" }}>
                        🏠 Home Collection
                      </Text>
                    </View>
                  )}
                </View>

                {/* Turnaround time */}
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                  }}
                >
                  Results in {item.turnaroundHours}h
                </Text>
              </View>

              {/* Price + Arrow */}
              <View
                style={{
                  alignItems: "flex-end",
                  marginLeft: 8,
                }}
              >
                {item.discountPrice ? (
                  <>
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textSecondary,
                        textDecorationLine: "line-through",
                      }}
                    >
                      {formatPrice(item.price)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: "#059669",
                      }}
                    >
                      {formatPrice(item.discountPrice)}
                    </Text>
                  </>
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: colors.text,
                    }}
                  >
                    {formatPrice(item.price)}
                  </Text>
                )}
                <ChevronRight
                  size={16}
                  color={colors.textSecondary}
                  style={{ marginTop: 4 }}
                />
              </View>
            </View>
          </Card>
        </Pressable>
      );
    },
    [colors, router]
  );

  return (
    <Screen>
      <ScreenHeader
        title="Book a Test"
        subtitle="Home sample collection"
        showBack
      />

      {/* Search Bar */}
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          placeholder="Search tests..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          style={{
            flex: 1,
            marginLeft: 10,
            fontSize: 15,
            color: colors.text,
          }}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Category Chips */}
      <View style={{ marginBottom: 12 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ value: null, label: "All", count: 0 }, ...categoryChips]}
          keyExtractor={(item) => item.value || "all"}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                setSelectedCategory(
                  item.value === selectedCategory ? null : item.value
                )
              }
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor:
                  selectedCategory === item.value
                    ? colors.primary
                    : colors.card,
                marginRight: 8,
                borderWidth: 1,
                borderColor:
                  selectedCategory === item.value
                    ? colors.primary
                    : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: selectedCategory === item.value ? "600" : "400",
                  color:
                    selectedCategory === item.value ? "#fff" : colors.text,
                }}
              >
                {item.label}
                {item.count > 0 ? ` (${item.count})` : ""}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Test List */}
      {isLoading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton
              key={i}
              style={{
                height: 80,
                borderRadius: 12,
                marginBottom: 12,
              }}
            />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Failed to load tests"
          description="Please check your connection and try again."
        />
      ) : testsData?.tests.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No tests found"
          description={
            search
              ? `No results for "${search}"`
              : "No tests available in this category."
          }
        />
      ) : (
        <FlatList
          data={testsData?.tests || []}
          keyExtractor={(item) => item.id}
          renderItem={renderTestCard}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

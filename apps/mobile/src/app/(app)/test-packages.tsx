// @ts-nocheck

import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Search,
  Package,
  TrendingDown,
  TestTube2,
  Clock,
  ChevronRight,
  X,
  Sparkles,
  AlertCircle,
} from "lucide-react-native";
import { useTestPackages, type TestPackage } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  ScreenHeader,
  Card,
  EmptyState,
  Skeleton,
} from "@/components/ui";

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

export default function TestPackagesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, error } = useTestPackages({
    search: debouncedSearch || undefined,
  });

  const renderPackageCard = useCallback(
    ({ item }: { item: TestPackage }) => {
      const effectivePrice = item.discountPrice ?? item.price;
      const savings = item.savings || item.price - effectivePrice;
      const hasSavings = savings > 0;

      return (
        <Pressable
          onPress={() => router.push(`/test-package-detail/${item.slug}`)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Card
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              padding: 0,
              overflow: "hidden",
            }}
          >
            {/* Savings Banner */}
            {hasSavings && (
              <View
                style={{
                  backgroundColor: "#059669",
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <TrendingDown size={14} color="#fff" />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#fff",
                    marginLeft: 6,
                  }}
                >
                  Save {formatPrice(savings)}
                </Text>
              </View>
            )}

            <View style={{ padding: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                }}
              >
                {/* Package Icon */}
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: colors.primary + "15",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Package size={24} color={colors.primary} />
                </View>

                {/* Package Info */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {item.name}
                  </Text>

                  {item.description && (
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        marginBottom: 8,
                        lineHeight: 18,
                      }}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  )}

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {item.testCount && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <TestTube2 size={14} color={colors.textSecondary} />
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                            marginLeft: 4,
                          }}
                        >
                          {item.testCount} tests
                        </Text>
                      </View>
                    )}

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Clock size={14} color={colors.textSecondary} />
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                          marginLeft: 4,
                        }}
                      >
                        Results in {item.turnaroundHours}h
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Price */}
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
                          fontSize: 18,
                          fontWeight: "800",
                          color: "#059669",
                        }}
                      >
                        {formatPrice(item.discountPrice)}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "800",
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
        title="Health Packages"
        subtitle="Comprehensive test bundles"
        showBack
      />

      {/* Search Bar */}
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
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
          placeholder="Search packages..."
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

      {/* Package List */}
      {isLoading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              style={{
                height: 120,
                borderRadius: 16,
                marginBottom: 12,
              }}
            />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Failed to load packages"
          description="Please check your connection and try again."
        />
      ) : data?.packages.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No packages found"
          description={
            search
              ? `No results for "${search}"`
              : "No health packages available yet."
          }
        />
      ) : (
        <FlatList
          data={data?.packages || []}
          keyExtractor={(item) => item.id}
          renderItem={renderPackageCard}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

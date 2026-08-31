// @ts-nocheck

import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Package,
  TestTube2,
  Clock,
  TrendingDown,
  Check,
  ChevronRight,
  Info,
  AlertCircle,
} from "lucide-react-native";
import { useTestPackageDetail } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { CURATED_PACKAGES, PackageThumbnail } from "../test-packages";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  EmptyState,
} from "@/components/ui";

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  blood: "#EF4444",
  urine: "#F59E0B",
  cardiac: "#EC4899",
  diabetes: "#3B82F6",
  thyroid: "#10B981",
  liver: "#F97316",
  kidney: "#06B6D4",
  lipid: "#8B5CF6",
  vitamin: "#14B8A6",
  hormone: "#EC4899",
  cancer_marker: "#EF4444",
  infection: "#F59E0B",
  allergy: "#10B981",
  genetic: "#8B5CF6",
};

export default function TestPackageDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { data, isLoading, error } = useTestPackageDetail(slug);

  if (isLoading) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Package Details" back />
        <View style={{ padding: 16 }}>
          <Skeleton style={{ height: 180, borderRadius: 16, marginBottom: 16 }} />
          <Skeleton style={{ height: 300, borderRadius: 12 }} />
        </View>
      </Screen>
    );
  }

  const fallbackPkg = CURATED_PACKAGES.find((c) => c.slug === slug);
  const pkg = data?.package ?? fallbackPkg;

  if (!pkg) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Package Details" back />
        <EmptyState
          icon={AlertCircle}
          title="Package not found"
          description="This package may no longer be available."
        />
      </Screen>
    );
  }
  const effectivePrice = pkg.discountPrice ?? pkg.price;
  const savings = pkg.savings || pkg.price - effectivePrice;
  const hasSavings = savings > 0;

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={pkg.name} back />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header Card */}
        <Card style={{ marginHorizontal: 16, marginTop: 8, padding: 0, overflow: "hidden" }}>
          {/* Savings Banner */}
          {hasSavings && (
            <View
              style={{
                backgroundColor: "#059669",
                paddingHorizontal: 16,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <TrendingDown size={18} color="#fff" />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#fff",
                  marginLeft: 8,
                }}
              >
                You save {formatPrice(savings)}!
              </Text>
            </View>
          )}

          <View style={{ padding: 20 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <View style={{ marginRight: 14 }}>
                <PackageThumbnail item={{ ...pkg, slug }} size={72} borderRadius={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  {pkg.name}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {pkg.testCount || pkg.tests?.length || 0} tests included
                </Text>
              </View>
            </View>

            {/* Price */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                marginBottom: 16,
              }}
            >
              {pkg.discountPrice ? (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      color: colors.textSecondary,
                      textDecorationLine: "line-through",
                      marginRight: 10,
                    }}
                  >
                    {formatPrice(pkg.price)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 32,
                      fontWeight: "800",
                      color: "#059669",
                    }}
                  >
                    {formatPrice(pkg.discountPrice)}
                  </Text>
                </>
              ) : (
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  {formatPrice(pkg.price)}
                </Text>
              )}
            </View>

            {/* Meta info */}
            <View
              style={{
                flexDirection: "row",
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Clock size={16} color={colors.textSecondary} />
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginLeft: 6,
                  }}
                >
                  Results in {pkg.turnaroundHours}h
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TestTube2 size={16} color={colors.textSecondary} />
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginLeft: 6,
                  }}
                >
                  Home collection
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Description */}
        {pkg.description && (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              About this package
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                lineHeight: 22,
              }}
            >
              {pkg.description}
            </Text>
          </Card>
        )}

        {/* Instructions */}
        {pkg.instructions && (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Info size={16} color="#3B82F6" />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.text,
                  marginLeft: 6,
                }}
              >
                Pre-test Instructions
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                lineHeight: 22,
              }}
            >
              {pkg.instructions}
            </Text>
          </Card>
        )}

        {/* Included Tests */}
        {pkg.tests && pkg.tests.length > 0 && (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 16 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 4,
              }}
            >
              Included Tests ({pkg.tests.length})
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: 16,
              }}
            >
              Individual total: {formatPrice(pkg.totalIndividualPrice || 0)}
            </Text>

            {pkg.tests.map((testItem, index) => {
              const isString = typeof testItem === "string";
              const testName = isString ? testItem : testItem.testName || testItem.name || "Diagnostic Test";
              const testCategory = (!isString && testItem.testCategory) ? testItem.testCategory : "blood";
              const categoryColor = CATEGORY_COLORS[testCategory] || "#0284C7";
              const testSlug = !isString ? testItem.testSlug : undefined;
              const hasPrice = !isString && (testItem.testDiscountPrice != null || testItem.testPrice != null);
              const fasting = !isString ? testItem.fastingRequired : false;

              return (
                <Pressable
                  key={isString ? `${testItem}-${index}` : testItem.id || index}
                  onPress={() => testSlug ? router.push(`/test-detail/${testSlug}`) : undefined}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: index < pkg.tests.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: categoryColor + "18",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Check
                      size={16}
                      color={categoryColor}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.text,
                      }}
                    >
                      {testName}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.textSecondary,
                          textTransform: "capitalize",
                        }}
                      >
                        {testCategory.replace(/_/g, " ")}
                      </Text>
                      {fasting && (
                        <Text style={{ fontSize: 11, color: "#D97706", fontWeight: "500" }}>
                          Fasting required
                        </Text>
                      )}
                    </View>
                  </View>

                  {hasPrice && (
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                      }}
                    >
                      {formatPrice(testItem.testDiscountPrice ?? testItem.testPrice)}
                    </Text>
                  )}
                  {testSlug && (
                    <ChevronRight size={16} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                  )}
                </Pressable>
              );
            })}
          </Card>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: 32,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button
          title={`Book Package — ${formatPrice(effectivePrice)}`}
          onPress={() =>
            router.push({
              pathname: "/book-test",
              params: {
                bookingType: "package",
                packageId: pkg.id,
                packageName: pkg.name,
                testPrice: String(effectivePrice),
              },
            })
          }
          style={{ width: "100%" }}
        />
      </View>
    </Screen>
  );
}

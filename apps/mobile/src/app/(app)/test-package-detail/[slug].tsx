// @ts-nocheck

import { View, Text, ScrollView, Pressable, Image, StyleSheet } from "react-native";
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
  const { colors, typography, radius } = useTheme();
  const router = useRouter();
  const sectionTitle = { ...typography.title.md, color: colors.text };
  const bodyText = { ...typography.body.md, lineHeight: 22, color: colors.textMuted };

  const { data, isLoading, error } = useTestPackageDetail(slug);

  const fallbackPkg = CURATED_PACKAGES.find((c) => c.slug === slug);
  const pkg = (data as any)?.id ? data : (data as any)?.package ?? fallbackPkg;

  if (isLoading && !pkg) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Package Details" back />
        <View style={{ padding: 16 }}>
          <Skeleton style={{ height: 220, borderRadius: radius.card, marginBottom: 12 }} />
          <Skeleton style={{ height: 300, borderRadius: radius.card }} />
        </View>
      </Screen>
    );
  }

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
                backgroundColor: colors.successSoft,
                paddingHorizontal: 20,
                paddingVertical: 9,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <TrendingDown size={16} color={colors.success} strokeWidth={2.4} />
              <Text
                style={{
                  ...typography.label.md,
                  color: colors.success,
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
                    ...typography.display.sm,
                    fontSize: 20,
                    lineHeight: 25,
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  {pkg.name}
                </Text>
                <Text style={{ ...typography.body.sm, color: colors.textMuted }}>
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
                      ...typography.body.lg,
                      color: colors.textSubtle,
                      textDecorationLine: "line-through",
                      marginRight: 10,
                    }}
                  >
                    {formatPrice(pkg.price)}
                  </Text>
                  <Text
                    style={{
                      ...typography.display.lg,
                      color: colors.text,
                    }}
                  >
                    {formatPrice(pkg.discountPrice)}
                  </Text>
                </>
              ) : (
                <Text
                  style={{
                    ...typography.display.lg,
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
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.infoSoft,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <Clock size={14} color={colors.info} strokeWidth={2.4} />
                <Text
                  style={{
                    ...typography.label.sm,
                    color: colors.info,
                    marginLeft: 6,
                  }}
                >
                  Results in {pkg.turnaroundHours}h
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.successSoft,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <TestTube2 size={14} color={colors.success} strokeWidth={2.4} />
                <Text
                  style={{
                    ...typography.label.sm,
                    color: colors.success,
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
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 18 }}>
            <Text style={{ ...sectionTitle, marginBottom: 8 }}>
              About this package
            </Text>
            <Text style={bodyText}>
              {pkg.description}
            </Text>
          </Card>
        )}

        {/* Instructions */}
        {pkg.instructions && (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 18 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Info size={16} color={colors.info} strokeWidth={2.4} />
              <Text style={{ ...sectionTitle, marginLeft: 8 }}>
                Pre-test Instructions
              </Text>
            </View>
            <Text style={bodyText}>
              {pkg.instructions}
            </Text>
          </Card>
        )}

        {/* Included Tests */}
        {pkg.tests && pkg.tests.length > 0 && (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 18, paddingBottom: 8 }}>
            <Text style={{ ...sectionTitle, marginBottom: 2 }}>
              Included Tests ({pkg.tests.length})
            </Text>
            <Text
              style={{
                ...typography.caption,
                color: colors.textSubtle,
                marginBottom: 8,
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
                    minHeight: 56,
                    paddingVertical: 12,
                    borderBottomWidth: index < pkg.tests.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      backgroundColor: categoryColor + "1F",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Check
                      size={16}
                      color={categoryColor}
                      strokeWidth={2.6}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...typography.title.xs,
                        fontSize: 14,
                        color: colors.text,
                      }}
                    >
                      {testName}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <Text
                        style={{
                          ...typography.caption,
                          fontSize: 11,
                          color: colors.textSubtle,
                          textTransform: "capitalize",
                        }}
                      >
                        {testCategory.replace(/_/g, " ")}
                      </Text>
                      {fasting && (
                        <Text style={{ ...typography.label.xs, color: colors.warning }}>
                          Fasting required
                        </Text>
                      )}
                    </View>
                  </View>

                  {hasPrice && (
                    <Text
                      style={{
                        ...typography.label.md,
                        color: colors.textMuted,
                      }}
                    >
                      {formatPrice(testItem.testDiscountPrice ?? testItem.testPrice)}
                    </Text>
                  )}
                  {testSlug && (
                    <ChevronRight size={16} color={colors.textSubtle} style={{ marginLeft: 6 }} />
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
          backgroundColor: colors.bgElevated ?? colors.surface,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 32,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <Button
          size="lg"
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

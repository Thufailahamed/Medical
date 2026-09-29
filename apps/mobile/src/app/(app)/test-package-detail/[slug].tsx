// @ts-nocheck

import React from "react";
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  TestTube2,
  Clock,
  TrendingDown,
  Check,
  ChevronRight,
  ChevronLeft,
  Info,
  AlertCircle,
  CalendarClock,
  Home,
  FileText,
  Timer,
} from "lucide-react-native";
import { useTestPackageDetail } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { CURATED_PACKAGES, packageImage } from "../test-packages";
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
  const insets = useSafeAreaInsets();
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
  const turnaround = pkg.turnaroundHours ?? pkg.reportTimeHours;
  const fastingHours = pkg.fastingHours;
  const individualTotal = pkg.totalIndividualPrice || 0;
  const discountPct = pkg.price > 0 && pkg.discountPrice
    ? Math.round(((pkg.price - pkg.discountPrice) / pkg.price) * 100)
    : 0;
  const kicker = { ...typography.kicker, color: colors.primary, textTransform: "uppercase" } as const;

  return (
    <Screen padded={false} edges={[]} bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 132 }}
      >
        {/* Photo hero */}
        <View style={{ height: 296 }}>
          <Image
            source={packageImage({ ...pkg, slug })}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["rgba(4,18,32,0.55)", "rgba(4,18,32,0.08)", "rgba(4,18,32,0.78)"]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          {pkg.tag && (
            <View
              style={{
                position: "absolute",
                top: insets.top + 14,
                left: 68,
                backgroundColor: "rgba(255,255,255,0.92)",
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 999,
                borderCurve: "continuous",
              }}
            >
              <Text style={{ ...typography.label.xs, fontSize: 10.5, color: colors.primary, letterSpacing: 0.8 }}>
                {pkg.tag}
              </Text>
            </View>
          )}
          {hasSavings && (
            <View
              style={{
                position: "absolute",
                top: insets.top + 14,
                right: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: "rgba(5,150,105,0.92)",
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 999,
                borderCurve: "continuous",
              }}
            >
              <TrendingDown size={12} color="#FFFFFF" strokeWidth={2.6} />
              <Text style={{ ...typography.label.xs, fontSize: 11, color: "#FFFFFF" }}>
                Save {formatPrice(savings)}
              </Text>
            </View>
          )}
        </View>

        {/* Detail card, overlapping the hero */}
        <Card
          variant="elevated"
          style={{ marginHorizontal: 16, marginTop: -52, padding: 20 }}
        >
          <Text
            style={{
              ...typography.display.sm,
              fontSize: 21,
              lineHeight: 26,
              color: colors.text,
            }}
          >
            {pkg.name}
          </Text>
          <Text style={{ ...typography.body.sm, color: colors.textMuted, marginTop: 4 }}>
            {pkg.testCount || pkg.tests?.length || 0} tests · One booking
          </Text>

          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.separator,
              marginVertical: 16,
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <View>
              <Text style={{ ...typography.overline, color: colors.textSubtle, marginBottom: 2 }}>
                Package price
              </Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={{ ...typography.display.lg, fontSize: 28, lineHeight: 32, color: colors.text }}>
                  {formatPrice(effectivePrice)}
                </Text>
                {pkg.discountPrice != null && pkg.discountPrice !== pkg.price ? (
                  <Text
                    style={{
                      ...typography.body.md,
                      color: colors.textSubtle,
                      textDecorationLine: "line-through",
                    }}
                  >
                    {formatPrice(pkg.price)}
                  </Text>
                ) : null}
              </View>
            </View>
            {discountPct > 0 && (
              <View
                style={{
                  backgroundColor: colors.successSoft,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  borderCurve: "continuous",
                }}
              >
                <Text style={{ ...typography.label.md, color: colors.success }}>
                  {discountPct}% OFF
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {turnaround ? (
              <MetaPill icon={<Clock size={13} color={colors.info} strokeWidth={2.4} />} label={`Results in ${turnaround}h`} bg={colors.infoSoft} fg={colors.info} />
            ) : null}
            <MetaPill icon={<Home size={13} color={colors.success} strokeWidth={2.4} />} label="Home collection" bg={colors.successSoft} fg={colors.success} />
            {fastingHours ? (
              <MetaPill icon={<Timer size={13} color={colors.warning} strokeWidth={2.4} />} label={`Fasting ${fastingHours}h`} bg={colors.warningSoft} fg={colors.warning} />
            ) : null}
          </View>
        </Card>

        {/* How it works */}
        <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 18, paddingVertical: 16 }}>
          <Text style={{ ...kicker, marginBottom: 14 }}>How it works</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[
              { icon: CalendarClock, label: "Book", sub: "Pick a slot" },
              { icon: TestTube2, label: "Collect", sub: "We visit you" },
              { icon: FileText, label: "Report", sub: turnaround ? `${turnaround}h digital` : "Digital" },
            ].map((step, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong, marginHorizontal: 4, marginBottom: 24 }} />
                )}
                <View style={{ alignItems: "center", width: 68 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 7,
                    }}
                  >
                    <step.icon size={20} color={colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={{ ...typography.label.sm, color: colors.text }}>{step.label}</Text>
                  <Text style={{ ...typography.caption, fontSize: 10.5, color: colors.textSubtle, marginTop: 1 }}>
                    {step.sub}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </Card>

        {/* Description */}
        {pkg.description && (
          <View style={{ marginHorizontal: 20, marginTop: 24 }}>
            <Text style={{ ...kicker, marginBottom: 8 }}>About this package</Text>
            <Text style={bodyText}>{pkg.description}</Text>
          </View>
        )}

        {/* Instructions */}
        {pkg.instructions && (
          <Card
            variant="muted"
            style={{ marginHorizontal: 16, marginTop: 20, padding: 16, flexDirection: "row", gap: 12 }}
          >
            <Info size={16} color={colors.info} strokeWidth={2.4} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.label.lg, color: colors.text, marginBottom: 4 }}>
                Before your test
              </Text>
              <Text style={bodyText}>{pkg.instructions}</Text>
            </View>
          </Card>
        )}

        {/* Included Tests */}
        {pkg.tests && pkg.tests.length > 0 && (
          <Card style={{ marginHorizontal: 16, marginTop: 20, padding: 18, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ ...kicker }}>Included tests</Text>
              <View
                style={{
                  backgroundColor: colors.primarySoft,
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Text style={{ ...typography.label.xs, color: colors.primary }}>
                  {pkg.tests.length} total
                </Text>
              </View>
            </View>

            {individualTotal > 0 && (
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textMuted,
                  marginBottom: 10,
                }}
              >
                {"Bought separately "}
                <Text style={{ textDecorationLine: "line-through", color: colors.textSubtle }}>
                  {formatPrice(individualTotal)}
                </Text>
                {individualTotal > effectivePrice ? (
                  <Text style={{ color: colors.success, fontFamily: typography.label.md.fontFamily }}>
                    {` · save ${formatPrice(individualTotal - effectivePrice)}`}
                  </Text>
                ) : null}
              </Text>
            )}

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

      {/* Glass back button over the hero */}
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(app)"))}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        style={{
          position: "absolute",
          top: insets.top + 14,
          left: 16,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(8,24,40,0.34)",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255,255,255,0.35)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: -2 }} />
      </Pressable>

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
          paddingBottom: Math.max(insets.bottom, 12) + 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        {hasSavings && (
          <Text
            style={{
              ...typography.label.sm,
              color: colors.success,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            You save {formatPrice(savings)} vs booking tests separately
          </Text>
        )}
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

function MetaPill({
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
        backgroundColor: bg,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        gap: 6,
      }}
    >
      {icon}
      <Text style={{ ...typography.label.sm, color: fg }}>{label}</Text>
    </View>
  );
}

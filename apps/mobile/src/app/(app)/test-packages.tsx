// @ts-nocheck

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Image,
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
  FlaskConical,
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

import { LAB_PACKAGE_BASE64 } from "@/constants/package-assets";

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

export function packageImage(pkg: { slug?: string; name?: string; description?: string } | string): any {
  const slug = typeof pkg === "string" ? pkg : pkg?.slug || "";
  if (LAB_PACKAGE_BASE64[slug]) {
    return { uri: LAB_PACKAGE_BASE64[slug] };
  }
  const text = typeof pkg === "string" ? pkg.toLowerCase() : `${pkg?.name ?? ""} ${pkg?.description ?? ""}`.toLowerCase();
  if (text.includes("diabet") || text.includes("sugar")) return { uri: LAB_PACKAGE_BASE64["comprehensive-diabetic-screen"] };
  if (text.includes("cardiac") || text.includes("heart")) return { uri: LAB_PACKAGE_BASE64["cardiac-wellness-profile"] };
  if (text.includes("senior")) return { uri: LAB_PACKAGE_BASE64["senior-citizen-wellness"] };
  if (text.includes("essential")) return { uri: LAB_PACKAGE_BASE64["essential-health-checkup"] };
  return { uri: LAB_PACKAGE_BASE64["full-body-health-checkup"] };
}

export function PackageThumbnail({
  item,
  size = 72,
  borderRadius = 18,
}: {
  item: any;
  size?: number;
  borderRadius?: number;
}) {
  const slug = item?.slug || "";
  const name = (item?.name || "").toLowerCase();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [slug]);

  let bg = "#F0F9FF";
  let border = "#BAE6FD";
  let iconColor = "#0284C7";

  if (slug.includes("diabet") || name.includes("diabet")) {
    bg = "#ECFDF5";
    border = "#A7F3D0";
    iconColor = "#059669";
  } else if (slug.includes("cardiac") || name.includes("cardiac") || name.includes("heart")) {
    bg = "#FFF1F2";
    border = "#FECDD3";
    iconColor = "#E11D48";
  } else if (slug.includes("senior") || name.includes("senior")) {
    bg = "#FAF5FF";
    border = "#E9D5FF";
    iconColor = "#9333EA";
  } else if (slug.includes("essential") || name.includes("essential")) {
    bg = "#FFFBEB";
    border = "#FDE68A";
    iconColor = "#D97706";
  }

  const src = packageImage(item);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: "hidden",
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FlaskConical size={Math.round(size * 0.44)} color={iconColor} />
      {!failed && src ? (
        <Image
          source={src}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size,
            height: size,
          }}
        />
      ) : null}
    </View>
  );
}

export const CURATED_PACKAGES = [
  {
    id: "pkg-full-body",
    slug: "full-body-health-checkup",
    name: "Full Body Executive Health Checkup",
    price: 8500,
    discountPrice: 5900,
    testCount: 68,
    savings: 2600,
    tag: "BEST VALUE",
    description:
      "Comprehensive diagnostic screening covering vital organs, blood profile, metabolic markers, and liver/kidney functions.",
    tests: [
      "Complete Blood Count (CBC)",
      "Lipid & Cholesterol Ratio",
      "Liver Function (SGPT/SGOT)",
      "Renal Function (Creatinine)",
      "Fasting Blood Sugar",
      "Urine Full Report (UFR)",
      "Thyroid Screening (TSH)",
    ],
    reportTimeHours: 12,
    fastingHours: 10,
  },
  {
    id: "pkg-senior",
    slug: "senior-citizen-wellness",
    name: "Senior Citizen Wellness & Vitality",
    price: 9200,
    discountPrice: 6500,
    testCount: 45,
    savings: 2700,
    tag: "SENIOR CARE",
    description:
      "Designed for age 55+ to track bone health, vital organ functions, vitamin levels, and joint inflammation markers.",
    tests: [
      "Calcium & Vitamin D3 Total",
      "Vitamin B12 Vitality Assay",
      "Uric Acid & Bone Health",
      "Full Kidney & Liver Panel",
      "HbA1c Glycated Hemoglobin",
    ],
    reportTimeHours: 18,
    fastingHours: 8,
  },
  {
    id: "pkg-cardiac",
    slug: "cardiac-wellness-profile",
    name: "Advanced Cardiac & Vascular Profile",
    price: 7800,
    discountPrice: 5400,
    testCount: 32,
    savings: 2400,
    tag: "CARDIO HEALTH",
    description:
      "Heart-health risk assessment detecting silent arterial plaque indicators, systemic inflammation, and lipid abnormalities.",
    tests: [
      "High-Sensitivity CRP (hs-CRP)",
      "Extended Lipid Profile (HDL/LDL)",
      "Apolipoprotein A1 & B Ratio",
      "Electrolytes (Na, K, Cl)",
    ],
    reportTimeHours: 16,
    fastingHours: 12,
  },
  {
    id: "pkg-diabetic",
    slug: "comprehensive-diabetic-screen",
    name: "Comprehensive Diabetic Care Package",
    price: 5200,
    discountPrice: 3800,
    testCount: 28,
    savings: 1400,
    tag: "POPULAR",
    description:
      "Essential periodic monitoring for pre-diabetic and diabetic management, including 3-month glycemic averages.",
    tests: [
      "HbA1c Glycated Hemoglobin",
      "Fasting & Post-Prandial Sugar",
      "Microalbumin / Creatinine",
      "Serum Creatinine & eGFR",
    ],
    reportTimeHours: 8,
    fastingHours: 10,
  },
  {
    id: "pkg-essential",
    slug: "essential-health-checkup",
    name: "Essential Health Checkup",
    price: 3500,
    discountPrice: 2800,
    testCount: 18,
    savings: 700,
    tag: "BASIC CARE",
    description:
      "Vital baseline diagnostic assessment for routine annual wellness checks and basic metabolic evaluation.",
    tests: [
      "Complete Blood Count (CBC)",
      "Routine Urine Analysis",
      "Blood Glucose Level",
      "Total Cholesterol Screening",
    ],
    reportTimeHours: 6,
    fastingHours: 8,
  },
];

export default function TestPackagesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, error } = useTestPackages({
    search: debouncedSearch || undefined,
  });

  const packagesList = useMemo(() => {
    const bySlug = new Map<string, any>();
    for (const c of CURATED_PACKAGES) bySlug.set(c.slug, c);
    const apiPackages = data?.packages ?? [];
    for (const p of apiPackages) {
      const found = bySlug.get(p.slug);
      bySlug.set(p.slug, { ...p, ...found, ...p });
    }
    const all = Array.from(bySlug.values());
    if (!debouncedSearch.trim()) return all;
    const q = debouncedSearch.toLowerCase();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [data?.packages, debouncedSearch]);

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
                {/* Package Illustration */}
                <View style={{ marginRight: 14 }}>
                  <PackageThumbnail item={item} size={72} borderRadius={18} />
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
                        color: colors.textMuted,
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
                        <TestTube2 size={14} color={colors.textMuted} />
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.textMuted,
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
                      <Clock size={14} color={colors.textMuted} />
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.textMuted,
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
                          color: colors.textMuted,
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
                    color={colors.textMuted}
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
    <Screen padded={false} bottomInset={false} edges={["top"]}>
      <ScreenHeader
        title="Health Packages"
        subtitle="Comprehensive test bundles"
        back
      />

      {/* Search Bar */}
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Search size={18} color={colors.textMuted} />
        <TextInput
          placeholder="Search packages..."
          placeholderTextColor={colors.textMuted}
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
            <X size={18} color={colors.textMuted} />
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
      ) : error && packagesList.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Failed to load packages"
          message="Please check your connection and try again."
        />
      ) : packagesList.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No packages found"
          message={
            search
              ? `No results for "${search}"`
              : "No health packages available yet."
          }
        />
      ) : (
        <FlatList
          data={packagesList}
          keyExtractor={(item) => item.id}
          renderItem={renderPackageCard}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

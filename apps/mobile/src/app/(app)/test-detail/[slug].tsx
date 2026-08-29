// @ts-nocheck

import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  TestTube2,
  Clock,
  Droplets,
  AlertCircle,
  CheckCircle2,
  Package,
  ChevronRight,
  Info,
  Home,
} from "lucide-react-native";
import { useTestDetail } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Button,
  Skeleton,
  EmptyState,
} from "@/components/ui";

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

export default function TestDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors, spacing, fontFamily } = useTheme();
  const router = useRouter();

  const { data, isLoading, error } = useTestDetail(slug);

  if (isLoading) {
    return (
      <Screen padded={false} bottomInset={false} edges={["top"]}>
        <ScreenHeader title="Test Details" back />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={180} radius={20} />
          <Skeleton height={100} radius={16} />
          <Skeleton height={80} radius={16} />
        </View>
      </Screen>
    );
  }

  if (error || !data?.test) {
    return (
      <Screen padded={false} bottomInset={false} edges={["top"]}>
        <ScreenHeader title="Test Details" back />
        <EmptyState
          icon={AlertCircle}
          title="Test not found"
          message="This test may no longer be available."
        />
      </Screen>
    );
  }

  const { test, packages } = data;
  const price = test.discountPrice ?? test.price;

  return (
    <Screen padded={false} bottomInset={false} edges={["top"]}>
      <ScreenHeader title="Test details" back />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140, paddingTop: spacing.sm }}
      >
        {/* Hero summary */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.28,
                shadowRadius: 10,
                elevation: 4,
              }}
            >
              <TestTube2 size={26} color={colors.onPrimary} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "800",
                  color: colors.text,
                  fontFamily: fontFamily.bodyBold,
                  letterSpacing: -0.4,
                  lineHeight: 26,
                }}
              >
                {test.name}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  marginTop: 4,
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}
              >
                {test.category.replace(/_/g, " ")} · {test.sampleType} sample
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            {test.discountPrice ? (
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textMuted,
                  textDecorationLine: "line-through",
                  fontWeight: "600",
                }}
              >
                {formatPrice(test.price)}
              </Text>
            ) : null}
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: test.discountPrice ? "#059669" : colors.text,
                fontFamily: fontFamily.bodyBold,
                letterSpacing: -0.5,
              }}
            >
              {formatPrice(price)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <InfoPill
              icon={<Clock size={14} color="#2563EB" strokeWidth={2.4} />}
              label={`Results in ${test.turnaroundHours}h`}
              bg="#EFF6FF"
              fg="#1D4ED8"
            />
            <InfoPill
              icon={<Droplets size={14} color="#7C3AED" strokeWidth={2.4} />}
              label={`${test.sampleType} sample`}
              bg="#F5F3FF"
              fg="#6D28D9"
            />
            {test.fastingRequired ? (
              <InfoPill
                icon={<AlertCircle size={14} color="#B45309" strokeWidth={2.4} />}
                label={`Fasting ${test.fastingHours}h`}
                bg="#FEF3C7"
                fg="#92400E"
              />
            ) : null}
            {test.homeCollectionAvailable ? (
              <InfoPill
                icon={<Home size={14} color="#059669" strokeWidth={2.4} />}
                label="Home collection"
                bg="#ECFDF5"
                fg="#047857"
              />
            ) : null}
          </View>
        </View>

        {test.description ? (
          <SectionCard title="About this test" colors={colors} spacing={spacing} fontFamily={fontFamily}>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                lineHeight: 22,
                fontWeight: "500",
              }}
            >
              {test.description}
            </Text>
          </SectionCard>
        ) : null}

        {test.instructions ? (
          <SectionCard title="Pre-test instructions" colors={colors} spacing={spacing} fontFamily={fontFamily} icon>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                lineHeight: 22,
                fontWeight: "500",
              }}
            >
              {test.instructions}
            </Text>
          </SectionCard>
        ) : null}

        {packages && packages.length > 0 ? (
          <SectionCard title="Available in packages" colors={colors} spacing={spacing} fontFamily={fontFamily}>
            <View style={{ gap: 4 }}>
              {packages.map((pkg, idx) => (
                <Pressable
                  key={pkg.id}
                  onPress={() => router.push(`/test-package-detail/${pkg.slug}`)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                    gap: 10,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Package size={16} color={colors.primary} strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: colors.text,
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
                      {pkg.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "600" }}>
                      {formatPrice(pkg.discountPrice ?? pkg.price)}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
                </Pressable>
              ))}
            </View>
          </SectionCard>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 28,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button
          title={`Book now — ${formatPrice(price)}`}
          onPress={() =>
            router.push({
              pathname: "/book-test",
              params: {
                bookingType: "single_test",
                testId: test.id,
                testName: test.name,
                testPrice: String(price),
                fastingRequired: test.fastingRequired ? "1" : "0",
                fastingHours: String(test.fastingHours),
              },
            })
          }
        />
      </View>
    </Screen>
  );
}

function SectionCard({
  title,
  children,
  colors,
  spacing,
  fontFamily,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  colors: any;
  spacing: any;
  fontFamily: any;
  icon?: boolean;
}) {
  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon ? <Info size={15} color={colors.primary} strokeWidth={2.4} /> : null}
        <Text
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: colors.text,
            fontFamily: fontFamily.bodyBold,
          }}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function InfoPill({
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
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 10,
        gap: 6,
      }}
    >
      {icon}
      <Text style={{ fontSize: 12, fontWeight: "700", color: fg, textTransform: "capitalize" }}>
        {label}
      </Text>
    </View>
  );
}

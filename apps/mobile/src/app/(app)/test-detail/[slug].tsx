// @ts-nocheck

import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  TestTube2,
  Clock,
  Droplets,
  AlertCircle,
  CheckCircle2,
  Package,
  ChevronRight,
  Info,
} from "lucide-react-native";
import { useTestDetail } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
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

export default function TestDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { data, isLoading, error } = useTestDetail(slug);

  if (isLoading) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Test Details" back />
        <View style={{ padding: 16 }}>
          <Skeleton style={{ height: 200, borderRadius: 16, marginBottom: 16 }} />
          <Skeleton style={{ height: 120, borderRadius: 12, marginBottom: 16 }} />
          <Skeleton style={{ height: 80, borderRadius: 12 }} />
        </View>
      </Screen>
    );
  }

  if (error || !data?.test) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Test Details" back />
        <EmptyState
          icon={AlertCircle}
          title="Test not found"
          description="This test may no longer be available."
        />
      </Screen>
    );
  }

  const { test, packages } = data;

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={test.name} back />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header Card */}
        <Card style={{ marginHorizontal: 16, marginTop: 8, padding: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: colors.primary + "15",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
              }}
            >
              <TestTube2 size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                {test.name}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  textTransform: "capitalize",
                }}
              >
                {test.category.replace(/_/g, " ")} • {test.sampleType} sample
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
            {test.discountPrice ? (
              <>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    textDecorationLine: "line-through",
                    marginRight: 8,
                  }}
                >
                  {formatPrice(test.price)}
                </Text>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "800",
                    color: "#059669",
                  }}
                >
                  {formatPrice(test.discountPrice)}
                </Text>
              </>
            ) : (
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "800",
                  color: colors.text,
                }}
              >
                {formatPrice(test.price)}
              </Text>
            )}
          </View>

          {/* Info Grid */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <InfoPill
              icon={<Clock size={16} color="#3B82F6" />}
              label={`Results in ${test.turnaroundHours}h`}
              bgColor="#EFF6FF"
            />
            <InfoPill
              icon={<Droplets size={16} color="#8B5CF6" />}
              label={`${test.sampleType} sample`}
              bgColor="#F5F3FF"
            />
            {test.fastingRequired && (
              <InfoPill
                icon={<AlertCircle size={16} color="#D97706" />}
                label={`Fasting ${test.fastingHours}h required`}
                bgColor="#FEF3C7"
              />
            )}
            {test.homeCollectionAvailable && (
              <InfoPill
                icon={<CheckCircle2 size={16} color="#059669" />}
                label="Home Collection"
                bgColor="#ECFDF5"
              />
            )}
          </View>
        </Card>

        {/* Description */}
        {test.description && (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              About this test
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                lineHeight: 22,
              }}
            >
              {test.description}
            </Text>
          </Card>
        )}

        {/* Pre-test Instructions */}
        {test.instructions && (
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
              {test.instructions}
            </Text>
          </Card>
        )}

        {/* Packages containing this test */}
        {packages && packages.length > 0 && (
          <Card style={{ marginHorizontal: 16, marginTop: 12, padding: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 12,
              }}
            >
              Available in packages
            </Text>
            {packages.map((pkg) => (
              <Pressable
                key={pkg.id}
                onPress={() => router.push(`/test-package-detail/${pkg.slug}`)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Package size={18} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: colors.text,
                    }}
                  >
                    {pkg.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {formatPrice(pkg.discountPrice ?? pkg.price)}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textSecondary} />
              </Pressable>
            ))}
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
          title={`Book Now — ${formatPrice(test.discountPrice ?? test.price)}`}
          onPress={() =>
            router.push({
              pathname: "/book-test",
              params: {
                bookingType: "single_test",
                testId: test.id,
                testName: test.name,
                testPrice: test.discountPrice ?? test.price,
                fastingRequired: test.fastingRequired ? "1" : "0",
                fastingHours: String(test.fastingHours),
              },
            })
          }
          style={{ width: "100%" }}
        />
      </View>
    </Screen>
  );
}

function InfoPill({
  icon,
  label,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  bgColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bgColor,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
      }}
    >
      {icon}
      <Text style={{ fontSize: 12, marginLeft: 6, color: "#374151" }}>
        {label}
      </Text>
    </View>
  );
}

// @ts-nocheck

import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
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
  const { colors, spacing, fontFamily, typography, radius, shadow, scheme } = useTheme();
  const router = useRouter();

  const { data, isLoading, error } = useTestDetail(slug);
  // Hooks must run on every render — keep this above the loading early-return.
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Screen padded={false} bottomInset={false} edges={["top"]}>
        <ScreenHeader title="Test Details" back />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={220} radius={radius.card} />
          <Skeleton height={100} radius={radius.card} />
          <Skeleton height={80} radius={radius.card} />
        </View>
      </Screen>
    );
  }

  const test = (data as any)?.test ?? data;
  const packages = (data as any)?.packages ?? [];
  const offers: Array<{ labId: string; labName: string; price: number; discountPrice: number | null }> =
    (test as any)?.availableAt ?? [];
  const cheapest = offers.slice().sort((a, b) => (a.discountPrice ?? a.price) - (b.discountPrice ?? b.price))[0];
  const effectiveLabId = selectedLabId ?? cheapest?.labId ?? null;
  const effectiveLab = offers.find((o) => o.labId === effectiveLabId) ?? cheapest ?? null;

  if (error || !test?.id) {
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
  const price = (test as any).minPrice ?? test.discountPrice ?? test.price;
  const categoryLabel = ((test as any).categorySlug ?? test.category ?? "").replace(/_/g, " ");

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
            borderRadius: radius.card,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
            backgroundColor: colors.surface,
            padding: spacing.xl,
            gap: spacing.lg,
            ...(scheme === "dark" ? {} : shadow.sm),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TestTube2 size={26} color={colors.primary} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  ...typography.title.lg,
                  color: colors.text,
                }}
              >
                {test.name}
              </Text>
              <Text
                style={{
                  ...typography.body.sm,
                  color: colors.textMuted,
                  marginTop: 3,
                  textTransform: "capitalize",
                }}
              >
                {categoryLabel} · {test.sampleType} sample
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            {test.discountPrice ? (
              <Text
                style={{
                  ...typography.body.md,
                  color: colors.textSubtle,
                  textDecorationLine: "line-through",
                }}
              >
                {formatPrice(test.price)}
              </Text>
            ) : null}
            <Text
              style={{
                ...typography.display.md,
                color: colors.text,
              }}
            >
              {formatPrice(price)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <InfoPill
              icon={<Clock size={14} color={colors.info} strokeWidth={2.4} />}
              label={`Results in ${test.turnaroundHours}h`}
              bg={colors.infoSoft}
              fg={colors.info}
            />
            <InfoPill
              icon={<Droplets size={14} color={colors.primary} strokeWidth={2.4} />}
              label={`${test.sampleType} sample`}
              bg={colors.primarySoft}
              fg={colors.primary}
            />
            {test.fastingRequired ? (
              <InfoPill
                icon={<AlertCircle size={14} color={colors.warning} strokeWidth={2.4} />}
                label={`Fasting ${test.fastingHours}h`}
                bg={colors.warningSoft}
                fg={colors.warning}
              />
            ) : null}
            {test.homeCollectionAvailable ? (
              <InfoPill
                icon={<Home size={14} color={colors.success} strokeWidth={2.4} />}
                label="Home collection"
                bg={colors.successSoft}
                fg={colors.success}
              />
            ) : null}
          </View>
        </View>

        {test.description ? (
          <SectionCard title="About this test" colors={colors} spacing={spacing} fontFamily={fontFamily}>
            <Text
              style={{
                ...typography.body.md,
                lineHeight: 22,
                color: colors.textMuted,
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
                ...typography.body.md,
                lineHeight: 22,
                color: colors.textMuted,
              }}
            >
              {test.instructions}
            </Text>
          </SectionCard>
        ) : null}

        {offers.length > 0 ? (
          <SectionCard title={`Available at ${offers.length} lab${offers.length === 1 ? "" : "s"}`} colors={colors} spacing={spacing} fontFamily={fontFamily}>
            <View style={{ gap: 4 }}>
              {offers.map((o, idx) => {
                const active = (effectiveLabId ?? "") === o.labId;
                return (
                <Pressable
                  key={o.labId}
                  onPress={() => setSelectedLabId(o.labId)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 56,
                    paddingVertical: 12,
                    borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                    opacity: pressed ? 0.85 : 1,
                    gap: 12,
                  })}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderCurve: "continuous",
                      borderWidth: 2,
                      borderColor: active ? colors.primary : colors.borderStrong,
                      backgroundColor: active ? colors.primary : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onPrimary }} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...typography.title.xs,
                        fontSize: 15,
                        color: colors.text,
                      }}
                    >
                      {o.labName || "Laboratory"}
                    </Text>
                  </View>
                  <Text style={{ ...typography.title.sm, fontFamily: typography.title.md.fontFamily, color: active ? colors.primary : colors.text }}>
                    {formatPrice(o.discountPrice ?? o.price)}
                  </Text>
                  <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
                </Pressable>
                );
              })}
            </View>
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
                    minHeight: 56,
                    paddingVertical: 12,
                    borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                    opacity: pressed ? 0.85 : 1,
                    gap: 12,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      borderCurve: "continuous",
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
                        ...typography.title.xs,
                        fontSize: 15,
                        color: colors.text,
                      }}
                    >
                      {pkg.name}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>
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
          backgroundColor: colors.bgElevated ?? colors.surface,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 28,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <Button
          size="lg"
          title={`Book now — ${formatPrice(effectiveLab ? (effectiveLab.discountPrice ?? effectiveLab.price) : price)}`}
          onPress={() =>
            router.push({
              pathname: "/book-test",
              params: {
                bookingType: "single_test",
                testId: test.id,
                testName: test.name,
                testPrice: String(effectiveLab ? (effectiveLab.discountPrice ?? effectiveLab.price) : price),
                ...(effectiveLabId ? { labPartnerId: effectiveLabId, labName: effectiveLab?.labName ?? "" } : {}),
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
  const { typography, radius, shadow, scheme } = useTheme();
  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
        backgroundColor: colors.surface,
        padding: spacing.lg,
        gap: spacing.sm,
        ...(scheme === "dark" ? {} : shadow.sm),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon ? <Info size={16} color={colors.primary} strokeWidth={2.4} /> : null}
        <Text
          style={{
            ...typography.title.md,
            color: colors.text,
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
  const { typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderCurve: "continuous",
        gap: 6,
      }}
    >
      {icon}
      <Text style={{ ...typography.label.sm, color: fg, textTransform: "capitalize" }}>
        {label}
      </Text>
    </View>
  );
}

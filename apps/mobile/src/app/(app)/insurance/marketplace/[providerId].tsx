// @ts-nocheck
// Insurance provider detail. Lists plans offered by a single insurer.

import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Building2,
  ShieldCheck,
  Star,
  Phone,
  Globe,
  FileText,
} from "lucide-react-native";
import { useInsuranceProvider } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  EmptyState,
  Skeleton,
  SectionHeader,
} from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { InsurancePlanCard } from "@/components/insurance/PlanCard";

export default function ProviderDetail() {
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading } = useInsuranceProvider(providerId ?? "");

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={180} radius={22} />
          <Skeleton height={148} radius={22} />
          <Skeleton height={148} radius={22} />
        </View>
      </Screen>
    );
  }

  if (!data?.provider) {
    return (
      <Screen>
        <ScreenHeader title={t("insurance.provider.notFound")} subtitle="" />
        <View style={{ padding: 16 }}>
          <EmptyState title={t("insurance.provider.notFound")} />
        </View>
      </Screen>
    );
  }

  const provider = data.provider;
  const plans = data.plans ?? [];

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={provider.name}
        subtitle={provider.tagline ?? undefined}
        kicker={t("insurance.provider.label")}
      />

      <Card style={{ margin: 16, marginTop: 8, padding: 20, gap: 16 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
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
            <Building2 size={26} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="700" size="lg">
              {provider.name}
            </AppText>
            {provider.tagline ? (
              <AppText size="sm" color="muted">
                {provider.tagline}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Pill tone="primary" icon={<Star size={12} />}>
            {t("insurance.provider.rating", {
              avg: provider.ratingAvg.toFixed(1),
              count: provider.ratingCount,
            })}
          </Pill>
          {typeof provider.claimSettlementRatioPct === "number" ? (
            <Pill tone="accent" icon={<ShieldCheck size={12} />}>
              {t("insurance.provider.claimRatio", {
                pct: provider.claimSettlementRatioPct.toFixed(0),
              })}
            </Pill>
          ) : null}
          {typeof provider.cashlessHospitalCount === "number" ? (
            <Pill tone="neutral">{provider.cashlessHospitalCount}+ hospitals</Pill>
          ) : null}
        </View>

        {provider.description ? (
          <AppText size="sm" color="muted">
            {provider.description}
          </AppText>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          {provider.supportPhone ? (
            <Button
              variant="secondary"
              size="sm"
              label={provider.supportPhone}
              icon={Phone}
              style={{ flex: 1 }}
              onPress={() => {
                // Linking.openURL(`tel:${provider.supportPhone}`)
              }}
            />
          ) : null}
          {provider.websiteUrl ? (
            <Button
              variant="secondary"
              size="sm"
              label={t("insurance.provider.website")}
              icon={Globe}
              style={{ flex: 1 }}
              onPress={() => {
                // Linking.openURL(provider.websiteUrl!)
              }}
            />
          ) : null}
        </View>
      </Card>

      <SectionHeader
        title={t("insurance.plan.available", { count: plans.length })}
        style={{ paddingHorizontal: 16, paddingTop: 8 }}
      />
      {plans.length === 0 ? (
        <View style={{ padding: 16 }}>
          <EmptyState
            title={t("insurance.provider.noPlans")}
            icon={<FileText size={28} color={colors.textSubtle} />}
          />
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 40 }}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <InsurancePlanCard
              plan={item}
              onPress={() => router.push(`/insurance/plans/${item.id}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}

// Theme-aware text used by this screen: maps the terse size/weight/color
// props onto typography tokens + theme colours so text stays legible in dark
// mode (the shared AppText hard-codes light-mode hex colours).
function AppText({
  size,
  weight,
  color,
  style,
  ...rest
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  weight?: string;
  color?: "muted" | "subtle" | "primary" | "accent" | "danger" | "text";
  style?: any;
  [key: string]: any;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const tone =
    color === "muted"
      ? colors.textMuted
      : color === "subtle"
        ? colors.textSubtle
        : color === "primary"
          ? colors.primary
          : color === "accent"
            ? colors.accent
            : color === "danger"
              ? colors.danger
              : colors.text;
  const bold = weight === "700" || weight === "800" || weight === "900" || weight === "bold";
  const semi = weight === "600" || weight === "500";
  const base =
    size === "2xl"
      ? typography.display.md
      : size === "xl"
        ? typography.display.sm
        : size === "lg"
          ? bold
            ? typography.title.lg
            : typography.body.lg
          : size === "md"
            ? bold
              ? typography.title.md
              : typography.body.md
            : size === "xs"
              ? typography.caption
              : bold
                ? typography.title.xs
                : typography.body.sm;
  const family = bold
    ? size === "xl" || size === "2xl" || size === "lg" || size === "md"
      ? base.fontFamily
      : fontFamily.bodyBold
    : semi
      ? fontFamily.bodySemibold
      : base.fontFamily;
  return (
    <Text
      {...rest}
      style={[{ ...base, fontFamily: family, color: tone }, style]}
    />
  );
}

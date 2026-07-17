// @ts-nocheck
// Insurance provider detail. Lists plans offered by a single insurer.

import { useLocalSearchParams, useRouter } from "expo-router";
import { View, FlatList } from "react-native";
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
import { AppText } from "@/components/ui/AppText";
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
          <Skeleton height={140} radius={16} />
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
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
    <Screen>
      <ScreenHeader
        title={provider.name}
        subtitle={provider.tagline ?? undefined}
        kicker={t("insurance.provider.label")}
      />

      <Card style={{ margin: 16, padding: 16, gap: 12 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={28} color={colors.primary} />
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
              variant="outline"
              label={provider.supportPhone}
              leftIcon={<Phone size={14} />}
              style={{ flex: 1 }}
              onPress={() => {
                // Linking.openURL(`tel:${provider.supportPhone}`)
              }}
            />
          ) : null}
          {provider.websiteUrl ? (
            <Button
              variant="outline"
              label={t("insurance.provider.website")}
              leftIcon={<Globe size={14} />}
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
        style={{ paddingHorizontal: 16 }}
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
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 32 }}
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
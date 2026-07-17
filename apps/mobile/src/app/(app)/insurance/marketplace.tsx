// @ts-nocheck
// Insurance marketplace browse — providers + plan grid with filters.

import { useState, useMemo } from "react";
import { View, FlatList, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react-native";
import { useInsuranceMarketplaceCatalog } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Skeleton,
  SectionHeader,
} from "@/components/ui";
import { InsuranceProviderCard } from "@/components/insurance/ProviderCard";
import { InsurancePlanCard } from "@/components/insurance/PlanCard";
import { useTheme } from "@/theme/ThemeProvider";

const PLAN_TYPES = [
  "individual",
  "family_floater",
  "senior",
  "critical_illness",
  "cancer",
  "dental",
  "maternity",
] as const;

export default function Marketplace() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [planType, setPlanType] = useState<string | undefined>();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);

  const { data, isLoading } = useInsuranceMarketplaceCatalog({
    planType,
    q: debouncedQ,
  });

  const providers = data?.providers ?? [];
  const plans = data?.plans ?? [];

  return (
    <Screen scroll padded={false}>
      <ScreenHeader
        title={t("insurance.browseMarketplace")}
        subtitle={t("insurance.homeSubtitle")}
        kicker={t("insurance.tab")}
      />

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Search size={16} color={colors.textSubtle} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t("insurance.search")}
            style={{ flex: 1, paddingVertical: 10, color: colors.text }}
          />
        </View>

        <ChipGroup>
          <Chip
            label={t("insurance.filterAll")}
            selected={!planType}
            onPress={() => setPlanType(undefined)}
          />
          {PLAN_TYPES.map((pt) => (
            <Chip
              key={pt}
              label={t(`insurance.planTypes.${pt}`)}
              selected={planType === pt}
              onPress={() => setPlanType(planType === pt ? undefined : pt)}
            />
          ))}
        </ChipGroup>
      </View>

      <SectionHeader
        title={t("insurance.provider.features")}
        style={{ paddingHorizontal: 16, paddingTop: 16 }}
      />
      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={104} radius={16} />
          <Skeleton height={104} radius={16} />
        </View>
      ) : providers.length === 0 ? (
        <View style={{ padding: 16 }}>
          <EmptyState
            title={t("insurance.provider.noPlans")}
            caption={t("insurance.search")}
          />
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <InsuranceProviderCard
              slug={item.slug}
              name={item.name}
              tagline={item.tagline}
              claimSettlementRatioPct={item.claimSettlementRatioPct}
              cashlessHospitalCount={item.cashlessHospitalCount}
              ratingAvg={item.ratingAvg}
              ratingCount={item.ratingCount}
              planCount={item.planCount ?? 0}
              onPress={() =>
                router.push(`/insurance/marketplace/${item.slug}`)
              }
            />
          )}
        />
      )}

      <SectionHeader
        title={t("insurance.plan.viewDetails")}
        style={{ paddingHorizontal: 16, paddingTop: 16 }}
      />
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
        ListEmptyComponent={
          isLoading ? null : (
            <View style={{ padding: 16 }}>
              <EmptyState title={t("insurance.search")} />
            </View>
          )
        }
      />
    </Screen>
  );
}
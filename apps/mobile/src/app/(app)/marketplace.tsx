// @ts-nocheck
// Caretaker Profiles: Marketplace — patient discovery list.
//
// Browse verified, available caretakers. Filter chips for district /
// role / language. Tap a row → detail screen. Top-right "My sent
// inquiries" → patient's own inquiry list.

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Search, BadgeCheck } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  Avatar,
  Button,
  EmptyState,
} from "@/components/ui";
import {
  useMarketplaceSearch,
  type CareRole,
} from "@/hooks/useCaretakerMarketplace";

const DISTRICTS = [
  "Any",
  "Colombo",
  "Kandy",
  "Galle",
  "Jaffna",
  "Gampaha",
  "Matara",
  "Kurunegala",
];

const ROLE_FILTERS: CareRole[] = [
  "nurse",
  "caregiver",
  "home_aide",
  "companion",
];

const LANGUAGES = ["Any", "en", "si", "ta"];

export default function MarketplaceScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

  const [district, setDistrict] = useState<string>("Any");
  const [role, setRole] = useState<CareRole | null>(null);
  const [language, setLanguage] = useState<string>("Any");

  const filters = {
    district: district === "Any" ? undefined : district,
    role: role ?? undefined,
    language: language === "Any" ? undefined : language,
  };
  const search = useMarketplaceSearch(filters);

  const caretakers = search.data?.caretakers ?? [];
  const refreshing = search.isFetching;

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        title={t("marketplace.title")}
        subtitle={t("marketplace.subtitle")}
        right={
          <Button
            label={t("marketplace.ctaMyInquiries")}
            onPress={() => router.push("/(app)/marketplace-inquiries" as any)}
            compact
          />
        }
      />

      {/* ─── Filter chips ─── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
          }}
        >
          {t("marketplace.filters.district")}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs }}
        >
          {DISTRICTS.map((d) => (
            <Chip
              key={d}
              label={d === "Any" ? t("marketplace.filters.any") : d}
              selected={district === d}
              onPress={() => setDistrict(d)}
            />
          ))}
        </ScrollView>

        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: spacing.xs,
          }}
        >
          {t("marketplace.filters.role")}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs }}
        >
          <Chip
            label={t("marketplace.filters.any")}
            selected={role === null}
            onPress={() => setRole(null)}
          />
          {ROLE_FILTERS.map((r) => (
            <Chip
              key={r}
              label={t(`caretaker.role.${r}`)}
              selected={role === r}
              onPress={() => setRole(r)}
            />
          ))}
        </ScrollView>

        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: spacing.xs,
          }}
        >
          {t("marketplace.filters.language")}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.xs }}
        >
          {LANGUAGES.map((l) => (
            <Chip
              key={l}
              label={l === "Any" ? t("marketplace.filters.any") : l}
              selected={language === l}
              onPress={() => setLanguage(l)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ─── Caretaker list ─── */}
      <FlatList
        data={caretakers}
        keyExtractor={(c) => c.caretakerUserId}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: spacing.xxxxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => search.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          search.isLoading ? null : (
            <EmptyState
              icon={Search}
              title={t("marketplace.empty")}
              body={t("marketplace.emptyBody")}
            />
          )
        }
        renderItem={({ item }) => {
          const topRoles = item.careRolesOffered.slice(0, 2);
          return (
            <Card
              padded={false}
              onPress={() =>
                router.push(
                  `/(app)/marketplace/${item.caretakerUserId}` as any
                )
              }
            >
              <View
                style={{
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <Avatar
                  uri={item.photo ?? undefined}
                  name={item.name}
                  size="md"
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.verified ? (
                      <BadgeCheck size={14} color={colors.success} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSecondary, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {item.district}
                    {topRoles.length
                      ? ` · ${topRoles
                          .map((r) => t(`caretaker.role.${r}`))
                          .join(", ")}`
                      : ""}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {item.hourlyRateLkr
                      ? `LKR ${item.hourlyRateLkr}/hr`
                      : t("marketplace.rateOnRequest")}
                    {item.experienceYears
                      ? ` · ${t("marketplace.experienceYears", {
                          n: item.experienceYears,
                        })}`
                      : ""}
                  </Text>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}
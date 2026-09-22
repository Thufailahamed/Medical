// @ts-nocheck
// Caretaker Profiles: Marketplace — patient discovery list.
//
// Browse verified, available caretakers. Filter chips for district /
// role / language. Tap a card → detail screen. Top-right "My sent
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
import {
  Search,
  BadgeCheck,
  MapPin,
  ChevronRight,
  Inbox,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  Pill,
  Avatar,
  Button,
  Divider,
  EmptyState,
  Skeleton,
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

function languageName(code: string, t: any): string {
  if (code === "en") return t("common.languageEnglish");
  if (code === "si") return t("common.languageSinhala");
  if (code === "ta") return t("common.languageTamil");
  return code;
}

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
            icon={Inbox}
            compact
          />
        }
      />

      {/* ─── Filter chips ─── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xs,
        }}
      >
        <FilterLabel label={t("marketplace.filters.district")} />
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
              tone={district === d ? "primary" : "neutral"}
              onPress={() => setDistrict(d)}
            />
          ))}
        </ScrollView>

        <FilterLabel
          label={t("marketplace.filters.role")}
          style={{ marginTop: spacing.xs }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs }}
        >
          <Chip
            label={t("marketplace.filters.any")}
            selected={role === null}
            tone={role === null ? "primary" : "neutral"}
            onPress={() => setRole(null)}
          />
          {ROLE_FILTERS.map((r) => (
            <Chip
              key={r}
              label={t(`caretaker.role.${r}`)}
              selected={role === r}
              tone={role === r ? "primary" : "neutral"}
              onPress={() => setRole(r)}
            />
          ))}
        </ScrollView>

        <FilterLabel
          label={t("marketplace.filters.language")}
          style={{ marginTop: spacing.xs }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.xs }}
        >
          {LANGUAGES.map((l) => (
            <Chip
              key={l}
              label={
                l === "Any" ? t("marketplace.filters.any") : languageName(l, t)
              }
              selected={language === l}
              tone={language === l ? "primary" : "neutral"}
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
          search.isLoading ? (
            <View style={{ gap: spacing.md }}>
              {[0, 1, 2].map((i) => (
                <Card key={i} style={{ gap: spacing.sm }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <Skeleton width={56} height={56} radius={28} />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Skeleton width="60%" height={14} />
                      <Skeleton width="80%" height={11} />
                      <Skeleton width="45%" height={11} />
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={Search}
              title={t("marketplace.empty")}
              body={t("marketplace.emptyBody")}
            />
          )
        }
        renderItem={({ item }) => (
          <CaretakerCard
            item={item}
            onPress={() =>
              router.push(`/(app)/marketplace/${item.caretakerUserId}` as any)
            }
          />
        )}
      />
    </Screen>
  );
}

function FilterLabel({
  label,
  style,
}: {
  label: string;
  style?: any;
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Text
      style={[
        typography.label.md,
        {
          color: colors.textMuted,
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginBottom: 2,
        },
        style,
      ]}
    >
      {label}
    </Text>
  );
}

function CaretakerCard({
  item,
  onPress,
}: {
  item: any;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const topRoles = item.careRolesOffered.slice(0, 3);

  return (
    <Card padded={false} onPress={onPress} style={{ overflow: "hidden" }}>
      <View
        style={{
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        {/* Identity row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Avatar
            source={item.photo ? { uri: item.photo } : undefined}
            name={item.name}
            size="lg"
          />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
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
                <BadgeCheck size={15} color={colors.success} />
              ) : null}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MapPin size={11} color={colors.textMuted} />
              <Text
                style={[typography.caption, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {item.district}
                {item.experienceYears
                  ? ` · ${t("marketplace.experienceYears", {
                      n: item.experienceYears,
                    })}`
                  : ""}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </View>

        {/* Role pills */}
        {topRoles.length ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {topRoles.map((r: CareRole) => (
              <Pill
                key={r}
                label={t(`caretaker.role.${r}`)}
                tone="primary"
                size="sm"
              />
            ))}
          </View>
        ) : null}

        <Divider />

        {/* Footer: rate + languages */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={[
              typography.body.sm,
              { color: colors.text, fontWeight: "800" },
            ]}
          >
            {item.hourlyRateLkr
              ? `LKR ${item.hourlyRateLkr}/hr`
              : t("marketplace.rateOnRequest")}
          </Text>
          {item.languages.length ? (
            <Text
              style={[typography.caption, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {item.languages.map((l: string) => languageName(l, t)).join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

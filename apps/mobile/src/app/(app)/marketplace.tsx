// @ts-nocheck
// Caretaker Profiles: Marketplace — patient discovery list.
//
// Browse verified, available caretakers. Role chips inline; district /
// language live behind a "Filters" panel. Tap a card → detail screen.
// Top-right inbox → patient's own sent inquiries.

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  FlatList,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Search,
  BadgeCheck,
  MapPin,
  ChevronRight,
  Inbox,
  SlidersHorizontal,
  ShieldCheck,
  UserPlus,
  X,
  RotateCcw,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  IconButton,
  Pressable,
  Chip,
  Pill,
  Avatar,
  Button,
  Divider,
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
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();

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
  const refreshing = search.isFetching && !search.isLoading;

  const [showMore, setShowMore] = useState(false);
  const activeFilters =
    (district !== "Any" ? 1 : 0) + (role ? 1 : 0) + (language !== "Any" ? 1 : 0);
  const extraActive = (district !== "Any" ? 1 : 0) + (language !== "Any" ? 1 : 0);
  const clearAll = () => {
    setDistrict("Any");
    setRole(null);
    setLanguage("Any");
  };
  const goInvite = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/caretakers" as any);
  };
  const filtersOn = showMore || extraActive > 0;

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        title={t("marketplace.title")}
        right={
          <IconButton
            icon={Inbox}
            variant="surface"
            onPress={() => router.push("/(app)/marketplace-inquiries" as any)}
            accessibilityLabel={t("marketplace.ctaMyInquiries")}
          />
        }
      />

      {/* ─── Trust line ─── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: spacing.lg,
          marginTop: -spacing.xs,
          marginBottom: spacing.sm,
        }}
      >
        <ShieldCheck size={14} color={colors.success} strokeWidth={2.4} />
        <Text
          style={[typography.body.sm, { color: colors.textMuted, flexShrink: 1 }]}
          numberOfLines={1}
        >
          {t("marketplace.trustLine")}
        </Text>
      </View>

      {/* ─── Filters ─── */}
      <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Vertical padding keeps the selected chip's coloured lift from
          // being clipped into a hard-edged box by the scroll viewport.
          contentContainerStyle={{
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: 6,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => setShowMore((v) => !v)}
            haptic="light"
            accessibilityRole="button"
            accessibilityState={{ expanded: showMore }}
            accessibilityLabel={t("marketplace.filtersCta")}
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                height: 36,
                paddingLeft: spacing.md,
                paddingRight: extraActive ? 6 : spacing.md,
                borderRadius: radius.full,
                backgroundColor: filtersOn ? colors.primarySoft : colors.surface,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: filtersOn ? "transparent" : colors.hairline,
              },
              scheme === "dark" || filtersOn ? null : shadow.xs,
            ]}
          >
            <SlidersHorizontal size={15} color={colors.primary} strokeWidth={2.4} />
            <Text style={[typography.label.md, { color: colors.primary }]}>
              {t("marketplace.filtersCta")}
            </Text>
            {extraActive ? (
              <View
                style={{
                  minWidth: 22,
                  height: 22,
                  paddingHorizontal: 6,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={[typography.caption, { color: colors.onPrimary, fontWeight: "700" }]}>
                  {extraActive}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <View
            style={{
              width: StyleSheet.hairlineWidth * 2,
              height: 20,
              backgroundColor: colors.separator,
            }}
          />

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

        {showMore ? (
          <Card
            variant="outline"
            style={{ marginHorizontal: spacing.lg, gap: spacing.sm }}
          >
            <FilterLabel label={t("marketplace.filters.district")} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {DISTRICTS.map((d) => (
                <Chip
                  key={d}
                  size="sm"
                  label={d === "Any" ? t("marketplace.filters.any") : d}
                  selected={district === d}
                  tone={district === d ? "primary" : "neutral"}
                  onPress={() => setDistrict(d)}
                />
              ))}
            </View>
            <FilterLabel
              label={t("marketplace.filters.language")}
              style={{ marginTop: spacing.sm }}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {LANGUAGES.map((l) => (
                <Chip
                  key={l}
                  size="sm"
                  label={l === "Any" ? t("marketplace.filters.any") : languageName(l, t)}
                  selected={language === l}
                  tone={language === l ? "primary" : "neutral"}
                  onPress={() => setLanguage(l)}
                />
              ))}
            </View>
          </Card>
        ) : extraActive ? (
          // Collapsed panel: surface the hidden filters as removable tokens.
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
            }}
          >
            {district !== "Any" ? (
              <ActiveToken
                icon={MapPin}
                label={district}
                onRemove={() => setDistrict("Any")}
              />
            ) : null}
            {language !== "Any" ? (
              <ActiveToken
                label={languageName(language, t)}
                onRemove={() => setLanguage("Any")}
              />
            ) : null}
          </View>
        ) : null}

        {!search.isLoading ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing.lg,
              minHeight: 24,
            }}
          >
            <Text style={[typography.label.md, { color: colors.textMuted }]}>
              {t("marketplace.resultCount", { count: caretakers.length })}
            </Text>
            {activeFilters > 0 ? (
              <Pressable
                onPress={clearAll}
                haptic="light"
                accessibilityRole="button"
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <RotateCcw size={13} color={colors.primary} strokeWidth={2.4} />
                <Text style={[typography.label.md, { color: colors.primary }]}>
                  {t("marketplace.clearFilters")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* ─── Caretaker list ─── */}
      <FlatList
        data={caretakers}
        keyExtractor={(c) => c.caretakerUserId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.lg,
          paddingTop: spacing.xs,
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
            <EmptyResults
              hasFilters={activeFilters > 0}
              onClear={clearAll}
              onInvite={goInvite}
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

function EmptyResults({
  hasFilters,
  onClear,
  onInvite,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onInvite: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography, shadow, scheme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxxl,
        gap: spacing.lg,
      }}
    >
      {/* Layered halo: two soft rings around a lifted icon disc. */}
      <View
        style={{
          width: 148,
          height: 148,
          borderRadius: 74,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}
      >
        <View
          style={{
            width: 108,
            height: 108,
            borderRadius: 54,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
          }}
        >
          <View
            style={[
              {
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
              },
              scheme === "dark" ? null : shadow.primary,
            ]}
          >
            <Search size={28} color={colors.onPrimary} strokeWidth={2.4} />
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.xs, alignItems: "center", maxWidth: 320 }}>
        <Text style={[typography.title.lg, { color: colors.text, textAlign: "center" }]}>
          {t("marketplace.empty")}
        </Text>
        <Text
          style={[
            typography.body.md,
            { color: colors.textMuted, textAlign: "center", lineHeight: 21 },
          ]}
        >
          {t("marketplace.emptyBody")}
        </Text>
      </View>

      <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
        {hasFilters ? (
          <Button
            title={t("marketplace.clearFilters")}
            icon={RotateCcw}
            onPress={onClear}
            fullWidth
          />
        ) : null}
        <Button
          title={t("marketplace.inviteCta")}
          icon={UserPlus}
          variant={hasFilters ? "secondary" : "primary"}
          onPress={onInvite}
          fullWidth
        />
      </View>
    </View>
  );
}

function ActiveToken({
  label,
  icon: Icon,
  onRemove,
}: {
  label: string;
  icon?: any;
  onRemove: () => void;
}) {
  const { spacing, colors, typography, radius } = useTheme();
  return (
    <Pressable
      onPress={onRemove}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 30,
        paddingLeft: spacing.sm + 2,
        paddingRight: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: colors.primarySoft,
      }}
    >
      {Icon ? <Icon size={12} color={colors.primary} strokeWidth={2.4} /> : null}
      <Text style={[typography.caption, { color: colors.primary, fontWeight: "600" }]}>
        {label}
      </Text>
      <X size={12} color={colors.primary} strokeWidth={2.6} />
    </Pressable>
  );
}

function FilterLabel({
  label,
  style,
}: {
  label: string;
  style?: any;
}) {
  const { colors, typography } = useTheme();
  return (
    <Text
      style={[
        typography.overline,
        { color: colors.textSubtle, textTransform: "uppercase" },
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
          gap: spacing.md,
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
                  typography.title.md,
                  { color: colors.text, flexShrink: 1 },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.verified ? (
                <BadgeCheck size={16} color={colors.success} />
              ) : null}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MapPin size={12} color={colors.textSubtle} />
              <Text
                style={[typography.body.sm, { color: colors.textMuted, flexShrink: 1 }]}
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
          <ChevronRight size={18} color={colors.textSubtle} />
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
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: spacing.md,
          }}
        >
          {item.hourlyRateLkr ? (
            <Text style={[typography.title.lg, { color: colors.text }]}>
              <Text style={[typography.label.sm, { color: colors.textMuted }]}>
                {"LKR "}
              </Text>
              {`${item.hourlyRateLkr}`}
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {"/hr"}
              </Text>
            </Text>
          ) : (
            <Text style={[typography.label.md, { color: colors.textMuted }]}>
              {t("marketplace.rateOnRequest")}
            </Text>
          )}
          {item.languages.length ? (
            <Text
              style={[
                typography.caption,
                { color: colors.textSubtle, flexShrink: 1, textAlign: "right", paddingBottom: 2 },
              ]}
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

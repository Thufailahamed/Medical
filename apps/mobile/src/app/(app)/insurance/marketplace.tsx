// @ts-nocheck
// Insurance marketplace — plan-first browse experience.
// Layout: gradient hero w/ embedded search + stats · plan-type chips · sort row
// · featured carousel (horizontal) · plans grid (rich cards) · providers strip
// · empty state. Data shape unchanged (`useInsuranceMarketplaceCatalog`).

import {
  useState,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Dimensions,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  Building2,
  Star,
  Heart,
  Users,
  Stethoscope,
  Baby,
  AlertTriangle,
  Smile,
  Activity,
  Wallet,
  Hospital,
  ChevronRight,
  TrendingDown,
  ArrowUpRight,
} from "lucide-react-native";

import { useInsuranceMarketplaceCatalog } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  ScreenHeader,
  Hero,
  Card,
  EmptyState,
  Skeleton,
  SectionHeader,
  Pill,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

// -----------------------------------------------------------------------------
// Constants

const PLAN_TYPES = [
  "individual",
  "family_floater",
  "senior",
  "critical_illness",
  "cancer",
  "dental",
  "maternity",
] as const;

// Stable, human-friendly icon + color per plan type — used both in the category
// strip and to tint provider avatars when no logoUrl is set.
const PLAN_TYPE_META: Record<
  string,
  { icon: typeof Heart; bg: string; fg: string }
> = {
  individual: { icon: Heart, bg: "#FEE2E2", fg: "#DC2626" },
  family_floater: { icon: Users, bg: "#DBEAFE", fg: "#2563EB" },
  senior: { icon: Stethoscope, bg: "#EDE9FE", fg: "#7C3AED" },
  critical_illness: { icon: AlertTriangle, bg: "#FEF3C7", fg: "#D97706" },
  cancer: { icon: Activity, bg: "#FCE7F3", fg: "#DB2777" },
  dental: { icon: Smile, bg: "#CFFAFE", fg: "#0891B2" },
  maternity: { icon: Baby, bg: "#DCFCE7", fg: "#16A34A" },
};

const SORT_OPTIONS: Array<{ value: "rating" | "premium" | "premium-desc"; i18nKey: string }> = [
  { value: "rating", i18nKey: "insurance.sort.rating" },
  { value: "premium", i18nKey: "insurance.sort.premium" },
  { value: "premium-desc", i18nKey: "insurance.sort.premiumDesc" },
];

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_GAP = 12;
const SCREEN_PAD = 16;
const GRID_COL_W = (SCREEN_WIDTH - SCREEN_PAD * 2 - CARD_GAP) / 2;
const FEATURED_CARD_W = Math.min(GRID_COL_W + 40, 280);

// Deterministic palette per provider name (used for the avatar bubble).
const PROVIDER_PALETTE = [
  { bg: "#EEF2FF", fg: "#4338CA" },
  { bg: "#FCE7F3", fg: "#BE185D" },
  { bg: "#DCFCE7", fg: "#15803D" },
  { bg: "#FEF3C7", fg: "#B45309" },
  { bg: "#E0F2FE", fg: "#0369A1" },
  { bg: "#F5D0FE", fg: "#7E22CE" },
  { bg: "#FFE4E6", fg: "#BE123C" },
  { bg: "#CCFBF1", fg: "#0F766E" },
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatLkr(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(value);
}

function HeroTrustPill({
  icon: Icon,
  label,
}: {
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.16)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.28)",
        maxWidth: 220,
      }}
    >
      <Icon size={12} color="#FFFFFF" strokeWidth={2.5} />
      <Text
        style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600", flexShrink: 1 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Atoms

function ProviderAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = getInitials(name);
  const palette = PROVIDER_PALETTE[hashString(name) % PROVIDER_PALETTE.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: palette.fg,
          fontWeight: "800",
          fontSize: size * 0.4,
          letterSpacing: 0.5,
        }}
        numberOfLines={1}
      >
        {initials}
      </Text>
    </View>
  );
}

function CategoryTile({
  planType,
  icon,
  bg,
  fg,
  label,
  count,
  selected,
  onPress,
}: {
  planType: string;
  icon: typeof Heart;
  bg: string;
  fg: string;
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const Icon = icon;
  return (
    <Pressable onPress={onPress} haptic="light">
      <View
        style={{
          alignItems: "center",
          gap: spacing.xs,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.xl,
            backgroundColor: selected ? fg : bg,
            borderWidth: selected ? 0 : 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={26} color={selected ? "#fff" : fg} strokeWidth={2} />
        </View>
        <Text
          style={{
            fontSize: 11,
            fontWeight: selected ? "700" : "600",
            color: selected ? colors.text : colors.textMuted,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: colors.textSubtle,
            fontWeight: "600",
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

// Rich plan card — single column. Mirrors `PlanCard` style but adds the
// provider badge row, value badges, and a clearer price stack.
function PlanRichCard({
  plan,
  providerName,
  onPress,
}: {
  plan: any;
  providerName: string;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const hasDiscount = plan.annualDiscountPct > 0;
  const meta = PLAN_TYPE_META[plan.planType] ?? PLAN_TYPE_META.individual;
  const PlanIcon = meta.icon;

  return (
    <Pressable onPress={onPress} haptic="light">
      <Card
        style={{
          padding: spacing.md,
          gap: spacing.sm,
          borderRadius: radius.xl,
        }}
      >
        {/* Provider row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <ProviderAvatar name={providerName} size={36} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {providerName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: meta.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlanIcon size={8} color={meta.fg} strokeWidth={2.5} />
              </View>
              <Text style={{ fontSize: 10, color: colors.textMuted }}>
                {plan.planType.replace(/_/g, " ")}
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color={colors.textSubtle} />
        </View>

        {/* Plan name + badges */}
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            color: colors.text,
            lineHeight: 20,
          }}
          numberOfLines={2}
        >
          {plan.name}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {plan.isFeatured ? (
            <Pill tone="accent" icon={<Sparkles size={11} />}>
              Featured
            </Pill>
          ) : null}
          {hasDiscount ? (
            <Pill tone="success" icon={<TrendingDown size={11} />}>
              Save {plan.annualDiscountPct.toFixed(0)}%
            </Pill>
          ) : null}
        </View>

        {/* Coverage */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={13} color={colors.accent ?? colors.primary} />
          <Text style={{ fontSize: 12, color: colors.text, fontWeight: "600" }}>
            Up to LKR {plan.coverageSummaryLkr.toLocaleString()}
          </Text>
        </View>

        {/* Premium block */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: 2,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: colors.primary,
                letterSpacing: -0.4,
              }}
            >
              LKR {plan.monthlyPremiumLkr.toLocaleString()}
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: colors.textMuted,
                }}
              >
                {" "}
                /mo
              </Text>
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>
              LKR {plan.annualPremiumLkr.toLocaleString()}/yr
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Hospital size={11} color={colors.textSubtle} />
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600" }}>
                {plan.networkHospitalCount}+ hospitals
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: colors.textSubtle }}>
              {plan.copayPct}% co-pay
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

// Featured carousel card — taller, single-row prominent variant.
function FeaturedPlanCard({
  plan,
  providerName,
  onPress,
}: {
  plan: any;
  providerName: string;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable onPress={onPress} haptic="light">
      <Card
        style={{
          width: FEATURED_CARD_W,
          padding: spacing.md,
          gap: spacing.sm,
          borderRadius: radius.xl,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.primary,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pill tone="primary" icon={<Sparkles size={11} />}>
            Top Pick
          </Pill>
          {plan.annualDiscountPct > 0 ? (
            <Pill tone="success" icon={<TrendingDown size={11} />}>
              {plan.annualDiscountPct.toFixed(0)}% off
            </Pill>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ProviderAvatar name={providerName} size={32} />
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: "700",
              color: colors.text,
            }}
            numberOfLines={1}
          >
            {providerName}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: colors.text,
            lineHeight: 20,
          }}
          numberOfLines={2}
        >
          {plan.name}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={12} color={colors.accent ?? colors.primary} />
          <Text style={{ fontSize: 12, color: colors.text, fontWeight: "600" }}>
            LKR {formatLkr(plan.coverageSummaryLkr)} coverage
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: 4,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: colors.primary,
                letterSpacing: -0.4,
              }}
            >
              LKR {plan.monthlyPremiumLkr.toLocaleString()}
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: colors.textMuted,
                }}
              >
                {" "}
                /mo
              </Text>
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted }}>
              or LKR {plan.annualPremiumLkr.toLocaleString()}/yr
            </Text>
          </View>
          <ChevronRight size={16} color={colors.primary} />
        </View>
      </Card>
    </Pressable>
  );
}

// Provider strip tile.
function ProviderTile({
  provider,
  onPress,
}: {
  provider: any;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable onPress={onPress} haptic="light">
      <Card
        style={{
          width: 140,
          padding: spacing.sm,
          gap: spacing.xs,
          borderRadius: radius.lg,
          alignItems: "center",
        }}
      >
        <ProviderAvatar name={provider.name} size={44} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: colors.text,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {provider.name}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            opacity: 0.85,
          }}
        >
          <Star size={10} color="#F59E0B" fill="#F59E0B" />
          <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>
            {provider.ratingAvg?.toFixed?.(1) ?? "—"}{" "}
            <Text style={{ color: colors.textSubtle }}>
              ({provider.ratingCount ?? 0})
            </Text>
          </Text>
        </View>
        <Text style={{ fontSize: 10, color: colors.textSubtle }}>
          {provider.planCount ?? 0} plans
        </Text>
      </Card>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Screen

export default function Marketplace() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, radius, shadow } = useTheme();

  const [planType, setPlanType] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rating" | "premium" | "premium-desc">("rating");
  const debouncedQ = useDebounce(q, 250);

  const { data, isLoading, refetch, isRefetching } = useInsuranceMarketplaceCatalog({
    planType,
    q: debouncedQ,
    sort,
  });

  const providers = data?.providers ?? [];
  const plans = data?.plans ?? [];
  const featuredPlans = useMemo(
    () => plans.filter((p: any) => p.isFeatured).slice(0, 6),
    [plans],
  );

  // Counts per plan type for the category strip — derived from the unfiltered
  // catalog so the strip is stable while the user toggles filters.
  const countsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const plan of plans as any[]) {
      counts[plan.planType] = (counts[plan.planType] ?? 0) + 1;
    }
    return counts;
  }, [plans]);

  // provider id → provider lookup for surfacing provider name on plan cards.
  const providerById = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of providers) map[p.id] = p;
    return map;
  }, [providers]);

  const totalProviders = providers.length;
  const totalPlans = plans.length;

  const handleSortPress = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t("insurance.sort.label"),
          options: [
            t(SORT_OPTIONS[0].i18nKey),
            t(SORT_OPTIONS[1].i18nKey),
            t(SORT_OPTIONS[2].i18nKey),
            t("common.cancel", { defaultValue: "Cancel" }),
          ],
          cancelButtonIndex: 3,
        },
        (index) => {
          if (index >= 0 && index < SORT_OPTIONS.length) {
            setSort(SORT_OPTIONS[index].value);
          }
        },
      );
    } else {
      // Cycle through sorts on android — no action sheet lib in use.
      const idx = SORT_OPTIONS.findIndex((s) => s.value === sort);
      const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
      setSort(next.value);
    }
  }, [sort, t]);

  const sortLabel = useMemo(() => {
    const opt = SORT_OPTIONS.find((o) => o.value === sort);
    return opt ? t(opt.i18nKey) : t("insurance.sort.label");
  }, [sort, t]);

  const marketplaceStats =
    totalProviders > 0
      ? t("insurance.marketplaceSubtitle", {
          providers: totalProviders,
          plans: totalPlans,
        })
      : t(
          "insurance.marketplaceSubtitleEmpty",
          "Compare plans from top insurers. Buy in 3 minutes.",
        );

  const isInitialLoad = isLoading && !data;

  return (
    <Screen scroll padded={false}>
      <ScreenHeader
        back
        onBack={() => router.replace("/(app)")}
        variant="compact"
        style={{ paddingBottom: spacing.xs }}
      />

      <Hero
        eyebrow={t("insurance.tab")}
        title={t("insurance.browseMarketplace")}
        subtitle={marketplaceStats}
        height={292}
        style={{
          borderRadius: radius.xl,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          borderBottomLeftRadius: radius.xl,
          borderBottomRightRadius: radius.xl,
          marginHorizontal: spacing.lg,
          marginTop: spacing.xs,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: "#FFFFFF",
            borderRadius: radius.lg,
            paddingHorizontal: 14,
            minHeight: 48,
            marginTop: spacing.md,
            ...shadow.sm,
          }}
        >
          <Search size={18} color={colors.textMuted} strokeWidth={2.25} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t("insurance.searchMarketplace", "Search insurers, plans, features")}
            placeholderTextColor={colors.textSubtle}
            returnKeyType="search"
            style={{
              flex: 1,
              paddingVertical: 10,
              color: colors.text,
              fontSize: 15,
              fontWeight: "500",
            }}
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")} hitSlop={8} haptic="light">
              <Text style={{ fontSize: 18, color: colors.textMuted, fontWeight: "600", lineHeight: 20 }}>
                ×
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => router.push("/insurance/quote")}
          haptic="light"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: spacing.sm,
            backgroundColor: "rgba(255,255,255,0.2)",
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.34)",
          }}
        >
          <Sparkles size={15} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14, flex: 1, textAlign: "center" }}>
            {t("insurance.getQuoteCta", "Get a personalised quote in 60s")}
          </Text>
          <ArrowUpRight size={15} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.md, marginHorizontal: -4 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
        >
          <HeroTrustPill
            icon={ShieldCheck}
            label={t("insurance.trust.cashless", "Cashless at network hospitals")}
          />
          <HeroTrustPill
            icon={Wallet}
            label={t("insurance.trust.claims", "No-claim bonus")}
          />
        </ScrollView>
      </Hero>

      {/* ─── Categories: horizontal scroller ─── */}
      <View style={{ marginTop: spacing.lg }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: colors.textSubtle,
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {t("insurance.browseByType", "Browse by plan type")}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: 14,
          }}
        >
          <CategoryTile
            planType="all"
            icon={Building2}
            bg={colors.surface}
            fg={colors.primary}
            label={t("insurance.filterAll")}
            count={totalPlans}
            selected={!planType}
            onPress={() => setPlanType(undefined)}
          />
          {PLAN_TYPES.map((pt) => {
            const meta = PLAN_TYPE_META[pt];
            return (
              <CategoryTile
                key={pt}
                planType={pt}
                icon={meta.icon}
                bg={meta.bg}
                fg={meta.fg}
                label={t(`insurance.planTypes.${pt}`)}
                count={countsByType[pt] ?? 0}
                selected={planType === pt}
                onPress={() => setPlanType(planType === pt ? undefined : pt)}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* ─── Sort row ─── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600" }}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            t("insurance.showingPlans", {
              count: totalPlans,
              defaultValue: `${totalPlans} plan${totalPlans === 1 ? "" : "s"}`,
            })
          )}
        </Text>
        <Pressable
          onPress={handleSortPress}
          haptic="light"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <SlidersHorizontal size={12} color={colors.textMuted} />
          <Text style={{ fontSize: 11, color: colors.text, fontWeight: "600" }}>
            {sortLabel}
          </Text>
        </Pressable>
      </View>

      {/* ─── Featured carousel ─── */}
      {!isInitialLoad && featuredPlans.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title={t("insurance.featuredTitle", "Top picks this week")}
            subtitle={t(
              "insurance.featuredSubtitle",
              "Hand-picked by coverage experts",
            )}
            style={{ paddingHorizontal: spacing.lg }}
          />
          <FlatList
            data={featuredPlans}
            keyExtractor={(p: any) => `feat-${p.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: CARD_GAP,
            }}
            renderItem={({ item }: any) => (
              <FeaturedPlanCard
                plan={item}
                providerName={
                  providerById[item.providerId]?.name ?? "Insurer"
                }
                onPress={() => router.push(`/insurance/plans/${item.id}`)}
              />
            )}
          />
        </View>
      ) : null}

      {/* ─── Plans list ─── */}
      <SectionHeader
        title={t("insurance.allPlans", "All available plans")}
        subtitle={t(
          "insurance.allPlansSubtitle",
          "Tap a card to view full coverage details",
        )}
        style={{
          paddingHorizontal: spacing.lg,
          marginTop: spacing.xl,
          marginBottom: spacing.sm,
        }}
      />

      {isInitialLoad ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={140} radius={20} />
          <Skeleton height={140} radius={20} />
          <Skeleton height={140} radius={20} />
        </View>
      ) : totalPlans === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <EmptyState
            icon={<Building2 size={28} color={colors.textSubtle} />}
            title={t("insurance.empty.title", "No plans match your search")}
            caption={t(
              "insurance.empty.caption",
              "Try clearing the search or pick a different plan type.",
            )}
            ctaLabel={t("insurance.empty.cta", "Clear filters")}
            onCtaPress={() => {
              setQ("");
              setPlanType(undefined);
            }}
          />
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
            paddingBottom: spacing.xxxl,
          }}
        >
          {plans.map((plan: any) => (
            <PlanRichCard
              key={plan.id}
              plan={plan}
              providerName={providerById[plan.providerId]?.name ?? "Insurer"}
              onPress={() => router.push(`/insurance/plans/${plan.id}`)}
            />
          ))}
          {isRefetching ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </View>
      )}

      {/* ─── Providers strip ─── */}
      {!isInitialLoad && providers.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title={t("insurance.featuredProviders", "Top insurers")}
            style={{ paddingHorizontal: spacing.lg }}
          />
          <FlatList
            data={providers.slice(0, 8)}
            keyExtractor={(p: any) => `prov-${p.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: 10,
            }}
            renderItem={({ item }: any) => (
              <ProviderTile
                provider={item}
                onPress={() =>
                  router.push(`/insurance/marketplace/${item.slug}`)
                }
              />
            )}
          />
          <View style={{ height: spacing.xxxl }} />
        </View>
      ) : null}
    </Screen>
  );
}

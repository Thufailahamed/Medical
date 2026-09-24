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
  Modal,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
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
  X,
  Scale,
} from "lucide-react-native";

import { useInsuranceMarketplaceCatalog } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  ScreenHeader,
  Card,
  EmptyState,
  Skeleton,
  SectionHeader,
  Pill,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { insurancePlanImage } from "@/components/insurance/PlanCard";

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
  // Translucent tone tints (fg @ ~12% alpha) so the soft tiles read well on
  // both the light grouped background and true-black dark mode.
  individual: { icon: Heart, bg: "#DC26261F", fg: "#DC2626" },
  family_floater: { icon: Users, bg: "#2563EB1F", fg: "#2563EB" },
  senior: { icon: Stethoscope, bg: "#7C3AED1F", fg: "#7C3AED" },
  critical_illness: { icon: AlertTriangle, bg: "#D977061F", fg: "#D97706" },
  cancer: { icon: Activity, bg: "#DB27771F", fg: "#DB2777" },
  dental: { icon: Smile, bg: "#0891B21F", fg: "#0891B2" },
  maternity: { icon: Baby, bg: "#16A34A1F", fg: "#16A34A" },
};

// Plan type → bundled illustration. `require()` keeps the assets baked
function planImageFor(planType: string): any | undefined {
  return insurancePlanImage(planType);
}

const HERO_IMAGE = require("../../../../assets/insurance/hero.jpg");

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
  { bg: "#6366F11F", fg: "#6366F1" },
  { bg: "#DB27771F", fg: "#DB2777" },
  { bg: "#16A34A1F", fg: "#16A34A" },
  { bg: "#D977061F", fg: "#D97706" },
  { bg: "#0284C71F", fg: "#0284C7" },
  { bg: "#9333EA1F", fg: "#9333EA" },
  { bg: "#E11D481F", fg: "#E11D48" },
  { bg: "#0D94881F", fg: "#0D9488" },
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
  const { typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.18)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.28)",
        maxWidth: 240,
      }}
    >
      <Icon size={12} color="#FFFFFF" strokeWidth={2.5} />
      <Text
        style={{ ...typography.label.sm, color: "#FFFFFF", flexShrink: 1 }}
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
  const { fontFamily } = useTheme();
  const initials = getInitials(name);
  const palette = PROVIDER_PALETTE[hashString(name) % PROVIDER_PALETTE.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        borderCurve: "continuous",
        backgroundColor: palette.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: palette.fg,
          fontFamily: fontFamily.heavy,
          fontSize: size * 0.38,
          letterSpacing: 0.2,
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
  const { colors, radius, spacing, typography, shadow, scheme } = useTheme();
  const Icon = icon;
  return (
    <Pressable onPress={onPress} haptic="light">
      <View
        style={{
          alignItems: "center",
          gap: 6,
          width: 68,
        }}
      >
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            borderCurve: "continuous",
            backgroundColor: selected ? fg : bg,
            borderWidth: !selected && bg === colors.surface ? StyleSheet.hairlineWidth : 0,
            borderColor: colors.separator,
            alignItems: "center",
            justifyContent: "center",
            ...(selected && scheme !== "dark" ? shadow.sm : {}),
          }}
        >
          <Icon size={24} color={selected ? "#fff" : fg} strokeWidth={2.1} />
        </View>
        <Text
          style={{
            ...(selected ? typography.label.sm : typography.caption),
            color: selected ? colors.text : colors.textMuted,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={{
            ...typography.label.xs,
            color: colors.textSubtle,
            marginTop: -4,
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
  onLongPress,
  comparing,
  compareSelected,
}: {
  plan: any;
  providerName: string;
  onPress: () => void;
  onLongPress?: () => void;
  comparing?: boolean;
  compareSelected?: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const hasDiscount = plan.annualDiscountPct > 0;
  const meta = PLAN_TYPE_META[plan.planType] ?? PLAN_TYPE_META.individual;
  const PlanIcon = meta.icon;
  const planImage = planImageFor(plan.planType);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      haptic="light"
    >
      <Card
        style={{
          padding: spacing.lg,
          gap: spacing.md,
          ...(compareSelected
            ? { borderWidth: 2, borderColor: colors.primary }
            : {}),
          overflow: "hidden",
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
            {comparing ? null : (
              <View
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderCurve: "continuous",
                  backgroundColor: compareSelected
                    ? colors.primary
                    : "transparent",
                  borderWidth: compareSelected ? 0 : 1.5,
                  borderColor: colors.borderStrong,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                }}
              >
                {compareSelected ? (
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                    ✓
                  </Text>
                ) : null}
              </View>
            )}
            <Text
              style={{
                ...typography.label.md,
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {providerName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 5,
                  borderCurve: "continuous",
                  backgroundColor: meta.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlanIcon size={10} color={meta.fg} strokeWidth={2.5} />
              </View>
              <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "capitalize" }}>
                {plan.planType.replace(/_/g, " ")}
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color={colors.textSubtle} />
        </View>

        {/* Plan details row with dedicated thumbnail */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text
              style={{
                ...typography.title.md,
                color: colors.text,
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
              <ShieldCheck size={14} color={colors.accent ?? colors.primary} strokeWidth={2.3} />
              <Text style={{ ...typography.body.sm, color: colors.textMuted }}>
                Up to{" "}
                <Text style={{ fontFamily: typography.label.md.fontFamily, color: colors.text }}>
                  LKR {plan.coverageSummaryLkr.toLocaleString()}
                </Text>
              </Text>
            </View>
          </View>

          {planImage ? (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                borderCurve: "continuous",
                overflow: "hidden",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.separator,
                backgroundColor: colors.surfaceMuted,
                flexShrink: 0,
              }}
            >
              <Image
                source={planImage}
                resizeMode="cover"
                style={{ width: "100%", height: "100%" }}
              />
            </View>
          ) : null}
        </View>

        {/* Premium block */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
          }}
        >
          <View>
            <Text
              style={{
                ...typography.display.sm,
                color: colors.text,
              }}
            >
              <Text style={{ ...typography.label.md, color: colors.textMuted }}>
                LKR{" "}
              </Text>
              {plan.monthlyPremiumLkr.toLocaleString()}
              <Text
                style={{
                  ...typography.label.md,
                  color: colors.textMuted,
                }}
              >
                {" "}
                /mo
              </Text>
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSubtle, marginTop: 2 }}>
              LKR {plan.annualPremiumLkr.toLocaleString()}/yr
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Hospital size={12} color={colors.textSubtle} />
              <Text style={{ ...typography.label.sm, color: colors.textMuted }}>
                {plan.networkHospitalCount}+ hospitals
              </Text>
            </View>
            <Text style={{ ...typography.caption, color: colors.textSubtle }}>
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
  const { colors, spacing, radius, typography } = useTheme();
  const planImage = planImageFor(plan.planType);
  return (
    <Pressable onPress={onPress} haptic="light">
      <Card
        style={{
          width: FEATURED_CARD_W,
          padding: spacing.lg,
          gap: spacing.sm + 2,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        {planImage ? (
          <View
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 68,
              height: 68,
              borderRadius: 18,
              borderCurve: "continuous",
              overflow: "hidden",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.separator,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Image
              source={planImage}
              resizeMode="cover"
              style={{ width: "100%", height: "100%" }}
            />
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 72 }}>
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
              ...typography.label.md,
              color: colors.textMuted,
            }}
            numberOfLines={1}
          >
            {providerName}
          </Text>
        </View>

        <Text
          style={{
            ...typography.title.md,
            color: colors.text,
            paddingRight: 8,
          }}
          numberOfLines={2}
        >
          {plan.name}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={13} color={colors.accent ?? colors.primary} strokeWidth={2.3} />
          <Text style={{ ...typography.label.sm, color: colors.text }}>
            LKR {formatLkr(plan.coverageSummaryLkr)} coverage
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: 4,
            paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
          }}
        >
          <View>
            <Text
              style={{
                ...typography.display.sm,
                color: colors.text,
              }}
            >
              <Text style={{ ...typography.label.md, color: colors.textMuted }}>
                LKR{" "}
              </Text>
              {plan.monthlyPremiumLkr.toLocaleString()}
              <Text
                style={{
                  ...typography.label.md,
                  color: colors.textMuted,
                }}
              >
                {" "}
                /mo
              </Text>
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSubtle, marginTop: 2 }}>
              or LKR {plan.annualPremiumLkr.toLocaleString()}/yr
            </Text>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight size={16} color={colors.primary} strokeWidth={2.5} />
          </View>
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
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <Pressable onPress={onPress} haptic="light">
      <Card
        style={{
          width: 140,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.md,
          gap: 6,
          alignItems: "center",
        }}
      >
        <ProviderAvatar name={provider.name} size={48} />
        <Text
          style={{
            ...typography.title.xs,
            color: colors.text,
            textAlign: "center",
            marginTop: 4,
          }}
          numberOfLines={1}
        >
          {provider.name}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Star size={11} color={colors.warning} fill={colors.warning} />
          <Text style={{ ...typography.label.sm, color: colors.text }}>
            {provider.ratingAvg?.toFixed?.(1) ?? "—"}{" "}
            <Text style={{ color: colors.textSubtle }}>
              ({provider.ratingCount ?? 0})
            </Text>
          </Text>
        </View>
        <Text style={{ ...typography.caption, color: colors.textSubtle }}>
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
  const { colors, spacing, radius, shadow, typography, scheme } = useTheme();

  const [planType, setPlanType] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rating" | "premium" | "premium-desc">("rating");
  // Compare tray: long-press a plan card to add it; up to 3 plans.
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // ─── Compare handlers ──────────────────────────────────
  // Long-press toggles a plan into the comparison tray (max 3).
  const toggleCompare = useCallback((planId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(planId)) return prev.filter((id) => id !== planId);
      if (prev.length >= 3) return prev; // cap at 3
      return [...prev, planId];
    });
    setComparing(true);
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds([]);
    setComparing(false);
  }, []);

  const comparePlans = useMemo(
    () => compareIds.map((id) => plans.find((p: any) => p.id === id)).filter(Boolean),
    [compareIds, plans],
  );

  // Pick the cheapest plan among the comparison set to badge it.
  const cheapestId = useMemo(() => {
    if (comparePlans.length < 2) return null;
    let min = Infinity;
    let id: string | null = null;
    for (const p of comparePlans) {
      const v = (p as any).monthlyPremiumLkr;
      if (typeof v === "number" && v < min) {
        min = v;
        id = (p as any).id;
      }
    }
    return id;
  }, [comparePlans]);

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

      <LinearGradient
        colors={["#0B4F6C", "#0D9488", "#14B8A6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: radius.xxl,
          borderCurve: "continuous",
          marginHorizontal: spacing.lg,
          marginTop: spacing.xs,
          overflow: "hidden",
          padding: spacing.xl,
          ...(scheme === "dark" ? {} : shadow.hero),
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -50,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: "rgba(255,255,255,0.12)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: -60,
            left: -30,
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        />

        {/* Hero illustration overlay — decorative, on the right side */}
        <Image
          source={HERO_IMAGE}
          resizeMode="cover"
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -spacing.md,
            top: "30%",
            width: 180,
            height: 110,
            borderRadius: 18,
            borderCurve: "continuous",
            opacity: 0.4,
            transform: [{ rotate: "6deg" }],
          }}
        />

        <Text
          style={{
            ...typography.overline,
            color: "rgba(255,255,255,0.8)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {t("insurance.tab")}
        </Text>
        <Text
          style={{
            ...typography.display.md,
            color: "#FFFFFF",
          }}
        >
          {t("insurance.browseMarketplace")}
        </Text>
        <Text
          style={{
            ...typography.body.sm,
            color: "rgba(255,255,255,0.86)",
            marginTop: 6,
            maxWidth: "85%",
          }}
        >
          {marketplaceStats}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: 14,
            minHeight: 46,
            marginTop: spacing.lg,
          }}
        >
          <Search size={18} color={colors.textSubtle} strokeWidth={2.25} />
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
              ...typography.body.md,
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
            marginTop: spacing.sm + 2,
            backgroundColor: "rgba(255,255,255,0.18)",
            minHeight: 46,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: radius.md,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.28)",
          }}
        >
          <Sparkles size={15} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={{ ...typography.label.lg, color: "#FFFFFF", flex: 1, textAlign: "center" }}>
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
      </LinearGradient>

      {/* ─── Categories: horizontal scroller ─── */}
      <View style={{ marginTop: spacing.xxl }}>
        <Text
          style={{
            ...typography.title.lg,
            color: colors.text,
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          {t("insurance.browseByType", "Browse by plan type")}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: 8,
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
        <Text style={{ ...typography.label.md, color: colors.textMuted }}>
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
            gap: 6,
            paddingHorizontal: 12,
            minHeight: 34,
            borderRadius: 999,
            backgroundColor: colors.fill,
          }}
        >
          <SlidersHorizontal size={13} color={colors.textMuted} strokeWidth={2.3} />
          <Text style={{ ...typography.label.sm, color: colors.text }}>
            {sortLabel}
          </Text>
        </Pressable>
      </View>

      {/* ─── Featured carousel ─── */}
      {!isInitialLoad && featuredPlans.length > 0 ? (
        <View style={{ marginTop: spacing.xxl }}>
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
          marginTop: spacing.xxl + 4,
          marginBottom: spacing.sm,
        }}
      />

      {isInitialLoad ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={196} radius={radius.card} />
          <Skeleton height={196} radius={radius.card} />
          <Skeleton height={196} radius={radius.card} />
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
            gap: spacing.md,
            paddingBottom: spacing.xxxl,
          }}
        >
          {plans.map((plan: any) => (
            <PlanRichCard
              key={plan.id}
              plan={plan}
              providerName={providerById[plan.providerId]?.name ?? "Insurer"}
              onPress={() => router.push(`/insurance/plans/${plan.id}`)}
              onLongPress={() => toggleCompare(plan.id)}
              comparing={comparing}
              compareSelected={compareIds.includes(plan.id)}
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
        <View style={{ marginTop: spacing.sm }}>
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
              gap: CARD_GAP,
              paddingBottom: 4,
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

      {/* ─── Compare tray (visible while picking) ─── */}
      {compareIds.length > 0 ? (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 18,
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            borderCurve: "continuous",
            padding: 16,
            gap: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor:
              scheme === "dark" ? colors.borderStrong : colors.separator,
            ...shadow.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Scale size={16} color={colors.primary} strokeWidth={2.4} />
            </View>
            <Text
              style={{
                ...typography.title.sm,
                color: colors.text,
                flex: 1,
              }}
            >
              {t(
                "insurance.compare.title",
                "Compare {{count}} plan",
                { count: compareIds.length },
              )}
            </Text>
            <Pressable onPress={clearCompare} hitSlop={8} haptic="light">
              <Text
                style={{
                  ...typography.label.md,
                  color: colors.primary,
                }}
              >
                {t("common.clear", "Clear")}
              </Text>
            </Pressable>
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {compareIds.map((id) => {
              const p: any = plans.find((x: any) => x.id === id);
              const name = p?.name ?? id.slice(0, 6);
              return (
                <View
                  key={id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: colors.fill,
                  }}
                >
                  <Text
                    style={{
                      ...typography.label.sm,
                      color: colors.text,
                      maxWidth: 140,
                    }}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  <Pressable
                    onPress={() => toggleCompare(id)}
                    hitSlop={6}
                  >
                    <X size={12} color={colors.textMuted} strokeWidth={2.4} />
                  </Pressable>
                </View>
              );
            })}
            {compareIds.length < 3 ? (
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textSubtle,
                  alignSelf: "center",
                }}
              >
                {t(
                  "insurance.compare.addMore",
                  "Long-press another plan to add ({{rem}} left)",
                  { rem: 3 - compareIds.length },
                )}
              </Text>
            ) : null}
          </View>
          <Pressable
            disabled={compareIds.length < 2}
            onPress={() => {
              // Modal is rendered below — opening handled via state
              setDrawerOpen(true);
            }}
            style={{
              backgroundColor:
                compareIds.length >= 2 ? colors.primary : colors.fill,
              minHeight: 48,
              justifyContent: "center",
              borderRadius: radius.button,
              borderCurve: "continuous",
              alignItems: "center",
              ...(compareIds.length >= 2 && scheme !== "dark" ? shadow.primary : {}),
            }}
            haptic={compareIds.length >= 2 ? "medium" : undefined}
          >
            <Text
              style={{
                ...typography.label.lg,
                color: compareIds.length >= 2 ? colors.onPrimary : colors.textMuted,
              }}
            >
              {t("insurance.compare.cta", "Compare side-by-side")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ─── Comparison modal ─── */}
      <Modal
        visible={drawerOpen && comparePlans.length >= 2}
        animationType="slide"
        transparent
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.scrim ?? "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              borderCurve: "continuous",
              paddingTop: 8,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xxl,
              maxHeight: "85%",
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: colors.fillStrong,
                marginBottom: spacing.md,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.lg,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Scale size={17} color={colors.primary} strokeWidth={2.4} />
              </View>
              <Text
                style={{
                  ...typography.title.lg,
                  color: colors.text,
                  flex: 1,
                  marginLeft: 10,
                }}
              >
                {t("insurance.compare.heading", "Side-by-side")}
              </Text>
              <Pressable
                onPress={() => setDrawerOpen(false)}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color={colors.textMuted} strokeWidth={2.6} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {comparePlans.map((p: any) => {
                  const provName =
                    providerById[p.providerId]?.name ?? "Insurer";
                  const isCheapest = p.id === cheapestId;
                  return (
                    <View
                      key={p.id}
                      style={{
                        width: 200,
                        padding: 14,
                        borderRadius: radius.xl,
                        borderCurve: "continuous",
                        borderWidth: isCheapest ? 1.5 : StyleSheet.hairlineWidth,
                        borderColor: isCheapest
                          ? colors.success
                          : scheme === "dark"
                            ? colors.borderStrong
                            : colors.separator,
                        backgroundColor: colors.surface,
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <ProviderAvatar name={provName} size={28} />
                        <Text
                          style={{
                            ...typography.label.sm,
                            color: colors.textMuted,
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {provName}
                        </Text>
                        {isCheapest ? (
                          <Pill tone="success">Best price</Pill>
                        ) : null}
                      </View>
                      <Text
                        style={{
                          ...typography.title.sm,
                          color: colors.text,
                        }}
                        numberOfLines={2}
                      >
                        {p.name}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.textSubtle, textTransform: "capitalize" }}>
                        {p.planType.replace(/_/g, " ")}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={{ height: spacing.md }} />

              {/* Comparison rows */}
              {[
                {
                  label: t("insurance.compare.premium", "Monthly premium"),
                  fmt: (p: any) =>
                    `LKR ${p.monthlyPremiumLkr.toLocaleString()}`,
                  bestOf: "min",
                },
                {
                  label: t("insurance.compare.annual", "Annual premium"),
                  fmt: (p: any) =>
                    `LKR ${p.annualPremiumLkr.toLocaleString()}`,
                  bestOf: "min",
                },
                {
                  label: t("insurance.compare.coverage", "Coverage up to"),
                  fmt: (p: any) =>
                    `LKR ${p.coverageSummaryLkr.toLocaleString()}`,
                  bestOf: "max",
                },
                {
                  label: t("insurance.compare.copay", "Co-pay %"),
                  fmt: (p: any) => `${p.copayPct}%`,
                  bestOf: "min",
                },
                {
                  label: t("insurance.compare.hospitals", "Network hospitals"),
                  fmt: (p: any) => `${p.networkHospitalCount}+`,
                  bestOf: "max",
                },
                {
                  label: t(
                    "insurance.compare.annualDiscount",
                    "Annual discount",
                  ),
                  fmt: (p: any) =>
                    p.annualDiscountPct > 0
                      ? `${p.annualDiscountPct.toFixed(0)}%`
                      : "—",
                  bestOf: "max",
                },
              ].map((row, ri) => {
                // Extract numeric for highlighting the best-value column.
                const numericVals = comparePlans.map((p: any) => {
                  const txt = row.fmt(p).replace(/[^0-9.]/g, "");
                  return Number(txt) || 0;
                });
                const bestVal =
                  row.bestOf === "min"
                    ? Math.min(...numericVals)
                    : Math.max(...numericVals);
                return (
                  <View
                    key={ri}
                    style={{
                      paddingVertical: 12,
                      borderTopWidth: ri === 0 ? StyleSheet.hairlineWidth : 0,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.separator,
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.textSubtle,
                      }}
                    >
                      {row.label}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 10 }}
                    >
                      {comparePlans.map((p: any) => {
                        const txt = row.fmt(p);
                        const num = numericVals[comparePlans.indexOf(p)];
                        const isBest =
                          comparePlans.length >= 2 && num === bestVal;
                        return (
                          <View
                            key={p.id}
                            style={{
                              width: 200,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: radius.md,
                              borderCurve: "continuous",
                              backgroundColor: isBest
                                ? colors.successSoft
                                : colors.surface,
                            }}
                          >
                            <Text
                              style={{
                                ...(isBest ? typography.title.sm : typography.label.lg),
                                color: isBest
                                  ? colors.success
                                  : colors.text,
                              }}
                            >
                              {txt}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })}

              <View style={{ height: spacing.md }} />

              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                {comparePlans.map((p: any) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setDrawerOpen(false);
                      router.push(`/insurance/plans/${p.id}`);
                    }}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      justifyContent: "center",
                      borderRadius: 999,
                      borderCurve: "continuous",
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                    }}
                    haptic="light"
                  >
                    <Text
                      style={{
                        ...typography.label.md,
                        color: colors.primary,
                      }}
                    >
                      {t("insurance.compare.viewPlan", "View")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

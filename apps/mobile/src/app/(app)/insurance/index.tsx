// @ts-nocheck
// Insurance home — dense marketplace hub. Stats flex fixed via Pressable layout.

import { useMemo, useRef } from "react";
import { View, Text, StyleSheet, type ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import {
  Shield,
  FilePlus,
  Activity,
  Search,
  FileText,
  CalendarClock,
  Building2,
  ShieldCheck,
  Sparkles,
  ChevronRight,
} from "lucide-react-native";
import {
  useMyInsuranceEnrollments,
  useMyInsuranceClaims,
  useInsuranceMarketplaceCatalog,
} from "@/hooks/useApi";
import { InsurancePlanCard } from "@/components/insurance/PlanCard";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Pill,
  EmptyState,
  Button,
  SectionHeader,
  Skeleton,
} from "@/components/ui";
import { Pressable } from "@/components/ui/Pressable";

export default function InsuranceHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, fontFamily, typography, radius, shadow, scheme } =
    useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const policiesY = useRef(0);

  const { data, isLoading } = useMyInsuranceEnrollments();
  const { data: claimsData, isLoading: claimsLoading } = useMyInsuranceClaims();
  const { data: catalogData, isLoading: catalogLoading } =
    useInsuranceMarketplaceCatalog({ sort: "rating" });

  const enrollments = data?.enrollments ?? [];
  const active = useMemo(
    () => enrollments.filter((e) => e.status === "active"),
    [enrollments],
  );
  const dueSoon = useMemo(
    () =>
      active.filter((e) => {
        if (!e.nextPremiumDueAt) return false;
        const d = Math.ceil(
          (new Date(e.nextPremiumDueAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        );
        return d >= 0 && d <= 7;
      }).length,
    [active],
  );
  const claims = claimsData?.claims ?? [];
  const pendingClaims = claims.filter((c) =>
    ["submitted", "under_review", "more_info_needed"].includes(c.status),
  ).length;
  const availablePlans = catalogData?.plans ?? [];
  const featuredPlans = useMemo(() => {
    const featured = availablePlans.filter((p) => p.isFeatured);
    const rest = availablePlans.filter((p) => !p.isFeatured);
    return [...featured, ...rest].slice(0, 3);
  }, [availablePlans]);

  function scrollToPolicies() {
    if (enrollments.length === 0) {
      router.push("/insurance/marketplace");
      return;
    }
    scrollRef.current?.scrollTo({
      y: Math.max(0, policiesY.current - 12),
      animated: true,
    });
  }

  return (
    <Screen scroll padded={false} edges={["top"]} ref={scrollRef}>
      <ScreenHeader
        title={t("insurance.tab", "Insurance")}
        subtitle={t(
          "insurance.tabSubtitle",
          "Policies, claims, and plan discovery in one place.",
        )}
        back
        onBack={() => router.replace("/(app)")}
      />

      {/* Hero */}
      <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xs }}>
        <LinearGradient
          colors={["#0B4F6C", "#0E7490", "#0D9488"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xxl,
            borderCurve: "continuous",
            padding: 20,
            overflow: "hidden",
            ...(scheme === "dark" ? {} : shadow.hero),
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -40,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -50,
              left: -30,
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: 6,
              marginBottom: 12,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radius.full,
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.28)",
            }}
          >
            <ShieldCheck size={12} color="#FFFFFF" strokeWidth={2.4} />
            <Text
              style={{
                ...typography.overline,
                color: "#FFFFFF",
                textTransform: "uppercase",
              }}
            >
              {t("insurance.marketplace", "Marketplace")}
            </Text>
          </View>

          <Text
            style={{
              ...typography.display.sm,
              color: "#FFFFFF",
            }}
          >
            {t("insurance.homeHeadline", "Find cover that fits")}
          </Text>
          <Text
            style={{
              ...typography.body.sm,
              color: "rgba(255,255,255,0.86)",
              marginTop: 4,
            }}
            numberOfLines={2}
          >
            {t(
              "insurance.homeSubtitleShort",
              "Compare premiums and buy cover in minutes.",
            )}
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={() => router.push("/insurance/marketplace")}
              haptic="light"
              accessibilityRole="button"
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: "#FFFFFF",
                paddingVertical: 11,
                borderRadius: radius.full,
                borderCurve: "continuous",
                minHeight: 46,
              }}
            >
              <Search size={15} color="#0B4F6C" strokeWidth={2.5} />
              <Text
                style={{
                  ...typography.label.lg,
                  color: "#0B4F6C",
                }}
              >
                {t("insurance.browseMarketplace", "Browse plans")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/insurance/quote")}
              haptic="light"
              accessibilityRole="button"
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
                paddingVertical: 11,
                borderRadius: radius.full,
                borderCurve: "continuous",
                minHeight: 46,
              }}
            >
              <Sparkles size={14} color="#FFFFFF" strokeWidth={2.4} />
              <Text
                style={{
                  ...typography.label.lg,
                  color: "#FFFFFF",
                }}
              >
                {t("insurance.quote.short", "Get quote")}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      {/* Full-width stats */}
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
        }}
      >
        <StatTile
          icon={Shield}
          value={String(active.length)}
          label={t("insurance.myPolicies", "My policies")}
          tint={colors.primary}
          soft={colors.primarySoft}
          onPress={scrollToPolicies}
        />
        <StatTile
          icon={FilePlus}
          value={String(claims.length)}
          label={
            pendingClaims > 0
              ? t("insurance.claimsPendingStat", "{{count}} pending", {
                  count: pendingClaims,
                })
              : t("insurance.myClaims", "My claims")
          }
          tint={colors.success}
          soft={colors.successSoft}
          onPress={() => router.push("/insurance/claims")}
        />
        {dueSoon > 0 ? (
          <StatTile
            icon={CalendarClock}
            value={String(dueSoon)}
            label={t("insurance.dueSoon", "Due ≤ 7d")}
            tint={colors.warning}
            soft={colors.warningSoft}
            onPress={scrollToPolicies}
          />
        ) : null}
      </View>

      {/* Secondary actions only — browse/quote stay in hero */}
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          paddingHorizontal: spacing.lg,
          marginTop: 12,
        }}
      >
        <ActionChip
          icon={Activity}
          label={t("insurance.actionCoverage", "Coverage")}
          color={colors.success}
          soft={colors.successSoft}
          onPress={() => router.push("/insurance/coverage-check")}
        />
        <ActionChip
          icon={FileText}
          label={t("insurance.actionClaim", "File claim")}
          color={colors.warning}
          soft={colors.warningSoft}
          onPress={() => router.push("/insurance/claims/new")}
        />
      </View>

      {/* Policies — immediately after actions so empty state is on-screen */}
      <View
        style={{ paddingHorizontal: spacing.lg, marginTop: 28 }}
        onLayout={(e) => {
          policiesY.current = e.nativeEvent.layout.y;
        }}
      >
        <SectionHeader
          title={t("insurance.myPolicies", "My policies")}
          action={{
            label: t("insurance.browseMarketplace", "Browse plans"),
            onPress: () => router.push("/insurance/marketplace"),
          }}
        />
      </View>

      {isLoading ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: 12,
            marginTop: 8,
          }}
        >
          <Skeleton height={132} radius={radius.card} />
        </View>
      ) : enrollments.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 8 }}>
          <View
            style={{
              paddingVertical: 28,
              paddingHorizontal: 20,
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderCurve: "continuous",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor:
                scheme === "dark" ? colors.borderStrong : colors.separator,
              ...(scheme === "dark" ? {} : shadow.sm),
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                marginBottom: 4,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={26} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text
              style={{
                ...typography.title.md,
                color: colors.text,
                textAlign: "center",
              }}
            >
              {t("insurance.noPolicies", "No active policies yet")}
            </Text>
            <Text
              style={{
                ...typography.body.sm,
                color: colors.textMuted,
                textAlign: "center",
                maxWidth: 260,
                marginBottom: 8,
              }}
            >
              {t(
                "insurance.noPoliciesHint",
                "Browse the marketplace to get coverage in minutes.",
              )}
            </Text>
            <Button
              title={t("insurance.browseMarketplace", "Browse plans")}
              onPress={() => router.push("/insurance/marketplace")}
              fullWidth={false}
            />
          </View>
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: 12,
            marginTop: 8,
          }}
        >
          {enrollments.map((item) => (
            <PolicyCard
              key={item.id}
              item={item}
              onPress={() => router.push(`/insurance/policy/${item.id}`)}
            />
          ))}
        </View>
      )}

      {/* Featured plans */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: 28 }}>
        <SectionHeader
          title={t("insurance.policiesToBuy", "Plans you can buy")}
          action={{
            label: t("common.seeAll", "See all"),
            onPress: () => router.push("/insurance/marketplace"),
          }}
        />
        <View style={{ gap: 12, marginTop: 8 }}>
          {catalogLoading ? (
            <>
              <Skeleton height={148} radius={radius.card} />
              <Skeleton height={148} radius={radius.card} />
            </>
          ) : featuredPlans.length === 0 ? (
            <EmptyState
              title={t("insurance.provider.noPlans", "No plans available")}
            />
          ) : (
            featuredPlans.map((plan) => (
              <InsurancePlanCard
                key={plan.id}
                plan={plan}
                onPress={() => router.push(`/insurance/plans/${plan.id}`)}
              />
            ))
          )}
        </View>
      </View>

      {/* Claims */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: 28 }}>
        <SectionHeader
          title={t("insurance.myClaims", "My claims")}
          action={{
            label: t("insurance.submitClaim", "File claim"),
            onPress: () => router.push("/insurance/claims/new"),
          }}
        />
      </View>

      {claimsLoading && claims.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 8 }}>
          <Skeleton height={76} radius={radius.card} />
        </View>
      ) : claims.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 8 }}>
          <EmptyState
            icon={FilePlus}
            title={t("insurance.claim.noClaims", "No claims submitted yet")}
            actionLabel={t("insurance.submitClaim", "File a claim")}
            onAction={() => router.push("/insurance/claims/new")}
            tone="neutral"
          />
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: 10,
            marginTop: 8,
          }}
        >
          {claims.slice(0, 5).map((claim) => (
            <Pressable
              key={claim.id}
              onPress={() => router.push(`/insurance/claims/${claim.id}`)}
              haptic="light"
              style={{
                borderRadius: radius.card,
                borderCurve: "continuous",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor:
                  scheme === "dark" ? colors.borderStrong : colors.separator,
                backgroundColor: colors.surface,
                paddingVertical: 14,
                paddingHorizontal: 16,
                gap: 4,
                ...(scheme === "dark" ? {} : shadow.sm),
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    ...typography.title.sm,
                    color: colors.text,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {claim.claimNumber ??
                    `Claim #${String(claim.id).slice(0, 8).toUpperCase()}`}
                </Text>
                <Pill
                  tone={
                    claim.status === "approved" || claim.status === "paid"
                      ? "success"
                      : claim.status === "rejected"
                        ? "danger"
                        : "warning"
                  }
                  label={t(
                    `insurance.claim.statuses.${claim.status}`,
                    String(claim.status).replace(/_/g, " "),
                  )}
                />
              </View>
              <Text
                style={{
                  ...typography.body.sm,
                  color: colors.textMuted,
                }}
              >
                LKR {Number(claim.amountRequestedLkr ?? 0).toLocaleString()} ·{" "}
                {claim.providerName ?? t("insurance.provider.label", "Insurer")}
              </Text>
            </Pressable>
          ))}
          {claims.length > 5 ? (
            <Pressable
              onPress={() => router.push("/insurance/claims")}
              haptic="light"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  ...typography.label.md,
                  color: colors.primary,
                }}
              >
                {t("insurance.claim.viewAll", "View all claims")}
              </Text>
              <ChevronRight size={14} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={{ height: spacing.xxxl }} />
    </Screen>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  tint,
  soft,
  onPress,
}: {
  icon: any;
  value: string;
  label: string;
  tint: string;
  soft: string;
  onPress: () => void;
}) {
  const { colors, typography, radius, shadow, scheme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
        padding: 14,
        gap: 2,
        minHeight: 104,
        ...(scheme === "dark" ? {} : shadow.sm),
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          borderCurve: "continuous",
          backgroundColor: soft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Icon size={16} color={tint} strokeWidth={2.4} />
      </View>
      <Text
        style={{
          ...typography.display.sm,
          color: colors.text,
        }}
      >
        {value}
      </Text>
      <Text
        style={{ ...typography.caption, color: colors.textMuted }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ActionChip({
  icon: Icon,
  label,
  color,
  soft,
  onPress,
}: {
  icon: any;
  label: string;
  color: string;
  soft: string;
  onPress: () => void;
}) {
  const { colors, typography, radius, shadow, scheme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
        paddingVertical: 12,
        paddingHorizontal: 12,
        minHeight: 56,
        ...(scheme === "dark" ? {} : shadow.xs),
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          borderCurve: "continuous",
          backgroundColor: soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={color} strokeWidth={2.4} />
      </View>
      <Text
        style={{
          flex: 1,
          ...typography.title.xs,
          color: colors.text,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <ChevronRight size={14} color={colors.textSubtle} strokeWidth={2.4} />
    </Pressable>
  );
}

function PolicyCard({
  item,
  onPress,
}: {
  item: any;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, radius, shadow, scheme } = useTheme();
  const statusTone: "success" | "warning" | "danger" | "neutral" =
    item.status === "active"
      ? "success"
      : item.status === "grace" || item.status === "grace_period"
        ? "warning"
        : item.status === "lapsed" || item.status === "expired"
          ? "danger"
          : "neutral";

  const coverage = Number(item.coverageAmountLkr ?? 0);
  const premium = Number(item.premiumAmountLkr ?? 0);
  const daysToDue = item.nextPremiumDueAt
    ? Math.ceil(
        (new Date(item.nextPremiumDueAt).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const dueSoon = daysToDue !== null && daysToDue >= 0 && daysToDue <= 7;
  const overdue = daysToDue !== null && daysToDue < 0;

  return (
    <Pressable onPress={onPress} haptic="light" accessibilityRole="button">
      <View
        style={{
          borderRadius: radius.card,
          borderCurve: "continuous",
          borderWidth: overdue || dueSoon ? 1 : StyleSheet.hairlineWidth,
          borderColor: overdue
            ? colors.danger
            : dueSoon
              ? colors.warning
              : scheme === "dark"
                ? colors.borderStrong
                : colors.separator,
          backgroundColor: colors.surface,
          ...(scheme === "dark" ? {} : shadow.sm),
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 18,
            bottom: 18,
            width: 3,
            borderTopRightRadius: 3,
            borderBottomRightRadius: 3,
            backgroundColor:
              item.status === "active" ? colors.primary : colors.textSubtle,
          }}
        />
        <View style={{ padding: 16, paddingLeft: 18, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={18} color={colors.primary} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  ...typography.title.md,
                  color: colors.text,
                }}
              >
                {item.planName ?? item.policyNumber ?? "Policy"}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  ...typography.body.sm,
                  color: colors.textMuted,
                  marginTop: 1,
                }}
              >
                {item.providerName ??
                  item.policyNumber ??
                  t("insurance.provider.label", "Insurer")}
              </Text>
            </View>
            <Pill
              tone={statusTone}
              label={t(
                `insurance.status.${item.status}`,
                String(item.status ?? "unknown").replace(/_/g, " "),
              )}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
              backgroundColor: colors.surfaceMuted,
              borderRadius: radius.lg,
              borderCurve: "continuous",
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <View>
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textSubtle,
                }}
              >
                {t("insurance.policy.coverage", "Coverage")}
              </Text>
              <Text
                style={{
                  ...typography.title.lg,
                  color: colors.text,
                  marginTop: 2,
                }}
              >
                LKR {coverage.toLocaleString()}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textSubtle,
                }}
              >
                {t("insurance.policy.premium", "Premium")}
              </Text>
              <Text
                style={{
                  ...typography.title.sm,
                  color: colors.text,
                  marginTop: 2,
                }}
              >
                LKR {premium.toLocaleString()}
              </Text>
            </View>
          </View>

          {item.nextPremiumDueAt ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <CalendarClock
                size={12}
                color={
                  overdue
                    ? colors.danger
                    : dueSoon
                      ? colors.warning
                      : colors.textMuted
                }
              />
              <Text
                style={{
                  ...typography.caption,
                  color: overdue
                    ? colors.danger
                    : dueSoon
                      ? colors.warning
                      : colors.textMuted,
                  flex: 1,
                }}
              >
                {t("insurance.policy.nextPremium", "Next premium")}:{" "}
                {new Date(item.nextPremiumDueAt).toLocaleDateString()}
                {daysToDue !== null
                  ? ` · ${overdue ? `${-daysToDue}d overdue` : `${daysToDue}d`}`
                  : ""}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

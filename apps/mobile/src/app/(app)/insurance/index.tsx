// @ts-nocheck
// Insurance home — dense marketplace hub. Stats flex fixed via Pressable layout.

import { useMemo, useRef } from "react";
import { View, Text, type ScrollView } from "react-native";
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
  const { colors, spacing, fontFamily } = useTheme();
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
          style={{ borderRadius: 20, padding: 14, overflow: "hidden" }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -30,
              right: -20,
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <ShieldCheck size={13} color="#FFFFFF" strokeWidth={2.4} />
            <Text
              style={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 10,
                fontWeight: "800",
                letterSpacing: 1.1,
                textTransform: "uppercase",
              }}
            >
              {t("insurance.marketplace", "Marketplace")}
            </Text>
          </View>

          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 20,
              fontWeight: "800",
              fontFamily: fontFamily.bodyBold,
              letterSpacing: -0.4,
            }}
          >
            {t("insurance.homeHeadline", "Find cover that fits")}
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.88)",
              fontSize: 12.5,
              lineHeight: 17,
              marginTop: 3,
              fontWeight: "500",
            }}
            numberOfLines={2}
          >
            {t(
              "insurance.homeSubtitleShort",
              "Compare premiums and buy cover in minutes.",
            )}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
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
                borderRadius: 12,
                minHeight: 44,
              }}
            >
              <Search size={14} color="#0B4F6C" strokeWidth={2.5} />
              <Text
                style={{
                  color: "#0B4F6C",
                  fontWeight: "800",
                  fontSize: 13,
                  fontFamily: fontFamily.bodyBold,
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
                backgroundColor: "rgba(255,255,255,0.16)",
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.45)",
                paddingVertical: 11,
                borderRadius: 12,
                minHeight: 44,
              }}
            >
              <Sparkles size={13} color="#FFFFFF" strokeWidth={2.4} />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "800",
                  fontSize: 13,
                  fontFamily: fontFamily.bodyBold,
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
          gap: 8,
          paddingHorizontal: spacing.lg,
          marginTop: 12,
        }}
      >
        <StatTile
          icon={Shield}
          value={String(active.length)}
          label={t("insurance.myPolicies", "My policies")}
          tint="#0284C7"
          soft="#E0F2FE"
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
          tint="#059669"
          soft="#D1FAE5"
          onPress={() => router.push("/insurance/claims")}
        />
        {dueSoon > 0 ? (
          <StatTile
            icon={CalendarClock}
            value={String(dueSoon)}
            label={t("insurance.dueSoon", "Due ≤ 7d")}
            tint="#D97706"
            soft="#FEF3C7"
            onPress={scrollToPolicies}
          />
        ) : null}
      </View>

      {/* Secondary actions only — browse/quote stay in hero */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: spacing.lg,
          marginTop: 12,
        }}
      >
        <ActionChip
          icon={Activity}
          label={t("insurance.actionCoverage", "Coverage")}
          color="#059669"
          soft="#D1FAE5"
          onPress={() => router.push("/insurance/coverage-check")}
        />
        <ActionChip
          icon={FileText}
          label={t("insurance.actionClaim", "File claim")}
          color="#D97706"
          soft="#FEF3C7"
          onPress={() => router.push("/insurance/claims/new")}
        />
      </View>

      {/* Policies — immediately after actions so empty state is on-screen */}
      <View
        style={{ paddingHorizontal: spacing.lg, marginTop: 18 }}
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
            gap: 8,
            marginTop: 8,
          }}
        >
          <Skeleton height={100} radius={16} />
        </View>
      ) : enrollments.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 8 }}>
          <View
            style={{
              padding: 16,
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={20} color={colors.primary} strokeWidth={2.3} />
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "800",
                color: colors.text,
                textAlign: "center",
                fontFamily: fontFamily.bodyBold,
              }}
            >
              {t("insurance.noPolicies", "No active policies yet")}
            </Text>
            <Text
              style={{
                fontSize: 12.5,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 17,
                fontWeight: "500",
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
            gap: 8,
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
      <View style={{ paddingHorizontal: spacing.lg, marginTop: 20 }}>
        <SectionHeader
          title={t("insurance.policiesToBuy", "Plans you can buy")}
          action={{
            label: t("common.seeAll", "See all"),
            onPress: () => router.push("/insurance/marketplace"),
          }}
        />
        <View style={{ gap: 8, marginTop: 8 }}>
          {catalogLoading ? (
            <>
              <Skeleton height={100} radius={16} />
              <Skeleton height={100} radius={16} />
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
      <View style={{ paddingHorizontal: spacing.lg, marginTop: 20 }}>
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
          <Skeleton height={80} radius={14} />
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
            gap: 8,
            marginTop: 8,
          }}
        >
          {claims.slice(0, 5).map((claim) => (
            <Pressable
              key={claim.id}
              onPress={() => router.push(`/insurance/claims/${claim.id}`)}
              haptic="light"
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 14,
                gap: 6,
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
                    fontWeight: "800",
                    fontSize: 14,
                    color: colors.text,
                    flex: 1,
                    fontFamily: fontFamily.bodyBold,
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
                  fontSize: 13,
                  color: colors.textMuted,
                  fontWeight: "600",
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
                  fontSize: 13,
                  fontWeight: "800",
                  color: colors.primary,
                  fontFamily: fontFamily.bodyBold,
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
  const { colors, fontFamily } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flex: 1,
        backgroundColor: soft,
        borderRadius: 14,
        padding: 12,
        gap: 4,
        minHeight: 84,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={14} color={tint} strokeWidth={2.4} />
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "800",
          color: colors.text,
          fontFamily: fontFamily.bodyBold,
          letterSpacing: -0.4,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
      <Text
        style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}
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
  const { colors, fontFamily } = useTheme();
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
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 12,
        paddingHorizontal: 12,
        minHeight: 48,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
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
          fontSize: 13,
          fontWeight: "800",
          color: colors.text,
          fontFamily: fontFamily.bodyBold,
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
  const { colors, fontFamily } = useTheme();
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
          borderRadius: 16,
          borderWidth: 1,
          borderColor: overdue
            ? colors.danger
            : dueSoon
              ? colors.warning
              : colors.border,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor:
              item.status === "active" ? colors.primary : colors.textSubtle,
          }}
        />
        <View style={{ padding: 14, paddingLeft: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
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
                  fontWeight: "800",
                  fontSize: 14,
                  color: colors.text,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {item.planName ?? item.policyNumber ?? "Policy"}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  marginTop: 2,
                  fontWeight: "600",
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
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <View>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  fontWeight: "600",
                }}
              >
                {t("insurance.policy.coverage", "Coverage")}
              </Text>
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 14,
                  color: colors.text,
                  marginTop: 2,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                LKR {coverage.toLocaleString()}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  fontWeight: "600",
                }}
              >
                {t("insurance.policy.premium", "Premium")}
              </Text>
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 14,
                  color: colors.text,
                  marginTop: 2,
                  fontFamily: fontFamily.bodyBold,
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
                  fontSize: 11.5,
                  fontWeight: "600",
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

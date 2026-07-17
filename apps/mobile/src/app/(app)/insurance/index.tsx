// @ts-nocheck
// Insurance tab home. Lists user's policies + entry to marketplace.

import { useMemo } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Shield,
  FilePlus,
  Activity,
  Search,
  ChevronRight,
  FileText,
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
  Hero,
  Card,
  Pill,
  EmptyState,
  Button,
  StatCard,
  SectionHeader,
  Skeleton,
} from "@/components/ui";
import { AppText } from "@/components/ui/AppText";
import { Pressable } from "@/components/ui/Pressable";

function QuickAction({ icon: Icon, label, color, bgColor, onPress }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: bgColor,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        }}
      >
        <Icon size={20} color={color} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: "600",
          color: colors.text,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <ChevronRight size={16} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function InsuranceHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  const { data, isLoading } = useMyInsuranceEnrollments();
  const { data: claimsData } = useMyInsuranceClaims();
  const { data: catalogData, isLoading: catalogLoading } = useInsuranceMarketplaceCatalog();

  const enrollments = data?.enrollments ?? [];
  const active = useMemo(
    () => enrollments.filter((e) => e.status === "active"),
    [enrollments],
  );
  const claims = claimsData?.claims ?? [];
  const pendingClaims = claims.filter((c) =>
    ["submitted", "under_review", "more_info_needed"].includes(c.status),
  ).length;
  const availablePlans = catalogData?.plans ?? [];

  return (
    <Screen scroll padded={false}>
      <ScreenHeader
        title={t("insurance.tab")}
        subtitle={t("insurance.tabSubtitle", "Manage your active policies, file claims, or search plans.")}
        kicker={t("insurance.homeKicker")}
        icon={<Shield size={20} color={colors.primary} />}
        onBack={() => router.replace("/(app)")}
      />

      {/* ─── Hero: tappable marketplace CTA ─── */}
      <Pressable
        onPress={() => router.push("/insurance/marketplace")}
        haptic="light"
      >
        <Hero
          eyebrow={t("insurance.marketplace", "Marketplace")}
          title={t("insurance.browseMarketplace")}
          subtitle={t("insurance.homeTitle")}
          height={135}
          style={{
            borderRadius: radius.xl,
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: spacing.md,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignSelf: "flex-start",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
            }}
          >
            <Search size={14} color="#fff" strokeWidth={2.5} />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              {t("insurance.search")}
            </Text>
            <ChevronRight size={14} color="#fff" />
          </View>
        </Hero>
      </Pressable>

      {/* ─── Stats row ─── */}
      <View
        style={{
          flexDirection: "row",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
        }}
      >
        <StatCard
          label={t("insurance.myPolicies")}
          value={String(active.length)}
          tone="primary"
          icon={Shield}
        />
        <StatCard
          label={t("insurance.myClaims")}
          value={String(pendingClaims)}
          tone="accent"
          icon={FilePlus}
        />
      </View>

      {/* ─── Quick Actions ─── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <SectionHeader title={t("insurance.tab")} />

        <QuickAction
          icon={Search}
          label={t("insurance.browseMarketplace")}
          color={colors.primary}
          bgColor={`${colors.primary}15`}
          onPress={() => router.push("/insurance/marketplace")}
        />

        <QuickAction
          icon={Activity}
          label={t("insurance.coverageCheck")}
          color="#10B981"
          bgColor="#10B98115"
          onPress={() => router.push("/insurance/coverage-check")}
        />

        <QuickAction
          icon={FileText}
          label={t("insurance.submitClaim")}
          color="#F59E0B"
          bgColor="#F59E0B15"
          onPress={() => router.push("/insurance/claims/new")}
        />
      </View>

      {/* ─── My Policies ─── */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <SectionHeader
          title={t("insurance.myPolicies")}
          action={
            enrollments.length > 0
              ? {
                  label: t("insurance.buyAnother"),
                  onPress: () => router.push("/insurance/marketplace"),
                }
              : undefined
          }
        />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
        </View>
      ) : enrollments.length === 0 ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Card style={{ padding: spacing.md, alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface }}>
              <Shield size={24} color={colors.textSubtle} />
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center" }}>
                {t("insurance.noPolicies")}
              </Text>
            </Card>
          </View>

          <View style={{ paddingHorizontal: spacing.lg }}>
            <SectionHeader title={t("insurance.policiesToBuy", "Policies You Can Buy")} />
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              {catalogLoading ? (
                <View style={{ gap: spacing.sm }}>
                  <Skeleton height={104} radius={16} />
                  <Skeleton height={104} radius={16} />
                </View>
              ) : availablePlans.length === 0 ? (
                <EmptyState title={t("insurance.provider.noPlans")} />
              ) : (
                availablePlans.slice(0, 3).map((plan) => (
                  <InsurancePlanCard
                    key={plan.id}
                    plan={plan}
                    onPress={() => router.push(`/insurance/plans/${plan.id}`)}
                  />
                ))
              )}
            </View>
          </View>
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
            marginTop: spacing.sm,
          }}
        >
          {enrollments.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/insurance/policy/${item.id}`)}
              haptic="light"
            >
              <Card style={{ padding: 14, gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 14,
                      color: colors.text,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {item.policyNumber ??
                      t("insurance.policy.policyNumber")}
                  </Text>
                  <Pill
                    tone={
                      item.status === "active" ? "accent" : "neutral"
                    }
                  >
                    {t(`insurance.status.${item.status}`)}
                  </Pill>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                  }}
                >
                  LKR {item.premiumAmountLkr.toLocaleString()} /{" "}
                  {item.billingCycle} · LKR{" "}
                  {item.coverageAmountLkr.toLocaleString()} coverage
                </Text>
                {item.nextPremiumDueAt ? (
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textMuted,
                    }}
                  >
                    {t("insurance.policy.nextPremium")}:{" "}
                    {new Date(
                      item.nextPremiumDueAt,
                    ).toLocaleDateString()}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      {/* ─── My Claims ─── */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <SectionHeader
          title={t("insurance.myClaims")}
          action={
            claims.length > 0
              ? {
                  label: t("insurance.submitClaim"),
                  onPress: () => router.push("/insurance/claims/new"),
                }
              : undefined
          }
        />
      </View>

      {claims.length === 0 && !isLoading ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={<FilePlus size={28} color={colors.textSubtle} />}
            title={t(
              "insurance.claim.noClaims",
              "No claims submitted yet.",
            )}
            ctaLabel={t("insurance.submitClaim")}
            onCtaPress={() => router.push("/insurance/claims/new")}
          />
        </View>
      ) : claims.length > 0 ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
            marginTop: spacing.sm,
          }}
        >
          {claims.slice(0, 5).map((claim) => (
            <Pressable
              key={claim.id}
              onPress={() =>
                router.push(`/insurance/claims/${claim.id}`)
              }
              haptic="light"
            >
              <Card style={{ padding: 14, gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 13,
                      color: colors.text,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {claim.claimNumber ??
                      `Claim #${claim.id.slice(0, 8)}`}
                  </Text>
                  <Pill
                    tone={
                      claim.status === "approved"
                        ? "accent"
                        : claim.status === "rejected"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {t(
                      `insurance.claim.status.${claim.status}`,
                      claim.status,
                    )}
                  </Pill>
                </View>
                <Text
                  style={{ fontSize: 13, color: colors.textMuted }}
                >
                  LKR{" "}
                  {(claim.claimedAmountLkr ?? 0).toLocaleString()}{" "}
                  claimed
                </Text>
                {claim.submittedAt ? (
                  <Text
                    style={{ fontSize: 11, color: colors.textMuted }}
                  >
                    {new Date(
                      claim.submittedAt,
                    ).toLocaleDateString()}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          ))}
          {claims.length > 5 ? (
            <Button
              label={t(
                "insurance.claim.viewAll",
                "View all claims",
              )}
              variant="outline"
              onPress={() => router.push("/insurance/claims")}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </View>
      ) : null}

      {/* Bottom spacing */}
      <View style={{ height: spacing.xxxl }} />
    </Screen>
  );
}
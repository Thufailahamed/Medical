// @ts-nocheck
// Insurance tab home — redesigned hero, stats, quick actions, policies & claims.

import { useMemo } from "react";
import { View, Text } from "react-native";
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
  ArrowUpRight,
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
  const { data, isLoading } = useMyInsuranceEnrollments();
  const { data: claimsData } = useMyInsuranceClaims();
  const { data: catalogData, isLoading: catalogLoading } =
    useInsuranceMarketplaceCatalog();

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
        return d <= 7;
      }).length,
    [active],
  );
  const claims = claimsData?.claims ?? [];
  const pendingClaims = claims.filter((c) =>
    ["submitted", "under_review", "more_info_needed"].includes(c.status),
  ).length;
  const availablePlans = catalogData?.plans ?? [];

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <ScreenHeader
        title={t("insurance.tab")}
        subtitle={t(
          "insurance.tabSubtitle",
          "Manage your active policies, file claims, or search plans.",
        )}
        back
        onBack={() => router.replace("/(app)")}
      />

      {/* ─── Hero ─── */}
      <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}>
        <LinearGradient
          colors={["#0B4F6C", "#0D9488", "#14B8A6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: spacing.lg,
            overflow: "hidden",
            minHeight: 168,
          }}
        >
          {/* Decorative orbs */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -40,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -50,
              left: -20,
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={16} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <Text
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              {t("insurance.marketplace", "Marketplace")}
            </Text>
          </View>

          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 24,
              fontWeight: "800",
              fontFamily: fontFamily.bodyBold,
              letterSpacing: -0.5,
              lineHeight: 30,
            }}
          >
            {t("insurance.browseMarketplace", "Browse plans")}
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.88)",
              fontSize: 13.5,
              lineHeight: 19,
              marginTop: 6,
              fontWeight: "500",
              maxWidth: "92%",
            }}
          >
            {t(
              "insurance.homeTitle",
              "Protect your family for less than your monthly coffee",
            )}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 16,
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Pressable
              onPress={() => router.push("/insurance/marketplace")}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={t("insurance.search", "Search plans")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#FFFFFF",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
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
                {t("insurance.search", "Search plans")}
              </Text>
              <ArrowUpRight size={14} color="#0B4F6C" strokeWidth={2.5} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/insurance/quote")}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={t("insurance.quote.short", "Get quote")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: "#FFFFFF",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
              }}
            >
              <Sparkles size={13} color="#0B4F6C" strokeWidth={2.4} />
              <Text
                style={{
                  color: "#0B4F6C",
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

      {/* ─── Stats ─── */}
      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
        }}
      >
        <StatTile
          icon={Shield}
          value={String(active.length)}
          label={t("insurance.myPolicies")}
          tint="#0284C7"
          soft="#E0F2FE"
          onPress={() => {}}
        />
        <StatTile
          icon={FilePlus}
          value={String(pendingClaims)}
          label={t("insurance.myClaims")}
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
            onPress={() => {}}
          />
        ) : null}
      </View>

      {/* ─── Quick Actions ─── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <SectionHeader title={t("insurance.quickActions", "Quick actions")} />
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <QuickTile
              icon={Search}
              label={t("insurance.actionBrowse", "Browse plans")}
              hint={t("insurance.browseHint", "Compare plans")}
              color="#0284C7"
              soft="#E0F2FE"
              onPress={() => router.push("/insurance/marketplace")}
            />
            <QuickTile
              icon={Activity}
              label={t("insurance.actionCoverage", "Coverage")}
              hint={t("insurance.coverageHint", "What's covered")}
              color="#059669"
              soft="#D1FAE5"
              onPress={() => router.push("/insurance/coverage-check")}
            />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <QuickTile
              icon={FileText}
              label={t("insurance.actionClaim", "File a claim")}
              hint={t("insurance.claimHint", "Submit online")}
              color="#D97706"
              soft="#FEF3C7"
              onPress={() => router.push("/insurance/claims/new")}
            />
            <QuickTile
              icon={Sparkles}
              label={t("insurance.actionQuote", "Get a quote")}
              hint={t("insurance.quoteHint", "Takes ~60s")}
              color="#0D9488"
              soft="#CCFBF1"
              onPress={() => router.push("/insurance/quote")}
            />
          </View>
        </View>
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
          <Skeleton height={112} radius={18} />
          <Skeleton height={112} radius={18} />
        </View>
      ) : enrollments.length === 0 ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View
              style={{
                padding: spacing.lg,
                alignItems: "center",
                gap: spacing.sm,
                backgroundColor: colors.surface,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Shield size={22} color={colors.primary} strokeWidth={2.3} />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: colors.text,
                  textAlign: "center",
                }}
              >
                {t("insurance.noPolicies")}
              </Text>
              <Button
                title={t("insurance.browseMarketplace")}
                onPress={() => router.push("/insurance/marketplace")}
                fullWidth={false}
              />
            </View>
          </View>

          <View style={{ paddingHorizontal: spacing.lg }}>
            <SectionHeader
              title={t("insurance.policiesToBuy", "Policies You Can Buy")}
            />
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              {catalogLoading ? (
                <View style={{ gap: spacing.sm }}>
                  <Skeleton height={112} radius={18} />
                  <Skeleton height={112} radius={18} />
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
            <PolicyCard
              key={item.id}
              item={item}
              onPress={() => router.push(`/insurance/policy/${item.id}`)}
            />
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
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <EmptyState
            icon={FilePlus}
            title={t("insurance.claim.noClaims", "No claims submitted yet.")}
            actionLabel={t("insurance.submitClaim")}
            onAction={() => router.push("/insurance/claims/new")}
            tone="neutral"
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
              onPress={() => router.push(`/insurance/claims/${claim.id}`)}
              haptic="light"
              style={({ pressed }) => ({
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                padding: 14,
                gap: 8,
              })}
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
                    `Claim #${claim.id.slice(0, 8).toUpperCase()}`}
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
                    claim.status,
                  )}
                />
              </View>
              <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600" }}>
                LKR {(claim.amountRequestedLkr ?? 0).toLocaleString()} ·{" "}
                {claim.providerName ?? t("insurance.provider.label")}
              </Text>
              {claim.createdAt ? (
                <Text style={{ fontSize: 11, color: colors.textSubtle, fontWeight: "600" }}>
                  {new Date(claim.createdAt).toLocaleDateString()}
                </Text>
              ) : null}
            </Pressable>
          ))}
          {claims.length > 5 ? (
            <Button
              title={t("insurance.claim.viewAll", "View all claims")}
              variant="outline"
              onPress={() => router.push("/insurance/claims")}
            />
          ) : null}
        </View>
      ) : null}

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
      style={{
        flex: 1,
        backgroundColor: soft,
        borderRadius: 18,
        padding: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: "transparent",
        minHeight: 96,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={tint} strokeWidth={2.4} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "800",
          color: colors.text,
          fontFamily: fontFamily.bodyBold,
          letterSpacing: -0.4,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11.5,
          fontWeight: "700",
          color: colors.textMuted,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function QuickTile({
  icon: Icon,
  label,
  hint,
  color,
  soft,
  onPress,
}: {
  icon: any;
  label: string;
  hint: string;
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
      accessibilityLabel={`${label}. ${hint}`}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: pressed ? soft : colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: pressed ? color : colors.border,
        padding: 14,
        gap: 10,
        minHeight: 104,
        justifyContent: "space-between",
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={color} strokeWidth={2.4} />
      </View>
      <View style={{ gap: 3 }}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: colors.text,
            fontFamily: fontFamily.bodyBold,
            letterSpacing: -0.2,
          }}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            fontSize: 12,
            color: colors.textMuted,
            fontWeight: "600",
          }}
        >
          {hint}
        </Text>
      </View>
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
      : item.status === "grace"
        ? "warning"
        : item.status === "lapsed" || item.status === "expired"
          ? "danger"
          : "neutral";

  const daysToDue = item.nextPremiumDueAt
    ? Math.ceil(
        (new Date(item.nextPremiumDueAt).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const dueSoon = daysToDue !== null && daysToDue >= 0 && daysToDue <= 7;
  const overdue = daysToDue !== null && daysToDue < 0;

  return (
    <Pressable onPress={onPress} haptic="light">
      <View
        style={{
          borderRadius: 18,
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
                {item.planName ?? item.policyNumber}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "600" }}
              >
                {item.providerName ??
                  item.policyNumber ??
                  t("insurance.provider.label")}
              </Text>
            </View>
            <Pill
              tone={statusTone}
              label={t(`insurance.status.${item.status}`)}
            />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600" }}>
                {t("insurance.policy.coverage")}
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
                LKR {item.coverageAmountLkr.toLocaleString()}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600" }}>
                {t("insurance.policy.premium")}
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
                LKR {item.premiumAmountLkr.toLocaleString()}
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
                }}
              >
                {t("insurance.policy.nextPremium")}:{" "}
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

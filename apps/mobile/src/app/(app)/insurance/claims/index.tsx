// @ts-nocheck
// My claims list. Summary strip + status-toned claim cards.

import { View, Text, FlatList, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  FilePlus,
  Plus,
  Receipt,
  ScanSearch,
  Upload,
  Wallet,
} from "lucide-react-native";
import { useMyInsuranceClaims } from "@/hooks/useApi";
import {
  Screen,
  ScreenHeader,
  Pill,
  EmptyState,
  Skeleton,
  Button,
  Card,
  IconTile,
  MetricStrip,
  SectionHeader,
} from "@/components/ui";
import { Pressable } from "@/components/ui/Pressable";
import { TREATMENT_ICONS, formatLkr } from "@/components/insurance/ClaimFormParts";
import { useTheme } from "@/theme/ThemeProvider";

const DONE = ["approved", "paid"];
const OPEN = ["draft", "submitted", "under_review", "more_info_needed"];

const statusTone = (s: string) =>
  DONE.includes(s) ? "success" : s === "rejected" ? "danger" : s === "draft" ? "neutral" : "warning";

const compactLkr = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
    : n >= 1_000
      ? `${Math.round(n / 1_000)}K`
      : String(n);

export default function ClaimsList() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
  const { data, isLoading } = useMyInsuranceClaims();

  const claims = data?.claims ?? [];
  const totalClaimed = claims.reduce((s, c) => s + (c.amountRequestedLkr ?? 0), 0);
  const totalApproved = claims
    .filter((c) => DONE.includes(c.status))
    .reduce((s, c) => s + (c.amountApprovedLkr ?? 0), 0);
  const openCount = claims.filter((c) => OPEN.includes(c.status)).length;

  const goNew = () => router.push("/insurance/claims/new");

  const formatDate = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });
  };

  const header = (
    <View>
      <MetricStrip
        size="md"
        items={[
          {
            icon: Receipt,
            label: t("insurance.claim.totalClaimed", "Claimed"),
            value: compactLkr(totalClaimed),
            sub: "LKR",
            tone: "primary",
          },
          {
            icon: BadgeCheck,
            label: t("insurance.claim.totalApproved", "Approved"),
            value: compactLkr(totalApproved),
            sub: "LKR",
            tone: "success",
          },
          {
            icon: Clock,
            label: t("insurance.claim.inProgress", "In progress"),
            value: openCount,
            tone: "warning",
            live: openCount > 0,
          },
        ]}
      />
      <SectionHeader title={t("insurance.claim.recent")} count={claims.length} />
    </View>
  );

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader
        kicker={t("insurance.claim.kicker")}
        title={t("insurance.claim.list")}
        subtitle={t("insurance.claim.listSubtitle", "Track submissions and payouts")}
        back
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: 12 }}>
          <Skeleton height={76} radius={radius.card} />
          <Skeleton height={92} radius={radius.card} />
          <Skeleton height={92} radius={radius.card} />
        </View>
      ) : claims.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: 32 + insets.bottom,
            gap: 4,
          }}
        >
          <EmptyState
            icon={FilePlus}
            title={t("insurance.claim.empty")}
            message={t(
              "insurance.claim.emptyBody",
              "Paid for treatment out of pocket? File a claim and get reimbursed by your insurer.",
            )}
            actionLabel={t("insurance.submitClaim")}
            onAction={goNew}
            tone="primary"
          />
          <SectionHeader
            kicker={t("insurance.claim.howKicker", "3 simple steps")}
            title={t("insurance.claim.howTitle", "How claims work")}
          />
          <Card style={{ padding: 18, gap: 16 }}>
            {[
              { icon: Upload, key: "howUpload", fallback: "Upload your final bill and discharge summary" },
              { icon: ScanSearch, key: "howReview", fallback: "Your insurer reviews the claim and may ask questions" },
              { icon: Wallet, key: "howPaid", fallback: "Approved amounts are paid out to you" },
            ].map((s, i, arr) => (
              <View key={s.key} style={{ flexDirection: "row", gap: 14 }}>
                <View style={{ alignItems: "center" }}>
                  <IconTile icon={s.icon} tone="primary" size={38} />
                  {i < arr.length - 1 ? (
                    <View style={{ width: 2, flex: 1, marginTop: 6, marginBottom: -10, borderRadius: 1, backgroundColor: colors.primarySoft }} />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingTop: 2, paddingBottom: i < arr.length - 1 ? 6 : 0 }}>
                  <Text style={[typography.caption, { color: colors.primary, fontFamily: typography.kicker.fontFamily }]}>
                    {t("insurance.coverage.step", { n: i + 1, defaultValue: "Step {{n}}" })}
                  </Text>
                  <Text style={[typography.body.md, { color: colors.text }]}>
                    {t(`insurance.claim.${s.key}`, s.fallback)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </ScrollView>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={header}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: 120 + insets.bottom,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const tone = statusTone(item.status);
            const date = formatDate(item.admissionDate ?? item.createdAt);
            const meta = [item.incurringFacility, date].filter(Boolean).join(" · ");
            const approved = item.amountApprovedLkr != null && DONE.includes(item.status);
            return (
              <Pressable
                onPress={() => router.push(`/insurance/claims/${item.id}`)}
                haptic="light"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  borderRadius: radius.card,
                  borderCurve: "continuous",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
                  backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                  ...(scheme === "dark" ? {} : shadow.sm),
                })}
              >
                <IconTile
                  icon={TREATMENT_ICONS[item.treatmentType] ?? Receipt}
                  tone={tone}
                  size={46}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text
                      style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}
                      numberOfLines={1}
                    >
                      {item.treatmentType
                        ? t(`insurance.claim.treatments.${item.treatmentType}`)
                        : t("insurance.claim.treatment")}
                    </Text>
                  </View>
                  {meta ? (
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {meta}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <Pill tone={tone} label={t(`insurance.claim.statuses.${item.status}`)} />
                    {item.claimNumber ? (
                      <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                        #{item.claimNumber}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={[typography.caption, { color: colors.textSubtle }]}>LKR</Text>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {formatLkr((approved ? item.amountApprovedLkr : item.amountRequestedLkr) ?? 0)}
                  </Text>
                  {approved && item.amountApprovedLkr !== item.amountRequestedLkr ? (
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textSubtle, textDecorationLine: "line-through" },
                      ]}
                    >
                      {formatLkr(item.amountRequestedLkr)}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: colors.well,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChevronRight size={15} color={colors.textMuted} strokeWidth={2.4} />
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {claims.length > 0 ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
            backgroundColor: colors.bgElevated ?? colors.surface,
          }}
        >
          <Button title={t("insurance.submitClaim")} icon={Plus} onPress={goNew} />
        </View>
      ) : null}
    </Screen>
  );
}

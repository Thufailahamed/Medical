// @ts-nocheck
// My claims list. Status pills + amounts.

import { View, Text, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { FilePlus } from "lucide-react-native";
import { useMyInsuranceClaims } from "@/hooks/useApi";
import {
  Screen,
  ScreenHeader,
  Pill,
  EmptyState,
  Skeleton,
  Button,
  SectionHeader,
} from "@/components/ui";
import { Pressable } from "@/components/ui/Pressable";
import { useTheme } from "@/theme/ThemeProvider";

export default function ClaimsList() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, fontFamily } = useTheme();
  const { data, isLoading } = useMyInsuranceClaims();

  const claims = data?.claims ?? [];

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader
        title={t("insurance.claim.list")}
        subtitle={t("insurance.claim.listSubtitle", "Track submissions and payouts")}
        back
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <SectionHeader title={t("insurance.claim.recent")} />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: 10 }}>
          <Skeleton height={96} radius={16} />
          <Skeleton height={96} radius={16} />
        </View>
      ) : claims.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={FilePlus}
            title={t("insurance.claim.empty")}
            actionLabel={t("insurance.submitClaim")}
            onAction={() => router.push("/insurance/claims/new")}
            tone="neutral"
          />
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: 10,
            paddingBottom: 100,
          }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/insurance/claims/${item.id}`)}
              haptic="light"
              style={({ pressed }) => ({
                padding: 14,
                gap: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
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
                  {item.treatmentType
                    ? t(`insurance.claim.treatments.${item.treatmentType}`)
                    : t("insurance.claim.treatment")}
                </Text>
                <Pill
                  tone={
                    item.status === "approved" || item.status === "paid"
                      ? "success"
                      : item.status === "rejected"
                        ? "danger"
                        : "warning"
                  }
                  label={t(`insurance.claim.statuses.${item.status}`)}
                />
              </View>
              <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600" }}>
                LKR {(item.amountRequestedLkr ?? 0).toLocaleString()}
                {item.amountApprovedLkr
                  ? ` · ${t("insurance.claim.approved", {
                      amount: item.amountApprovedLkr.toLocaleString(),
                    })}`
                  : ""}
              </Text>
            </Pressable>
          )}
        />
      )}

      {claims.length > 0 ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: spacing.lg,
            paddingBottom: 28,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Button
            title={t("insurance.submitClaim")}
            onPress={() => router.push("/insurance/claims/new")}
          />
        </View>
      ) : null}
    </Screen>
  );
}

// @ts-nocheck
// My claims list. Status pills + amounts.

import { View, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { FilePlus } from "lucide-react-native";
import { useMyInsuranceClaims } from "@/hooks/useApi";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  EmptyState,
  Skeleton,
  Button,
  SectionHeader,
} from "@/components/ui";
import { AppText } from "@/components/ui/AppText";
import { Pressable } from "@/components/ui/Pressable";
import { useTheme } from "@/theme/ThemeProvider";

export default function ClaimsList() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading } = useMyInsuranceClaims();

  const claims = data?.claims ?? [];

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.claim.list")}
        subtitle=""
        kicker={t("insurance.claim.kicker")}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <SectionHeader title={t("insurance.claim.recent")} />
      </View>

      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
        </View>
      ) : claims.length === 0 ? (
        <View style={{ padding: 16 }}>
          <EmptyState
            icon={<FilePlus size={28} color={colors.textSubtle} />}
            title={t("insurance.claim.empty")}
            ctaLabel={t("insurance.submitClaim")}
            onCtaPress={() => router.push("/insurance/claims/new")}
          />
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/insurance/claims/${item.id}`)}>
              <Card style={{ padding: 14, gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <AppText weight="700">
                    {item.treatmentType
                      ? t(`insurance.claim.treatments.${item.treatmentType}`)
                      : t("insurance.claim.treatment")}
                  </AppText>
                  <Pill
                    tone={
                      item.status === "approved"
                        ? "accent"
                        : item.status === "rejected"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {t(`insurance.claim.statuses.${item.status}`)}
                  </Pill>
                </View>
                <AppText size="sm" color="muted">
                  LKR {item.amountRequestedLkr.toLocaleString()}
                  {item.amountApprovedLkr
                    ? ` · ${t("insurance.claim.approved", { amount: item.amountApprovedLkr.toLocaleString() })}`
                    : ""}
                </AppText>
                {item.submittedAt ? (
                  <AppText size="xs" color="muted">
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </AppText>
                ) : null}
              </Card>
            </Pressable>
          )}
        />
      )}

      <View style={{ padding: 16 }}>
        <Button
          label={t("insurance.submitClaim")}
          leftIcon={<FilePlus size={14} />}
          onPress={() => router.push("/insurance/claims/new")}
        />
      </View>
    </Screen>
  );
}
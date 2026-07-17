// @ts-nocheck
// Policy detail. Premium status, coverage, dependents, claims summary, ECARD link.

import { useLocalSearchParams, useRouter } from "expo-router";
import { View, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Shield,
  CreditCard,
  CalendarClock,
  FilePlus,
  Wallet,
} from "lucide-react-native";
import { useInsuranceEnrollment } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  Skeleton,
  EmptyState,
  SectionHeader,
} from "@/components/ui";
import { AppText } from "@/components/ui/AppText";

export default function PolicyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading } = useInsuranceEnrollment(id ?? "");

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={140} radius={16} />
          <Skeleton height={120} radius={16} />
        </View>
      </Screen>
    );
  }

  if (!data?.enrollment) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16 }}>
          <EmptyState title={t("insurance.policy.notFound")} />
        </View>
      </Screen>
    );
  }

  const e = data.enrollment;

  return (
    <Screen>
      <ScreenHeader
        title={e.policyNumber ?? t("insurance.policy.policyNumber")}
        subtitle={`LKR ${e.coverageAmountLkr.toLocaleString()} coverage`}
        kicker={t("insurance.policy.kicker")}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Card style={{ margin: 16, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Shield size={20} color={colors.primary} />
            <AppText weight="700" size="md">
              {t("insurance.policy.summary")}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill tone={e.status === "active" ? "accent" : "neutral"}>
              {t(`insurance.status.${e.status}`)}
            </Pill>
            <Pill tone="primary">{e.billingCycle}</Pill>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText size="xs" color="muted">
                {t("insurance.policy.premium")}
              </AppText>
              <AppText weight="700" size="md">
                LKR {e.premiumAmountLkr.toLocaleString()}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText size="xs" color="muted">
                {t("insurance.policy.coverage")}
              </AppText>
              <AppText weight="700" size="md">
                LKR {e.coverageAmountLkr.toLocaleString()}
              </AppText>
            </View>
          </View>

          {e.nextPremiumDueAt ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CalendarClock size={14} color={colors.textSubtle} />
              <AppText size="sm" color="muted">
                {t("insurance.policy.nextPremium")}:{" "}
                {new Date(e.nextPremiumDueAt).toLocaleDateString()}
              </AppText>
            </View>
          ) : null}
        </Card>

        <SectionHeader
          title={t("insurance.policy.actions")}
          style={{ paddingHorizontal: 16 }}
        />
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            paddingHorizontal: 16,
            flexWrap: "wrap",
          }}
        >
          <Button
            label={t("insurance.ecard.view")}
            leftIcon={<CreditCard size={14} />}
            onPress={() => router.push(`/insurance/ecard/${e.id}`)}
            style={{ flex: 1, minWidth: 140 }}
          />
          <Button
            label={t("insurance.renew")}
            variant="outline"
            leftIcon={<Wallet size={14} />}
            onPress={() => router.push(`/insurance/payment/${e.id}`)}
            style={{ flex: 1, minWidth: 140 }}
          />
          <Button
            label={t("insurance.submitClaim")}
            variant="outline"
            leftIcon={<FilePlus size={14} />}
            onPress={() => router.push("/insurance/claims/new")}
            style={{ flex: 1, minWidth: 140 }}
          />
        </View>

        <SectionHeader
          title={t("insurance.policy.coverageDetails")}
          style={{ paddingHorizontal: 16, paddingTop: 16 }}
        />
        <Card style={{ marginHorizontal: 16, padding: 16, gap: 8 }}>
          <AppText size="sm">
            {t("insurance.policy.startDate")}:{" "}
            {new Date(e.startDate).toLocaleDateString()}
          </AppText>
          {e.endDate ? (
            <AppText size="sm">
              {t("insurance.policy.endDate")}:{" "}
              {new Date(e.endDate).toLocaleDateString()}
            </AppText>
          ) : null}
          {Array.isArray(e.dependents) && e.dependents.length > 0 ? (
            <>
              <AppText size="xs" color="muted" style={{ marginTop: 8 }}>
                {t("insurance.policy.dependents")}
              </AppText>
              {e.dependents.map((d: any, i: number) => (
                <AppText key={i} size="sm">
                  · {d.name} ({d.relation}, {d.age})
                </AppText>
              ))}
            </>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}
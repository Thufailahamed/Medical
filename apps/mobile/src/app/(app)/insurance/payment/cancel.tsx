// @ts-nocheck
// payments.lk cancel callback. No charge was made; offer retry or back out.

import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { XCircle } from "lucide-react-native";
import { Screen, ScreenHeader, Card, Button } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function InsurancePaymentCancel() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("insurance.payment.cancelTitle")}
        subtitle=""
        kicker="INSURANCE"
        back={true}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ padding: spacing.xl, gap: spacing.md, alignItems: "center" }}>
          <XCircle size={48} color={colors.warning} strokeWidth={2} />
          <Text style={[typography.title.md, { color: colors.text, textAlign: "center" }]}>
            {t("insurance.payment.cancelTitle")}
          </Text>
          <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
            {t("insurance.payment.cancelBody")}
          </Text>
          <View style={{ width: "100%", gap: spacing.sm, marginTop: spacing.sm }}>
            <Button
              title={t("insurance.payment.retry")}
              size="lg"
              onPress={() =>
                router.replace(
                  (enrollmentId
                    ? `/(app)/insurance/payment/${enrollmentId}`
                    : "/(app)/insurance/marketplace") as any
                )
              }
            />
            <Button
              title={t("insurance.payment.backToPlans")}
              variant="secondary"
              onPress={() => router.replace("/(app)/insurance/marketplace" as any)}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

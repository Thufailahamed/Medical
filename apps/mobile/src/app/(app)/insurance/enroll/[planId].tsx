// @ts-nocheck
// Enrollment form. KYC + nominee + dependents + T&C consent → POST /enrollments.

import { useState } from "react";
import { View, ScrollView, TextInput, Switch } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  SectionHeader,
} from "@/components/ui";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useCreateInsuranceEnrollment,
  usePayInsurancePremium,
  useInsurancePlan,
} from "@/hooks/useApi";
import { useInsuranceStore } from "@/stores/insurance-store";
import { useAuthStore } from "@/stores/auth";

export default function Enroll() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: planData } = useInsurancePlan(planId ?? "");
  const quote = useInsuranceStore((s) => s.quote);
  const setDraft = useInsuranceStore((s) => s.setDraftEnrollmentId);
  const user = useAuthStore((s) => s.user);

  const [nomineeName, setNomineeName] = useState("");
  const [nomineeRelation, setNomineeRelation] = useState("spouse");
  const [nomineeDob, setNomineeDob] = useState("");
  const [nic, setNic] = useState("");
  const [agreedTnc, setAgreedTnc] = useState(false);

  const createMut = useCreateInsuranceEnrollment();
  const payMut = usePayInsurancePremium();

  const plan = planData?.plan;

  const onSubmit = async () => {
    if (!agreedTnc || !plan) return;
    const created = await createMut.mutateAsync({
      planId: plan.id,
      billingCycle: quote.billingCycle,
      nomineeName: nomineeName || undefined,
      nomineeRelation: nomineeRelation || undefined,
      nomineeDob: nomineeDob || undefined,
      kycNic: nic || undefined,
      dependents: quote.members,
    });
    setDraft(created.enrollment.id);
    const pay = await payMut.mutateAsync(created.enrollment.id);
    if (pay.checkoutUrl) {
      router.push(`/insurance/payment/${created.enrollment.id}`);
    } else {
      router.push(`/insurance/policy/${created.enrollment.id}`);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.enroll.title")}
        subtitle={plan?.name ?? ""}
        kicker={t("insurance.enroll.kicker")}
      />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
        {plan ? (
          <Card style={{ padding: 16, gap: 8 }}>
            <AppText weight="700" size="md">
              {plan.name}
            </AppText>
            <Pill tone="primary">{t(`insurance.planTypes.${plan.planType}`)}</Pill>
            <AppText size="sm" color="muted">
              {t("insurance.enroll.premium", {
                amount: (
                  quote.billingCycle === "monthly"
                    ? plan.monthlyPremiumLkr
                    : plan.annualPremiumLkr
                ).toLocaleString(),
                cycle: quote.billingCycle,
              })}
            </AppText>
          </Card>
        ) : null}

        <SectionHeader title={t("insurance.enroll.kyc")} />
        <Card style={{ padding: 16, gap: 10 }}>
          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.enroll.nic")}
            </AppText>
            <TextInput
              value={nic}
              onChangeText={setNic}
              placeholder="200012345678"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
              }}
            />
          </View>
          <AppText size="xs" color="muted">
            {t("insurance.enroll.kycHelp", { name: user?.name ?? "" })}
          </AppText>
        </Card>

        <SectionHeader title={t("insurance.enroll.nominee")} />
        <Card style={{ padding: 16, gap: 10 }}>
          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.enroll.nomineeName")}
            </AppText>
            <TextInput
              value={nomineeName}
              onChangeText={setNomineeName}
              placeholder={t("insurance.enroll.nomineePlaceholder")}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
              }}
            />
          </View>
          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.enroll.nomineeRelation")}
            </AppText>
            <TextInput
              value={nomineeRelation}
              onChangeText={setNomineeRelation}
              placeholder="spouse"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
              }}
            />
          </View>
          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.enroll.nomineeDob")}
            </AppText>
            <TextInput
              value={nomineeDob}
              onChangeText={setNomineeDob}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
              }}
            />
          </View>
        </Card>

        <SectionHeader title={t("insurance.enroll.dependents")} />
        <Card style={{ padding: 16, gap: 6 }}>
          {quote.members.length === 0 ? (
            <AppText size="sm" color="muted">
              {t("insurance.enroll.noDependents")}
            </AppText>
          ) : (
            quote.members.map((m) => (
              <View
                key={m.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 4,
                }}
              >
                <AppText size="sm">
                  {m.name} · {m.relation} · {m.age}
                </AppText>
              </View>
            ))
          )}
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Switch value={agreedTnc} onValueChange={setAgreedTnc} />
            <AppText size="sm" style={{ flex: 1 }}>
              {t("insurance.enroll.agreeTnc")}
            </AppText>
          </View>
        </Card>

        <Button
          label={t("insurance.enroll.proceed")}
          disabled={!agreedTnc || createMut.isPending || payMut.isPending}
          loading={createMut.isPending || payMut.isPending}
          onPress={onSubmit}
        />
      </ScrollView>
    </Screen>
  );
}
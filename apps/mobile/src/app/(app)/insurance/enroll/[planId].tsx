// @ts-nocheck
// Enrollment form. KYC + nominee + dependents + T&C consent → POST /enrollments.

import { useState } from "react";
import { View, Text, ScrollView, TextInput, Switch } from "react-native";
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
  const { colors, typography, radius } = useTheme();
  const fieldStyle = {
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    borderCurve: "continuous" as const,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.text,
    ...typography.body.md,
  };
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
    if (!agreedTnc || !plan || !nomineeName.trim() || !nomineeRelation.trim()) return;
    const created = await createMut.mutateAsync({
      planId: plan.id,
      billingCycle: quote.billingCycle,
      nomineeName: nomineeName.trim(),
      nomineeRelation: nomineeRelation.trim(),
      nomineeDob: nomineeDob || undefined,
      acceptTerms: true,
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

      <ScrollView contentContainerStyle={{ paddingVertical: 12, gap: 14, paddingBottom: 120 }}>
        {plan ? (
          <Card style={{ padding: 20, gap: 10 }}>
            <Pill tone="primary">{t(`insurance.planTypes.${plan.planType}`)}</Pill>
            <AppText weight="700" size="lg">
              {plan.name}
            </AppText>
            <AppText size="md" weight="600" style={{ color: colors.text }}>
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
        <Card style={{ padding: 20, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.enroll.nic")}
            </AppText>
            <TextInput
              value={nic}
              onChangeText={setNic}
              placeholder="200012345678"
              autoCapitalize="none"
              placeholderTextColor={colors.textSubtle}
              style={{
                ...fieldStyle,
              }}
            />
          </View>
          <AppText size="xs" color="muted">
            {t("insurance.enroll.kycHelp", { name: user?.name ?? "" })}
          </AppText>
        </Card>

        <SectionHeader title={t("insurance.enroll.nominee")} />
        <Card style={{ padding: 20, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.enroll.nomineeName")}
            </AppText>
            <TextInput
              value={nomineeName}
              onChangeText={setNomineeName}
              placeholder={t("insurance.enroll.nomineePlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={{
                ...fieldStyle,
              }}
            />
          </View>
          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.enroll.nomineeRelation")}
            </AppText>
            <TextInput
              value={nomineeRelation}
              onChangeText={setNomineeRelation}
              placeholder="spouse"
              placeholderTextColor={colors.textSubtle}
              style={{
                ...fieldStyle,
              }}
            />
          </View>
          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.enroll.nomineeDob")}
            </AppText>
            <TextInput
              value={nomineeDob}
              onChangeText={setNomineeDob}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              placeholderTextColor={colors.textSubtle}
              style={{
                ...fieldStyle,
              }}
            />
          </View>
        </Card>

        <SectionHeader title={t("insurance.enroll.dependents")} />
        <Card style={{ paddingVertical: 8, paddingHorizontal: 20, gap: 0 }}>
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
                  alignItems: "center",
                  minHeight: 44,
                  paddingVertical: 8,
                }}
              >
                <AppText size="md" style={{ textTransform: "capitalize" }}>
                  {m.name} · {m.relation} · {m.age}
                </AppText>
              </View>
            ))
          )}
        </Card>

        <Card style={{ padding: 20, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Switch
              value={agreedTnc}
              onValueChange={setAgreedTnc}
              trackColor={{ true: colors.primary, false: colors.fillStrong }}
            />
            <AppText size="sm" style={{ flex: 1 }}>
              {t("insurance.enroll.agreeTnc")}
            </AppText>
          </View>
        </Card>

        <Button
          label={t("insurance.enroll.proceed")}
          size="lg"
          disabled={
            !agreedTnc ||
            !nomineeName.trim() ||
            !nomineeRelation.trim() ||
            createMut.isPending ||
            payMut.isPending
          }
          loading={createMut.isPending || payMut.isPending}
          onPress={onSubmit}
        />
      </ScrollView>
    </Screen>
  );
}

// Theme-aware text used by this screen: maps the terse size/weight/color
// props onto typography tokens + theme colours so text stays legible in dark
// mode (the shared AppText hard-codes light-mode hex colours).
function AppText({
  size,
  weight,
  color,
  style,
  ...rest
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  weight?: string;
  color?: "muted" | "subtle" | "primary" | "accent" | "danger" | "text";
  style?: any;
  [key: string]: any;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const tone =
    color === "muted"
      ? colors.textMuted
      : color === "subtle"
        ? colors.textSubtle
        : color === "primary"
          ? colors.primary
          : color === "accent"
            ? colors.accent
            : color === "danger"
              ? colors.danger
              : colors.text;
  const bold = weight === "700" || weight === "800" || weight === "900" || weight === "bold";
  const semi = weight === "600" || weight === "500";
  const base =
    size === "2xl"
      ? typography.display.md
      : size === "xl"
        ? typography.display.sm
        : size === "lg"
          ? bold
            ? typography.title.lg
            : typography.body.lg
          : size === "md"
            ? bold
              ? typography.title.md
              : typography.body.md
            : size === "xs"
              ? typography.caption
              : bold
                ? typography.title.xs
                : typography.body.sm;
  const family = bold
    ? size === "xl" || size === "2xl" || size === "lg" || size === "md"
      ? base.fontFamily
      : fontFamily.bodyBold
    : semi
      ? fontFamily.bodySemibold
      : base.fontFamily;
  return (
    <Text
      {...rest}
      style={[{ ...base, fontFamily: family, color: tone }, style]}
    />
  );
}

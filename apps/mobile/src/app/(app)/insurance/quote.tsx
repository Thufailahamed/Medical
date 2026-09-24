// @ts-nocheck
// Personalized quote calculator. 3-step wizard: age/gender -> members -> pre-existing.

import { useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, ScrollView, BackHandler, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, UserPlus, HeartPulse } from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  Chip,
  ChipGroup,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useInsuranceStore } from "@/stores/insurance-store";
import { useInsuranceQuote } from "@/hooks/useApi";

const PRE_EXISTING = [
  "diabetes",
  "hypertension",
  "asthma",
  "heart_disease",
  "cancer_history",
  "kidney_disease",
];

export default function Quote() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, typography, radius } = useTheme();
  const quote = useInsuranceStore((s) => s.quote);
  const fieldStyle = {
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    borderCurve: "continuous" as const,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.text,
    ...typography.body.md,
  };
  const setAge = useInsuranceStore((s) => s.setAge);
  const setGender = useInsuranceStore((s) => s.setGender);
  const addMember = useInsuranceStore((s) => s.addMember);
  const removeMember = useInsuranceStore((s) => s.removeMember);
  const togglePreExisting = useInsuranceStore((s) => s.togglePreExisting);
  const reset = useInsuranceStore((s) => s.reset);

  const [step, setStep] = useState(1);
  const [age, setAgeLocal] = useState(quote.memberAge?.toString() ?? "30");
  const [gender, setGenderLocal] = useState<"male" | "female" | "other">(
    (quote.memberGender as any) ?? "male",
  );
  const [memberName, setMemberName] = useState("");
  const [memberAge, setMemberAge] = useState("");

  const quoteMut = useInsuranceQuote();
  const data = quoteMut.data;
  const isFetching = quoteMut.isPending;

  const requestQuote = () => {
    if (!quote.planId) return;
    quoteMut.mutate({
      planId: quote.planId,
      billingCycle: quote.billingCycle ?? "annual",
      memberAge: Number(age) || 30,
      memberGender: gender,
      members: quote.members.length ? quote.members : undefined,
      preExisting: quote.preExisting.length ? quote.preExisting : undefined,
    });
  };

  const continueQuote = () => {
    setAge(Number(age) || 30);
    setGender(gender);
    setStep(2);
  };

  const addNewMember = () => {
    if (!memberName) return;
    addMember({
      name: memberName,
      relation: "spouse",
    });
    setMemberName("");
    setMemberAge("");
  };

  const onSubmit = () => {
    if (quote.planId) {
      router.push(`/insurance/enroll/${quote.planId}`);
    }
  };

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => s - 1);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/insurance/marketplace");
    }
  }, [step, router]);

  useEffect(() => {
    const onBackPress = () => {
      if (step > 1) {
        setStep((s) => s - 1);
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [step, router]);

  if (!quote.planId) {
    return (
      <Screen>
        <ScreenHeader back onBack={() => router.replace("/insurance/marketplace")} title={t("insurance.quote.title")} subtitle="" />
        <View style={{ paddingVertical: 16 }}>
          <AppText size="md" color="muted">
            {t("insurance.quote.noPlan")}
          </AppText>
          <Button
            label={t("insurance.browseMarketplace")}
            onPress={() => router.replace("/insurance/marketplace")}
            style={{ marginTop: 12 }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        back
        onBack={handleBack}
        title={t("insurance.quote.title")}
        subtitle={quote.planName ?? ""}
        kicker={t("insurance.quote.kicker")}
      />

      <ScrollView contentContainerStyle={{ paddingVertical: 12, gap: 16, paddingBottom: 120 }}>
        {step === 1 ? (
          <Card style={{ padding: 20, gap: 18 }}>
            <AppText weight="700" size="md">
              {t("insurance.quote.aboutYou")}
            </AppText>

            <View style={{ gap: 8 }}>
              <AppText size="sm" weight="600" color="muted">
                {t("insurance.quote.age")}
              </AppText>
              <TextInput
                value={age}
                onChangeText={setAgeLocal}
                keyboardType="number-pad"
                placeholderTextColor={colors.textSubtle}
                style={fieldStyle}
              />
            </View>

            <View style={{ gap: 8 }}>
              <AppText size="sm" weight="600" color="muted">
                {t("insurance.quote.gender")}
              </AppText>
              <ChipGroup>
                {(["male", "female", "other"] as const).map((g) => (
                  <Chip
                    key={g}
                    label={t(`insurance.quote.${g}`)}
                    selected={gender === g}
                    onPress={() => setGenderLocal(g)}
                  />
                ))}
              </ChipGroup>
            </View>

            <Button label={t("insurance.quote.next")} onPress={continueQuote} />
          </Card>
        ) : null}

        {step === 2 ? (
          <>
            <Card style={{ padding: 20, gap: 14 }}>
              <AppText weight="700" size="md">
                {t("insurance.quote.members")}
              </AppText>
              <AppText size="sm" color="muted" style={{ marginTop: -8 }}>
                {t("insurance.quote.membersHelp")}
              </AppText>

              {quote.members.map((m, idx) => (
                <View
                  key={`${m.name}-${idx}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 48,
                    paddingVertical: 4,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <AppText size="md" style={{ textTransform: "capitalize" }}>
                    {m.name} · {m.relation}
                  </AppText>
                  <Button
                    variant="danger"
                    size="sm"
                    label=""
                    icon={Trash2}
                    fullWidth={false}
                    onPress={() => removeMember(idx)}
                  />
                </View>
              ))}

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  placeholder={t("insurance.quote.name")}
                  value={memberName}
                  onChangeText={setMemberName}
                  placeholderTextColor={colors.textSubtle}
                  style={{ ...fieldStyle, flex: 1 }}
                />
                <TextInput
                  placeholder={t("insurance.quote.age")}
                  value={memberAge}
                  onChangeText={setMemberAge}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textSubtle}
                  style={{ ...fieldStyle, width: 76 }}
                />
                <Button
                  variant="secondary"
                  label=""
                  icon={UserPlus}
                  fullWidth={false}
                  onPress={addNewMember}
                  style={{ minHeight: 48, height: 48, paddingHorizontal: 14 }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  variant="secondary"
                  label={t("common.back", "Back")}
                  onPress={handleBack}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t("insurance.quote.next")}
                  onPress={() => {
                    setStep(3);
                    requestQuote();
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Card style={{ padding: 20, gap: 14 }}>
              <AppText weight="700" size="md">
                {t("insurance.quote.preExisting")}
              </AppText>
              <AppText size="sm" color="muted" style={{ marginTop: -8 }}>
                {t("insurance.quote.preExistingHelp")}
              </AppText>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {PRE_EXISTING.map((p) => (
                  <Chip
                    key={p}
                    label={t(`insurance.quote.conditions.${p}`, p)}
                    selected={quote.preExisting.includes(p)}
                    onPress={() => togglePreExisting(p)}
                  />
                ))}
              </View>
            </Card>

            <Card
              style={{
                padding: 20,
                gap: 8,
                backgroundColor: colors.surface,
              }}
            >
              <AppText size="sm" weight="600" color="muted">
                {t("insurance.quote.estimate")}
              </AppText>
              {isFetching ? (
                <AppText weight="700" size="lg">
                  {t("insurance.quote.calculating")}
                </AppText>
              ) : data?.adjustedPremiumLkr ? (
                <>
                  <AppText weight="700" size="2xl" style={{ color: colors.text }}>
                    LKR {data.adjustedPremiumLkr.toLocaleString()}
                  </AppText>
                  <AppText size="xs" color="muted">
                    Base LKR {data.basePremiumLkr.toLocaleString()} · {data.billingCycle}
                  </AppText>
                  {data.notes?.length ? (
                    <AppText size="xs" color="muted">
                      {data.notes.join(" ")}
                    </AppText>
                  ) : null}
                  {data.riders?.length ? (
                    <AppText size="xs" color="muted">
                      {data.riders.map((r) => `${r.name} (LKR ${r.priceLkr.toLocaleString()})`).join(" · ")}
                    </AppText>
                  ) : null}
                  {(data.adjustedPremiumLkr - data.basePremiumLkr) > 0 ? (
                    <Pill tone="accent" icon={<HeartPulse size={12} />}>
                      {t("insurance.quote.loading", {
                        pct: Math.round(
                          ((data.adjustedPremiumLkr - data.basePremiumLkr) /
                            data.basePremiumLkr) *
                            100,
                        ).toFixed(0),
                      })}
                    </Pill>
                  ) : null}
                  <Button
                    variant="secondary"
                    label={t("insurance.quote.recalculate", "Recalculate")}
                    onPress={requestQuote}
                  />
                </>
              ) : quoteMut.isError ? (
                <>
                  <AppText size="sm" color="muted">
                    {t("insurance.quote.unavailable")}
                  </AppText>
                  <Button
                    variant="secondary"
                    label={t("insurance.quote.retry", "Retry")}
                    onPress={requestQuote}
                  />
                </>
              ) : (
                <AppText size="sm" color="muted">
                  {t("insurance.quote.unavailable")}
                </AppText>
              )}
            </Card>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                variant="secondary"
                label={t("common.back", "Back")}
                onPress={handleBack}
                style={{ flex: 1 }}
              />
              <Button
                label={t("insurance.quote.continue")}
                onPress={onSubmit}
                style={{ flex: 1 }}
              />
            </View>
            <Button
              variant="ghost"
              label={t("insurance.quote.reset")}
              onPress={() => {
                reset();
                router.replace("/insurance/marketplace");
              }}
            />
          </>
        ) : null}
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

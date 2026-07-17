// @ts-nocheck
// Personalized quote calculator. 3-step wizard: age/gender -> members -> pre-existing.

import { useState } from "react";
import { View, TextInput, ScrollView } from "react-native";
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
import { AppText } from "@/components/ui/AppText";
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
  const { colors } = useTheme();
  const quote = useInsuranceStore((s) => s.quote);
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

  const { data, isFetching } = useInsuranceQuote({
    planId: quote.planId ?? "",
    age: Number(age) || 30,
    gender,
    members: quote.members,
    preExisting: quote.preExisting,
  });

  const continueQuote = () => {
    setAge(Number(age) || 30);
    setGender(gender);
    setStep(2);
  };

  const addNewMember = () => {
    if (!memberName || !memberAge) return;
    addMember({
      id: `m_${Date.now()}`,
      name: memberName,
      age: Number(memberAge) || 30,
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

  if (!quote.planId) {
    return (
      <Screen>
        <ScreenHeader title={t("insurance.quote.title")} subtitle="" />
        <View style={{ padding: 16 }}>
          <AppText size="sm" color="muted">
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
        title={t("insurance.quote.title")}
        subtitle={quote.planName ?? ""}
        kicker={t("insurance.quote.kicker")}
      />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
        {step === 1 ? (
          <Card style={{ padding: 16, gap: 14 }}>
            <AppText weight="700" size="md">
              {t("insurance.quote.aboutYou")}
            </AppText>

            <View style={{ gap: 6 }}>
              <AppText size="sm" color="muted">
                {t("insurance.quote.age")}
              </AppText>
              <TextInput
                value={age}
                onChangeText={setAgeLocal}
                keyboardType="number-pad"
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
            <Card style={{ padding: 16, gap: 12 }}>
              <AppText weight="700" size="md">
                {t("insurance.quote.members")}
              </AppText>
              <AppText size="xs" color="muted">
                {t("insurance.quote.membersHelp")}
              </AppText>

              {quote.members.map((m) => (
                <View
                  key={m.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <AppText size="sm">
                    {m.name} · {m.age} · {m.relation}
                  </AppText>
                  <Button
                    variant="ghost"
                    label=""
                    leftIcon={<Trash2 size={14} color={colors.danger} />}
                    onPress={() => removeMember(m.id)}
                  />
                </View>
              ))}

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  placeholder={t("insurance.quote.name")}
                  value={memberName}
                  onChangeText={setMemberName}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    padding: 10,
                    color: colors.text,
                  }}
                />
                <TextInput
                  placeholder={t("insurance.quote.age")}
                  value={memberAge}
                  onChangeText={setMemberAge}
                  keyboardType="number-pad"
                  style={{
                    width: 70,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    padding: 10,
                    color: colors.text,
                  }}
                />
                <Button
                  variant="outline"
                  label=""
                  leftIcon={<UserPlus size={14} />}
                  onPress={addNewMember}
                />
              </View>

              <Button
                label={t("insurance.quote.next")}
                onPress={() => setStep(3)}
              />
            </Card>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Card style={{ padding: 16, gap: 12 }}>
              <AppText weight="700" size="md">
                {t("insurance.quote.preExisting")}
              </AppText>
              <AppText size="xs" color="muted">
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
                padding: 16,
                gap: 8,
                backgroundColor: colors.surface,
              }}
            >
              <AppText size="sm" color="muted">
                {t("insurance.quote.estimate")}
              </AppText>
              {isFetching ? (
                <AppText weight="700" size="lg">
                  {t("insurance.quote.calculating")}
                </AppText>
              ) : data?.quote ? (
                <>
                  <AppText weight="700" size="xl" style={{ color: colors.primary }}>
                    LKR{" "}
                    {quote.billingCycle === "monthly"
                      ? data.quote.monthlyPremiumLkr.toLocaleString()
                      : data.quote.annualPremiumLkr.toLocaleString()}
                  </AppText>
                  <AppText size="xs" color="muted">
                    {t("insurance.quote.coverage", {
                      amount: data.quote.coverageSummaryLkr.toLocaleString(),
                    })}
                  </AppText>
                  {data.quote.appliedLoadingsPct > 0 ? (
                    <Pill tone="accent" icon={<HeartPulse size={12} />}>
                      {t("insurance.quote.loading", {
                        pct: data.quote.appliedLoadingsPct.toFixed(0),
                      })}
                    </Pill>
                  ) : null}
                </>
              ) : (
                <AppText size="sm" color="muted">
                  {t("insurance.quote.unavailable")}
                </AppText>
              )}
            </Card>

            <Button label={t("insurance.quote.continue")} onPress={onSubmit} />
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
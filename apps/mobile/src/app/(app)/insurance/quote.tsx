// @ts-nocheck
// Personalized quote calculator. 3-step wizard: age/gender -> members -> pre-existing.

import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, TextInput, ScrollView, Pressable, BackHandler, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  UserRound,
  User,
  Users,
  CircleDashed,
  Cake,
  PencilLine,
  HeartPulse,
  BadgePercent,
  RefreshCw,
  ArrowRight,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  Chip,
  ChipGroup,
  EmptyState,
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

const RELATIONS = ["spouse", "child", "parent", "sibling"] as const;

const GENDERS = [
  { key: "male", icon: User },
  { key: "female", icon: UserRound },
  { key: "other", icon: CircleDashed },
] as const;

const STEP_LABEL_KEYS = ["stepYou", "stepFamily", "stepHealth"] as const;

export default function Quote() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, typography, radius } = useTheme();
  const quote = useInsuranceStore((s) => s.quote);
  const kicker = { ...typography.kicker, color: colors.primary, textTransform: "uppercase" } as const;

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
  const [memberRelation, setMemberRelation] = useState<string>("spouse");
  const scrollRef = useRef<ScrollView>(null);

  const quoteMut = useInsuranceQuote();
  const data = quoteMut.data;
  const isFetching = quoteMut.isPending;

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [step]);

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
    const name = memberName.trim();
    if (!name) return;
    addMember({ name, relation: memberRelation });
    setMemberName("");
    setMemberRelation("spouse");
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
        <EmptyState title={t("insurance.quote.noPlan")} />
        <Button
          label={t("insurance.browseMarketplace")}
          onPress={() => router.replace("/insurance/marketplace")}
          style={{ marginTop: 12 }}
        />
      </Screen>
    );
  }

  const cardHeader = (Icon: any, title: string, help?: string) => (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, borderCurve: "continuous", backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
        <Icon size={19} color={colors.primary} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ ...typography.title.md, color: colors.text }}>{title}</Text>
        {help ? (
          <Text style={{ ...typography.caption, color: colors.textMuted }}>{help}</Text>
        ) : null}
      </View>
    </View>
  );

  const fieldLabel = { ...typography.label.sm, color: colors.textMuted } as const;
  const fieldWrap = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    borderCurve: "continuous" as const,
    paddingHorizontal: 14,
    minHeight: 50,
  };
  const fieldInput = { flex: 1, color: colors.text, ...typography.body.md, minHeight: 50 };

  const adjusted = data?.adjustedPremiumLkr;
  const base = data?.basePremiumLkr;
  const uplift = adjusted != null && base != null && base > 0 ? adjusted - base : 0;

  return (
    <Screen padded={false} keyboard>
      <ScreenHeader
        back
        onBack={handleBack}
        title={t("insurance.quote.title")}
        subtitle={quote.planName ?? ""}
        kicker={t("insurance.quote.kicker")}
        style={{ paddingHorizontal: 16 }}
      />

      {/* Step progress */}
      <View style={{ paddingHorizontal: 16, marginTop: 2, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>
            {t("insurance.quote.stepOf", { n: step })}
          </Text>
          <Text style={{ ...typography.label.sm, color: colors.primary }}>
            {t(`insurance.quote.${STEP_LABEL_KEYS[step - 1]}`)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                backgroundColor: i < step ? colors.primary : colors.fillStrong,
              }}
            />
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1 — primary insured */}
        {step === 1 ? (
          <Card variant="elevated" style={{ padding: 18, gap: 18 }}>
            {cardHeader(UserRound, t("insurance.quote.aboutYou"))}

            <View style={{ gap: 7 }}>
              <Text style={fieldLabel}>{t("insurance.quote.age")}</Text>
              <View style={fieldWrap}>
                <Cake size={17} color={colors.textMuted} strokeWidth={2.2} />
                <TextInput
                  value={age}
                  onChangeText={setAgeLocal}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={colors.textSubtle}
                  style={fieldInput}
                />
              </View>
            </View>

            <View style={{ gap: 7 }}>
              <Text style={fieldLabel}>{t("insurance.quote.gender")}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {GENDERS.map((g) => {
                  const selected = gender === g.key;
                  const Icon = g.icon;
                  return (
                    <Pressable
                      key={g.key}
                      onPress={() => setGenderLocal(g.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        paddingVertical: 12,
                        borderRadius: 14,
                        borderCurve: "continuous",
                        borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
                      }}
                    >
                      <Icon size={17} color={selected ? colors.primary : colors.textMuted} strokeWidth={2.2} />
                      <Text style={{ ...typography.label.sm, color: selected ? colors.primary : colors.textMuted }}>
                        {t(`insurance.quote.${g.key}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Button
              label={t("insurance.quote.next")}
              iconRight={ArrowRight}
              onPress={continueQuote}
            />
          </Card>
        ) : null}

        {/* Step 2 — family members */}
        {step === 2 ? (
          <Card variant="elevated" style={{ padding: 18, gap: 14 }}>
            {cardHeader(Users, t("insurance.quote.members"), t("insurance.quote.membersHelp"))}

            {quote.members.map((m, idx) => (
              <View
                key={`${m.name}-${idx}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 52,
                  paddingVertical: 8,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.separator,
                }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...typography.title.sm, color: colors.primary }}>
                    {m.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ ...typography.title.sm, color: colors.text }}>
                    {m.name}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "capitalize" }}>
                    {t(`insurance.quote.relations.${m.relation}`, m.relation)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeMember(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={t("insurance.enroll.removeMember", "Remove")}
                  hitSlop={8}
                  style={{ width: 34, height: 34, borderRadius: 11, borderCurve: "continuous", backgroundColor: colors.dangerSoft, alignItems: "center", justifyContent: "center" }}
                >
                  <Trash2 size={16} color={colors.danger} strokeWidth={2.2} />
                </Pressable>
              </View>
            ))}

            <View style={{ gap: 10 }}>
              <View style={fieldWrap}>
                <PencilLine size={17} color={colors.textMuted} strokeWidth={2.2} />
                <TextInput
                  placeholder={t("insurance.quote.name")}
                  value={memberName}
                  onChangeText={setMemberName}
                  placeholderTextColor={colors.textSubtle}
                  style={fieldInput}
                  onSubmitEditing={addNewMember}
                  returnKeyType="done"
                />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>
                  {RELATIONS.map((r) => {
                    const selected = memberRelation === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setMemberRelation(r)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 999,
                          backgroundColor: selected ? colors.primarySoft : colors.fill,
                        }}
                      >
                        <Text style={{ ...typography.label.sm, color: selected ? colors.primary : colors.textMuted }}>
                          {t(`insurance.quote.relations.${r}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Button
                  variant="secondary"
                  label={t("insurance.quote.add")}
                  icon={Plus}
                  compact
                  onPress={addNewMember}
                  disabled={!memberName.trim()}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <Button
                variant="secondary"
                label={t("insurance.quote.back", "Back")}
                onPress={handleBack}
                style={{ flex: 1 }}
              />
              <Button
                label={t("insurance.quote.seePremium", "See premium")}
                iconRight={ArrowRight}
                onPress={() => {
                  setStep(3);
                  requestQuote();
                }}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}

        {/* Step 3 — pre-existing + estimate */}
        {step === 3 ? (
          <>
            <Card variant="elevated" style={{ padding: 18, gap: 14 }}>
              {cardHeader(HeartPulse, t("insurance.quote.preExisting"), t("insurance.quote.preExistingHelp"))}
              <ChipGroup>
                {PRE_EXISTING.map((p) => (
                  <Chip
                    key={p}
                    label={t(`insurance.quote.conditions.${p}`, p)}
                    selected={quote.preExisting.includes(p)}
                    onPress={() => togglePreExisting(p)}
                  />
                ))}
              </ChipGroup>
            </Card>

            <Card variant="elevated" style={{ padding: 18, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={kicker}>{t("insurance.quote.yourPremium", "Your premium")}</Text>
                {quote.billingCycle ? (
                  <View style={{ backgroundColor: colors.fill, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ ...typography.label.xs, color: colors.textMuted, textTransform: "capitalize" }}>
                      {quote.billingCycle}
                    </Text>
                  </View>
                ) : null}
              </View>

              {isFetching ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={{ ...typography.body.md, color: colors.textMuted }}>
                    {t("insurance.quote.calculating")}
                  </Text>
                </View>
              ) : adjusted ? (
                <>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
                    <Text style={{ ...typography.title.sm, color: colors.textMuted }}>LKR</Text>
                    <Text style={{ ...typography.display.lg, fontSize: 32, lineHeight: 37, color: colors.text }}>
                      {adjusted.toLocaleString()}
                    </Text>
                    <Text style={{ ...typography.label.md, color: colors.textMuted }}>
                      {quote.billingCycle === "monthly" ? t("insurance.quote.perMonth") : t("insurance.quote.perYear")}
                    </Text>
                  </View>

                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />

                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ ...typography.body.sm, color: colors.textMuted }}>{t("insurance.quote.basePremium")}</Text>
                      <Text style={{ ...typography.label.md, color: colors.text }}>LKR {base?.toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ ...typography.body.sm, color: colors.textMuted }}>{t("insurance.quote.adjustments")}</Text>
                      {uplift > 0 && base ? (
                        <Pill tone="accent" icon={<BadgePercent size={12} />}>
                          {t("insurance.quote.loading", { pct: Math.round((uplift / base) * 100) })}
                        </Pill>
                      ) : (
                        <Text style={{ ...typography.label.md, color: colors.textMuted }}>—</Text>
                      )}
                    </View>
                    {data?.riders?.map((r) => (
                      <View key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ ...typography.body.sm, color: colors.textMuted }}>{r.name}</Text>
                        <Text style={{ ...typography.label.md, color: colors.text }}>+LKR {r.priceLkr.toLocaleString()}</Text>
                      </View>
                    ))}
                  </View>

                  {data?.notes?.length ? (
                    <Text style={{ ...typography.body.xs, color: colors.textSubtle }}>
                      {data.notes.join(" ")}
                    </Text>
                  ) : null}

                  <Button
                    variant="secondary"
                    size="sm"
                    label={t("insurance.quote.recalculate", "Recalculate")}
                    icon={RefreshCw}
                    onPress={requestQuote}
                  />
                </>
              ) : (
                <>
                  <Text style={{ ...typography.body.sm, color: colors.textMuted }}>
                    {t("insurance.quote.unavailable")}
                  </Text>
                  <Button
                    variant="secondary"
                    size="sm"
                    label={t("insurance.quote.retry", "Retry")}
                    icon={RefreshCw}
                    onPress={requestQuote}
                  />
                </>
              )}
            </Card>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                variant="secondary"
                label={t("insurance.quote.back", "Back")}
                onPress={handleBack}
                style={{ flex: 1 }}
              />
              <Button
                label={t("insurance.quote.continue")}
                iconRight={ArrowRight}
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

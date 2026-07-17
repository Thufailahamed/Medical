// @ts-nocheck
// Pre-treatment coverage check. Procedure + hospital → out-of-pocket estimate.

import { useState } from "react";
import { View, ScrollView, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Chip,
  ChipGroup,
  SectionHeader,
  Pill,
} from "@/components/ui";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/theme/ThemeProvider";
import { useCoverageCheck } from "@/hooks/useApi";

const PROCEDURES = [
  "consultation",
  "lab_test",
  "diagnostic_imaging",
  "minor_surgery",
  "major_surgery",
  "dental",
  "maternity",
];

export default function CoverageCheck() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [procedure, setProcedure] = useState("consultation");
  const [hospital, setHospital] = useState("");
  const [estimated, setEstimated] = useState("");

  const mut = useCoverageCheck();

  const onCheck = async () => {
    if (!estimated) return;
    await mut.mutateAsync({
      procedure,
      hospitalName: hospital || undefined,
      estimatedAmountLkr: Number(estimated),
    });
  };

  const result = mut.data?.coverage;

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.coverage.title")}
        subtitle={t("insurance.coverage.subtitle")}
        kicker={t("insurance.coverage.kicker")}
      />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <SectionHeader title={t("insurance.coverage.planned")} />
        <Card style={{ padding: 16, gap: 12 }}>
          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.coverage.procedure")}
            </AppText>
            <ChipGroup>
              {PROCEDURES.map((p) => (
                <Chip
                  key={p}
                  label={t(`insurance.coverage.procedures.${p}`)}
                  selected={procedure === p}
                  onPress={() => setProcedure(p)}
                />
              ))}
            </ChipGroup>
          </View>

          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.coverage.hospital")}
            </AppText>
            <TextInput
              value={hospital}
              onChangeText={setHospital}
              placeholder={t("insurance.coverage.hospitalPlaceholder")}
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
              {t("insurance.coverage.estimatedAmount")}
            </AppText>
            <TextInput
              value={estimated}
              onChangeText={setEstimated}
              keyboardType="numeric"
              placeholder="0"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
              }}
            />
          </View>

          <Button
            label={t("insurance.coverage.check")}
            leftIcon={<Activity size={14} />}
            onPress={onCheck}
            loading={mut.isPending}
            disabled={!estimated}
          />
        </Card>

        {result ? (
          <Card
            style={{
              padding: 16,
              gap: 10,
              backgroundColor: result.covered
                ? colors.surface
                : colors.danger + "15",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {result.covered ? (
                <CheckCircle2 size={18} color={colors.accent} />
              ) : (
                <AlertCircle size={18} color={colors.danger} />
              )}
              <AppText weight="700" size="md">
                {result.covered
                  ? t("insurance.coverage.coveredTitle")
                  : t("insurance.coverage.notCoveredTitle")}
              </AppText>
            </View>
            <Pill tone={result.covered ? "accent" : "danger"}>
              {t(`insurance.coverage.procedures.${procedure}`)}
            </Pill>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppText size="xs" color="muted">
                  {t("insurance.coverage.eligible")}
                </AppText>
                <AppText weight="700" size="md" style={{ color: colors.accent }}>
                  LKR {result.eligibleAmountLkr.toLocaleString()}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText size="xs" color="muted">
                  {t("insurance.coverage.outOfPocket")}
                </AppText>
                <AppText weight="700" size="md" style={{ color: colors.danger }}>
                  LKR {result.outOfPocketLkr.toLocaleString()}
                </AppText>
              </View>
            </View>
            {result.requiresPreAuth ? (
              <Pill tone="neutral">
                {t("insurance.coverage.requiresPreAuth")}
              </Pill>
            ) : null}
            {result.notes ? (
              <AppText size="sm" color="muted">
                {result.notes}
              </AppText>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
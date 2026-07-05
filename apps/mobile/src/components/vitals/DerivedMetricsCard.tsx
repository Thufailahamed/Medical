import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import type { DerivedBlock } from "@healthcare/shared/vitals";

type Props = {
  derived: DerivedBlock | null;
};

/**
 * Displays the registry-derived metrics — BMI / BMR / WHR / MAP /
 * pulse pressure — that aren't stored as raw readings. Each row
 * shows the value plus a WHO/AHA category hint where relevant.
 */
export function DerivedMetricsCard({ derived }: Props) {
  const { spacing, typography, colors } = useTheme();
  const { t } = useTranslation();
  if (!derived) return null;

  const rows: Array<{ key: string; label: string; value: string; hint?: string }> = [];

  if (derived.bmi != null) {
    rows.push({
      key: "bmi",
      label: t("vitals.derived.bmi"),
      value: String(derived.bmi),
      hint: derived.bmiCategory ?? undefined,
    });
  }
  if (derived.map != null) {
    rows.push({ key: "map", label: t("vitals.derived.map"), value: `${derived.map} mmHg` });
  }
  if (derived.pulsePressure != null) {
    rows.push({
      key: "pp",
      label: t("vitals.derived.pulsePressure"),
      value: `${derived.pulsePressure} mmHg`,
    });
  }
  if (derived.bmr != null) {
    rows.push({
      key: "bmr",
      label: t("vitals.derived.bmr"),
      value: `${derived.bmr} kcal/day`,
    });
  }
  if (derived.whr != null) {
    rows.push({ key: "whr", label: t("vitals.derived.whr"), value: String(derived.whr) });
  }

  if (rows.length === 0) return null;

  return (
    <Card>
      <Text
        style={[
          typography.title.sm,
          { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
        ]}
      >
        {t("vitals.derivedHeading")}
      </Text>
      <View style={{ gap: spacing.xs }}>
        {rows.map((r, idx) => (
          <View
            key={r.key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: spacing.xs,
              borderBottomWidth: idx < rows.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={[typography.body.md, { color: colors.text }]}>{r.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
                {r.value}
              </Text>
              {r.hint ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>{r.hint}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}
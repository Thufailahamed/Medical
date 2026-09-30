// @ts-nocheck
// Shared insurance form pieces: treatment-type tile grid, active-policy radio
// cards (with a "no policy" call-to-action) and the treatment icon map.
// Used by the coverage check and the claim submission screens.

import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Baby,
  BedDouble,
  Microscope,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Stethoscope,
  Sunrise,
} from "lucide-react-native";
import { Button, Card, IconTile, Pressable } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export const TREATMENT_ICONS = {
  hospitalization: BedDouble,
  day_care: Sunrise,
  opd: Stethoscope,
  dental: Smile,
  diagnostic: Microscope,
  maternity: Baby,
} as const;

export type TreatmentType = keyof typeof TREATMENT_ICONS;

export const TREATMENT_TYPES = Object.keys(TREATMENT_ICONS) as TreatmentType[];

export const formatLkr = (n: number) => Math.round(n || 0).toLocaleString("en-US");

/** 3-column grid of selectable treatment tiles. */
export function TreatmentGrid({
  value,
  onChange,
  labelFor,
}: {
  value: string;
  onChange: (v: TreatmentType) => void;
  labelFor: (v: TreatmentType) => string;
}) {
  const { colors, radius, shadow } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {TREATMENT_TYPES.map((key) => {
        const selected = value === key;
        return (
          <Pressable
            key={key}
            haptic="light"
            onPress={() => onChange(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            wrapperStyle={{ flexBasis: "31%", flexGrow: 1 }}
            style={{
              alignItems: "center",
              gap: 8,
              paddingVertical: 14,
              paddingHorizontal: 6,
              borderRadius: radius.card,
              borderCurve: "continuous",
              backgroundColor: selected ? colors.primarySoft : colors.surface,
              borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
              borderColor: selected ? colors.primary : colors.hairline,
              ...(selected ? {} : shadow.xs),
            }}
          >
            <IconTile
              icon={TREATMENT_ICONS[key]}
              tone="primary"
              appearance={selected ? "solid" : "soft"}
              size={40}
            />
            <FormText
              weight="600"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: selected ? colors.primary : colors.text }}
            >
              {labelFor(key)}
            </FormText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Active-policy radio cards, or a call-to-action card when there are none. */
export function PolicyPicker({
  enrollments,
  selectedId,
  onSelect,
  loading,
  emptyMessage,
}: {
  enrollments: any[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  emptyMessage: string;
}) {
  const { t } = useTranslation();
  const { colors, radius, shadow } = useTheme();

  if (loading) return null;

  if (enrollments.length === 0) {
    return (
      <Card style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <IconTile icon={ShieldAlert} tone="warning" size={44} />
          <View style={{ flex: 1, gap: 4 }}>
            <FormText weight="700" size="md">
              {t("insurance.coverage.noPolicyTitle", "No active policy")}
            </FormText>
            <FormText muted>{emptyMessage}</FormText>
          </View>
        </View>
        <Button
          title={t("insurance.coverage.browsePlans", "Browse plans")}
          variant="secondary"
          size="sm"
          icon={ShieldCheck}
          onPress={() => router.push("/insurance/marketplace")}
        />
      </Card>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {enrollments.map((e) => {
        const selected = selectedId === e.id;
        return (
          <Pressable
            key={e.id}
            haptic="light"
            onPress={() => onSelect(e.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: radius.card,
              borderCurve: "continuous",
              backgroundColor: selected ? colors.primarySoft : colors.surface,
              borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
              borderColor: selected ? colors.primary : colors.hairline,
              ...(selected ? {} : shadow.xs),
            }}
          >
            <IconTile
              icon={ShieldCheck}
              tone="primary"
              appearance={selected ? "solid" : "soft"}
              size={40}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <FormText weight="700" size="md" numberOfLines={1}>
                {e.planName || t("insurance.coverage.policy", "Policy")}
              </FormText>
              {e.policyNumber ? (
                <FormText size="xs" muted numberOfLines={1}>
                  {e.policyNumber}
                </FormText>
              ) : null}
            </View>
            <Radio selected={selected} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function Radio({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.borderStrong,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {selected ? (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
      ) : null}
    </View>
  );
}

function FormText({
  size = "sm",
  weight,
  muted,
  style,
  ...rest
}: {
  size?: "xs" | "sm" | "md";
  weight?: "600" | "700";
  muted?: boolean;
  style?: any;
  [key: string]: any;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const base =
    size === "md"
      ? weight === "700"
        ? typography.title.md
        : typography.body.md
      : size === "xs"
        ? typography.caption
        : typography.body.sm;
  const family =
    weight === "700"
      ? size === "md"
        ? base.fontFamily
        : fontFamily.bodyBold
      : weight === "600"
        ? fontFamily.bodySemibold
        : base.fontFamily;
  return (
    <Text
      {...rest}
      style={[
        { ...base, fontFamily: family, color: muted ? colors.textMuted : colors.text },
        style,
      ]}
    />
  );
}

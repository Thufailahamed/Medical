import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { ClassificationBadge } from "./ClassificationBadge";
import { Sparkline } from "./Sparkline";
import {
  VITAL_REGISTRY,
  type LatestByType,
  type VitalType,
} from "@healthcare/shared/vitals";
import type { VitalsPoint } from "@/hooks/useApi";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

type Props = {
  latest: LatestByType;
  sparkline?: VitalsPoint[];
  onPress?: () => void;
  compact?: boolean;
};

/**
 * Card used in the doctor/hospital patient detail screens. Surfaces
 * the latest reading, its classification, and a 7-day sparkline. The
 * compact variant drops the sparkline for tighter grids.
 */
export function LatestStatusCard({ latest, sparkline, onPress, compact }: Props) {
  const { spacing, typography, colors, radius } = useTheme();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const def = VITAL_REGISTRY[latest.type as VitalType];
  const meta = latest.latest;
  if (!meta) return null;

  const reading =
    meta.secondary != null ? `${meta.value}/${meta.secondary}` : `${meta.value}`;
  const unit = meta.unit || def?.unit || "";
  const leftEdge = leftEdgeColor(meta.classification, colors);

  const inner = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 4,
          backgroundColor: leftEdge,
          borderRadius: 2,
        }}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.xs,
          }}
        >
          <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
            {def?.label ?? latest.type}
          </Text>
          <ClassificationBadge classification={meta.classification} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
          <Text
            style={[typography.title.md, { color: colors.text, fontWeight: "800" }]}
          >
            {reading}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{unit}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {fmtDateTime(new Date(meta.recordedAt), locale)}
        </Text>
        {!compact && sparkline && sparkline.length > 1 ? (
          <View style={{ marginTop: 4 }}>
            <Sparkline points={sparkline} width={140} height={28} stroke={leftEdge} />
          </View>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        <Card padded={false}>
          <View style={{ padding: spacing.md }}>{inner}</View>
        </Card>
      </Pressable>
    );
  }
  return <Card padded={false}><View style={{ padding: spacing.md }}>{inner}</View></Card>;
}

function leftEdgeColor(cls: string, colors: any): string {
  switch (cls) {
    case "critical":
    case "high":
      return colors.danger;
    case "elevated":
    case "low":
      return colors.warning;
    case "normal":
      return colors.success;
    default:
      return colors.border;
  }
}
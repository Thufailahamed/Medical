import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { ClassificationBadge } from "./ClassificationBadge";
import type { VitalAlert } from "@healthcare/shared/vitals";
import { VITAL_REGISTRY, type VitalType } from "@healthcare/shared/vitals";

type Props = {
  alerts: VitalAlert[];
  title?: string;
};

/**
 * Renders the patient's recent out-of-range readings. Used on the
 * vitals screen (last 30d) and on the home dashboard.
 */
export function AlertsCard({ alerts, title }: Props) {
  const { spacing, typography, colors } = useTheme();
  const { t } = useTranslation();
  if (alerts.length === 0) {
    return (
      <Card>
        <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
          {title ?? t("vitals.alertsHeading")}
        </Text>
        <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {t("vitals.noAlerts")}
        </Text>
      </Card>
    );
  }
  return (
    <Card>
      <Text
        style={[
          typography.title.sm,
          { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
        ]}
      >
        {title ?? t("vitals.alertsHeading")} ({alerts.length})
      </Text>
      <View style={{ gap: spacing.xs }}>
        {alerts.slice(0, 6).map((a) => {
          const def = VITAL_REGISTRY[a.type as VitalType];
          const label = def?.label ?? a.type;
          const unit = a.unit || def?.unit || "";
          const reading =
            a.secondary != null ? `${a.value}/${a.secondary} ${unit}` : `${a.value} ${unit}`;
          const recorded = new Date(a.recordedAt);
          const rel = isNaN(recorded.getTime()) ? "" : relativeTime(recorded);
          return (
            <View
              key={a.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.xs,
                gap: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.body.md, { color: colors.text }]}>{label}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {reading} {rel ? `· ${rel}` : ""}
                </Text>
              </View>
              <ClassificationBadge classification={a.classification} />
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return d.toLocaleDateString();
}
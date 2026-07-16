// MedicineAdherenceStrip — Tier 1 records: meds adherence visualisation.
//
// Horizontal SVG strip, one row per active medicine. Bar spans
// startDate → endDate (or today if still active). Colour-coded:
//   - green: currently active
//   - gray: ended (past)
//   - amber: started within the last 7 days (fresh)
//
// Tap row → medicine detail (handler injected via prop so this stays a
// pure presentational component).
//
// Sits inside the Trends screen next to the VitalsChart.

import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg";
import { Pill as PillIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { AppText } from "@/components/ui/AppText";

interface Med {
  id: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean | null;
}

interface Props {
  medicines: Med[];
  width?: number;
  onPress?: (id: string) => void;
}

export function MedicineAdherenceStrip({ medicines, width = 320, onPress }: Props) {
  const { colors } = useTheme();

  const rows = useMemo(() => {
    if (!medicines.length) return [];
    const now = Date.now();
    const earliest = Math.min(
      ...medicines.map((m) =>
        m.startDate ? new Date(m.startDate).getTime() : now
      )
    );
    const latest = Math.max(
      now,
      ...medicines.map((m) =>
        m.endDate ? new Date(m.endDate).getTime() : now
      )
    );
    const span = Math.max(1, latest - earliest);
    return medicines.map((m) => {
      const startMs = m.startDate ? new Date(m.startDate).getTime() : earliest;
      const endMs = m.endDate
        ? new Date(m.endDate).getTime()
        : m.active
        ? now
        : startMs;
      const x = ((Math.min(startMs, now) - earliest) / span) * (width - 80);
      const xEnd = ((endMs - earliest) / span) * (width - 80);
      const w = Math.max(4, xEnd - x);
      const color =
        !m.active
          ? "#94A3B8"
          : startMs > now - 7 * 86_400_000
          ? "#F59E0B"
          : "#10B981";
      return { med: m, x, w, color };
    });
  }, [medicines, width]);

  if (!rows.length) {
    return (
      <View style={styles.empty}>
        <AppText variant="body.sm" color="muted">
          No active medicines.
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {rows.map(({ med, x, w, color }) => (
        <Pressable
          key={med.id}
          onPress={() => onPress?.(med.id)}
          style={[styles.row, { borderColor: colors.border }]}
        >
          <View style={styles.labelCol}>
            <PillIcon size={14} color={color} />
            <View style={{ flex: 1 }}>
              <AppText variant="body.sm" weight="600" numberOfLines={1}>
                {med.name}
              </AppText>
              <AppText variant="body.xs" color="muted" numberOfLines={1}>
                {[med.dosage, med.frequency].filter(Boolean).join(" • ")}
              </AppText>
            </View>
          </View>
          <Svg width={width - 100} height={28}>
            <Line
              x1={0}
              x2={width - 80}
              y1={14}
              y2={14}
              stroke={colors.border}
              strokeWidth={1}
            />
            <Rect
              x={x}
              y={6}
              width={w}
              height={16}
              rx={4}
              fill={color}
              opacity={0.85}
            />
            {med.startDate && (
              <SvgText
                x={x}
                y={4}
                fontSize={9}
                fill={colors.textMuted}
              >
                {new Date(med.startDate).toLocaleDateString()}
              </SvgText>
            )}
          </Svg>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { padding: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  labelCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: 100,
  },
});

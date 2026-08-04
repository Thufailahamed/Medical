import React from "react";
import { View, StyleSheet } from "react-native";
import { TrendingDown, TrendingUp, Sparkles, Activity } from "lucide-react-native";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/theme/ThemeProvider";

export interface TrendPoint {
  date: string;
  value: number;
  label: string;
}

interface Props {
  testName: string;
  unit: string;
  points: TrendPoint[];
  insight?: string;
}

export function LongitudinalTrendChart({ testName, unit, points, insight }: Props) {
  const { colors, fontFamily } = useTheme();

  if (!points || points.length === 0) return null;

  const firstVal = points[0].value;
  const lastVal = points[points.length - 1].value;
  const isImproving = lastVal < firstVal; // e.g. HbA1c or Cholesterol dropping is positive improvement

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 14,
        marginTop: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "rgba(0, 0, 0, 0.04)",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 2,
        gap: 12,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: isImproving ? "#ECFDF5" : "#FEF2F2",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isImproving ? (
              <TrendingDown size={16} color="#059669" strokeWidth={2.25} />
            ) : (
              <TrendingUp size={16} color="#DC2626" strokeWidth={2.25} />
            )}
          </View>
          <View>
            <AppText
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: "#0F172A",
                fontFamily: fontFamily.bodyBold,
              }}
            >
              {testName} Multi-Year Trend
            </AppText>
            <AppText style={{ fontSize: 11, color: "#64748B" }}>
              Longitudinal tracking ({points[0].date.slice(0, 4)}–{points[points.length - 1].date.slice(0, 4)})
            </AppText>
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: isImproving ? "#D1FAE5" : "#FEE2E2",
          }}
        >
          <AppText
            style={{
              fontSize: 10.5,
              fontWeight: "800",
              color: isImproving ? "#047857" : "#B91C1C",
            }}
          >
            {isImproving ? "IMPROVED" : "STABLE"}
          </AppText>
        </View>
      </View>

      {/* Visual Bar / Chart Grid */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: 75, paddingTop: 10 }}>
        {points.map((pt, idx) => {
          // Normalize height between 25px and 60px
          const maxV = Math.max(...points.map((p) => p.value));
          const minV = Math.min(...points.map((p) => p.value));
          const range = maxV - minV || 1;
          const barHeight = Math.max(24, Math.min(58, ((pt.value - minV) / range) * 34 + 24));
          const isLatest = idx === points.length - 1;

          return (
            <View key={idx} style={{ alignItems: "center", gap: 6, flex: 1 }}>
              <AppText
                style={{
                  fontSize: 10.5,
                  fontWeight: isLatest ? "800" : "600",
                  color: isLatest ? "#0284C7" : "#475569",
                }}
              >
                {pt.label}
              </AppText>
              <View
                style={{
                  width: 22,
                  height: barHeight,
                  borderRadius: 6,
                  backgroundColor: isLatest ? "#0284C7" : "#CBD5E1",
                }}
              />
              <AppText style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: "600" }}>
                {pt.date.slice(0, 7)}
              </AppText>
            </View>
          );
        })}
      </View>

      {/* Clinical Insight Footer */}
      {insight ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 6,
            backgroundColor: "#F8FAFC",
            padding: 9,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#F1F5F9",
          }}
        >
          <Sparkles size={13} color="#0284C7" style={{ marginTop: 1 }} />
          <AppText style={{ flex: 1, fontSize: 11.5, color: "#334155", lineHeight: 16, fontWeight: "500" }}>
            {insight}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

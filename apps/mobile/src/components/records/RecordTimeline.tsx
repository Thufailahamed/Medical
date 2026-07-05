// RecordTimeline: aggregates records + vitals + symptoms + medicines + notes
// from the existing /timeline/me endpoint. Phase v3 keeps the existing
// endpoint and adds a "kind" tag to each item so the hub can filter.

import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Play,
  Square,
  FlaskConical,
  Pill as PillIcon,
  ScanLine,
  FileText,
  Activity,
  type LucideIcon,
} from "lucide-react-native";
import { useUnifiedTimeline } from "@/hooks/useApi";
import { AppText } from "@/components/ui/AppText";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme/ThemeProvider";

export function RecordTimeline() {
  const router = useRouter();
  const { typography, colors, spacing, fontFamily } = useTheme();
  const { data, isLoading } = useUnifiedTimeline() as {
    data?: { events?: any[]; items?: any[] };
    isLoading: boolean;
  };

  if (isLoading) {
    return (
      <View style={{ padding: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 72, marginBottom: 12, borderRadius: 16 }} />
        ))}
      </View>
    );
  }

  const items = data?.events ?? data?.items ?? [];
  if (!items.length) {
    return (
      <EmptyState
        title="Nothing yet"
        body="Timeline will fill as you add records, vitals, and medicines."
      />
    );
  }

  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    
    const optionsDate: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    const formattedDate = date.toLocaleDateString("en-US", optionsDate);
    
    // Check if dateStr contains a time (length > 10)
    if (dateStr.length > 10) {
      const optionsTime: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: true };
      const formattedTime = date.toLocaleTimeString("en-US", optionsTime);
      return `${formattedDate} · ${formattedTime}`;
    }
    return formattedDate;
  };

  const getEventDetails = (kind: string, title: string) => {
    const k = (kind ?? "").toLowerCase();
    const t = (title ?? "").toLowerCase();
    
    if (k.includes("medicine_start")) {
      return {
        icon: Play,
        bg: "#ECFDF5",
        fg: "#10B981",
        tag: "STARTED MED",
        tagBg: "#D1FAE5",
        tagFg: "#065F46",
      };
    }
    if (k.includes("medicine_stop")) {
      return {
        icon: Square,
        bg: "#FEF2F2",
        fg: "#EF4444",
        tag: "STOPPED MED",
        tagBg: "#FEE2E2",
        tagFg: "#991B1B",
      };
    }
    if (k.includes("record")) {
      if (t.includes("lab") || t.includes("report") || t.includes("test")) {
        return {
          icon: FlaskConical,
          bg: "#FEF3C7",
          fg: "#D97706",
          tag: "LAB REPORT",
          tagBg: "#FEF3C7",
          tagFg: "#92400E",
        };
      }
      if (t.includes("presc") || t.includes("rx") || t.includes("med")) {
        return {
          icon: PillIcon,
          bg: "#F3E8FF",
          fg: "#9333EA",
          tag: "PRESCRIPTION",
          tagBg: "#F3E8FF",
          tagFg: "#6B21A8",
        };
      }
      if (t.includes("xray") || t.includes("scan") || t.includes("image") || t.includes("mri")) {
        return {
          icon: ScanLine,
          bg: "#E0E7FF",
          fg: "#4F46E5",
          tag: "IMAGING",
          tagBg: "#E0E7FF",
          tagFg: "#3730A3",
        };
      }
      return {
        icon: FileText,
        bg: "#E2E8F0",
        fg: "#475569",
        tag: "RECORD",
        tagBg: "#E2E8F0",
        tagFg: "#334155",
      };
    }
    return {
      icon: Activity,
      bg: "#F0F9FF",
      fg: "#0EA5E9",
      tag: (kind || "EVENT").toUpperCase().replace(/_/g, " "),
      tagBg: "#E0F2FE",
      tagFg: "#075985",
    };
  };

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 12 }}>
      {items.map((it: any, idx: number) => {
        const titleText = it.title ?? it.label ?? "Event";
        const kindVal = it.kind ?? it.type ?? "event";
        const meta = getEventDetails(kindVal, titleText);
        const formattedDate = formatEventDate(it.date ?? it.recordedAt ?? it.startDate);
        const isRecord = kindVal.toLowerCase().includes("record");

        return (
          <Pressable
            key={`${it.id ?? it.recordId ?? idx}`}
            onPress={() => {
              const recordId = it.recordId ?? it.id;
              if (isRecord && recordId) {
                router.push(`/record-detail?id=${recordId}`);
              }
            }}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderRadius: 18,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              opacity: pressed ? 0.92 : 1,
              shadowColor: "rgba(0, 0, 0, 0.03)",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 1,
              shadowRadius: 10,
              elevation: 2,
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            {/* Circle Icon Badge */}
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: meta.bg,
                alignItems: "center",
                justifyContent: "center",
                marginRight: spacing.md,
              }}
            >
              {React.createElement(meta.icon, {
                size: 16,
                color: meta.fg,
                strokeWidth: 2.5,
              })}
            </View>

            {/* Content block */}
            <View style={{ flex: 1, gap: 2 }}>
              <AppText
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: colors.text,
                  fontFamily: fontFamily.bodyBold,
                }}
                numberOfLines={1}
              >
                {titleText}
              </AppText>
              <AppText
                style={{
                  fontSize: 12.5,
                  fontWeight: "500",
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                }}
                numberOfLines={1}
              >
                {formattedDate}
              </AppText>
            </View>

            {/* Custom tag badge */}
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: meta.tagBg,
              }}
            >
              <AppText
                style={{
                  fontSize: 9.5,
                  fontWeight: "800",
                  color: meta.tagFg,
                  fontFamily: fontFamily.bodyBold,
                  letterSpacing: 0.3,
                }}
              >
                {meta.tag}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
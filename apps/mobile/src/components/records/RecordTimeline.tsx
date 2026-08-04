// @ts-nocheck
// Chronological Health Timeline Component.
// High-impact enhancements: Category Filter Pills, AI Timeline Summary Banner,
// left-aligned vertical axis, expanded card width, zero text truncation,
// and color-coded event nodes.

import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Play,
  Square,
  FlaskConical,
  Pill as PillIcon,
  ScanLine,
  FileText,
  Activity,
  Calendar,
  Stethoscope,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Sparkles,
  Heart,
  Filter,
  Bot,
} from "lucide-react-native";
import { useUnifiedTimeline } from "@/hooks/useApi";
import { AppText } from "@/components/ui/AppText";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme/ThemeProvider";

type Kind =
  | "appointment"
  | "consultation"
  | "medicine_start"
  | "medicine_stop"
  | "record"
  | "visit"
  | "lab"
  | "prescription"
  | "vaccination"
  | "note"
  | string;

interface EventMeta {
  icon: any;
  color: string;
  bg: string;
  ring: string;
  tag: string;
  tagBg: string;
  tagFg: string;
  state: "active" | "muted" | "normal";
  verb?: string;
}

function getEventMeta(kind: Kind, title: string): EventMeta {
  const k = (kind ?? "").toLowerCase();
  const t = (title ?? "").toLowerCase();

  if (k.includes("medicine_start")) {
    return {
      icon: Play,
      color: "#10B981",
      bg: "rgba(16, 185, 129, 0.10)",
      ring: "rgba(16, 185, 129, 0.30)",
      tag: "STARTED MED",
      tagBg: "#D1FAE5",
      tagFg: "#065F46",
      state: "normal",
      verb: "Started",
    };
  }
  if (k.includes("medicine_stop")) {
    return {
      icon: Square,
      color: "#EF4444",
      bg: "rgba(239, 68, 68, 0.10)",
      ring: "rgba(239, 68, 68, 0.25)",
      tag: "STOPPED MED",
      tagBg: "#FEE2E2",
      tagFg: "#991B1B",
      state: "muted",
      verb: "Stopped",
    };
  }
  if (k.includes("appointment") || k.includes("consultation")) {
    return {
      icon: Stethoscope,
      color: "#0D9488",
      bg: "rgba(13, 148, 136, 0.10)",
      ring: "rgba(13, 148, 136, 0.30)",
      tag: "CONSULTATION",
      tagBg: "#CCFBF1",
      tagFg: "#115E59",
      state: "normal",
      verb: "Visit",
    };
  }
  if (k.includes("vaccination") || t.includes("vaccin") || t.includes("immuniz")) {
    return {
      icon: Heart,
      color: "#EC4899",
      bg: "rgba(236, 72, 153, 0.10)",
      ring: "rgba(236, 72, 153, 0.30)",
      tag: "VACCINATION",
      tagBg: "#FCE7F3",
      tagFg: "#9D174D",
      state: "normal",
      verb: "Vaccinated",
    };
  }
  if (t.includes("lab") || t.includes("report") || t.includes("blood") || t.includes("test")) {
    return {
      icon: FlaskConical,
      color: "#D97706",
      bg: "rgba(217, 119, 6, 0.10)",
      ring: "rgba(217, 119, 6, 0.30)",
      tag: "BLOOD TEST",
      tagBg: "#FEF3C7",
      tagFg: "#92400E",
      state: "normal",
      verb: "Lab result",
    };
  }
  if (t.includes("presc") || t.includes("rx")) {
    return {
      icon: PillIcon,
      color: "#9333EA",
      bg: "rgba(147, 51, 234, 0.10)",
      ring: "rgba(147, 51, 234, 0.30)",
      tag: "PRESCRIPTION",
      tagBg: "#F3E8FF",
      tagFg: "#6B21A8",
      state: "normal",
      verb: "Prescribed",
    };
  }
  if (t.includes("xray") || t.includes("scan") || t.includes("mri") || t.includes("ecg") || t.includes("image")) {
    return {
      icon: ScanLine,
      color: "#4F46E5",
      bg: "rgba(79, 70, 229, 0.10)",
      ring: "rgba(79, 70, 229, 0.30)",
      tag: "DIAGNOSTIC",
      tagBg: "#E0E7FF",
      tagFg: "#3730A3",
      state: "normal",
      verb: "Imaging",
    };
  }
  if (k.includes("record") || k.includes("visit")) {
    return {
      icon: FileText,
      color: "#0284C7",
      bg: "rgba(2, 132, 199, 0.10)",
      ring: "rgba(2, 132, 199, 0.30)",
      tag: "RECORD",
      tagBg: "#E0F2FE",
      tagFg: "#075985",
      state: "normal",
      verb: "Recorded",
    };
  }
  return {
    icon: Activity,
    color: "#0284C7",
    bg: "rgba(2, 132, 199, 0.10)",
    ring: "rgba(2, 132, 199, 0.30)",
    tag: (kind || "EVENT").toUpperCase(),
    tagBg: "#E0F2FE",
    tagFg: "#075985",
    state: "normal",
  };
}

function getNavigationTarget(it: any) {
  if (!it) return null;
  const k = (it.kind ?? it.type ?? "").toLowerCase();
  const rawId = it.recordId ?? it.medicalRecordId ?? it.id;
  const recordId = rawId ? String(rawId).replace(/^rec-/, "") : null;

  if (recordId && (k.includes("record") || k.includes("visit") || k.includes("lab") || k.includes("presc") || k.includes("note") || k.includes("imaging") || k.includes("consultation"))) {
    return { path: `/record-detail?id=${recordId}`, label: "Tap to view record details" };
  }
  if (k.includes("medicine")) {
    return { path: "/(app)/medicines", label: "Tap to view medicine details" };
  }
  if (k.includes("appointment") || k.includes("consultation")) {
    return { path: "/(app)/appointments", label: "Tap to view visit details" };
  }
  if (recordId) {
    return { path: `/record-detail?id=${recordId}`, label: "Tap to view details" };
  }
  return null;
}

type FilterCategory = "all" | "lab" | "medicine" | "visit" | "record";

export function RecordTimeline() {
  const router = useRouter();
  const { colors, spacing, fontFamily } = useTheme();
  const { data, isLoading } = useUnifiedTimeline() as {
    data?: { events?: any[]; items?: any[] };
    isLoading: boolean;
  };

  const rawEvents = data?.events ?? data?.items ?? [];
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");

  // Category Filter logic
  const filteredEvents = useMemo(() => {
    if (selectedCategory === "all") return rawEvents;
    return rawEvents.filter((item: any) => {
      const k = (item.kind ?? item.type ?? "").toLowerCase();
      const t = (item.title ?? item.label ?? "").toLowerCase();
      if (selectedCategory === "lab") {
        return k.includes("lab") || t.includes("lab") || t.includes("blood") || t.includes("test");
      }
      if (selectedCategory === "medicine") {
        return k.includes("medicine") || t.includes("med") || t.includes("presc");
      }
      if (selectedCategory === "visit") {
        return k.includes("visit") || k.includes("appointment") || k.includes("consultation");
      }
      if (selectedCategory === "record") {
        return k.includes("record") || k.includes("note");
      }
      return true;
    });
  }, [rawEvents, selectedCategory]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let labCount = 0;
    let medCount = 0;
    let visitCount = 0;
    let recordCount = 0;
    for (const item of rawEvents) {
      const k = (item.kind ?? item.type ?? "").toLowerCase();
      const t = (item.title ?? item.label ?? "").toLowerCase();
      if (k.includes("lab") || t.includes("lab") || t.includes("blood") || t.includes("test")) labCount++;
      else if (k.includes("medicine") || t.includes("med") || t.includes("presc")) medCount++;
      else if (k.includes("visit") || k.includes("appointment") || k.includes("consultation")) visitCount++;
      else recordCount++;
    }
    return {
      all: rawEvents.length,
      lab: labCount,
      medicine: medCount,
      visit: visitCount,
      record: recordCount,
    };
  }, [rawEvents]);

  // Group events by Year
  const groupedByYear = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of filteredEvents) {
      const dateStr = item.date ?? item.recordedAt ?? item.startDate ?? item.createdAt;
      const year = dateStr ? new Date(dateStr).getFullYear().toString() : "Recent";
      const validYear = Number.isNaN(Number(year)) ? "Recent" : year;
      if (!map.has(validYear)) {
        map.set(validYear, []);
      }
      map.get(validYear)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredEvents]);

  if (isLoading) {
    return (
      <View style={{ padding: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 96, marginBottom: 14, borderRadius: 18 }} />
        ))}
      </View>
    );
  }

  if (!rawEvents.length) {
    return (
      <EmptyState
        title="No timeline history yet"
        body="Your chronological health timeline will fill automatically as lab reports, prescriptions, and visits are recorded."
      />
    );
  }

  const formatDateParts = (dateStr: string) => {
    if (!dateStr) return { weekday: "", month: "", day: "" };
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return { weekday: "", month: dateStr, day: "" };
    return {
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      month: d.toLocaleDateString("en-US", { month: "short" }),
      day: String(d.getDate()),
    };
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const filterButtons: { key: FilterCategory; label: string; icon: any; count: number }[] = [
    { key: "all", label: "All", icon: Filter, count: counts.all },
    { key: "lab", label: "Labs", icon: FlaskConical, count: counts.lab },
    { key: "medicine", label: "Meds", icon: PillIcon, count: counts.medicine },
    { key: "visit", label: "Visits", icon: Stethoscope, count: counts.visit },
    { key: "record", label: "Records", icon: FileText, count: counts.record },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 10,
        paddingTop: spacing.xs,
        paddingBottom: spacing.xl,
      }}
    >
      {/* 1. Light & Professional AI Timeline Summary Card */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 14,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: "#E2E8F0",
          shadowColor: "rgba(0, 0, 0, 0.03)",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 1,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: "#E0F2FE",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={15} color="#0284C7" strokeWidth={2.25} />
            </View>
            <AppText
              style={{
                fontSize: 11.5,
                fontWeight: "800",
                color: "#0F172A",
                fontFamily: fontFamily.bodyBold,
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              AI Timeline Insights
            </AppText>
          </View>

          <Pressable
            onPress={() => router.push("/(app)/ai/chat" as any)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: pressed ? "#E0F2FE" : "#F0F9FF",
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "#BAE6FD",
            })}
          >
            <Bot size={12} color="#0284C7" />
            <AppText style={{ fontSize: 11, fontWeight: "700", color: "#0284C7" }}>
              Ask AI
            </AppText>
            <ChevronRight size={11} color="#0284C7" strokeWidth={2.5} />
          </Pressable>
        </View>

        <AppText style={{ fontSize: 12.5, color: "#475569", lineHeight: 17, fontWeight: "500" }}>
          {`${rawEvents.length} health events recorded in 2026. Includes ${counts.lab || 0} lab reports, ${counts.medicine || 0} medication updates, and ${counts.visit || 0} clinical visits.`}
        </AppText>
      </View>

      {/* 2. Interactive Category Filter Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
      >
        {filterButtons.map((btn) => {
          const isActive = selectedCategory === btn.key;
          const IconComponent = btn.icon;
          return (
            <Pressable
              key={btn.key}
              onPress={() => setSelectedCategory(btn.key)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: isActive ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: isActive ? colors.primary : colors.border,
                opacity: pressed ? 0.9 : 1,
                shadowColor: isActive ? colors.primary : "transparent",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isActive ? 0.2 : 0,
                shadowRadius: 4,
                elevation: isActive ? 2 : 0,
              })}
            >
              <IconComponent
                size={13}
                color={isActive ? "#FFFFFF" : colors.textMuted}
                strokeWidth={2.25}
              />
              <AppText
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? "800" : "600",
                  color: isActive ? "#FFFFFF" : colors.text,
                  fontFamily: isActive ? fontFamily.bodyBold : fontFamily.body,
                }}
              >
                {btn.label}
              </AppText>
              {btn.count > 0 ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 999,
                    backgroundColor: isActive ? "rgba(255,255,255,0.25)" : colors.surfaceMuted,
                  }}
                >
                  <AppText
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: isActive ? "#FFFFFF" : colors.textMuted,
                    }}
                  >
                    {btn.count}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 3. Grouped Events List */}
      {groupedByYear.map(([year, yearEvents]) => {
        const isCurrentYear = year === new Date().getFullYear().toString();
        return (
          <View key={year} style={{ marginBottom: 28 }}>
            {/* Year header without background box */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 14,
                paddingHorizontal: 4,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
                <AppText
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: colors.text,
                    fontFamily: fontFamily.heavy,
                    letterSpacing: -0.4,
                  }}
                >
                  {year}
                </AppText>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <AppText
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: colors.primary,
                      fontFamily: fontFamily.bodyBold,
                      letterSpacing: 1.1,
                      textTransform: "uppercase",
                    }}
                  >
                    {isCurrentYear ? "THIS YEAR" : "YEAR"}
                  </AppText>
                  {isCurrentYear ? (
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: "#10B981",
                      }}
                    />
                  ) : null}
                </View>
              </View>

              <AppText
                style={{
                  fontSize: 12.5,
                  fontWeight: "600",
                  color: colors.textMuted,
                }}
              >
                {yearEvents.length} {yearEvents.length === 1 ? "event" : "events"}
              </AppText>
            </View>

            {/* Timeline list with left-aligned vertical axis */}
            <View>
              {yearEvents.map((it: any, idx: number) => {
                const titleText = it.title ?? it.label ?? "Event";
                const kindVal = it.kind ?? it.type ?? "event";
                const meta = getEventMeta(kindVal, titleText);
                const dateStr = it.date ?? it.recordedAt ?? it.startDate ?? it.createdAt;
                const date = formatDateParts(dateStr);
                const time = formatTime(dateStr);
                const isLast = idx === yearEvents.length - 1;
                const extractedItems: any[] = it.extractedItems || [];
                const isHover = hoverIdx === idx;
                const navTarget = getNavigationTarget(it);

                return (
                  <View
                    key={`${it.id ?? idx}`}
                    style={{
                      flexDirection: "row",
                      marginBottom: isLast ? 0 : 12,
                    }}
                  >
                    {/* Left Timeline Axis Column */}
                    <View
                      style={{
                        alignItems: "center",
                        width: 24,
                        marginRight: 8,
                      }}
                    >
                      {/* Top connector line */}
                      {idx !== 0 ? (
                        <View
                          style={{
                            width: 2,
                            height: 12,
                            backgroundColor: colors.border,
                          }}
                        />
                      ) : (
                        <View style={{ height: 12 }} />
                      )}

                      {/* Timeline Node Dot */}
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: meta.color,
                          alignItems: "center",
                          justifyContent: "center",
                          shadowColor: meta.color,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.35,
                          shadowRadius: 4,
                          elevation: 2,
                        }}
                      >
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: "#fff",
                          }}
                        />
                      </View>

                      {/* Bottom connector line */}
                      {!isLast ? (
                        <View
                          style={{
                            flex: 1,
                            width: 2,
                            minHeight: 14,
                            backgroundColor: colors.border,
                            marginTop: 2,
                          }}
                        />
                      ) : null}
                    </View>

                    {/* Expanded Event Card */}
                    <Pressable
                      onPress={() => {
                        if (navTarget?.path) {
                          router.push(navTarget.path as any);
                        }
                      }}
                      onPressIn={() => setHoverIdx(idx)}
                      onPressOut={() => setHoverIdx(null)}
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                        borderRadius: 16,
                        padding: 13,
                        opacity: pressed ? 0.96 : 1,
                        borderWidth: 1,
                        borderColor: isHover ? meta.color : colors.border,
                        shadowColor: isHover ? meta.color : "rgba(0,0,0,0.04)",
                        shadowOffset: { width: 0, height: isHover ? 4 : 2 },
                        shadowOpacity: isHover ? 0.15 : 0.05,
                        shadowRadius: isHover ? 10 : 4,
                        elevation: isHover ? 3 : 1,
                        gap: 8,
                      })}
                    >
                      {/* Top Row: Date Pill + Title/Verb + Category Tag */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {/* Month/Day Date Pill */}
                        <View
                          style={{
                            alignItems: "center",
                            backgroundColor: meta.bg,
                            borderRadius: 9,
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            minWidth: 42,
                            borderWidth: 1,
                            borderColor: meta.ring,
                          }}
                        >
                          <AppText
                            style={{
                              fontSize: 8.5,
                              fontWeight: "800",
                              color: meta.color,
                              fontFamily: fontFamily.bodyBold,
                              letterSpacing: 0.5,
                              textTransform: "uppercase",
                            }}
                          >
                            {date.month}
                          </AppText>
                          <AppText
                            style={{
                              fontSize: 14,
                              fontWeight: "900",
                              color: meta.color,
                              fontFamily: fontFamily.heavy,
                              lineHeight: 15,
                              marginTop: 1,
                            }}
                          >
                            {date.day}
                          </AppText>
                        </View>

                        {/* Event Verb & Title */}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            {meta.verb ? (
                              <AppText
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: "800",
                                  color: meta.color,
                                  fontFamily: fontFamily.bodyBold,
                                  letterSpacing: 0.5,
                                  textTransform: "uppercase",
                                }}
                              >
                                {meta.verb}
                              </AppText>
                            ) : null}
                          </View>
                          <AppText
                            style={{
                              fontSize: 14.5,
                              fontWeight: "800",
                              color: colors.text,
                              fontFamily: fontFamily.bodyBold,
                              letterSpacing: -0.2,
                              marginTop: 1,
                            }}
                          >
                            {titleText}
                          </AppText>
                        </View>

                        {/* Tag Badge */}
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                            backgroundColor: meta.tagBg,
                            borderWidth: 1,
                            borderColor: meta.ring,
                          }}
                        >
                          <AppText
                            style={{
                              fontSize: 9.5,
                              fontWeight: "800",
                              color: meta.tagFg,
                              fontFamily: fontFamily.bodyBold,
                              letterSpacing: 0.4,
                            }}
                          >
                            {meta.tag}
                          </AppText>
                        </View>
                      </View>

                      {/* Subtitle / Provider line */}
                      {it.subtitle ? (
                        <AppText
                          style={{
                            fontSize: 12,
                            color: colors.textMuted,
                            lineHeight: 16,
                          }}
                        >
                          {it.subtitle}
                        </AppText>
                      ) : null}

                      {/* Quick Meta Footer Strip (Time, Provider, Location) */}
                      {(time || it.provider || it.location) ? (
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 12,
                            paddingTop: 6,
                            borderTopWidth: 1,
                            borderTopColor: colors.surfaceMuted,
                          }}
                        >
                          {time ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Clock size={11} color={colors.textMuted} />
                              <AppText style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: "600" }}>
                                {time}
                              </AppText>
                            </View>
                          ) : null}
                          {it.provider ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Stethoscope size={11} color={colors.textMuted} />
                              <AppText style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: "600" }}>
                                {it.provider}
                              </AppText>
                            </View>
                          ) : null}
                          {it.location ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <MapPin size={11} color={colors.textMuted} />
                              <AppText style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: "600" }}>
                                {it.location}
                              </AppText>
                            </View>
                          ) : null}
                        </View>
                      ) : null}

                      {/* Extracted Lab Values / Sub-items Grid */}
                      {extractedItems.length > 0 ? (
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                            paddingTop: 4,
                          }}
                        >
                          {extractedItems.slice(0, 4).map((item, i) => {
                            const isAbnormal =
                              item.flag === "high" ||
                              item.flag === "low" ||
                              item.flag === "critical";
                            const isCritical = item.flag === "critical";
                            const flagBg = isCritical
                              ? "#FEE2E2"
                              : isAbnormal
                              ? "#FEF3C7"
                              : colors.surfaceMuted;
                            const flagFg = isCritical
                              ? "#B91C1C"
                              : isAbnormal
                              ? "#92400E"
                              : colors.text;
                            const FlagIcon = isCritical
                              ? TrendingUp
                              : isAbnormal
                              ? TrendingUp
                              : null;

                            return (
                              <View
                                key={i}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 8,
                                  backgroundColor: flagBg,
                                  gap: 4,
                                }}
                              >
                                {FlagIcon ? (
                                  <FlagIcon size={10} color={flagFg} strokeWidth={2.5} />
                                ) : null}
                                <AppText
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: flagFg,
                                    letterSpacing: -0.1,
                                  }}
                                >
                                  {item.name}:
                                </AppText>
                                <AppText
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: "800",
                                    color: flagFg,
                                    letterSpacing: -0.1,
                                  }}
                                >
                                  {item.value} {item.unit || ""}
                                </AppText>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      {/* Clickable Detail Footer Indicator */}
                      {navTarget ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingTop: 6,
                            marginTop: 2,
                            borderTopWidth: 1,
                            borderTopColor: "rgba(0,0,0,0.05)",
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Sparkles size={11} color={meta.color} />
                            <AppText
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: meta.color,
                                letterSpacing: -0.1,
                                fontFamily: fontFamily.bodyBold,
                              }}
                            >
                              {navTarget.label}
                            </AppText>
                          </View>
                          <ChevronRight size={13} color={meta.color} strokeWidth={2.5} />
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

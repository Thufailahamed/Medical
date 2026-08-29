// @ts-nocheck
// Chronological Health Timeline Component.
// High-impact enhancements: Category Filter Pills, AI Timeline Summary Banner,
// left-aligned vertical axis, expanded card width, zero text truncation,
// and color-coded event nodes.

import React, { useMemo, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Play,
  Square,
  FlaskConical,
  Pill as PillIcon,
  ScanLine,
  FileText,
  Activity,
  Stethoscope,
  ChevronRight,
  TrendingUp,
  Clock,
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
    return { path: `/record-detail?id=${recordId}` };
  }
  if (k.includes("medicine")) {
    return { path: "/(app)/medicines" };
  }
  if (k.includes("appointment") || k.includes("consultation")) {
    return { path: "/(app)/appointments" };
  }
  if (recordId) {
    return { path: `/record-detail?id=${recordId}` };
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
  const [pressedKey, setPressedKey] = useState<string | null>(null);
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

  const insightYear = new Date().getFullYear();

  return (
    <View style={{ gap: spacing.md }}>
      {/* AI summary — compact */}
      <Pressable
        onPress={() => router.push("/(app)/ai/chat" as any)}
        accessibilityRole="button"
        accessibilityLabel="Ask AI about timeline"
        style={({ pressed }) => ({
          backgroundColor: pressed ? "#F0F9FF" : colors.surface,
          borderRadius: 18,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: "#E0F2FE",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={18} color="#0284C7" strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
              letterSpacing: -0.2,
            }}
          >
            Timeline insights
          </AppText>
          <AppText
            numberOfLines={2}
            style={{
              fontSize: 12,
              color: colors.textMuted,
              lineHeight: 16,
              fontWeight: "500",
            }}
          >
            {`${rawEvents.length} events in ${insightYear} · ${counts.lab} labs · ${counts.medicine} meds · ${counts.visit} visits`}
          </AppText>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: "#F0F9FF",
            borderWidth: 1,
            borderColor: "#BAE6FD",
          }}
        >
          <Bot size={12} color="#0284C7" />
          <AppText
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: "#0284C7",
              fontFamily: fontFamily.bodyBold,
            }}
          >
            Ask
          </AppText>
        </View>
      </Pressable>

      {/* Category filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {filterButtons.map((btn) => {
          const isActive = selectedCategory === btn.key;
          const IconComponent = btn.icon;
          return (
            <Pressable
              key={btn.key}
              onPress={() => setSelectedCategory(btn.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: isActive
                  ? colors.primary
                  : pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                borderWidth: 1,
                borderColor: isActive ? colors.primary : colors.border,
                minHeight: 36,
              })}
            >
              <IconComponent
                size={13}
                color={isActive ? "#FFFFFF" : colors.textMuted}
                strokeWidth={2.25}
              />
              <AppText
                style={{
                  fontSize: 12.5,
                  fontWeight: "700",
                  color: isActive ? "#FFFFFF" : colors.text,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {btn.label}
              </AppText>
              <AppText
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: isActive ? "rgba(255,255,255,0.8)" : colors.textMuted,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {btn.count}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Grouped events */}
      {groupedByYear.map(([year, yearEvents]) => {
        const isCurrentYear = year === new Date().getFullYear().toString();
        return (
          <View key={year} style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 2,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <AppText
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: colors.text,
                    fontFamily: fontFamily.bodyBold,
                    letterSpacing: -0.3,
                  }}
                >
                  {year}
                </AppText>
                {isCurrentYear ? (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: colors.primarySoft,
                    }}
                  >
                    <AppText
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: colors.primary,
                        fontFamily: fontFamily.bodyBold,
                        letterSpacing: 0.6,
                      }}
                    >
                      THIS YEAR
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.textMuted,
                }}
              >
                {yearEvents.length} {yearEvents.length === 1 ? "event" : "events"}
              </AppText>
            </View>

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
                const eventKey = `${year}-${it.id ?? idx}`;
                const isPressed = pressedKey === eventKey;
                const navTarget = getNavigationTarget(it);
                const Icon = meta.icon;

                return (
                  <View
                    key={eventKey}
                    style={{
                      flexDirection: "row",
                      marginBottom: isLast ? 0 : 8,
                    }}
                  >
                    {/* Axis */}
                    <View
                      style={{
                        alignItems: "center",
                        width: 22,
                        marginRight: 10,
                      }}
                    >
                      {idx !== 0 ? (
                        <View
                          style={{
                            width: 2,
                            height: 8,
                            backgroundColor: colors.border,
                          }}
                        />
                      ) : (
                        <View style={{ height: 8 }} />
                      )}
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: meta.color,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 2,
                          borderColor: "#FFFFFF",
                          shadowColor: meta.color,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 3,
                          elevation: 2,
                        }}
                      >
                        <View
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: "#fff",
                          }}
                        />
                      </View>
                      {!isLast ? (
                        <View
                          style={{
                            flex: 1,
                            width: 2,
                            minHeight: 10,
                            backgroundColor: colors.border,
                            marginTop: 2,
                          }}
                        />
                      ) : null}
                    </View>

                    {/* Compact event row */}
                    <Pressable
                      onPress={() => {
                        if (navTarget?.path) router.push(navTarget.path as any);
                      }}
                      onPressIn={() => setPressedKey(eventKey)}
                      onPressOut={() => setPressedKey(null)}
                      accessibilityRole="button"
                      accessibilityLabel={`${meta.verb || meta.tag}: ${titleText}`}
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor:
                          pressed || isPressed ? colors.surfaceMuted : colors.surface,
                        borderRadius: 14,
                        paddingVertical: 10,
                        paddingHorizontal: 11,
                        borderWidth: 1,
                        borderColor:
                          pressed || isPressed ? meta.color : colors.border,
                        gap: 6,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: 10,
                        }}
                      >
                        {/* Date */}
                        <View
                          style={{
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: meta.bg,
                            borderRadius: 10,
                            paddingHorizontal: 6,
                            paddingVertical: 5,
                            minWidth: 40,
                          }}
                        >
                          <AppText
                            style={{
                              fontSize: 9,
                              fontWeight: "800",
                              color: meta.color,
                              fontFamily: fontFamily.bodyBold,
                              letterSpacing: 0.4,
                              textTransform: "uppercase",
                            }}
                          >
                            {date.month}
                          </AppText>
                          <AppText
                            style={{
                              fontSize: 15,
                              fontWeight: "900",
                              color: meta.color,
                              fontFamily: fontFamily.heavy,
                              lineHeight: 17,
                            }}
                          >
                            {date.day}
                          </AppText>
                        </View>

                        {/* Title block */}
                        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                paddingHorizontal: 7,
                                paddingVertical: 3,
                                borderRadius: 6,
                                backgroundColor: meta.tagBg,
                              }}
                            >
                              <Icon size={10} color={meta.tagFg} strokeWidth={2.5} />
                              <AppText
                                style={{
                                  fontSize: 10,
                                  fontWeight: "800",
                                  color: meta.tagFg,
                                  fontFamily: fontFamily.bodyBold,
                                  letterSpacing: 0.3,
                                }}
                              >
                                {meta.tag}
                              </AppText>
                            </View>
                            {time ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <Clock size={10} color={colors.textMuted} />
                                <AppText
                                  style={{
                                    fontSize: 11,
                                    color: colors.textMuted,
                                    fontWeight: "600",
                                  }}
                                >
                                  {time}
                                </AppText>
                              </View>
                            ) : null}
                          </View>

                          <AppText
                            numberOfLines={2}
                            style={{
                              fontSize: 15,
                              fontWeight: "800",
                              color: colors.text,
                              fontFamily: fontFamily.bodyBold,
                              letterSpacing: -0.25,
                              lineHeight: 19,
                            }}
                          >
                            {titleText}
                          </AppText>

                          {(it.subtitle || it.provider || it.location) ? (
                            <AppText
                              numberOfLines={1}
                              style={{
                                fontSize: 12,
                                color: colors.textMuted,
                                fontWeight: "500",
                              }}
                            >
                              {[it.subtitle, it.provider, it.location]
                                .filter(Boolean)
                                .join(" · ")}
                            </AppText>
                          ) : null}
                        </View>

                        {navTarget ? (
                          <ChevronRight
                            size={16}
                            color={colors.textSubtle}
                            strokeWidth={2.25}
                            style={{ marginTop: 10 }}
                          />
                        ) : null}
                      </View>

                      {extractedItems.length > 0 ? (
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 5,
                            paddingLeft: 50,
                          }}
                        >
                          {extractedItems.slice(0, 3).map((item, i) => {
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
                                : colors.textMuted;

                            return (
                              <View
                                key={i}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  paddingHorizontal: 7,
                                  paddingVertical: 3,
                                  borderRadius: 6,
                                  backgroundColor: flagBg,
                                  gap: 3,
                                }}
                              >
                                {isAbnormal ? (
                                  <TrendingUp size={9} color={flagFg} strokeWidth={2.5} />
                                ) : null}
                                <AppText
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: "700",
                                    color: flagFg,
                                  }}
                                >
                                  {item.name} {item.value}
                                  {item.unit ? ` ${item.unit}` : ""}
                                </AppText>
                              </View>
                            );
                          })}
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
    </View>
  );
}

// @ts-nocheck
import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Inbox,
  MessageSquarePlus,
  MessageSquare,
  Search,
  X,
  Lock,
  ChevronRight,
  Users,
  CalendarCheck,
  Stethoscope,
  Sparkles,
  CheckCheck,
} from "lucide-react-native";
import { useDoctorConversations } from "@/hooks/useApi";
import { Screen, ErrorState, Skeleton, Card, Avatar, Pill } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";
import { withOpacity } from "@/constants/theme";

function timeAgo(iso: string, locale: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString(
    locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
    {
      day: "numeric",
      month: "short",
    }
  );
}

function ConversationCardSkeleton({ colors }: { colors: any }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.separator,
        padding: 14,
        marginBottom: 10,
        gap: 12,
      }}
    >
      <Skeleton width={48} height={48} radius={24} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Skeleton width="45%" height={15} radius={6} />
          <Skeleton width={38} height={12} radius={6} />
        </View>
        <Skeleton width="70%" height={12} radius={6} />
      </View>
    </View>
  );
}

/** Quick actionable route card for doctor empty state */
function DoctorPathwayCard({
  icon: Icon,
  iconTint,
  iconBg,
  title,
  subtitle,
  badge,
  onPress,
}: {
  icon: any;
  iconTint: string;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
}) {
  const { colors, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        minHeight: 64,
        borderRadius: 20,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.separator,
        backgroundColor: colors.surface,
        ...(isDark ? {} : shadow.xs),
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          borderCurve: "continuous",
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={iconTint} strokeWidth={2.2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text },
            ]}
          >
            {title}
          </Text>
          {badge ? <Pill label={badge} tone="accent" size="sm" /> : null}
        </View>
        <Text
          style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>

      <ChevronRight size={17} color={colors.textSubtle} strokeWidth={2.4} />
    </Pressable>
  );
}

export default function DoctorInboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, fontFamily, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.separator;
  const segStyle = (active: boolean) => ({
    flex: 1,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderCurve: "continuous" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: active ? colors.surface : "transparent",
    ...(active ? shadow.xs : shadow.none),
  });
  const segText = (active: boolean) => [
    active ? typography.label.sm : typography.body.xs,
    { color: active ? colors.text : colors.textMuted },
  ];
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading, isError, refetch, isRefetching } = useDoctorConversations();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "active" | "closed">("all");

  const conversations = data?.conversations || [];
  const totalUnread = data?.totalUnread || 0;

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c: any) => {
      // Status filter
      if (activeFilter === "unread" && (c.doctorUnread || 0) === 0) return false;
      if (activeFilter === "active" && c.status === "closed") return false;
      if (activeFilter === "closed" && c.status !== "closed") return false;

      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const patientName = (c.patient?.name || "").toLowerCase();
        const preview = (c.lastMessagePreview || "").toLowerCase();
        if (!patientName.includes(q) && !preview.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [conversations, activeFilter, searchQuery]);

  const activeCount = useMemo(
    () => conversations.filter((c: any) => c.status !== "closed").length,
    [conversations]
  );
  const closedCount = useMemo(
    () => conversations.filter((c: any) => c.status === "closed").length,
    [conversations]
  );

  const renderConversationItem = useCallback(
    ({ item }: { item: any }) => {
      const initials = (item.patient?.name || "Patient")
        .split(" ")
        .map((s: string) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
      const unread = item.doctorUnread || 0;
      const isClosed = item.status === "closed";
      const isUnread = unread > 0;

      return (
        <Pressable
          onPress={() => router.push(`/(doctor)/inbox/${item.id}` as any)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 14,
            paddingHorizontal: 14,
            marginBottom: 10,
            minHeight: 76,
            borderRadius: 20,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isUnread ? withOpacity(colors.primary, 0.35) : hairline,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            transform: [{ scale: pressed ? 0.99 : 1 }],
            ...(isDark ? {} : shadow.xs),
          })}
        >
          {/* Avatar with Active Online Status Dot */}
          <View style={{ position: "relative", marginRight: 12 }}>
            <Avatar
              name={item.patient?.name || "Patient"}
              source={item.patient?.photo ? { uri: item.patient.photo } : undefined}
              size="md"
            />
            {!isClosed && (
              <View
                style={{
                  position: "absolute",
                  bottom: -1,
                  right: -1,
                  width: 13,
                  height: 13,
                  borderRadius: 7,
                  backgroundColor: colors.success,
                  borderWidth: 2.5,
                  borderColor: colors.surface,
                }}
              />
            )}
          </View>

          {/* Details */}
          <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
            {/* Top row: Name + Status + Time */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 3,
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  isUnread ? typography.title.md : typography.title.sm,
                  {
                    color: colors.text,
                    flex: 1,
                    marginRight: 8,
                  },
                ]}
              >
                {item.patient?.name || "Patient"}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {isClosed && (
                  <View
                    style={{
                      backgroundColor: colors.fill,
                      borderRadius: 6,
                      borderCurve: "continuous",
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={[typography.label.xs, { fontSize: 10, color: colors.textMuted }]}>
                      {t("inbox.closedStatus", { defaultValue: "Closed" })}
                    </Text>
                  </View>
                )}
                <Text
                  style={[
                    isUnread ? typography.label.sm : typography.caption,
                    { color: isUnread ? colors.primary : colors.textSubtle },
                  ]}
                >
                  {timeAgo(item.lastMessageAt, locale)}
                </Text>
              </View>
            </View>

            {/* Bottom row: Message Snippet + Unread Badge */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  isUnread ? typography.label.md : typography.body.sm,
                  { color: isUnread ? colors.text : colors.textMuted, flex: 1 },
                ]}
              >
                {item.lastMessageSender === "doctor" ? (
                  <Text style={{ color: colors.textSubtle }}>
                    {t("inbox.youPrefix", { defaultValue: "You:" })}{" "}
                  </Text>
                ) : null}
                {item.lastMessagePreview || t("inbox.noMessagesYet", { defaultValue: "No messages yet" })}
              </Text>

              {unread > 0 ? (
                <View
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 6,
                    marginLeft: 8,
                  }}
                >
                  <Text style={[typography.label.xs, { color: colors.onPrimary }]}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              ) : (
                <ChevronRight size={16} color={colors.textSubtle} style={{ marginLeft: 6 }} />
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, typography, fontFamily, locale, router, t, hairline, isDark, shadow]
  );

  return (
    <Screen scroll={false} padded={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* ── Header ── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: colors.bg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Title and dynamic badge */}
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageSquare size={17} color={colors.primary} strokeWidth={2.4} />
              </View>
              <Text style={[typography.display.md, { color: colors.text }]}>
                {t("inbox.title", { defaultValue: "Inbox" })}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: totalUnread > 0 ? colors.primary : colors.success,
                }}
              />
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {totalUnread > 0
                  ? t("inbox.subtitleWithUnread", {
                      count: totalUnread,
                      defaultValue: `${totalUnread} unread messages`,
                    })
                  : t("inbox.subtitleEmpty", {
                      defaultValue: "All patient messages up to date",
                    })}
              </Text>
            </View>
          </View>

          {/* New Chat Primary Action Button */}
          <Pressable
            onPress={() => router.push("/(doctor)/inbox/new" as any)}
            accessibilityRole="button"
            accessibilityLabel={t("inbox.startCta", { defaultValue: "New Message" })}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.primarySoft,
              height: 36,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderCurve: "continuous",
              opacity: pressed ? 0.75 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <MessageSquarePlus size={16} color={colors.primary} strokeWidth={2.4} />
            <Text style={[typography.label.md, { color: colors.primary }]}>
              {t("inbox.newChat", { defaultValue: "New Chat" })}
            </Text>
          </Pressable>
        </View>

        {/* ── Search Bar (Always accessible when there are conversations or search active) ── */}
        {(conversations.length > 0 || searchQuery.length > 0) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.fill,
              borderRadius: 12,
              borderCurve: "continuous",
              paddingHorizontal: 12,
              height: 40,
              marginTop: spacing.lg,
            }}
          >
            <Search size={16} color={colors.textSubtle} strokeWidth={2.2} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("inbox.searchConversations", {
                defaultValue: "Search conversations by patient name...",
              })}
              placeholderTextColor={colors.textSubtle}
              style={{
                flex: 1,
                marginLeft: 8,
                ...typography.body.md,
                color: colors.text,
                paddingVertical: 0,
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <X size={15} color={colors.textSubtle} />
              </Pressable>
            )}
          </View>
        )}

        {/* ── Filter Segment Tabs ── */}
        {conversations.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              gap: 2,
              padding: 3,
              marginTop: spacing.sm,
              borderRadius: 12,
              borderCurve: "continuous",
              backgroundColor: colors.fill,
            }}
          >
            <Pressable
              onPress={() => setActiveFilter("all")}
              style={segStyle(activeFilter === "all")}
            >
              <Text numberOfLines={1} style={segText(activeFilter === "all")}>
                All ({conversations.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveFilter("unread")}
              style={segStyle(activeFilter === "unread")}
            >
              <Text
                numberOfLines={1}
                style={[
                  ...segText(activeFilter === "unread"),
                  activeFilter !== "unread" && totalUnread > 0 ? { color: colors.primary } : null,
                ]}
              >
                Unread ({totalUnread})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveFilter("active")}
              style={segStyle(activeFilter === "active")}
            >
              <Text numberOfLines={1} style={segText(activeFilter === "active")}>
                Active ({activeCount})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveFilter("closed")}
              style={segStyle(activeFilter === "closed")}
            >
              <Text numberOfLines={1} style={segText(activeFilter === "closed")}>
                Closed ({closedCount})
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Body Content ── */}
      {isLoading ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <ConversationCardSkeleton key={i} colors={colors} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title={t("inbox.errorTitle", { defaultValue: "Failed to load messages" })}
          message={t("inbox.errorBody", {
            defaultValue: "Unable to retrieve conversation threads. Please check your network connection.",
          })}
          actionLabel={t("common.retry", { defaultValue: "Try Again" })}
          onAction={() => refetch()}
        />
      ) : conversations.length === 0 ? (
        /* ── Rich Clinical Empty State ── */
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: 130, // Clearance for floating tab bar!
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
        >
          {/* Hero Empty Card */}
          <Card
            style={{
              padding: spacing.xl,
              paddingVertical: spacing.xxl,
              alignItems: "center",
            }}
          >
            {/* Layered Icon Well */}
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.lg,
              }}
            >
              <Inbox size={34} color={colors.primary} strokeWidth={2} />
            </View>

            <Text
              style={[
                typography.title.lg,
                {
                  color: colors.text,
                  textAlign: "center",
                  marginBottom: 6,
                },
              ]}
            >
              {t("inbox.emptyTitle", { defaultValue: "No conversations yet" })}
            </Text>

            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, textAlign: "center", maxWidth: 290, marginBottom: 20 },
              ]}
            >
              {t("inbox.emptyBody", {
                defaultValue:
                  "Start secure consultation threads, discuss test results, or send prescription follow-ups directly to your patients.",
              })}
            </Text>

            {/* Primary Action Button */}
            <Pressable
              onPress={() => router.push("/(doctor)/inbox/new" as any)}
              accessibilityRole="button"
              accessibilityLabel={t("inbox.startCta", { defaultValue: "Start a conversation" })}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: colors.primary,
                height: 48,
                paddingHorizontal: 22,
                borderRadius: 16,
                borderCurve: "continuous",
                marginBottom: 16,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...(isDark ? {} : shadow.primary),
              })}
            >
              <MessageSquarePlus size={18} color={colors.onPrimary} strokeWidth={2.4} />
              <Text style={[typography.title.sm, { color: colors.onPrimary }]}>
                {t("inbox.startCta", { defaultValue: "Start a Conversation" })}
              </Text>
            </Pressable>

            {/* Encryption & Confidentiality Tag */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.successSoft,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderCurve: "continuous",
              }}
            >
              <Lock size={12} color={colors.success} strokeWidth={2.4} />
              <Text style={[typography.label.sm, { color: colors.success }]}>
                HIPAA Compliant • End-to-End Encrypted
              </Text>
            </View>
          </Card>

          {/* Quick Clinical Pathways */}
          <View style={{ gap: spacing.xs + 3 }}>
            <Text
              style={[
                typography.title.lg,
                { color: colors.text, paddingHorizontal: 4, marginBottom: 2 },
              ]}
            >
              {t("inbox.quickPathways", { defaultValue: "Quick Pathways" })}
            </Text>

            <DoctorPathwayCard
              icon={Users}
              iconTint={colors.primary}
              iconBg={colors.primarySoft}
              title={t("inbox.pathRecentTitle", { defaultValue: "Message Recent Patient" })}
              subtitle={t("inbox.pathRecentSubtitle", {
                defaultValue: "Quickly start a thread with recently visited patients",
              })}
              badge={t("inbox.pathRecentBadge", { defaultValue: "Fast" })}
              onPress={() => router.push("/(doctor)/inbox/new" as any)}
            />

            <DoctorPathwayCard
              icon={Stethoscope}
              iconTint={colors.accent}
              iconBg={colors.accentSoft}
              title={t("inbox.pathDirectoryTitle", { defaultValue: "Browse Patient Directory" })}
              subtitle={t("inbox.pathDirectorySubtitle", {
                defaultValue: "Find clinical charts, lab results, and patient profiles",
              })}
              onPress={() => router.push("/(doctor)/patients" as any)}
            />

            <DoctorPathwayCard
              icon={CalendarCheck}
              iconTint={colors.info}
              iconBg={colors.infoSoft}
              title={t("inbox.pathScheduleTitle", { defaultValue: "Check Today's Schedule" })}
              subtitle={t("inbox.pathScheduleSubtitle", {
                defaultValue: "View confirmed appointments and waiting room queue",
              })}
              onPress={() => router.push("/(doctor)/schedule" as any)}
            />
          </View>
        </ScrollView>
      ) : filteredConversations.length === 0 ? (
        /* ── Filter / Search Result Empty State ── */
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.xl,
            paddingBottom: 100,
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 20,
              borderCurve: "continuous",
              backgroundColor: colors.fill,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Search size={26} color={colors.textSubtle} />
          </View>
          <Text
            style={[
              typography.title.md,
              { color: colors.text, marginBottom: 4 },
            ]}
          >
            {t("inbox.noConversationsFound", { defaultValue: "No conversations found" })}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, textAlign: "center", marginBottom: 16 },
            ]}
          >
            {searchQuery
              ? t("inbox.noResultsMatching", {
                  search: searchQuery,
                  defaultValue: `No results matching "${searchQuery}"`,
                })
              : t("inbox.noFilterMatch", {
                  defaultValue: "No conversations match the selected filter.",
                })}
          </Text>
          <Pressable
            onPress={() => {
              setSearchQuery("");
              setActiveFilter("all");
            }}
            style={{
              height: 36,
              justifyContent: "center",
              paddingHorizontal: 16,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: colors.primarySoft,
            }}
          >
            <Text style={[typography.label.md, { color: colors.primary }]}>
              {t("inbox.resetFilters", { defaultValue: "Reset Filters" })}
            </Text>
          </Pressable>
        </View>
      ) : (
        /* ── Active Conversations List ── */
        <FlatList
          data={filteredConversations}
          keyExtractor={(c) => c.id}
          renderItem={renderConversationItem}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: 130, // Clearance for floating bottom nav!
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
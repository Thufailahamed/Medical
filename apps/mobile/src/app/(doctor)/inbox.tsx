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
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.borderSubtle ?? colors.border,
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
  const { colors, typography } = useTheme();

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
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.borderSubtle ?? colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
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
              typography.bodyBold,
              { color: colors.text, fontWeight: "700", fontSize: 14.5 },
            ]}
          >
            {title}
          </Text>
          {badge ? <Pill label={badge} tone="accent" size="sm" /> : null}
        </View>
        <Text
          style={{
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
            lineHeight: 16,
          }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>

      <ChevronRight size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function DoctorInboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, fontFamily } = useTheme();
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
            padding: 14,
            marginBottom: 10,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: isUnread
              ? withOpacity(colors.primary, 0.3)
              : (colors.borderSubtle ?? colors.border),
            backgroundColor: isUnread
              ? withOpacity(colors.primary, 0.04)
              : colors.surface,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.995 : 1 }],
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
                  backgroundColor: colors.success || "#10B981",
                  borderWidth: 2,
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
                  typography.bodyBold,
                  {
                    color: colors.text,
                    fontWeight: isUnread ? "800" : "600",
                    fontSize: 15,
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
                      backgroundColor: withOpacity(colors.warning || "#F59E0B", 0.15),
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: colors.warning || "#B45309",
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
                      Closed
                    </Text>
                  </View>
                )}
                <Text
                  style={{
                    fontSize: 11.5,
                    color: isUnread ? colors.primary : colors.textSubtle,
                    fontFamily: isUnread ? fontFamily.bodyBold : fontFamily.body,
                    fontWeight: isUnread ? "700" : "500",
                  }}
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
                style={{
                  fontSize: 13,
                  color: isUnread ? colors.text : colors.textMuted,
                  fontWeight: isUnread ? "600" : "400",
                  flex: 1,
                  lineHeight: 18,
                }}
              >
                {item.lastMessageSender === "doctor" ? (
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>
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
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 6,
                    marginLeft: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: "800",
                      fontFamily: fontFamily.displayBold,
                    }}
                  >
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
    [colors, typography, fontFamily, locale, router, t]
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
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageSquare size={17} color={colors.primary} strokeWidth={2.4} />
              </View>
              <Text
                style={[
                  typography.display.lg,
                  {
                    color: colors.text,
                    fontFamily: fontFamily.displayBold,
                    fontSize: 26,
                    lineHeight: 32,
                  },
                ]}
              >
                {t("inbox.title", { defaultValue: "Inbox" })}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: totalUnread > 0 ? colors.primary : colors.success || "#10B981",
                }}
              />
              <Text
                style={{
                  fontSize: 12.5,
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                }}
              >
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
              backgroundColor: colors.primary,
              paddingVertical: 9,
              paddingHorizontal: 14,
              borderRadius: 22,
              opacity: pressed ? 0.88 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 5,
              elevation: 3,
            })}
          >
            <MessageSquarePlus size={16} color="#FFFFFF" strokeWidth={2.4} />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: "700",
                fontFamily: fontFamily.bodyBold,
              }}
            >
              New Chat
            </Text>
          </Pressable>
        </View>

        {/* ── Search Bar (Always accessible when there are conversations or search active) ── */}
        {(conversations.length > 0 || searchQuery.length > 0) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              paddingHorizontal: 12,
              height: 42,
              marginTop: spacing.md,
            }}
          >
            <Search size={16} color={colors.textSubtle} strokeWidth={2.2} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search conversations by patient name..."
              placeholderTextColor={colors.textSubtle}
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 13.5,
                color: colors.text,
                fontFamily: fontFamily.body,
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: "row",
              gap: 8,
              paddingTop: spacing.sm,
              paddingBottom: 4,
            }}
          >
            <Pressable
              onPress={() => setActiveFilter("all")}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor:
                  activeFilter === "all" ? colors.primary : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: activeFilter === "all" ? "700" : "500",
                  color: activeFilter === "all" ? "#FFFFFF" : colors.textMuted,
                }}
              >
                All ({conversations.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveFilter("unread")}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor:
                  activeFilter === "unread"
                    ? colors.primary
                    : totalUnread > 0
                    ? withOpacity(colors.primary, 0.1)
                    : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: activeFilter === "unread" ? "700" : "500",
                  color:
                    activeFilter === "unread"
                      ? "#FFFFFF"
                      : totalUnread > 0
                      ? colors.primary
                      : colors.textMuted,
                }}
              >
                Unread ({totalUnread})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveFilter("active")}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor:
                  activeFilter === "active" ? colors.primary : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: activeFilter === "active" ? "700" : "500",
                  color: activeFilter === "active" ? "#FFFFFF" : colors.textMuted,
                }}
              >
                Active ({activeCount})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveFilter("closed")}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor:
                  activeFilter === "closed" ? colors.primary : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: activeFilter === "closed" ? "700" : "500",
                  color: activeFilter === "closed" ? "#FFFFFF" : colors.textMuted,
                }}
              >
                Closed ({closedCount})
              </Text>
            </Pressable>
          </ScrollView>
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
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              borderRadius: 22,
              padding: spacing.xl,
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            {/* Layered Icon Well */}
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
                borderWidth: 4,
                borderColor: withOpacity(colors.primary, 0.08),
              }}
            >
              <Inbox size={34} color={colors.primary} strokeWidth={2} />
            </View>

            <Text
              style={[
                typography.title.md,
                {
                  color: colors.text,
                  fontWeight: "800",
                  textAlign: "center",
                  fontSize: 18,
                  marginBottom: 6,
                },
              ]}
            >
              {t("inbox.emptyTitle", { defaultValue: "No conversations yet" })}
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 19,
                maxWidth: 290,
                marginBottom: 20,
              }}
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
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 24,
                marginBottom: 16,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              <MessageSquarePlus size={18} color="#FFFFFF" strokeWidth={2.4} />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "700",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {t("inbox.startCta", { defaultValue: "Start a Conversation" })}
              </Text>
            </Pressable>

            {/* Encryption & Confidentiality Tag */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: withOpacity(colors.success || "#059669", 0.08),
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: withOpacity(colors.success || "#059669", 0.2),
              }}
            >
              <Lock size={12} color={colors.success || "#059669"} strokeWidth={2.4} />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: "600",
                  color: colors.success || "#059669",
                }}
              >
                HIPAA Compliant • End-to-End Encrypted
              </Text>
            </View>
          </Card>

          {/* Quick Clinical Pathways */}
          <View style={{ gap: spacing.xs + 3 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.textSubtle,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                paddingHorizontal: 4,
              }}
            >
              Quick Pathways
            </Text>

            <DoctorPathwayCard
              icon={Users}
              iconTint={colors.primary}
              iconBg={colors.primarySoft}
              title="Message Recent Patient"
              subtitle="Quickly start a thread with recently visited patients"
              badge="Fast"
              onPress={() => router.push("/(doctor)/inbox/new" as any)}
            />

            <DoctorPathwayCard
              icon={Stethoscope}
              iconTint={colors.accent || "#0891B2"}
              iconBg={withOpacity(colors.accent || "#0891B2", 0.12)}
              title="Browse Patient Directory"
              subtitle="Find clinical charts, lab results, and patient profiles"
              onPress={() => router.push("/(doctor)/patients" as any)}
            />

            <DoctorPathwayCard
              icon={CalendarCheck}
              iconTint={colors.success || "#059669"}
              iconBg={withOpacity(colors.success || "#059669", 0.12)}
              title="Check Today's Schedule"
              subtitle="View confirmed appointments and waiting room queue"
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
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Search size={26} color={colors.textSubtle} />
          </View>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "700", marginBottom: 4 },
            ]}
          >
            No conversations found
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textMuted,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {searchQuery
              ? `No results matching "${searchQuery}"`
              : "No conversations match the selected filter."}
          </Text>
          <Pressable
            onPress={() => {
              setSearchQuery("");
              setActiveFilter("all");
            }}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 18,
              backgroundColor: colors.primarySoft,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
              Reset Filters
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
// @ts-nocheck
// Patient Inbox — shows conversations that the doctor has opened.
// Patients CANNOT start a conversation; only the doctor can initiate.
// If there are no open conversations, a neutral empty state is shown
// without any CTA to start a chat.
//
// Phase MVP-1: state pass — full Loading / Empty / Error / Content with
// retry. Pull-to-refresh re-uses the React Query refetch.

import { useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react-native";
import { usePatientConversations } from "@/hooks/useApi";
import { Screen, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";

function timeAgo(iso: string): string {
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
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function ConversationRowSkeleton({ colors, spacing }: any) {
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <Skeleton width={48} height={48} radius={24} style={{ marginRight: spacing.md }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="60%" height={14} radius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={12} radius={4} />
      </View>
    </View>
  );
}

export default function PatientInboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, fontFamily } = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = usePatientConversations();

  const conversations = data?.conversations || [];
  const totalUnread = data?.totalUnread || 0;

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const initials = (item.doctor?.name || "Dr")
        .split(" ")
        .map((s: string) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
      const unread = item.patientUnread || 0;
      return (
        <Pressable
          onPress={() => router.push(`/(app)/inbox/${item.id}` as any)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          })}
        >
          {/* Doctor avatar */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
              overflow: "hidden",
            }}
          >
            {item.doctor?.photo ? (
              <Image source={{ uri: item.doctor.photo }} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary, fontFamily: fontFamily.displayBold }}>
                {initials}
              </Text>
            )}
          </View>

          {/* Conversation info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text
                numberOfLines={1}
                style={[typography.body, {
                  color: colors.text,
                  fontFamily: fontFamily.bodyBold,
                  fontWeight: unread > 0 ? "800" : "600",
                  flex: 1,
                }]}
              >
                {item.doctor?.name || "Your Doctor"}
              </Text>
              <Text style={{ fontSize: 11, color: unread > 0 ? colors.primary : colors.textSubtle, fontFamily: fontFamily.body, marginLeft: 8 }}>
                {timeAgo(item.lastMessageAt)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
              <Text
                numberOfLines={1}
                style={[typography.caption, {
                  color: unread > 0 ? colors.text : colors.textSubtle,
                  fontWeight: unread > 0 ? "600" : "400",
                  flex: 1,
                }]}
              >
                {item.lastMessageSender === "patient" ? "You: " : ""}
                {item.lastMessagePreview || "No messages yet"}
              </Text>
              {unread > 0 && (
                <View style={{
                  minWidth: 20, height: 20, borderRadius: 10,
                  backgroundColor: colors.primary, alignItems: "center",
                  justifyContent: "center", paddingHorizontal: 6, marginLeft: 8,
                }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800", fontFamily: fontFamily.displayBold }}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, spacing, typography, fontFamily, router]
  );

  return (
    <Screen scroll={false} padded={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
        <Text style={[typography.display?.lg ?? { fontSize: 28, fontWeight: "800" }, {
          color: colors.text, fontFamily: fontFamily.displayBold, fontSize: 28, lineHeight: 34,
        }]}>
          Messages
        </Text>
        <Text style={[typography.body, { color: colors.textSubtle, marginTop: 4 }]}>
          {totalUnread > 0
            ? `${totalUnread} unread message${totalUnread > 1 ? "s" : ""}`
            : "Messages from your doctor"}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <ConversationRowSkeleton key={i} colors={colors} spacing={spacing} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title={t("inbox.errorTitle")}
          message={t("inbox.errorBody")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : conversations.length === 0 ? (
        /* Empty state — no CTA to start a chat */
        <EmptyState
          icon={<MessageCircle size={42} color={colors.primary} strokeWidth={1.6} />}
          title={t("inbox.emptyTitle")}
          message={t("inbox.emptyBody")}
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </Screen>
  );
}

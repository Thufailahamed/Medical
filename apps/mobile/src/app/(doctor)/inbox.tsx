// @ts-nocheck
import { useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Inbox, MessageSquarePlus } from "lucide-react-native";
import {
  useDoctorConversations,
} from "@/hooks/useApi";
import { Screen } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";

function timeAgo(iso: string, locale: string): string {
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
  return new Date(iso).toLocaleDateString(locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK", {
    day: "numeric",
    month: "short",
  });
}

export default function InboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading } = useDoctorConversations();

  const conversations = data?.conversations || [];
  const totalUnread = data?.totalUnread || 0;

  const subtitle = useMemo(() => {
    if (totalUnread === 0) return t("inbox.subtitleEmpty");
    return t("inbox.subtitleWithUnread", { count: totalUnread });
  }, [totalUnread, t]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const initials = (item.patient?.name || "?")
        .split(" ")
        .map((s: string) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
      const unread = item.doctorUnread || 0;
      return (
        <Pressable
          onPress={() => router.push(`/(doctor)/inbox/${item.id}` as any)}
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
            {item.patient?.photo ? (
              <Image
                source={{ uri: item.patient.photo }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
              />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: colors.primary,
                  fontFamily: fontFamily.displayBold,
                }}
              >
                {initials}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
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
                  typography.body,
                  {
                    color: colors.text,
                    fontFamily: fontFamily.bodyBold,
                    fontWeight: unread > 0 ? "800" : "600",
                    flex: 1,
                  },
                ]}
              >
                {item.patient?.name || "Patient"}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: unread > 0 ? colors.primary : colors.textSubtle,
                  fontFamily: fontFamily.bodyBold,
                  marginLeft: 8,
                }}
              >
                {timeAgo(item.lastMessageAt, locale)}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 2,
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  typography.caption,
                  {
                    color: unread > 0 ? colors.text : colors.textSubtle,
                    fontWeight: unread > 0 ? "600" : "400",
                    flex: 1,
                  },
                ]}
              >
                {item.lastMessageSender === "doctor"
                  ? t("inbox.youPrefix") + " "
                  : ""}
                {item.lastMessagePreview || t("inbox.noMessagesYet")}
              </Text>
              {unread > 0 && (
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
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, spacing, typography, radius, fontFamily, locale, router, t]
  );

  return (
    <Screen scroll={false} padded={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        }}
      >
        <Text
          style={[
            typography.display.lg,
            {
              color: colors.text,
              fontFamily: fontFamily.displayBold,
              fontSize: 28,
              lineHeight: 34,
            },
          ]}
        >
          {t("inbox.title")}
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSubtle, marginTop: 4 },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View
          style={{
            flex: 1,
            paddingHorizontal: spacing.xl,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.lg,
            }}
          >
            <Inbox size={42} color={colors.primary} strokeWidth={1.6} />
          </View>
          <Text
            style={[
              typography.display.md,
              {
                color: colors.text,
                fontFamily: fontFamily.displayBold,
                textAlign: "center",
              },
            ]}
          >
            {t("inbox.emptyTitle")}
          </Text>
          <Text
            style={[
              typography.body,
              {
                color: colors.textSubtle,
                textAlign: "center",
                marginTop: 8,
                maxWidth: 300,
                lineHeight: 22,
              },
            ]}
          >
            {t("inbox.emptyBody")}
          </Text>
          <Pressable
            onPress={() => router.push("/(doctor)/prescription" as any)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: spacing.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.full,
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <MessageSquarePlus size={18} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: "700",
                fontFamily: fontFamily.bodyBold,
              }}
            >
              {t("inbox.startCta")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </Screen>
  );
}

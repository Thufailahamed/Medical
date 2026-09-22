// @ts-nocheck
// Patient Inbox — shows conversations that the doctor has opened.
// Patients CANNOT start a conversation; only the doctor can initiate.
// If there are no open conversations, a neutral empty state is shown
// without any CTA to start a chat.
//
// Phase MVP-1: state pass — full Loading / Empty / Error / Content with
// retry. Pull-to-refresh re-uses the React Query refetch.

import { useCallback } from "react";
import { View, Text, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
} from "lucide-react-native";
import { usePatientConversations } from "@/hooks/useApi";
import {
  Screen,
  ErrorState,
  Skeleton,
  Card,
  Avatar,
  Pill,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

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

function HeaderMetric({ value, label }: { value: number; label: string }) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: radius.md,
        backgroundColor: colors.glassOnPrimary,
        borderWidth: 1,
        borderColor: colors.glassOnPrimary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Text style={[typography.title.lg, { color: colors.onPrimary }]}>{value}</Text>
      <Text
        style={[
          typography.overline,
          { color: colors.glassOnPrimarySoft, textTransform: "uppercase" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ConversationCardSkeleton() {
  const { spacing, radius } = useTheme();
  return (
    <Card padded={false} style={{ borderRadius: radius.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <Skeleton width={54} height={54} radius={27} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton width="62%" height={15} radius={6} />
          <Skeleton width="42%" height={12} radius={6} />
        </View>
      </View>
    </Card>
  );
}

function EmptyInbox() {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.sm + 2,
        paddingBottom: spacing.xxxxxl,
      }}
    >
      <Card padded={false} style={{ width: "100%", borderRadius: radius.xl }}>
        <LinearGradient
          colors={[colors.primarySoft, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            alignItems: "center",
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.xxxl,
          }}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryMuted]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.lg,
            }}
          >
            <MessageCircle size={38} color={colors.onPrimary} strokeWidth={1.8} />
          </LinearGradient>
          <Text
            style={[
              typography.title.lg,
              { color: colors.text, textAlign: "center" },
            ]}
          >
            {t("inbox.emptyTitle")}
          </Text>
          <Text
            style={[
              typography.body.md,
              {
                color: colors.textMuted,
                textAlign: "center",
                marginTop: spacing.sm,
              },
            ]}
          >
            {t("patientInbox.emptyBody", {
              defaultValue: "When your doctor sends a message, it will appear here.",
            })}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: spacing.sm,
              marginTop: spacing.lg,
            }}
          >
            <Pill
              icon={ShieldCheck}
              label={t("patientInbox.secureBadge", { defaultValue: "Private & secure" })}
              tone="primary"
            />
            <Pill
              icon={Stethoscope}
              label={t("patientInbox.careTeamBadge", { defaultValue: "Care team replies" })}
              tone="neutral"
            />
          </View>
        </LinearGradient>
      </Card>
    </View>
  );
}

export default function PatientInboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius } = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = usePatientConversations();

  const conversations = data?.conversations || [];
  const totalUnread = data?.totalUnread || 0;
  const contentPadding = spacing.sm + 2;
  const subtitle =
    totalUnread > 0
      ? t("inbox.subtitleWithUnread", { count: totalUnread })
      : t("patientInbox.subtitle", { defaultValue: "Messages from your doctor" });

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const unread = item.patientUnread || 0;
      return (
        <Card
          onPress={() => router.push(`/(app)/inbox/${item.id}` as any)}
          padded={false}
          style={{
            borderRadius: radius.lg,
            borderColor: unread > 0 ? colors.primary : colors.border,
            backgroundColor: unread > 0 ? colors.secondarySoft : colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.md,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                padding: 2,
                borderRadius: 30,
                borderWidth: unread > 0 ? 2 : 0,
                borderColor: colors.primary,
              }}
            >
              <Avatar
                name={item.doctor?.name || "Your Doctor"}
                source={item.doctor?.photo ? { uri: item.doctor.photo } : undefined}
                size="lg"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.sm,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    typography.title.sm,
                    {
                      color: colors.text,
                      flex: 1,
                      fontWeight: unread > 0 ? "800" : "600",
                    },
                  ]}
                >
                  {item.doctor?.name || "Your Doctor"}
                </Text>
                <Text
                  style={[
                    typography.caption,
                    {
                      color: unread > 0 ? colors.primary : colors.textSubtle,
                      fontWeight: unread > 0 ? "700" : "400",
                    },
                  ]}
                >
                  {timeAgo(item.lastMessageAt)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  marginTop: 3,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    typography.body.sm,
                    {
                      color: unread > 0 ? colors.text : colors.textMuted,
                      fontWeight: unread > 0 ? "600" : "400",
                      flex: 1,
                    },
                  ]}
                >
                  {item.lastMessageSender === "patient" ? "You: " : ""}
                  {item.lastMessagePreview || t("inbox.noMessagesYet")}
                </Text>
                {item.status === "closed" ? (
                  <Pill
                    label={t("inbox.closed", { defaultValue: "Closed" })}
                    tone="warning"
                    size="sm"
                  />
                ) : null}
              </View>
            </View>
            {unread > 0 ? (
              <View
                style={{
                  minWidth: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 7,
                }}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: colors.onPrimary, fontWeight: "800" },
                  ]}
                >
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : (
              <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.25} />
            )}
          </View>
        </Card>
      );
    },
    [colors, radius, router, spacing, t, typography]
  );

  return (
    <Screen scroll={false} padded={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      <View
        style={{
          paddingHorizontal: contentPadding,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
        }}
      >
        <LinearGradient
          colors={[colors.primaryMuted, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.lg,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 170,
              height: 170,
              borderRadius: 85,
              right: -58,
              top: -72,
              backgroundColor: colors.glassOnPrimary,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(app)" as any)
              }
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.glassOnPrimary,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <ArrowLeft size={20} color={colors.onPrimary} strokeWidth={2.4} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: radius.full,
                  backgroundColor: colors.glassOnPrimary,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 5,
                  marginBottom: spacing.sm,
                }}
              >
                <ShieldCheck size={12} color={colors.onPrimary} strokeWidth={2.5} />
                <Text
                  style={[
                    typography.overline,
                    { color: colors.onPrimary, letterSpacing: 0.8 },
                  ]}
                >
                  {t("patientInbox.secureBadge", { defaultValue: "Private & secure" })}
                </Text>
              </View>
              <Text style={[typography.display.md, { color: colors.onPrimary }]}>
                {t("nav.tabs.messages")}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.glassOnPrimarySoft, marginTop: 2 },
                ]}
              >
                {subtitle}
              </Text>
            </View>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: colors.glassOnPrimary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MessageCircle size={25} color={colors.onPrimary} strokeWidth={2.1} />
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginTop: spacing.lg,
            }}
          >
            <HeaderMetric
              value={conversations.length}
              label={t("patientInbox.conversationsLabel", { defaultValue: "Conversations" })}
            />
            <HeaderMetric
              value={totalUnread}
              label={t("patientInbox.unreadLabel", { defaultValue: "Unread" })}
            />
          </View>
        </LinearGradient>
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: contentPadding, gap: spacing.sm }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <ConversationCardSkeleton key={i} />
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
        <EmptyInbox />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          contentContainerStyle={{
            paddingHorizontal: contentPadding,
            paddingTop: spacing.xs,
            paddingBottom: 110,
          }}
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

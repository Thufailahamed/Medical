// @ts-nocheck
// Patient Inbox — shows conversations that the doctor has opened.
// Patients CANNOT start a conversation directly; only the doctor initiates clinical threads.
// If there are no open conversations, a helpful empty state with clear clinical pathways is displayed.

import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
  CalendarCheck,
  Sparkles,
  Users,
  Search,
  X,
  Lock,
  ArrowRight,
  Clock,
} from "lucide-react-native";
import { usePatientConversations } from "@/hooks/useApi";
import {
  Screen,
  ScreenHeader,
  ErrorState,
  Skeleton,
  Card,
  Avatar,
  Pill,
  TextInput,
  Button,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function ConversationCardSkeleton() {
  const { spacing, radius, colors } = useTheme();
  return (
    <Card
      padded={false}
      style={{
        borderRadius: radius.card,
        borderCurve: "continuous",
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Skeleton width={48} height={48} radius={24} />
        <View style={{ flex: 1, gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Skeleton width="50%" height={15} radius={6} />
            <Skeleton width={40} height={12} radius={6} />
          </View>
          <Skeleton width="75%" height={12} radius={6} />
        </View>
      </View>
    </Card>
  );
}

/** Action card for quick access from the empty messages state. */
function QuickActionCard({
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
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 68,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
        backgroundColor: colors.surface,
        ...(scheme === "dark" ? null : shadow.sm),
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
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
        <Icon size={20} color={iconTint} />
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

      <ChevronRight size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

function EmptyInbox({ onRefresh, isRefetching }: { onRefresh: () => void; isRefetching: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xxxxl,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* ── Main Empty State Card ── */}
      <Card
        style={{
          borderRadius: radius.card,
          borderCurve: "continuous",
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.xxl + 4,
          alignItems: "center",
        }}
      >
        {/* Soft Layered Icon */}
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 24,
            borderCurve: "continuous",
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.lg,
          }}
        >
          <MessageCircle size={36} color={colors.primary} strokeWidth={2} />
        </View>

        <Text
          style={[
            typography.title.lg,
            { color: colors.text, textAlign: "center", marginBottom: 6 },
          ]}
        >
          {t("inbox.emptyTitle", { defaultValue: "No conversations yet" })}
        </Text>

        <Text
          style={[
            typography.body.md,
            {
              color: colors.textMuted,
              textAlign: "center",
              maxWidth: 300,
              marginBottom: spacing.lg,
            },
          ]}
        >
          {t("patientInbox.emptyBody", {
            defaultValue:
              "When your doctor or care team sends a consultation message or follow-up, it will appear here.",
          })}
        </Text>

        {/* Security & Confidentiality Pill */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.successSoft,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radius.full,
          }}
        >
          <Lock size={12} color={colors.success} strokeWidth={2.4} />
          <Text style={[typography.label.sm, { color: colors.success }]}>
            End-to-End Encrypted & Private
          </Text>
        </View>
      </Card>

      {/* ── Helpful Action Pathways ── */}
      <View style={{ gap: spacing.md }}>
        <Text
          style={[
            typography.title.lg,
            { color: colors.text, marginLeft: 2 },
          ]}
        >
          Looking to connect?
        </Text>

        <View style={{ gap: spacing.md }}>
          <QuickActionCard
            icon={CalendarCheck}
            iconTint={colors.primary}
            iconBg={colors.primarySoft}
            title="Book an Appointment"
            subtitle="Schedule an in-person or video consultation"
            onPress={() => router.push("/(app)/book-appointment" as any)}
          />

          <QuickActionCard
            icon={Sparkles}
            iconTint={colors.accent}
            iconBg={colors.accentSoft}
            title="Ask AI Health Assistant"
            subtitle="Instant 24/7 symptom checks & health guidance"
            badge="Instant"
            onPress={() => router.push("/(app)/ai/chat" as any)}
          />

          <QuickActionCard
            icon={Users}
            iconTint={colors.warning}
            iconBg={colors.warningSoft}
            title="View Your Care Team"
            subtitle="See your connected doctors, specialists & clinic"
            onPress={() => router.push("/(app)/care-team" as any)}
          />
        </View>
      </View>
    </ScrollView>
  );
}

export default function PatientInboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, scheme } = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = usePatientConversations();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const conversations = data?.conversations || [];
  const totalUnread = data?.totalUnread || 0;

  const filteredConversations = useMemo(() => {
    return conversations.filter((c: any) => {
      if (filterUnreadOnly && (c.patientUnread || 0) === 0) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const docName = (c.doctor?.name || "").toLowerCase();
      const lastMsg = (c.lastMessagePreview || "").toLowerCase();
      const specialty = (c.doctor?.specialty || "").toLowerCase();
      return docName.includes(q) || lastMsg.includes(q) || specialty.includes(q);
    });
  }, [conversations, filterUnreadOnly, searchQuery]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const unread = item.patientUnread || 0;
      return (
        <Card
          onPress={() => router.push(`/(app)/inbox/${item.id}` as any)}
          padded={false}
          style={{
            borderRadius: radius.card,
            borderCurve: "continuous",
            borderWidth: unread > 0 ? 1 : StyleSheet.hairlineWidth,
            borderColor: unread > 0 ? withOpacity(colors.primary, 0.35) : scheme === "dark" ? colors.borderStrong : colors.separator,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md + 2,
              gap: spacing.md,
            }}
          >
            {/* Doctor Avatar with Optional Online/Unread Dot */}
            <View style={{ position: "relative" }}>
              <Avatar
                name={item.doctor?.name || "Doctor"}
                source={item.doctor?.photo ? { uri: item.doctor.photo } : undefined}
                size="md"
              />
              {unread > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: -1,
                    right: -1,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: colors.primary,
                    borderWidth: 2.5,
                    borderColor: colors.surface,
                  }}
                />
              ) : null}
            </View>

            {/* Conversation Details */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 3,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    unread > 0 ? typography.title.md : typography.title.sm,
                    {
                      color: colors.text,
                      flex: 1,
                    },
                  ]}
                >
                  {item.doctor?.name || "Your Doctor"}
                </Text>
                <Text
                  style={[
                    unread > 0 ? typography.label.sm : typography.caption,
                    {
                      color: unread > 0 ? colors.primary : colors.textSubtle,
                      marginLeft: 8,
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
                  gap: 8,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    unread > 0 ? typography.label.md : typography.body.sm,
                    {
                      color: unread > 0 ? colors.text : colors.textMuted,
                      flex: 1,
                    },
                  ]}
                >
                  {item.lastMessageSender === "patient" ? "You: " : ""}
                  {item.lastMessagePreview || t("inbox.noMessagesYet", { defaultValue: "No messages yet" })}
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

            {/* Unread Pill or Chevron */}
            {unread > 0 ? (
              <View
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: 11,
                  borderCurve: "continuous",
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 6,
                }}
              >
                <Text
                  style={[
                    typography.label.xs,
                    {
                      color: colors.onPrimary,
                      letterSpacing: 0,
                    },
                  ]}
                >
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : (
              <ChevronRight size={18} color={colors.textSubtle} />
            )}
          </View>
        </Card>
      );
    },
    [colors, router, spacing, t, typography, radius, scheme]
  );

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={["top"]}
      tabBarOffset={true}
      style={{ backgroundColor: colors.bg }}
    >
      {/* ── Native Clean Screen Header (No Clunky Gradient or Misplaced Back Arrow) ── */}
      <ScreenHeader
        title={t("nav.tabs.messages", { defaultValue: "Messages" })}
        subtitle={
          totalUnread > 0
            ? `${totalUnread} unread consultation${totalUnread > 1 ? "s" : ""}`
            : "Direct messages from your doctors"
        }
        back={false}
        right={
          totalUnread > 0 ? (
            <Pill
              label={`${totalUnread} Unread`}
              tone="primary"
              size="sm"
            />
          ) : (
            <Pill
              label="Encrypted"
              icon={Lock}
              tone="neutral"
              size="sm"
            />
          )
        }
      />

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.xs }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <ConversationCardSkeleton key={i} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title={t("inbox.errorTitle", { defaultValue: "Couldn't load messages" })}
          message={t("inbox.errorBody", { defaultValue: "Check your connection and try again." })}
          actionLabel={t("common.retry", { defaultValue: "Retry" })}
          onAction={() => refetch()}
        />
      ) : conversations.length === 0 ? (
        <EmptyInbox onRefresh={refetch} isRefetching={isRefetching} />
      ) : (
        <View style={{ flex: 1 }}>
          {/* Search Input when conversations exist */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.xs,
              paddingBottom: spacing.md,
            }}
          >
            <TextInput
              leadingIcon={Search}
              placeholder="Search doctors or messages..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              tone="soft"
              trailingIcon={searchQuery ? X : undefined}
              onTrailingIconPress={() => setSearchQuery("")}
            />
          </View>

          <FlatList
            data={filteredConversations}
            keyExtractor={(c) => c.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.xs,
              paddingBottom: 24,
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => refetch()}
                tintColor={colors.primary}
              />
            }
          />
        </View>
      )}
    </Screen>
  );
}


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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
  const { colors, spacing, typography, radius } = useTheme();

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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
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
              typography.title.xs,
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
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 20,
          padding: spacing.xl,
          alignItems: "center",
        }}
      >
        {/* Soft Layered Icon */}
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.md,
          }}
        >
          <MessageCircle size={34} color={colors.primary} strokeWidth={2} />
        </View>

        <Text
          style={[
            typography.title.md,
            { color: colors.text, fontWeight: "700", textAlign: "center", marginBottom: 6 },
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
            marginBottom: 16,
          }}
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
            End-to-End Encrypted & Private
          </Text>
        </View>
      </Card>

      {/* ── Helpful Action Pathways ── */}
      <View style={{ gap: spacing.xs + 2 }}>
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: "700",
            color: colors.textMuted,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginLeft: 2,
          }}
        >
          Looking to connect?
        </Text>

        <View style={{ gap: 10 }}>
          <QuickActionCard
            icon={CalendarCheck}
            iconTint="#0284C7"
            iconBg="#E0F2FE"
            title="Book an Appointment"
            subtitle="Schedule an in-person or video consultation"
            onPress={() => router.push("/(app)/book-appointment" as any)}
          />

          <QuickActionCard
            icon={Sparkles}
            iconTint="#059669"
            iconBg="#D1FAE5"
            title="Ask AI Health Assistant"
            subtitle="Instant 24/7 symptom checks & health guidance"
            badge="Instant"
            onPress={() => router.push("/(app)/ai/chat" as any)}
          />

          <QuickActionCard
            icon={Users}
            iconTint="#D97706"
            iconBg="#FEF3C7"
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
  const { colors, spacing, typography, radius } = useTheme();
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
            borderRadius: 16,
            borderWidth: 1,
            borderColor: unread > 0 ? colors.primary : colors.border,
            backgroundColor: unread > 0
              ? withOpacity(colors.primary, 0.04)
              : colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.md,
              gap: 12,
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
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colors.primary,
                    borderWidth: 2,
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
                  marginBottom: 2,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    typography.title.xs,
                    {
                      color: colors.text,
                      flex: 1,
                      fontWeight: unread > 0 ? "800" : "700",
                      fontSize: 15,
                    },
                  ]}
                >
                  {item.doctor?.name || "Your Doctor"}
                </Text>
                <Text
                  style={{
                    fontSize: 11.5,
                    color: unread > 0 ? colors.primary : colors.textSubtle,
                    fontWeight: unread > 0 ? "700" : "500",
                    marginLeft: 8,
                  }}
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
                  style={{
                    fontSize: 12.5,
                    color: unread > 0 ? colors.text : colors.textMuted,
                    fontWeight: unread > 0 ? "600" : "400",
                    flex: 1,
                    lineHeight: 17,
                  }}
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
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.onPrimary,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
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
    [colors, router, spacing, t, typography]
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
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.xs }}>
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
              paddingBottom: spacing.sm,
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
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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


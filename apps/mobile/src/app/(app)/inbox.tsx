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
  LargeHeader,
  ErrorState,
  Skeleton,
  Card,
  Avatar,
  Pill,
  SearchField,
  ChipGroup,
  IconButton,
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
  const { colors, spacing, typography, radius, scheme, shadow } = useTheme();
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

  const lastIndex = filteredConversations.length - 1;

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const unread = item.patientUnread || 0;
      const isFirst = index === 0;
      const isLast = index === lastIndex;
      const doctorName = item.doctor?.name || t("patientInbox.yourDoctor", { defaultValue: "Your Doctor" });
      const specialty = item.doctor?.specialty;
      const closed = item.status === "closed";
      return (
        <Pressable
          onPress={() => router.push(`/(app)/inbox/${item.id}` as any)}
          accessibilityRole="button"
          accessibilityLabel={`${doctorName}${unread > 0 ? `, ${unread} unread` : ""}`}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.fill : colors.surface,
            borderTopLeftRadius: isFirst ? radius.card : 0,
            borderTopRightRadius: isFirst ? radius.card : 0,
            borderBottomLeftRadius: isLast ? radius.card : 0,
            borderBottomRightRadius: isLast ? radius.card : 0,
            borderCurve: "continuous",
            borderLeftWidth: StyleSheet.hairlineWidth,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderTopWidth: isFirst ? StyleSheet.hairlineWidth : 0,
            borderBottomWidth: isLast ? StyleSheet.hairlineWidth : 0,
            borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
            ...(isFirst && scheme !== "dark" ? shadow.card : null),
          })}
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
            {/* Avatar with unread / active status dot */}
            <View>
              <Avatar
                name={doctorName}
                source={item.doctor?.photo ? { uri: item.doctor.photo } : undefined}
                size={52}
              />
              {!closed ? (
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: unread > 0 ? colors.primary : colors.success,
                    borderWidth: 2.5,
                    borderColor: colors.surface,
                  }}
                />
              ) : null}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                  numberOfLines={1}
                  style={[typography.title.md, { color: colors.text, flex: 1 }]}
                >
                  {doctorName}
                </Text>
                <Text
                  style={[
                    unread > 0 ? typography.label.sm : typography.caption,
                    { color: unread > 0 ? colors.primary : colors.textSubtle },
                  ]}
                >
                  {timeAgo(item.lastMessageAt)}
                </Text>
              </View>

              {specialty ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Stethoscope size={11} color={colors.primary} strokeWidth={2.4} />
                  <Text numberOfLines={1} style={[typography.label.sm, { color: colors.primary, flexShrink: 1 }]}>
                    {specialty}
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Text
                  numberOfLines={1}
                  style={[
                    unread > 0 ? typography.label.md : typography.body.sm,
                    { color: unread > 0 ? colors.text : colors.textMuted, flex: 1 },
                  ]}
                >
                  {item.lastMessageSender === "patient" ? (
                    <Text style={{ color: colors.textSubtle }}>
                      {t("patientInbox.you", { defaultValue: "You" })}:{" "}
                    </Text>
                  ) : null}
                  {item.lastMessagePreview || t("inbox.noMessagesYet", { defaultValue: "No messages yet" })}
                </Text>

                {closed ? (
                  <Pill label={t("inbox.closed", { defaultValue: "Closed" })} tone="warning" size="sm" />
                ) : unread > 0 ? (
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
                    <Text style={[typography.label.xs, { color: colors.onPrimary, letterSpacing: 0 }]}>
                      {unread > 99 ? "99+" : unread}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: colors.well,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.4} />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Inset divider aligned with the text column */}
          {!isLast ? (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.separator,
                marginLeft: spacing.lg + 52 + spacing.md,
              }}
            />
          ) : null}
        </Pressable>
      );
    },
    [colors, router, spacing, t, typography, radius, scheme, shadow, lastIndex]
  );

  const filterOptions = [
    { label: t("patientInbox.filterAll", { defaultValue: "All" }), value: "all" },
    {
      label:
        totalUnread > 0
          ? `${t("patientInbox.filterUnread", { defaultValue: "Unread" })} · ${totalUnread}`
          : t("patientInbox.filterUnread", { defaultValue: "Unread" }),
      value: "unread",
    },
  ];

  const listHeader = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <SearchField
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t("patientInbox.searchPlaceholder", { defaultValue: "Search doctors or messages" })}
      />
      <ChipGroup
        size="sm"
        options={filterOptions}
        value={filterUnreadOnly ? "unread" : "all"}
        onChange={(v: string) => setFilterUnreadOnly(v === "unread")}
      />
    </View>
  );

  const listEmpty = (
    <View style={{ alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.sm }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          borderCurve: "continuous",
          backgroundColor: colors.well,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {filterUnreadOnly && !searchQuery ? (
          <MessageSquare size={24} color={colors.textMuted} />
        ) : (
          <Search size={24} color={colors.textMuted} />
        )}
      </View>
      <Text style={[typography.title.sm, { color: colors.text }]}>
        {filterUnreadOnly && !searchQuery
          ? t("patientInbox.allCaughtUp", { defaultValue: "You're all caught up" })
          : t("patientInbox.noResults", { defaultValue: "No matching conversations" })}
      </Text>
    </View>
  );

  const listFooter = (
    <View style={{ gap: spacing.md, paddingTop: spacing.xl }}>
      {/* Privacy reassurance */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.card,
          borderCurve: "continuous",
          backgroundColor: withOpacity(colors.success, scheme === "dark" ? 0.12 : 0.07),
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            borderCurve: "continuous",
            backgroundColor: colors.successSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldCheck size={18} color={colors.success} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.label.md, { color: colors.text }]}>
            {t("patientInbox.privateTitle", { defaultValue: "Private & encrypted" })}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
            {t("patientInbox.privateBody", {
              defaultValue: "Only you and your care team can read these messages.",
            })}
          </Text>
        </View>
      </View>

      <Text style={[typography.kicker, { color: colors.textSubtle, textTransform: "uppercase", marginTop: spacing.sm, marginLeft: 2 }]}>
        {t("patientInbox.needHelp", { defaultValue: "Need something else?" })}
      </Text>
      <QuickActionCard
        icon={CalendarCheck}
        iconTint={colors.primary}
        iconBg={colors.primarySoft}
        title={t("patientInbox.bookTitle", { defaultValue: "Book an Appointment" })}
        subtitle={t("patientInbox.bookBody", { defaultValue: "In-person or video consultation" })}
        onPress={() => router.push("/(app)/book-appointment" as any)}
      />
      <QuickActionCard
        icon={Sparkles}
        iconTint={colors.accent}
        iconBg={colors.accentSoft}
        title={t("patientInbox.aiTitle", { defaultValue: "Ask AI Health Assistant" })}
        subtitle={t("patientInbox.aiBody", { defaultValue: "Instant 24/7 health guidance" })}
        badge={t("patientInbox.instant", { defaultValue: "Instant" })}
        onPress={() => router.push("/(app)/ai/chat" as any)}
      />
    </View>
  );

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={["top"]}
      tabBarOffset={true}
      style={{ backgroundColor: colors.bg }}
    >
      <LargeHeader
        kicker={
          totalUnread > 0
            ? t("patientInbox.unreadKicker", { count: totalUnread, defaultValue: "{{count}} unread" })
            : t("patientInbox.kicker", { defaultValue: "Care team" })
        }
        title={t("nav.tabs.messages", { defaultValue: "Messages" })}
        subtitle={t("patientInbox.subtitle", { defaultValue: "Direct messages from your doctors" })}
        right={
          <IconButton
            icon={Users}
            variant="surface"
            onPress={() => router.push("/(app)/care-team" as any)}
            accessibilityLabel={t("patientInbox.careTeam", { defaultValue: "View your care team" })}
          />
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
          <FlatList
            data={filteredConversations}
            keyExtractor={(c) => c.id}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            ListFooterComponent={listFooter}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.xs,
              paddingBottom: spacing.xxxxl,
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


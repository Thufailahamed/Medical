// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Send, Check, CheckCheck, Lock, Unlock, ShieldCheck, MessageCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useDoctorConversation,
  useSendDoctorMessage,
  useMarkConversationRead,
  useSetConversationStatus,
} from "@/hooks/useApi";
import { Screen, ErrorState, Skeleton, IconTile } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function ConversationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  const { colors, spacing, typography, fontFamily, scheme, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === "dark";
  const edge = isDark ? colors.borderStrong : colors.hairline;

  const { data, isLoading, isError, refetch } = useDoctorConversation(id);
  const sendMutation = useSendDoctorMessage(id);
  const markRead = useMarkConversationRead(id);
  const setStatus = useSetConversationStatus(id);

  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList>(null);
  const markedRef = useRef(false);

  // Mark read on mount.
  useEffect(() => {
    if (!markedRef.current && id) {
      markedRef.current = true;
      markRead.mutate();
    }
  }, [id, markRead]);

  const isClosed = data?.conversation?.status === "closed";

  const handleToggleStatus = useCallback(() => {
    if (isClosed) {
      Alert.alert(
        t("inbox.reopenTitle"),
        t("inbox.reopenBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("inbox.reopen"), onPress: () => setStatus.mutate("open") },
        ]
      );
    } else {
      Alert.alert(
        t("inbox.closeTitle"),
        t("inbox.closeBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("inbox.close"), style: "destructive", onPress: () => setStatus.mutate("closed") },
        ]
      );
    }
  }, [isClosed, setStatus, t]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      await sendMutation.mutateAsync(text);
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch {
      setDraft(text);
    }
  }, [draft, sendMutation]);

  const dayKey = (iso: string) => new Date(iso).toDateString();
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t("inbox.chatToday");
    if (d.toDateString() === yesterday.toDateString()) return t("inbox.chatYesterday");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  const renderBubble = ({ item, index }: { item: any; index: number }) => {
    const isMine = item.senderRole === "doctor";
    const list = data?.messages || [];
    const prev = list[index - 1];
    const next = list[index + 1];
    const newDay = !prev || dayKey(prev.createdAt) !== dayKey(item.createdAt);
    const groupedWithPrev = !newDay && prev.senderRole === item.senderRole;
    const groupedWithNext =
      !!next && next.senderRole === item.senderRole && dayKey(next.createdAt) === dayKey(item.createdAt);
    const R = 20;
    const TAIL = 6;
    return (
      <View>
        {newDay && (
          <View style={{ alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.xs }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: edge,
              }}
            >
              <Text style={[typography.label.xs, { color: colors.textMuted }]}>
                {dayLabel(item.createdAt)}
              </Text>
            </View>
          </View>
        )}
        <View
          style={{
            alignItems: isMine ? "flex-end" : "flex-start",
            marginTop: groupedWithPrev ? 2 : 10,
            paddingHorizontal: spacing.md,
          }}
        >
          <View
            style={[
              {
                maxWidth: "80%",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: R,
                borderCurve: "continuous",
                backgroundColor: isMine ? colors.primary : colors.surface,
                borderWidth: isMine ? 0 : StyleSheet.hairlineWidth,
                borderColor: edge,
                borderTopRightRadius: isMine && groupedWithPrev ? TAIL : R,
                // Sender-side corners tighten within a run; the last bubble keeps a tail corner.
                borderBottomRightRadius: isMine ? (groupedWithNext ? TAIL : 4) : R,
                borderTopLeftRadius: !isMine && groupedWithPrev ? TAIL : R,
                borderBottomLeftRadius: !isMine ? (groupedWithNext ? TAIL : 4) : R,
              },
              isDark ? null : shadow.xs,
            ]}
          >
            <Text
              style={[
                typography.body.md,
                {
                  fontSize: 16,
                  lineHeight: 21,
                  color: isMine ? colors.onPrimary : colors.text,
                },
              ]}
            >
              {item.body}
            </Text>
          </View>
          {!groupedWithNext && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                marginTop: 4,
                marginHorizontal: 6,
              }}
            >
              <Text
                style={[
                  typography.caption,
                  { fontSize: 11, color: colors.textSubtle, fontVariant: ["tabular-nums"] },
                ]}
              >
                {new Date(item.createdAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {isMine && (
                item.readAt ? (
                  <CheckCheck size={13} color={colors.primary} />
                ) : (
                  <Check size={13} color={colors.textSubtle} />
                )
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (!id) {
    return (
      <Screen padded={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text>{t("inbox.notFound")}</Text>
        </View>
      </Screen>
    );
  }

  const patient = data?.patient;
  const messages = data?.messages || [];
  const initials = (patient?.name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const firstName = (patient?.name || t("inbox.patientFallback")).split(" ")[0];
  const canSend = !!draft.trim() && !isClosed && !sendMutation.isPending;
  const starters = [
    t("inbox.starterCheckIn", { name: firstName }),
    t("inbox.starterReports"),
    t("inbox.starterFollowUp"),
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Screen padded={false} edges={["top"]} scroll={false} style={{ backgroundColor: colors.bg }}>
        {/* Header */}
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              paddingLeft: spacing.sm,
              paddingRight: spacing.md,
              paddingVertical: 10,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: edge,
              backgroundColor: colors.surface,
              zIndex: 2,
            },
            isDark ? null : shadow.xs,
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 19,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
              backgroundColor: pressed ? colors.fillStrong : colors.well,
            })}
          >
            <ChevronLeft size={22} color={colors.text} strokeWidth={2.4} />
          </Pressable>
          <View style={{ marginRight: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {patient?.photo ? (
                <Image source={{ uri: patient.photo }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <Text style={[typography.label.lg, { color: colors.primary }]}>
                  {initials}
                </Text>
              )}
            </View>
            <View
              style={{
                position: "absolute",
                right: -1,
                bottom: -1,
                width: 14,
                height: 14,
                borderRadius: 7,
                borderWidth: 2,
                borderColor: colors.surface,
                backgroundColor: isClosed ? colors.warning : colors.success,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[typography.title.md, { color: colors.text }]}
              numberOfLines={1}
            >
              {patient?.name || "…"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
              {isClosed ? (
                <Lock size={11} color={colors.warning} strokeWidth={2.4} />
              ) : (
                <ShieldCheck size={12} color={colors.success} strokeWidth={2.4} />
              )}
              <Text
                numberOfLines={1}
                style={[
                  typography.caption,
                  { color: isClosed ? colors.warning : colors.textMuted, fontVariant: ["tabular-nums"] },
                ]}
              >
                {isClosed
                  ? t("inbox.chatClosed")
                  : patient?.phone || t("inbox.patientFallback")}
              </Text>
            </View>
          </View>

          {/* Close / Reopen button */}
          <Pressable
            onPress={handleToggleStatus}
            disabled={setStatus.isPending}
            accessibilityRole="button"
            accessibilityLabel={isClosed ? t("inbox.reopen") : t("inbox.closeChat")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              height: 34,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: isClosed ? colors.primarySoft : colors.surface,
              borderWidth: isClosed ? 0 : StyleSheet.hairlineWidth,
              borderColor: isDark ? colors.borderStrong : colors.separator,
              opacity: pressed || setStatus.isPending ? 0.7 : 1,
              marginLeft: spacing.sm,
            })}
          >
            {setStatus.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isClosed ? (
              <>
                <Unlock size={13} color={colors.primary} strokeWidth={2.4} />
                <Text style={[typography.label.sm, { color: colors.primary }]}>
                  {t("inbox.reopen")}
                </Text>
              </>
            ) : (
              <>
                <Lock size={13} color={colors.textMuted} strokeWidth={2.4} />
                <Text style={[typography.label.sm, { color: colors.textMuted }]}>
                  {t("inbox.close")}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Closed banner */}
        {isClosed && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: colors.warningSoft, paddingHorizontal: spacing.lg, paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: edge,
          }}>
            <Lock size={14} color={colors.warning} />
            <Text style={[typography.body.sm, { color: colors.warning, flex: 1 }]}>
              {t("inbox.closedBanner")}
            </Text>
          </View>
        )}

        {/* Messages */}
        {isLoading ? (
          <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={{
                alignItems: i % 2 === 0 ? "flex-end" : "flex-start",
                marginVertical: 4,
              }}>
                <Skeleton width={`${55 + (i % 4) * 10}%`} height={38} radius={20} />
              </View>
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            title={t("inbox.errorTitle")}
            message={t("inbox.errorBody")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderBubble}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, paddingTop: spacing.xs, paddingBottom: spacing.lg }}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListHeaderComponent={
              messages.length > 0 ? (
                <View style={{ alignItems: "center", paddingTop: spacing.md }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: colors.successSoft,
                    }}
                  >
                    <ShieldCheck size={12} color={colors.success} strokeWidth={2.4} />
                    <Text style={[typography.label.xs, { color: colors.success }]}>
                      {t("inbox.secureNote")}
                    </Text>
                  </View>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.xl,
                }}
              >
                <IconTile icon={MessageCircle} tone="primary" appearance="solid" size={64} style={isDark ? null : shadow.primary} />
                <Text
                  style={[
                    typography.title.lg,
                    { color: colors.text, textAlign: "center", marginTop: spacing.lg },
                  ]}
                >
                  {t("inbox.emptyChatTitle")}
                </Text>
                <Text
                  style={[
                    typography.body.md,
                    { color: colors.textMuted, textAlign: "center", marginTop: 6, maxWidth: 300 },
                  ]}
                >
                  {t("inbox.emptyChatBody", { name: firstName })}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: spacing.md,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: colors.successSoft,
                  }}
                >
                  <ShieldCheck size={12} color={colors.success} strokeWidth={2.4} />
                  <Text style={[typography.label.xs, { color: colors.success }]}>
                    {t("inbox.secureNote")}
                  </Text>
                </View>

                {!isClosed && (
                  <View style={{ alignSelf: "stretch", marginTop: spacing.xl }}>
                    <Text
                      style={[
                        typography.label.xs,
                        {
                          color: colors.textSubtle,
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          marginBottom: spacing.sm,
                          textAlign: "center",
                        },
                      ]}
                    >
                      {t("inbox.quickStarters")}
                    </Text>
                    <View style={{ gap: 8 }}>
                      {starters.map((line) => (
                        <Pressable
                          key={line}
                          onPress={() => setDraft(line)}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            {
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              borderRadius: 16,
                              borderCurve: "continuous",
                              backgroundColor: colors.surface,
                              borderWidth: StyleSheet.hairlineWidth,
                              borderColor: edge,
                              opacity: pressed ? 0.75 : 1,
                              transform: [{ scale: pressed ? 0.98 : 1 }],
                            },
                            isDark ? null : shadow.xs,
                          ]}
                        >
                          <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
                            {line}
                          </Text>
                          <View
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 13,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: colors.well,
                            }}
                          >
                            <Send size={12} color={colors.primary} strokeWidth={2.4} />
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            }
          />
        )}

        {/* Composer */}
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: edge,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              minHeight: 46,
              paddingLeft: 16,
              paddingRight: 4,
              paddingVertical: 4,
              borderRadius: 23,
              borderCurve: "continuous",
              backgroundColor: colors.well,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: edge,
              opacity: isClosed ? 0.6 : 1,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder={isClosed ? t("inbox.closedPlaceholder") : t("inbox.composerPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              editable={!isClosed}
              style={{
                flex: 1,
                maxHeight: 120,
                paddingTop: 9,
                paddingBottom: 9,
                ...typography.body.md,
                fontSize: 16,
                lineHeight: 20,
                color: colors.text,
              }}
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              style={({ pressed }) => [
                {
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  marginLeft: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: canSend || sendMutation.isPending ? colors.primary : colors.fillStrong,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
                canSend && !isDark ? shadow.primary : null,
              ]}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Send
                  size={17}
                  color={canSend ? colors.onPrimary : colors.textSubtle}
                  strokeWidth={2.25}
                  style={{ marginLeft: -2, marginTop: 1 }}
                />
              )}
            </Pressable>
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

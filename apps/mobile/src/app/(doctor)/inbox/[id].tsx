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
import { ChevronLeft, Send, Check, CheckCheck, Lock, Unlock } from "lucide-react-native";
import {
  useDoctorConversation,
  useSendDoctorMessage,
  useMarkConversationRead,
  useSetConversationStatus,
} from "@/hooks/useApi";
import { Screen, ErrorState, Skeleton } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function ConversationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  const { colors, spacing, typography, fontFamily, scheme } = useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.separator;

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
        "Reopen chat?",
        "The patient will be able to send messages again.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Reopen", onPress: () => setStatus.mutate("open") },
        ]
      );
    } else {
      Alert.alert(
        "Close chat?",
        "The patient will see their messages as read-only and won't be able to reply.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Close", style: "destructive", onPress: () => setStatus.mutate("closed") },
        ]
      );
    }
  }, [isClosed, setStatus]);

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

  const renderBubble = ({ item, index }: { item: any; index: number }) => {
    const isMine = item.senderRole === "doctor";
    const list = data?.messages || [];
    const prev = list[index - 1];
    const next = list[index + 1];
    const groupedWithPrev = prev && prev.senderRole === item.senderRole;
    const groupedWithNext = next && next.senderRole === item.senderRole;
    const R = 20;
    const TAIL = 6;
    return (
      <View
        style={{
          alignItems: isMine ? "flex-end" : "flex-start",
          marginTop: groupedWithPrev ? 1 : 10,
          paddingHorizontal: spacing.md,
        }}
      >
        <View
          style={{
            maxWidth: "78%",
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: R,
            borderCurve: "continuous",
            backgroundColor: isMine ? colors.primary : colors.surface,
            borderWidth: isMine ? 0 : StyleSheet.hairlineWidth,
            borderColor: hairline,
            borderTopRightRadius: isMine && groupedWithPrev ? TAIL : R,
            // Sender-side corners tighten within a run; the last bubble keeps a tail corner.
            borderBottomRightRadius: isMine ? (groupedWithNext ? TAIL : 4) : R,
            borderTopLeftRadius: !isMine && groupedWithPrev ? TAIL : R,
            borderBottomLeftRadius: !isMine ? (groupedWithNext ? TAIL : 4) : R,
          }}
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            marginTop: 2,
            marginHorizontal: 6,
          }}
        >
          <Text
            style={[
              typography.caption,
              { fontSize: 10.5, color: colors.textSubtle, fontVariant: ["tabular-nums"] },
            ]}
          >
            {new Date(item.createdAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {isMine && (
            item.readAt ? (
              <CheckCheck size={12} color={colors.primary} />
            ) : (
              <Check size={12} color={colors.textSubtle} />
            )
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Screen padded={false} edges={["top"]} scroll={false} style={{ backgroundColor: colors.bg }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: hairline,
            backgroundColor: colors.surface,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 2,
              backgroundColor: pressed ? colors.fill : "transparent",
            })}
          >
            <ChevronLeft size={26} color={colors.primary} strokeWidth={2.4} />
          </Pressable>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              borderCurve: "continuous",
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
              overflow: "hidden",
            }}
          >
            {patient?.photo ? (
              <Image source={{ uri: patient.photo }} style={{ width: 38, height: 38, borderRadius: 19 }} />
            ) : (
              <Text style={[typography.label.md, { color: colors.primary }]}>
                {initials}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[typography.title.md, { color: colors.text }]}
              numberOfLines={1}
            >
              {patient?.name || "…"}
            </Text>
            <Text style={[typography.caption, { color: isClosed ? colors.warning : colors.textSubtle }]}>
              {isClosed ? "Chat closed" : patient?.phone || "Patient"}
            </Text>
          </View>

          {/* Close / Reopen button */}
          <Pressable
            onPress={handleToggleStatus}
            disabled={setStatus.isPending}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: isClosed ? colors.primarySoft : colors.fill,
              opacity: pressed || setStatus.isPending ? 0.7 : 1,
              marginLeft: spacing.sm,
              marginRight: spacing.xs,
            })}
          >
            {setStatus.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isClosed ? (
              <>
                <Unlock size={13} color={colors.primary} />
                <Text style={[typography.label.sm, { color: colors.primary }]}>
                  Reopen
                </Text>
              </>
            ) : (
              <>
                <Lock size={13} color={colors.textMuted} />
                <Text style={[typography.label.sm, { color: colors.textMuted }]}>
                  Close Chat
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Closed banner */}
        {isClosed && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 8,
            backgroundColor: colors.warningSoft, paddingHorizontal: spacing.lg, paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline,
          }}>
            <Lock size={14} color={colors.warning} />
            <Text style={[typography.body.sm, { color: colors.warning, flex: 1 }]}>
              Chat is closed. Patient cannot send new messages. Tap "Reopen" to re-enable replies.
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
            contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.lg }}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ padding: spacing.xl, alignItems: "center" }}>
                <Text style={[typography.body.sm, { color: colors.textSubtle, textAlign: "center" }]}>
                  {t("inbox.noMessagesYet")}
                </Text>
              </View>
            }
          />
        )}

        {/* Composer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: hairline,
            backgroundColor: colors.surface,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder={isClosed ? "Chat is closed — reopen to send messages" : t("inbox.composerPlaceholder")}
            placeholderTextColor={colors.textSubtle}
            editable={!isClosed}
            style={{
              flex: 1,
              minHeight: 38,
              maxHeight: 120,
              borderRadius: 19,
              borderCurve: "continuous",
              paddingHorizontal: 14,
              paddingVertical: 9,
              paddingTop: 9,
              ...typography.body.md,
              fontSize: 16,
              lineHeight: 20,
              color: colors.text,
              backgroundColor: colors.fill,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: hairline,
              opacity: isClosed ? 0.5 : 1,
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sendMutation.isPending || isClosed}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 19,
              borderCurve: "continuous",
              marginLeft: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: draft.trim() && !isClosed ? colors.primary : colors.fill,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Send
                size={17}
                color={draft.trim() && !isClosed ? colors.onPrimary : colors.textSubtle}
                strokeWidth={2.25}
              />
            )}
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

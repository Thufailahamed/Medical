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
import { Screen } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function ConversationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  const { colors, spacing, typography, fontFamily } = useTheme();

  const { data, isLoading } = useDoctorConversation(id);
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

  const renderBubble = ({ item }: { item: any }) => {
    const isMine = item.senderRole === "doctor";
    return (
      <View
        style={{
          alignItems: isMine ? "flex-end" : "flex-start",
          marginVertical: 3,
          paddingHorizontal: spacing.lg,
        }}
      >
        <View
          style={{
            maxWidth: "78%",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 18,
            backgroundColor: isMine ? colors.primary : colors.surfaceMuted,
            borderTopRightRadius: isMine ? 4 : 18,
            borderTopLeftRadius: isMine ? 18 : 4,
          }}
        >
          <Text
            style={{
              color: isMine ? "#FFFFFF" : colors.text,
              fontSize: 15,
              lineHeight: 21,
              fontFamily: fontFamily.body,
            }}
          >
            {item.body}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            marginTop: 3,
            marginHorizontal: 4,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: colors.textSubtle,
              fontFamily: fontFamily.body,
            }}
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
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.sm,
              backgroundColor: pressed ? colors.surfaceMuted : "transparent",
            })}
          >
            <ChevronLeft size={22} color={colors.primary} />
          </Pressable>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.sm,
              overflow: "hidden",
            }}
          >
            {patient?.photo ? (
              <Image source={{ uri: patient.photo }} style={{ width: 36, height: 36, borderRadius: 18 }} />
            ) : (
              <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13, fontFamily: fontFamily.displayBold }}>
                {initials}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
              numberOfLines={1}
            >
              {patient?.name || "…"}
            </Text>
            <Text style={{ fontSize: 11, color: isClosed ? "#B45309" : colors.textSubtle }}>
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
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: isClosed ? colors.primarySoft : "#FEF3C7",
              opacity: pressed || setStatus.isPending ? 0.7 : 1,
              marginLeft: spacing.sm,
            })}
          >
            {setStatus.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isClosed ? (
              <>
                <Unlock size={13} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary, fontFamily: fontFamily.bodyBold }}>
                  Reopen
                </Text>
              </>
            ) : (
              <>
                <Lock size={13} color="#92400E" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#92400E", fontFamily: fontFamily.bodyBold }}>
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
            backgroundColor: "#FEF3C7", paddingHorizontal: spacing.lg, paddingVertical: 10,
            borderBottomWidth: 1, borderBottomColor: "#FCD34D",
          }}>
            <Lock size={14} color="#92400E" />
            <Text style={{ color: "#92400E", fontSize: 13, fontFamily: fontFamily.body, flex: 1 }}>
              Chat is closed. Patient cannot send new messages. Tap "Reopen" to re-enable replies.
            </Text>
          </View>
        )}

        {/* Messages */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderBubble}
            contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: spacing.xl }}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ padding: spacing.xl, alignItems: "center" }}>
                <Text style={{ color: colors.textSubtle, textAlign: "center" }}>
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
            borderTopWidth: 1,
            borderTopColor: colors.border,
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
              minHeight: 40,
              maxHeight: 120,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 10,
              paddingTop: 10,
              fontSize: 15,
              color: colors.text,
              fontFamily: fontFamily.body,
              backgroundColor: isClosed ? colors.border : colors.surfaceMuted,
              lineHeight: 20,
              opacity: isClosed ? 0.5 : 1,
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sendMutation.isPending || isClosed}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              marginLeft: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: draft.trim() && !isClosed ? colors.primary : colors.surfaceMuted,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Send
                size={18}
                color={draft.trim() && !isClosed ? "#FFFFFF" : colors.textSubtle}
                strokeWidth={2.25}
              />
            )}
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

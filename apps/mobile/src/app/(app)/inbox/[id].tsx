// @ts-nocheck
// Patient-side conversation view.
// - Reads messages from /patient-messages/conversations/:id/messages
// - Allows patient to send replies ONLY when conversation.status === "open"
// - Shows a read-only banner if the doctor has closed the thread

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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Send, Check, CheckCheck, Lock } from "lucide-react-native";
import {
  usePatientConversation,
  useSendPatientMessage,
  useMarkPatientConversationRead,
} from "@/hooks/useApi";
import { Screen, ErrorState, Skeleton } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function PatientConversationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  const { colors, spacing, typography, fontFamily } = useTheme();

  const { data, isLoading, isError, refetch } = usePatientConversation(id);
  const sendMutation = useSendPatientMessage(id);
  const markRead = useMarkPatientConversationRead(id);

  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (!markedRef.current && id) {
      markedRef.current = true;
      markRead.mutate();
    }
  }, [id]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      await sendMutation.mutateAsync(text);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setDraft(text);
    }
  }, [draft, sendMutation]);

  const renderBubble = ({ item }: { item: any }) => {
    const isMine = item.senderRole === "patient";
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
          <Text style={{ color: isMine ? "#FFFFFF" : colors.text, fontSize: 15, lineHeight: 21, fontFamily: fontFamily.body }}>
            {item.body}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3, marginHorizontal: 4 }}>
          <Text style={{ fontSize: 10, color: colors.textSubtle, fontFamily: fontFamily.body }}>
            {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </Text>
          {isMine && (item.readAt
            ? <CheckCheck size={12} color={colors.primary} />
            : <Check size={12} color={colors.textSubtle} />
          )}
        </View>
      </View>
    );
  };

  if (!id) return null;

  const doctor = data?.doctor;
  const messages = data?.messages || [];
  const isClosed = data?.conversation?.status === "closed";
  const initials = (doctor?.name || "Dr")
    .split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen padded={false} edges={["top"]} scroll={false} style={{ backgroundColor: colors.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
          borderBottomWidth: 1, borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18, alignItems: "center",
              justifyContent: "center", marginRight: spacing.sm,
              backgroundColor: pressed ? colors.surfaceMuted : "transparent",
            })}
          >
            <ChevronLeft size={22} color={colors.primary} />
          </Pressable>
          <View style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft,
            alignItems: "center", justifyContent: "center", marginRight: spacing.sm, overflow: "hidden",
          }}>
            {doctor?.photo
              ? <Image source={{ uri: doctor.photo }} style={{ width: 36, height: 36, borderRadius: 18 }} />
              : <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13, fontFamily: fontFamily.displayBold }}>{initials}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, fontFamily: fontFamily.bodyBold }} numberOfLines={1}>
              {doctor?.name || "Your Doctor"}
            </Text>
            <Text style={{ fontSize: 11, color: isClosed ? colors.danger ?? "#E53E3E" : colors.textSubtle }}>
              {isClosed ? "Chat closed by doctor" : "Online"}
            </Text>
          </View>
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
              This conversation has been closed by your doctor. You can read past messages but cannot send new ones.
            </Text>
          </View>
        )}

        {/* Messages */}
        {isLoading ? (
          <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={{
                alignItems: i % 2 === 0 ? "flex-start" : "flex-end",
                marginVertical: 4,
              }}>
                <Skeleton width={`${55 + (i % 4) * 10}%`} height={36} radius={18} />
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
            contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: spacing.xl }}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ padding: spacing.xl, alignItems: "center" }}>
                <Text style={{ color: colors.textSubtle, textAlign: "center" }}>No messages yet</Text>
              </View>
            }
          />
        )}

        {/* Composer — disabled if closed */}
        {!isClosed ? (
          <View style={{
            flexDirection: "row", alignItems: "flex-end",
            paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.lg,
            borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
          }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder="Type a reply…"
              placeholderTextColor={colors.textSubtle}
              style={{
                flex: 1, minHeight: 40, maxHeight: 120,
                borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
                paddingTop: 10, fontSize: 15, color: colors.text,
                fontFamily: fontFamily.body, backgroundColor: colors.surfaceMuted, lineHeight: 20,
              }}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sendMutation.isPending}
              style={({ pressed }) => ({
                width: 40, height: 40, borderRadius: 20, marginLeft: 8,
                alignItems: "center", justifyContent: "center",
                backgroundColor: draft.trim() ? colors.primary : colors.surfaceMuted,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {sendMutation.isPending
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Send size={18} color={draft.trim() ? "#FFFFFF" : colors.textSubtle} strokeWidth={2.25} />
              }
            </Pressable>
          </View>
        ) : (
          /* Locked footer when conversation is closed */
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center",
            paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
            backgroundColor: colors.surfaceMuted, gap: 6,
          }}>
            <Lock size={14} color={colors.textSubtle} />
            <Text style={{ color: colors.textSubtle, fontSize: 13, fontFamily: fontFamily.body }}>
              Replies disabled — conversation closed
            </Text>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

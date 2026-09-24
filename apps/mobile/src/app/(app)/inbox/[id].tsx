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
  StyleSheet,
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
  const { colors, spacing, typography, fontFamily, scheme } = useTheme();
  const theirBubble = scheme === "dark" ? colors.surfaceElevated : colors.surface;
  const barBg = scheme === "dark" ? colors.bgElevated : colors.surface;

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
          marginVertical: 4,
          paddingHorizontal: spacing.md,
        }}
      >
        <View
          style={{
            maxWidth: "80%",
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 20,
            borderCurve: "continuous",
            backgroundColor: isMine ? colors.primary : theirBubble,
            borderBottomRightRadius: isMine ? 6 : 20,
            borderBottomLeftRadius: isMine ? 20 : 6,
            borderWidth: isMine || scheme === "dark" ? 0 : StyleSheet.hairlineWidth,
            borderColor: colors.separator,
          }}
        >
          <Text style={{ color: isMine ? colors.onPrimary : colors.text, fontSize: 16, lineHeight: 22, letterSpacing: -0.2, fontFamily: fontFamily.body }}>
            {item.body}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4, marginHorizontal: 8 }}>
          <Text style={[typography.caption, { fontSize: 11, lineHeight: 14, color: colors.textSubtle }]}>
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
          paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator,
          backgroundColor: barBg,
        }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40, height: 40, borderRadius: 20, alignItems: "center",
              justifyContent: "center", marginRight: spacing.sm,
              backgroundColor: pressed ? colors.fillStrong : colors.fill,
            })}
          >
            <ChevronLeft size={22} color={colors.text} strokeWidth={2.4} />
          </Pressable>
          <View style={{
            width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft,
            alignItems: "center", justifyContent: "center", marginRight: spacing.md, overflow: "hidden",
          }}>
            {doctor?.photo
              ? <Image source={{ uri: doctor.photo }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              : <Text style={[typography.label.lg, { color: colors.primary, fontFamily: fontFamily.displayBold }]}>{initials}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
              {doctor?.name || "Your Doctor"}
            </Text>
            <Text style={[typography.caption, { color: isClosed ? colors.danger : colors.textSubtle, marginTop: 1 }]}>
              {isClosed ? "Chat closed by doctor" : "Online"}
            </Text>
          </View>
        </View>

        {/* Closed banner */}
        {isClosed && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: colors.warningSoft, marginHorizontal: spacing.md, marginTop: spacing.md,
            paddingHorizontal: spacing.md, paddingVertical: spacing.md,
            borderRadius: 16, borderCurve: "continuous",
          }}>
            <Lock size={15} color={colors.warning} strokeWidth={2.4} />
            <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
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
                marginVertical: 5,
              }}>
                <Skeleton width={`${55 + (i % 4) * 10}%`} height={40} radius={20} />
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
                <Text style={[typography.body.sm, { color: colors.textSubtle, textAlign: "center" }]}>No messages yet</Text>
              </View>
            }
          />
        )}

        {/* Composer — disabled if closed */}
        {!isClosed ? (
          <View style={{
            flexDirection: "row", alignItems: "flex-end",
            paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.lg,
            borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, backgroundColor: barBg,
          }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder="Type a reply…"
              placeholderTextColor={colors.textSubtle}
              style={{
                flex: 1, minHeight: 40, maxHeight: 120,
                borderRadius: 20, borderCurve: "continuous", paddingHorizontal: 16, paddingVertical: 10,
                paddingTop: 10, fontSize: 16, color: colors.text,
                fontFamily: fontFamily.body, backgroundColor: colors.fill, lineHeight: 20,
                borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator,
              }}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sendMutation.isPending}
              style={({ pressed }) => ({
                width: 40, height: 40, borderRadius: 20, marginLeft: 8,
                alignItems: "center", justifyContent: "center",
                backgroundColor: draft.trim() ? colors.primary : colors.fill,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              })}
            >
              {sendMutation.isPending
                ? <ActivityIndicator color={colors.onPrimary} size="small" />
                : <Send size={18} color={draft.trim() ? colors.onPrimary : colors.textSubtle} strokeWidth={2.25} />
              }
            </Pressable>
          </View>
        ) : (
          /* Locked footer when conversation is closed */
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center",
            paddingTop: spacing.md, paddingBottom: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator,
            backgroundColor: barBg, gap: 6,
          }}>
            <Lock size={14} color={colors.textSubtle} />
            <Text style={[typography.body.sm, { color: colors.textSubtle }]}>
              Replies disabled — conversation closed
            </Text>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

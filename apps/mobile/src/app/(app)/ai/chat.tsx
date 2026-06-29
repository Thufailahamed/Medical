import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput as RNTextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Plus,
  Send,
  Trash2,
  MessageSquare,
  Sparkles,
} from "lucide-react-native";
import {
  useChatSessions,
  useCreateChatSession,
  useChatMessages,
  useSendChat,
  useDeleteChatSession,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  Skeleton,
  Pill as PillCmp,
  useToast,
} from "@/components/ui";

function fmtTime(d: string) {
  try {
    const dt = new Date(d);
    return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function fmtWhen(d: string) {
  try {
    const dt = new Date(d);
    const now = new Date();
    const diff = (now.getTime() - dt.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return dt.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export default function AiChatScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const sessions = useChatSessions();
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const messages = useChatMessages(activeId);
  const send = useSendChat();

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const len = messages.data?.messages?.length || 0;
    if (scrollRef.current && len > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.data?.messages?.length, send.isPending]);

  async function startNew() {
    try {
      const res = await createSession.mutateAsync({ title: "New chat" });
      setActiveId(res.session.id);
      setDraft("");
    } catch (err: any) {
      toast.show(err?.message || "Could not start chat", "danger");
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (!activeId) {
      try {
        const res = await createSession.mutateAsync({ title: text });
        setActiveId(res.session.id);
        try {
          await send.mutateAsync({ sessionId: res.session.id, content: text });
        } catch (err: any) {
          toast.show(err?.message || "Could not send", "danger");
        }
      } catch (err: any) {
        toast.show(err?.message || "Could not start chat", "danger");
      }
      return;
    }
    try {
      await send.mutateAsync({ sessionId: activeId, content: text });
    } catch (err: any) {
      toast.show(err?.message || "Could not send", "danger");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSession.mutateAsync(id);
      if (activeId === id) setActiveId(null);
    } catch (err: any) {
      toast.show(err?.message || "Could not delete", "danger");
    }
  }

  const list = (sessions.data?.sessions || []) as any[];

  // ─── THREAD VIEW ─────────────────────────────────────────
  if (activeId) {
    const msgList = (messages.data?.messages || []) as any[];
    const sending = send.isPending;
    const canSend = draft.trim().length > 0 && !sending;

    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <ScreenHeader
          back
          onBack={() => setActiveId(null)}
          title="Health Q&A"
          subtitle="AI chat with patient context"
          right={
            <PillCmp icon={Sparkles} label="AI" tone="accent" size="sm" />
          }
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
              gap: spacing.sm,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.isLoading ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={56} radius={16} />
                <Skeleton height={56} radius={16} />
                <Skeleton height={56} radius={16} />
              </View>
            ) : msgList.length === 0 ? (
              <View style={{ paddingTop: spacing.xxl }}>
                <EmptyState
                  icon={MessageSquare}
                  title="Ask anything"
                  message="Type a question to begin."
                />
              </View>
            ) : (
              msgList.map((m, idx) => {
                const isUser = m.role === "user";
                const prev = msgList[idx - 1];
                const sameAuthor = prev && prev.role === m.role;
                return (
                  <Bubble
                    key={m.id ?? idx}
                    isUser={isUser}
                    content={m.content}
                    showMeta={!sameAuthor}
                    meta={`${isUser ? "You" : "AI"} · ${fmtTime(m.createdAt)}`}
                  />
                );
              })
            )}
            {sending ? (
              <View style={{ alignSelf: "flex-start" }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    backgroundColor: colors.surface,
                    borderRadius: 18,
                    borderTopLeftRadius: 6,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    numberOfLines={1}
                    style={[typography.body.sm, { color: colors.textMuted }]}
                  >
                    Thinking…
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Composer */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.bgElevated,
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 44,
                borderRadius: 22,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                justifyContent: "center",
              }}
            >
              <RNTextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask a health question…"
                placeholderTextColor={colors.textSubtle}
                style={{
                  padding: 0,
                  margin: 0,
                  color: colors.text,
                  fontSize: 15,
                  lineHeight: 20,
                  minHeight: 24,
                  maxHeight: 120,
                  textAlignVertical: "center",
                }}
                multiline
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                returnKeyType="send"
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              hitSlop={6}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                opacity: canSend ? 1 : 0.45,
              }}
            >
              <Send size={18} color={colors.onPrimary} strokeWidth={2.4} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // ─── SESSION LIST ────────────────────────────────────────
  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Health chat"
        subtitle="AI Q&A with your patient context"
        right={
          <PillCmp icon={Sparkles} label="AI" tone="accent" size="sm" />
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Button
          title="Start new chat"
          icon={Plus}
          size="lg"
          fullWidth={false}
          onPress={startNew}
          loading={createSession.isPending}
        />

        {sessions.isLoading ? (
          <View style={{ gap: spacing.md }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={72} radius={16} />
            ))}
          </View>
        ) : list.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No chats yet"
            message="Start a new chat to ask anything."
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {list.map((s) => (
              <SessionRow
                key={s.id}
                title={s.title || "Health Q&A"}
                when={s.updatedAt ? fmtWhen(s.updatedAt) : "Tap to open"}
                onPress={() => setActiveId(s.id)}
                onDelete={() => handleDelete(s.id)}
              />
            ))}
          </View>
        )}

        <Text
          numberOfLines={2}
          style={[
            typography.caption,
            { color: colors.textSubtle, textAlign: "center" },
          ]}
        >
          AI can make mistakes. Confirm important info with your doctor.
        </Text>
      </ScrollView>
    </Screen>
  );
}

// ─── Bubble ──────────────────────────────────────────────
function Bubble({
  isUser,
  content,
  showMeta,
  meta,
}: {
  isUser: boolean;
  content: string;
  showMeta: boolean;
  meta: string;
}) {
  const { spacing, colors, typography } = useTheme();

  // Asymmetric radius: 18 corners, 6 on the side facing the speaker
  const bubbleRadius = isUser
    ? {
        borderTopRightRadius: 6,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
      }
    : {
        borderTopLeftRadius: 6,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
      };

  return (
    <View
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "85%",
        gap: 4,
      }}
    >
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: isUser ? colors.primary : colors.surface,
          borderWidth: isUser ? 0 : 1,
          borderColor: colors.border,
          ...bubbleRadius,
        }}
      >
        <Text
          style={[
            typography.body.sm,
            {
              color: isUser ? colors.onPrimary : colors.text,
              lineHeight: 20,
            },
          ]}
        >
          {content}
        </Text>
      </View>
      {showMeta ? (
        <Text
          numberOfLines={1}
          style={[
            typography.caption,
            {
              color: colors.textSubtle,
              alignSelf: isUser ? "flex-end" : "flex-start",
              paddingHorizontal: 4,
            },
          ]}
        >
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Session row ─────────────────────────────────────────
function SessionRow({
  title,
  when,
  onPress,
  onDelete,
}: {
  title: string;
  when: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { spacing, colors, typography } = useTheme();

  // Uniform icon-button height so avatar and trash button align center-to-center
  const ICON_SIZE = 44;

  return (
    <Card padded={false} onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <View
          style={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: 14,
            backgroundColor: colors.accentSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageSquare
            size={20}
            color={colors.accent}
            strokeWidth={2.25}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={[typography.title.sm, { color: colors.text }]}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[typography.caption, { color: colors.textMuted }]}
          >
            {when}
          </Text>
        </View>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete chat"
          style={({ pressed }) => ({
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: ICON_SIZE / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          })}
        >
          <Trash2 size={18} color={colors.danger} strokeWidth={2.25} />
        </Pressable>
      </View>
    </Card>
  );
}
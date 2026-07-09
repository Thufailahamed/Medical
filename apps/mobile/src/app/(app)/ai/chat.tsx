// @ts-nocheck

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput as RNTextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate, intlLocale } from "@/lib/format";

function intlLocaleFromTag(l: string) {
  return intlLocale(l as any);
}
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
import { apiSse } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Pill as PillCmp,
  useToast,
} from "@/components/ui";

function fmtTime(d: string, locale: string) {
  try {
    const dt = new Date(d);
    return new Intl.DateTimeFormat(intlLocaleFromTag(locale), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dt);
  } catch {
    return "";
  }
}

function fmtWhen(t: (k: string, opts?: any) => string, d: string, locale: string) {
  try {
    const dt = new Date(d);
    const now = new Date();
    const diff = (now.getTime() - dt.getTime()) / 1000;
    if (diff < 60) return t("aiChat.whenJustNow");
    if (diff < 3600) return t("aiChat.whenMinutes", { count: Math.floor(diff / 60) });
    if (diff < 86400) return t("aiChat.whenHours", { count: Math.floor(diff / 3600) });
    if (diff < 604800) return t("aiChat.whenDays", { count: Math.floor(diff / 86400) });
    return new Intl.DateTimeFormat(intlLocaleFromTag(locale), {
      day: "numeric",
      month: "short",
    }).format(dt);
  } catch {
    return "";
  }
}

export default function AiChatScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
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

  // Streamed-reply state: while the model is generating, mirror the
  // accumulating draft so the user sees tokens appear incrementally
  // instead of a 25 s spinner. The persisted assistant message is
  // appended automatically once the SSE `done` event fires (via
  // query invalidation in the hook).
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null);

  useEffect(() => {
    const len = messages.data?.messages?.length || 0;
    if (scrollRef.current && len > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.data?.messages?.length, send.isPending]);

  async function startNew() {
    try {
      const res = await createSession.mutateAsync({ title: t("aiChat.newChatTitle") });
      setActiveId(res.session.id);
      setDraft("");
    } catch (err: any) {
      toast.show(err?.message || t("aiChat.createError"), "danger");
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");

    // Resolve a session id — create one if this is the first message.
    let sessionId = activeId;
    if (!sessionId) {
      try {
        const res = await createSession.mutateAsync({ title: text });
        sessionId = res.session.id;
        setActiveId(sessionId);
      } catch (err: any) {
        toast.show(err?.message || t("aiChat.createError"), "danger");
        return;
      }
    }

    if (!sessionId) return;

    // Stream the reply via SSE. On each `delta` chunk append to the
    // local draft; on `done` clear the draft and let the query layer
    // re-fetch the canonical assistant row. Falls back to the JSON
    // `send` mutation if the SSE endpoint is unavailable.
    setStreamingText("");
    setStreamingSessionId(sessionId);
    try {
      await new Promise<void>((resolve, reject) => {
        const conn = apiSse(
          `/chat/sessions/${sessionId}/messages/stream`,
          { method: "POST", body: { content: text } },
          (e) => {
            try {
              const payload = e.data ? JSON.parse(e.data) : {};
              if (e.event === "delta" && typeof payload.delta === "string") {
                setStreamingText((prev) => (prev ?? "") + payload.delta);
              } else if (e.event === "user") {
                // Optimistically invalidate so the user's own bubble
                // renders immediately even before the server commits.
                // (The user row is already persisted server-side.)
                messages.refetch?.();
              } else if (e.event === "done") {
                // Pull the persisted assistant row + updated session
                // title so the streaming draft can be replaced by
                // the canonical server-rendered bubble.
                try {
                  messages.refetch?.();
                } catch {
                  /* ignore */
                }
                resolve();
              } else if (e.event === "error") {
                reject(new Error(payload.error || "stream error"));
              }
            } catch (parseErr) {
              // Ignore malformed lines.
            }
          }
        );
        conn.done.catch(reject);
      });
    } catch (err: any) {
      // Fallback: try the non-streaming endpoint.
      try {
        await send.mutateAsync({ sessionId, content: text });
      } catch (err2: any) {
        toast.show(err2?.message || t("aiChat.sendError"), "danger");
      }
    } finally {
      setStreamingText(null);
      setStreamingSessionId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSession.mutateAsync(id);
      if (activeId === id) setActiveId(null);
    } catch (err: any) {
      toast.show(err?.message || t("aiChat.deleteError"), "danger");
    }
  }

  const list = (sessions.data?.sessions || []) as any[];

  // ─── THREAD VIEW ─────────────────────────────────────────
  if (activeId) {
    const msgList = (messages.data?.messages || []) as any[];
    const sending = send.isPending || streamingSessionId === activeId;
    const canSend = draft.trim().length > 0 && !sending;

    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <ScreenHeader
          back
          onBack={() => setActiveId(null)}
          title={t("aiChat.title")}
          subtitle={t("aiChat.subtitle")}
          right={
            <PillCmp icon={Sparkles} label={t("aiChat.aiPill")} tone="accent" size="sm" />
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
            ) : messages.isError ? (
              <ErrorState
                title={t("common.errorTitle")}
                message={t("common.errorLoad")}
                actionLabel={t("common.retry")}
                onAction={() => messages.refetch?.()}
              />
            ) : msgList.length === 0 ? (
              <View style={{ paddingTop: spacing.xxl }}>
                <EmptyState
                  icon={MessageSquare}
                  title={t("aiChat.emptyTitle")}
                  message={t("aiChat.emptyBody")}
                />
              </View>
            ) : (
              msgList.map((m, idx) => {
                const isUser = m.role === "user";
                const prev = msgList[idx - 1];
                const sameAuthor = prev && prev.role === m.role;
                const authorLabel = isUser ? t("aiChat.youLabel") : t("aiChat.aiLabel");
                return (
                  <Bubble
                    key={m.id ?? idx}
                    isUser={isUser}
                    content={m.content}
                    showMeta={!sameAuthor}
                    meta={t("aiChat.metaFormat", {
                      author: authorLabel,
                      time: fmtTime(m.createdAt, locale),
                    })}
                  />
                );
              })
            )}
            {streamingSessionId === activeId && streamingText != null ? (
              <Bubble
                isUser={false}
                content={streamingText || t("aiChat.thinking")}
                showMeta={true}
                meta={t("aiChat.metaFormat", {
                  author: t("aiChat.aiLabel"),
                  time: "",
                })}
              />
            ) : sending ? (
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
                  <Skeleton width={80} height={14} radius={7} />
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
                placeholder={t("aiChat.inputPlaceholder")}
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
              accessibilityLabel={t("aiChat.sendA11y")}
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
        title={t("aiChat.listTitle")}
        subtitle={t("aiChat.listSubtitle")}
        right={
          <PillCmp icon={Sparkles} label={t("aiChat.aiPill")} tone="accent" size="sm" />
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
          title={t("aiChat.startNew")}
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
        ) : sessions.isError ? (
          <ErrorState
            title={t("common.errorTitle")}
            message={t("common.errorLoad")}
            actionLabel={t("common.retry")}
            onAction={() => sessions.refetch?.()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={t("aiChat.listEmptyTitle")}
            message={t("aiChat.listEmptyBody")}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {list.map((s) => (
              <SessionRow
                key={s.id}
                title={s.title || t("aiChat.sessionFallbackTitle")}
                when={
                  s.updatedAt
                    ? fmtWhen(t, s.updatedAt, locale)
                    : t("aiChat.sessionFallbackWhen")
                }
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
          {t("aiChat.disclaimer")}
        </Text>
      </ScrollView>
    </Screen>
  );
}

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
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

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
          accessibilityLabel={t("aiChat.sessionDeleteA11y")}
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
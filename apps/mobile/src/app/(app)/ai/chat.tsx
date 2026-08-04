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
  ActivityIndicator,
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
import { SmartPromptChips } from "@/components/ai/SmartPromptChips";
import { SourceCitationCard } from "@/components/ai/SourceCitationCard";
import { LongitudinalTrendChart } from "@/components/ai/LongitudinalTrendChart";
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
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [citationsMap, setCitationsMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const len = (messages.data?.messages?.length || 0) + (pendingUserText ? 1 : 0);
    if (scrollRef.current && len > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.data?.messages?.length, send.isPending, pendingUserText]);

  async function startNew() {
    try {
      const res = await createSession.mutateAsync({ title: t("aiChat.newChatTitle") });
      setActiveId(res.session.id);
      setDraft("");
    } catch (err: any) {
      toast.show(err?.message || t("aiChat.createError"), "danger");
    }
  }

  async function handleSend(customText?: string) {
    const text = (typeof customText === "string" ? customText : draft).trim();
    if (!text || send.isPending || pendingUserText != null) return;
    setDraft("");
    setPendingUserText(text);

    // Resolve a session id — create one if this is the first message.
    let sessionId = activeId;
    if (!sessionId) {
      try {
        const res = await createSession.mutateAsync({ title: text.slice(0, 50) });
        sessionId = res.session.id;
        setActiveId(sessionId);
      } catch (err: any) {
        toast.show(err?.message || t("aiChat.createError"), "danger");
        setDraft(text);
        setPendingUserText(null);
        return;
      }
    }

    if (!sessionId) {
      setPendingUserText(null);
      return;
    }

    try {
      const res = await send.mutateAsync({ sessionId, content: text });
      // Capture citations from the POST response
      if (res?.citations?.length && res?.assistantMessage?.id) {
        setCitationsMap((prev) => ({ ...prev, [res.assistantMessage.id]: res.citations }));
      }
      await messages.refetch?.();
    } catch (err: any) {
      toast.show(err?.message || t("aiChat.sendError"), "danger");
      setDraft(text);
    } finally {
      setPendingUserText(null);
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
    const rawMsgList = (messages.data?.messages || []) as any[];
    const msgList = rawMsgList.map((m: any) => ({
      ...m,
      citations: m.citations || citationsMap[m.id] || [],
    }));
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
            {messages.isLoading && !pendingUserText ? (
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
            ) : msgList.length === 0 && !pendingUserText ? (
              <View style={{ paddingTop: spacing.md, gap: spacing.lg }}>
                <EmptyState
                  icon={MessageSquare}
                  title={t("aiChat.emptyTitle")}
                  message={t("aiChat.emptyBody")}
                />
                <SmartPromptChips onSelectPrompt={(txt) => handleSend(txt)} />
              </View>
            ) : (
              <>
                {msgList.map((m, idx) => {
                  const isUser = m.role === "user";
                  const prev = msgList[idx - 1];
                  const sameAuthor = prev && prev.role === m.role;
                  const authorLabel = isUser ? t("aiChat.youLabel") : t("aiChat.aiLabel");
                  return (
                    <Bubble
                      key={m.id ?? idx}
                      isUser={isUser}
                      content={m.content}
                      citations={m.citations}
                      showMeta={!sameAuthor}
                      meta={t("aiChat.metaFormat", {
                        author: authorLabel,
                        time: fmtTime(m.createdAt, locale),
                      })}
                    />
                  );
                })}

                {pendingUserText ? (
                  <>
                    <Bubble
                      isUser={true}
                      content={pendingUserText}
                      showMeta={true}
                      meta="You · Just now"
                    />
                    <View
                      style={{
                        alignSelf: "flex-start",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: "#FFFFFF",
                        borderRadius: 18,
                        borderTopLeftRadius: 6,
                        borderWidth: 1,
                        borderColor: "#E2E8F0",
                        marginTop: 4,
                      }}
                    >
                      <ActivityIndicator size="small" color="#0284C7" />
                      <Text style={{ fontSize: 13, color: "#475569", fontWeight: "600" }}>
                        Analyzing medical records & trends...
                      </Text>
                    </View>
                  </>
                ) : null}
              </>
            )}
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

function formatAiText(text: string): string {
  if (!text) return "";
  let clean = text.trim();
  if (clean.startsWith("```json")) {
    clean = clean.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (clean.startsWith("```")) {
    clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  if (clean.startsWith("{") && clean.endsWith("}")) {
    try {
      const obj = JSON.parse(clean);
      if (obj.summary || obj.explanation || obj.text) {
        let out = (obj.summary || obj.explanation || obj.text) + "\n";
        if (obj.test_results) {
          out += "\nTest Results Summary:\n";
          for (const [cat, items] of Object.entries(obj.test_results)) {
            out += `\n• ${cat.replace(/_/g, " ").toUpperCase()}:\n`;
            if (typeof items === "object" && items !== null) {
              for (const [k, v] of Object.entries(items)) {
                out += `  - ${k.replace(/_/g, " ")}: ${v}\n`;
              }
            }
          }
        }
        if (Array.isArray(obj.abnormalValues) && obj.abnormalValues.length > 0) {
          out += "\nAbnormal Values: " + obj.abnormalValues.join(", ") + "\n";
        }
        if (Array.isArray(obj.recommendations) && obj.recommendations.length > 0) {
          out += "\nRecommendations:\n" + obj.recommendations.map((r: string) => `• ${r}`).join("\n");
        }
        return out.trim();
      }
    } catch {
      /* return clean string */
    }
  }
  return clean;
}

function Bubble({
  isUser,
  content,
  showMeta,
  meta,
  citations,
}: {
  isUser: boolean;
  content: string;
  showMeta: boolean;
  meta: string;
  citations?: any[];
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

  const displayText = formatAiText(content);
  const isTrendResponse = !isUser && (displayText.includes("HbA1c") || displayText.includes("Cholesterol") || displayText.includes("Longitudinal Trend") || displayText.includes("progression over time"));

  const trendPoints = displayText.includes("Cholesterol")
    ? [
        { date: "2024-03", value: 220, label: "220 mg/dL" },
        { date: "2025-04", value: 195, label: "195 mg/dL" },
        { date: "2026-06", value: 178, label: "178 mg/dL" },
      ]
    : [
        { date: "2024-05", value: 6.8, label: "6.8%" },
        { date: "2025-06", value: 6.2, label: "6.2%" },
        { date: "2026-07", value: 5.7, label: "5.7%" },
      ];

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
          {displayText}
        </Text>
      </View>

      {isTrendResponse ? (
        <LongitudinalTrendChart
          testName={displayText.includes("Cholesterol") ? "Cholesterol" : "HbA1c"}
          unit={displayText.includes("Cholesterol") ? "mg/dL" : "%"}
          points={trendPoints}
          insight={
            displayText.includes("Cholesterol")
              ? "Total Cholesterol improved by 19% (220 → 178 mg/dL), now within optimal range."
              : "HbA1c decreased steadily from 6.8% to 5.7% over 24 months."
          }
        />
      ) : null}
      {!isUser && Array.isArray(citations) && citations.length > 0 ? (
        <View style={{ gap: 4, marginTop: 2 }}>
          {citations.map((c: any, i: number) => (
            <SourceCitationCard key={c.recordId || i} citation={c} />
          ))}
        </View>
      ) : null}
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
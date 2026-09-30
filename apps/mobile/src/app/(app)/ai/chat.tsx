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
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
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
  FlaskConical,
  Pill,
  Stethoscope,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Clock,
  Lock,
  Bot,
  ArrowUpRight,
  ArrowUp,
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
import { ChatMarkdown } from "@/components/ai/ChatMarkdown";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Animated, Easing } from "react-native";
import { Copy, Check as CheckIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { palette } from "@/constants/theme";
import {
  Screen,
  ScreenHeader,
  Card,
  ErrorState,
  Skeleton,
  Pill as PillCmp,
  SectionHeader,
  IconTile,
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

const SUGGESTED_TOPICS = [
  {
    id: "lab_results",
    title: "Explain Lab Results",
    desc: "Analyze blood markers & flags",
    prompt: "Can you explain my latest blood test report and highlight any abnormal values?",
    icon: FlaskConical,
    iconColor: palette.sky[600],
    iconBg: palette.sky[100],
    gradient: [palette.sky[400], palette.sky[600]],
  },
  {
    id: "medications",
    title: "Medication Review",
    desc: "Check doses & instructions",
    prompt: "Which medications appear in my records and what are the key instructions?",
    icon: Pill,
    iconColor: palette.emerald[600],
    iconBg: palette.emerald[100],
    gradient: [palette.emerald[400], palette.emerald[600]],
  },
  {
    id: "doctor_prep",
    title: "Doctor Visit Prep",
    desc: "Prepare summary for consult",
    prompt: "Prepare a concise summary of my recent health records for my next doctor visit.",
    icon: Stethoscope,
    iconColor: palette.amber[600],
    iconBg: palette.amber[100],
    gradient: [palette.amber[400], palette.amber[600]],
  },
  {
    id: "trends",
    title: "Longitudinal Trends",
    desc: "Track HbA1c & cholesterol",
    prompt: "How has my HbA1c and cholesterol changed over the last three years?",
    icon: TrendingUp,
    iconColor: palette.coral[600],
    iconBg: palette.coral[100],
    gradient: [palette.coral[400], palette.coral[600]],
  },
];

export default function AiChatScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography, fontFamily, shadow, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const sessions = useChatSessions();
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const messages = useChatMessages(activeId);
  const send = useSendChat();

  const [draft, setDraft] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);
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

  function promptDelete(id: string) {
    Alert.alert(
      t("aiChat.deleteConfirmTitle", "Delete chat?"),
      t("aiChat.deleteConfirmMsg", "This chat session and its messages will be permanently deleted."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.delete", "Delete"),
          style: "destructive",
          onPress: () => handleDelete(id),
        },
      ]
    );
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
              gap: spacing.md,
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
              <View style={{ gap: spacing.xl }}>
                <LinearGradient
                  colors={[palette.sky[800], palette.sky[600], palette.cyan[500]]}
                  locations={[0, 0.62, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 28,
                    borderCurve: "continuous",
                    padding: spacing.xl,
                    overflow: "hidden",
                    shadowColor: palette.sky[700],
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.2,
                    shadowRadius: 20,
                    elevation: 6,
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      width: 170,
                      height: 170,
                      borderRadius: 85,
                      right: -68,
                      top: -76,
                      backgroundColor: colors.glassOnPrimary,
                    }}
                  />
                  <View
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 18,
                      borderCurve: "continuous",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.glassOnPrimary,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: "rgba(255,255,255,0.28)",
                      marginBottom: spacing.lg,
                    }}
                  >
                    <Sparkles size={26} color={palette.white} strokeWidth={2.1} />
                  </View>
                  <Text
                    style={[
                      typography.display.sm,
                      { color: palette.white, fontWeight: "700", maxWidth: 290 },
                    ]}
                  >
                    {t("aiChat.emptyTitle", "Ask anything about your health")}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      {
                        color: colors.glassOnPrimarySoft,
                        lineHeight: 20,
                        maxWidth: 310,
                        marginTop: spacing.xs,
                      },
                    ]}
                  >
                    {t("aiChat.emptyBody", "Get clear answers grounded in your private medical records.")}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      gap: 6,
                      marginTop: spacing.lg,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: colors.glassOnPrimary,
                    }}
                  >
                    <Lock size={11} color={palette.white} strokeWidth={2.4} />
                    <Text style={{ fontSize: 10.5, fontWeight: "600", color: palette.white }}>
                      {t("aiChat.privacyPill", "Private & Encrypted")}
                    </Text>
                  </View>
                </LinearGradient>

                <View style={{ gap: spacing.md }}>
                  <View style={{ gap: 2 }}>
                    <Text style={[typography.title.md, { color: colors.text, fontWeight: "700" }]}>
                      {t("aiChat.suggestedTitle", "Suggested Topics")}
                    </Text>
                    <Text style={[typography.body.xs, { color: colors.textMuted }]}>
                      {t("aiChat.suggestedSubtitle", "Tap any topic to ask with your context")}
                    </Text>
                  </View>
                  <SmartPromptChips onSelectPrompt={(txt) => handleSend(txt)} />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: spacing.xs,
                  }}
                >
                  <ShieldCheck size={13} color={colors.success} strokeWidth={2.2} />
                  <Text style={{ fontSize: 10.5, color: colors.textMuted }}>
                    {t("aiChat.groundedNote", "Answers are grounded in your connected health records")}
                  </Text>
                </View>
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
                      time={fmtTime(m.createdAt, locale)}
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
                      meta={t("aiChat.metaFormat", { author: t("aiChat.youLabel"), time: t("aiChat.whenJustNow") })}
                    />
                    <TypingIndicator />
                  </>
                ) : null}
              </>
            )}
          </ScrollView>

          {/* Composer */}
          <View
            style={{
              gap: 7,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.bgElevated,
              shadowColor: palette.slate[900],
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.05,
              shadowRadius: 14,
              elevation: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                gap: spacing.sm,
                minHeight: 54,
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: canSend ? colors.borderStrong : colors.border,
                paddingLeft: spacing.lg,
                paddingRight: 6,
                paddingVertical: 6,
                shadowColor: palette.slate[900],
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <RNTextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t("aiChat.inputPlaceholder")}
                placeholderTextColor={colors.textSubtle}
                style={{
                  flex: 1,
                  padding: 0,
                  margin: 0,
                  color: colors.text,
                  fontSize: 15,
                  lineHeight: 21,
                  minHeight: 40,
                  maxHeight: 120,
                  textAlignVertical: "center",
                }}
                multiline
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                returnKeyType="send"
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t("aiChat.sendA11y")}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  borderCurve: "continuous",
                  overflow: "hidden",
                  opacity: canSend ? (pressed ? 0.82 : 1) : 0.38,
                  transform: [{ scale: pressed && canSend ? 0.96 : 1 }],
                })}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                >
                  <ArrowUp size={20} color={palette.white} strokeWidth={2.6} />
                </LinearGradient>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <Lock size={10} color={colors.textSubtle} strokeWidth={2.3} />
              <Text style={{ fontSize: 11, color: colors.textSubtle, fontFamily: fontFamily.body }}>
                {t("aiChat.disclaimer")}
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // ─── SESSION LIST ────────────────────────────────────────
  const busy = send.isPending || createSession.isPending;
  const visibleSessions = showAllSessions ? list : list.slice(0, 4);
  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiChat.listTitle")}
        subtitle={t("aiChat.listSubtitle")}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxxl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Composer hero */}
        <View style={{ borderRadius: 26, borderCurve: "continuous", ...(scheme === "dark" ? null : shadow.hero) }}>
          <View style={{ borderRadius: 26, borderCurve: "continuous", overflow: "hidden", padding: spacing.lg, gap: spacing.md }}>
            <LinearGradient
              colors={[palette.sky[900], palette.sky[700], palette.cyan[600]]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Sparkles size={18} color={palette.white} strokeWidth={2.2} />
              <Text
                style={{
                  fontSize: 19,
                  lineHeight: 24,
                  letterSpacing: -0.4,
                  fontFamily: fontFamily.displayBold,
                  color: palette.white,
                  flex: 1,
                }}
              >
                {t("aiChat.heroAsk", "What would you like to know?")}
              </Text>
            </View>

            {/* Inline composer — type and send straight from the hero */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                minHeight: 52,
                paddingLeft: spacing.lg,
                paddingRight: 6,
                paddingVertical: 6,
                borderRadius: 26,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
              }}
            >
              <RNTextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t("aiChat.inputPlaceholder", "Ask a health question…")}
                placeholderTextColor={colors.textSubtle}
                editable={!busy}
                returnKeyType="send"
                onSubmitEditing={() => handleSend()}
                style={{
                  flex: 1,
                  padding: 0,
                  margin: 0,
                  fontSize: 15,
                  fontFamily: fontFamily.bodyMedium,
                  color: colors.text,
                }}
              />
              <Pressable
                onPress={() => (draft.trim() ? handleSend() : startNew())}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={draft.trim() ? t("aiChat.sendA11y") : t("aiChat.startNew", "Start new chat")}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                })}
              >
                <LinearGradient
                  colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {busy ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : draft.trim() ? (
                  <ArrowUp size={20} color={palette.white} strokeWidth={2.5} />
                ) : (
                  <Plus size={20} color={palette.white} strokeWidth={2.4} />
                )}
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <TrustItem icon={Lock} label={t("aiChat.privacyPill", "Private & Encrypted")} />
              <TrustItem icon={Bot} label={t("aiChat.recordsPill", "Records-Aware AI")} />
            </View>
          </View>
        </View>

        {/* Recent conversations — first for returning users */}
        {list.length > 0 || sessions.isLoading || sessions.isError ? (
          <>
            <SectionHeader
              title={t("aiChat.recentTitle", "Recent Conversations")}
              count={list.length > 0 ? list.length : undefined}
              action={
                list.length > 4
                  ? {
                      label: showAllSessions
                        ? t("aiChat.showLess", "Show less")
                        : t("common.seeAll", "See all"),
                      onPress: () => setShowAllSessions((v) => !v),
                    }
                  : undefined
              }
            />
            {sessions.isLoading ? (
              <View style={{ gap: spacing.sm }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={64} radius={18} />
                ))}
              </View>
            ) : sessions.isError ? (
              <ErrorState
                title={t("common.errorTitle")}
                message={t("common.errorLoad")}
                actionLabel={t("common.retry")}
                onAction={() => sessions.refetch?.()}
              />
            ) : (
              <Card padded={false}>
                {visibleSessions.map((s, i) => (
                  <SessionRow
                    key={s.id}
                    first={i === 0}
                    title={s.title || t("aiChat.sessionFallbackTitle")}
                    when={s.updatedAt ? fmtWhen(t, s.updatedAt, locale) : t("aiChat.sessionFallbackWhen")}
                    onPress={() => setActiveId(s.id)}
                    onDelete={() => promptDelete(s.id)}
                  />
                ))}
              </Card>
            )}
          </>
        ) : null}

        {/* Suggested topics — one tap sends the prompt */}
        <SectionHeader title={t("aiChat.suggestedTitleShort", "Try asking")} />
        <Card padded={false}>
          {SUGGESTED_TOPICS.map((topic, i) => {
            const IconCmp = topic.icon;
            return (
              <Pressable
                key={topic.id}
                onPress={() => handleSend(topic.prompt)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={topic.title}
                accessibilityHint={topic.desc}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.separator,
                  backgroundColor: pressed ? colors.fill : "transparent",
                  opacity: busy ? 0.55 : 1,
                })}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LinearGradient
                    colors={topic.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <IconCmp size={18} color={palette.white} strokeWidth={2.1} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text }]}>
                    {topic.title}
                  </Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
                    {topic.desc}
                  </Text>
                </View>
                <ArrowUpRight size={17} color={colors.textSubtle} strokeWidth={2.3} />
              </Pressable>
            );
          })}
        </Card>

        {/* Disclaimer footnote */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 6,
            marginTop: spacing.xl,
            paddingHorizontal: spacing.lg,
          }}
        >
          <ShieldCheck size={13} color={colors.textSubtle} strokeWidth={2.2} style={{ marginTop: 1 }} />
          <Text style={{ flexShrink: 1, fontSize: 11.5, lineHeight: 16, color: colors.textSubtle, textAlign: "center", fontFamily: fontFamily.body }}>
            {t("aiChat.disclaimer")}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function TrustItem({ icon: Icon, label }: { icon: any; label: string }) {
  const { fontFamily } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon size={12} color="rgba(255,255,255,0.8)" strokeWidth={2.3} />
      <Text style={{ fontSize: 12, fontFamily: fontFamily.bodyMedium, color: "rgba(255,255,255,0.8)" }}>{label}</Text>
    </View>
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
  time,
  citations,
}: {
  isUser: boolean;
  content: string;
  showMeta: boolean;
  meta: string;
  time?: string;
  citations?: any[];
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography, fontFamily } = useTheme();
  const [copied, setCopied] = useState(false);
  const displayText = formatAiText(content);

  if (isUser) {
    return (
      <View style={{ alignSelf: "flex-end", maxWidth: "85%", gap: 4 }}>
        <View
          style={{
            paddingHorizontal: spacing.md + 2,
            paddingVertical: spacing.sm + 2,
            backgroundColor: colors.primary,
            borderRadius: 20,
            borderBottomRightRadius: 6,
            borderCurve: "continuous",
          }}
        >
          <Text style={[typography.body.md, { color: colors.onPrimary, lineHeight: 22 }]}>{displayText}</Text>
        </View>
        {showMeta ? (
          <Text numberOfLines={1} style={[typography.caption, { color: colors.textSubtle, alignSelf: "flex-end", paddingHorizontal: 4 }]}>
            {meta}
          </Text>
        ) : null}
      </View>
    );
  }

  // Assistant replies are long-form: full-width card with an avatar row,
  // real Markdown formatting and a copy action — not a narrow chat bubble.
  async function copy() {
    try {
      await Clipboard.setStringAsync(displayText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
      {showMeta ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
          >
            <Sparkles size={13} color="#FFFFFF" strokeWidth={2.4} />
          </LinearGradient>
          <Text style={[typography.label.md, { color: colors.text }]}>{t("aiChat.assistantName", "Health assistant")}</Text>
          <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
            {time}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          padding: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: 20,
          borderTopLeftRadius: 6,
          borderCurve: "continuous",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
        }}
      >
        <ChatMarkdown text={displayText} />
      </View>

      {Array.isArray(citations) && citations.length > 0 ? (
        <View style={{ gap: 4 }}>
          {citations.map((c: any, i: number) => (
            <SourceCitationCard key={c.recordId || i} citation={c} />
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: 2 }}>
        <Pressable
          onPress={copy}
          accessibilityRole="button"
          accessibilityLabel={t("aiChat.copy", "Copy")}
          hitSlop={6}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            height: 28,
            paddingHorizontal: 10,
            borderRadius: 14,
            backgroundColor: pressed ? colors.fillStrong : colors.fill,
          })}
        >
          {copied ? (
            <CheckIcon size={13} color={colors.success} strokeWidth={2.6} />
          ) : (
            <Copy size={13} color={colors.textMuted} strokeWidth={2.4} />
          )}
          <Text style={[typography.label.xs, { color: copied ? colors.success : colors.textMuted, letterSpacing: 0 }]}>
            {copied ? t("aiChat.copied", "Copied") : t("aiChat.copy", "Copy")}
          </Text>
        </Pressable>
        <Text style={[typography.caption, { color: colors.textSubtle, flex: 1, fontSize: 11, fontFamily: fontFamily.body }]} numberOfLines={1}>
          {t("aiChat.notAdvice", "Not a diagnosis — check with your doctor")}
        </Text>
      </View>
    </View>
  );
}

/** Animated dots + rotating status line while the answer is generated. */
function TypingIndicator() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const steps = [
    t("aiChat.status.reading", "Reading your records…"),
    t("aiChat.status.checking", "Checking results and trends…"),
    t("aiChat.status.writing", "Writing your answer…"),
  ];
  const [step, setStep] = useState(0);
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    loops.forEach((l) => l.start());
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 2600);
    return () => {
      loops.forEach((l) => l.stop());
      clearInterval(id);
    };
  }, []);

  return (
    <View style={{ alignSelf: "stretch", gap: spacing.sm }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
        >
          <Sparkles size={13} color="#FFFFFF" strokeWidth={2.4} />
        </LinearGradient>
        <Text style={[typography.label.md, { color: colors.text }]}>{t("aiChat.assistantName", "Health assistant")}</Text>
      </View>
      <View
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: 20,
          borderTopLeftRadius: 6,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
        }}
      >
        <View style={{ flexDirection: "row", gap: 4 }}>
          {dots.map((v, i) => (
            <Animated.View
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: colors.primary,
                opacity: v,
                transform: [{ translateY: v.interpolate({ inputRange: [0.3, 1], outputRange: [0, -3] }) }],
              }}
            />
          ))}
        </View>
        <Text style={[typography.body.sm, { color: colors.textMuted }]}>{steps[step]}</Text>
      </View>
    </View>
  );
}

function SessionRow({
  title,
  when,
  first,
  onPress,
  onDelete,
}: {
  title: string;
  when: string;
  first: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.fill : "transparent" })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.lg }}>
        <IconTile icon={MessageSquare} tone="primary" size={38} />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: 14,
            paddingRight: spacing.md,
            borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text }]}>
              {title}
            </Text>
            <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
              {when}
            </Text>
          </View>
          <Pressable
            onPress={onDelete}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("aiChat.sessionDeleteA11y")}
            style={({ pressed }) => ({
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.dangerSoft : "transparent",
            })}
          >
            {({ pressed }) => (
              <Trash2 size={16} color={pressed ? colors.danger : colors.textSubtle} strokeWidth={2} />
            )}
          </Pressable>
          <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.2} />
        </View>
      </View>
    </Pressable>
  );
}

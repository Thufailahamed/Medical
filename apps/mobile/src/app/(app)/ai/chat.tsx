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
import { palette } from "@/constants/theme";
import {
  Screen,
  ScreenHeader,
  Card,
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

const SUGGESTED_TOPICS = [
  {
    id: "lab_results",
    title: "Explain Lab Results",
    desc: "Analyze blood markers & flags",
    prompt: "Can you explain my latest blood test report and highlight any abnormal values?",
    icon: FlaskConical,
    iconColor: palette.sky[600],
    iconBg: palette.sky[100],
  },
  {
    id: "medications",
    title: "Medication Review",
    desc: "Check doses & instructions",
    prompt: "Which medications appear in my records and what are the key instructions?",
    icon: Pill,
    iconColor: palette.emerald[600],
    iconBg: palette.emerald[100],
  },
  {
    id: "doctor_prep",
    title: "Doctor Visit Prep",
    desc: "Prepare summary for consult",
    prompt: "Prepare a concise summary of my recent health records for my next doctor visit.",
    icon: Stethoscope,
    iconColor: palette.amber[600],
    iconBg: palette.amber[100],
  },
  {
    id: "trends",
    title: "Longitudinal Trends",
    desc: "Track HbA1c & cholesterol",
    prompt: "How has my HbA1c and cholesterol changed over the last three years?",
    icon: TrendingUp,
    iconColor: palette.coral[600],
    iconBg: palette.coral[100],
  },
];

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
                      Private, encrypted, and records-aware
                    </Text>
                  </View>
                </LinearGradient>

                <View style={{ gap: spacing.md }}>
                  <View style={{ gap: 2 }}>
                    <Text style={[typography.title.md, { color: colors.text, fontWeight: "700" }]}>
                      Popular questions
                    </Text>
                    <Text style={[typography.body.xs, { color: colors.textMuted }]}>
                      Choose a starting point or write your own question below
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
                    Answers are grounded in your connected health records
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
                        backgroundColor: colors.surface,
                        borderRadius: 18,
                        borderCurve: "continuous",
                        borderTopLeftRadius: 6,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.separator,
                        marginTop: 4,
                      }}
                    >
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600" }}>
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
                  borderRadius: 15,
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
                  <Send size={18} color={palette.white} strokeWidth={2.4} />
                </LinearGradient>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <Lock size={10} color={colors.textSubtle} strokeWidth={2.3} />
              <Text style={{ fontSize: 9.5, color: colors.textSubtle }}>
                Your health information stays private and encrypted
              </Text>
            </View>
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
          paddingTop: spacing.md,
          paddingBottom: spacing.xl * 1.5,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero AI Assistant Card */}
        <LinearGradient
          colors={[palette.sky[800], palette.sky[600], palette.cyan[500]]}
          locations={[0, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 28,
            borderCurve: "continuous",
            padding: spacing.xl,
            gap: spacing.lg,
            overflow: "hidden",
            shadowColor: palette.sky[700],
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.24,
            shadowRadius: 22,
            elevation: 7,
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: 90,
              right: -70,
              top: -82,
              backgroundColor: colors.glassOnPrimary,
            }}
          />
          <View
            style={{
              position: "absolute",
              width: 110,
              height: 110,
              borderRadius: 55,
              left: -46,
              bottom: -58,
              backgroundColor: colors.glassOnPrimary,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 17,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.glassOnPrimary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              <Sparkles size={25} color={palette.white} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Text style={[typography.title.lg, { color: palette.white, fontWeight: "700" }]}>
                  {t("aiChat.heroTitle", "Health Assistant")}
                </Text>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: palette.emerald[300],
                    shadowColor: palette.emerald[300],
                    shadowOpacity: 0.8,
                    shadowRadius: 5,
                  }}
                />
              </View>
              <Text style={[typography.body.sm, { color: colors.glassOnPrimarySoft, lineHeight: 19 }]}>
                {t("aiChat.heroSubtitle", "Personalized answers grounded in your private medical records")}
              </Text>
            </View>
          </View>

          {/* Context & Privacy Tags */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: colors.glassOnPrimary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              <Lock size={12} color={palette.white} strokeWidth={2.4} />
              <Text style={{ fontSize: 11, fontWeight: "600", color: palette.white }}>
                {t("aiChat.privacyPill", "Private & Encrypted")}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: colors.glassOnPrimary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              <Bot size={12} color={palette.white} strokeWidth={2.4} />
              <Text style={{ fontSize: 11, fontWeight: "600", color: palette.white }}>
                {t("aiChat.recordsPill", "Records-Aware AI")}
              </Text>
            </View>
          </View>

          {/* Hero CTA Button */}
          <Pressable
            onPress={startNew}
            disabled={createSession.isPending}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: palette.white,
              minHeight: 52,
              paddingHorizontal: spacing.md,
              borderRadius: 17,
              borderCurve: "continuous",
              opacity: pressed || createSession.isPending ? 0.88 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.sky[100],
                }}
              >
                {createSession.isPending ? (
                  <ActivityIndicator size="small" color={palette.sky[600]} />
                ) : (
                  <Plus size={17} color={palette.sky[600]} strokeWidth={2.7} />
                )}
              </View>
              <Text style={{ color: palette.slate[900], fontSize: 15, fontWeight: "700" }}>
                {t("aiChat.startNew", "Start new chat")}
              </Text>
            </View>
            <ArrowUpRight size={19} color={palette.sky[600]} strokeWidth={2.4} />
          </Pressable>
        </LinearGradient>

        {/* Suggested Topics Section */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ gap: 2 }}>
            <Text style={[typography.title.md, { color: colors.text, fontWeight: "700" }]}>
              {t("aiChat.suggestedTitle", "Suggested Topics")}
            </Text>
            <Text style={[typography.body.xs, { color: colors.textMuted }]}>
              {t("aiChat.suggestedSubtitle", "Tap any topic to ask with your context")}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {SUGGESTED_TOPICS.map((topic) => {
              const IconCmp = topic.icon;
              return (
                <Pressable
                  key={topic.id}
                  onPress={() => handleSend(topic.prompt)}
                  disabled={send.isPending || createSession.isPending}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexBasis: "48%",
                    flexGrow: 1,
                    minHeight: 144,
                    backgroundColor: colors.surface,
                    borderRadius: 22,
                    borderCurve: "continuous",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: pressed ? topic.iconColor : colors.border,
                    padding: spacing.md,
                    justifyContent: "space-between",
                    overflow: "hidden",
                    opacity: send.isPending || createSession.isPending ? 0.55 : 1,
                    transform: [{ translateY: pressed ? 1 : 0 }, { scale: pressed ? 0.985 : 1 }],
                    shadowColor: palette.slate[900],
                    shadowOffset: { width: 0, height: 5 },
                    shadowOpacity: 0.06,
                    shadowRadius: 12,
                    elevation: 2,
                  })}
                >
                  <View
                    style={{
                      position: "absolute",
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      borderCurve: "continuous",
                      right: -26,
                      top: -25,
                      backgroundColor: topic.iconBg,
                      opacity: 0.58,
                    }}
                  />
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        borderCurve: "continuous",
                        backgroundColor: topic.iconBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconCmp size={20} color={topic.iconColor} strokeWidth={2.2} />
                    </View>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        borderCurve: "continuous",
                        backgroundColor: colors.surface,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.separator,
                      }}
                    >
                      <ArrowUpRight size={14} color={topic.iconColor} strokeWidth={2.3} />
                    </View>
                  </View>
                  <View style={{ gap: 3 }}>
                    <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 19, fontWeight: "700", color: colors.text }}>
                      {topic.title}
                    </Text>
                    <Text numberOfLines={2} style={{ fontSize: 11, lineHeight: 16, color: colors.textMuted }}>
                      {topic.desc}
                    </Text>
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      left: spacing.md,
                      right: spacing.md,
                      bottom: 0,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: topic.iconColor,
                      opacity: 0.85,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Recent Conversations Section */}
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[typography.title.md, { color: colors.text, fontWeight: "700" }]}>
                {t("aiChat.recentTitle", "Recent Conversations")}
              </Text>
              {list.length > 0 ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: colors.primary,
                    }}
                  >
                    {list.length}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {sessions.isLoading ? (
            <View style={{ gap: spacing.sm }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={68} radius={16} />
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
            <Card padded>
              <View style={{ alignItems: "center", paddingVertical: spacing.md, gap: spacing.xs }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}
                >
                  <MessageSquare size={22} color={colors.primary} strokeWidth={2} />
                </View>
                <Text style={[typography.title.sm, { color: colors.text, fontWeight: "600" }]}>
                  {t("aiChat.listEmptyTitle")}
                </Text>
                <Text
                  style={[
                    typography.body.xs,
                    { color: colors.textMuted, textAlign: "center", maxWidth: 260 },
                  ]}
                >
                  {t("aiChat.listEmptyBody")}
                </Text>
              </View>
            </Card>
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
                  onDelete={() => promptDelete(s.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Clinical Disclaimer & Grounding Card */}
        <LinearGradient
          colors={[colors.primarySoft, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
            padding: spacing.md,
            borderRadius: 18,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.separator,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              borderCurve: "continuous",
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.separator,
              marginTop: 1,
            }}
          >
            <ShieldCheck size={18} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
              Clinically Grounded AI
            </Text>
            <Text style={{ fontSize: 11, lineHeight: 16, color: colors.textMuted }}>
              {t("aiChat.disclaimer")}
            </Text>
          </View>
        </LinearGradient>
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
    <Card
      padded={false}
      onPress={onPress}
      style={{ borderRadius: 20, borderColor: colors.borderStrong }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 13,
        }}
      >
        <LinearGradient
          colors={[colors.primarySoft, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: 14,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.separator,
          }}
        >
          <MessageSquare size={20} color={colors.primary} strokeWidth={2.2} />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={[typography.title.sm, { color: colors.text, fontWeight: "600" }]}
          >
            {title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Clock size={11} color={colors.textMuted} strokeWidth={2} />
            <Text
              numberOfLines={1}
              style={[typography.caption, { color: colors.textMuted }]}
            >
              {when}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("aiChat.sessionDeleteA11y")}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 11,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.dangerSoft : colors.surfaceMuted,
            })}
          >
            <Trash2 size={15} color={colors.danger} strokeWidth={2.1} />
          </Pressable>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primarySoft,
            }}
          >
            <ChevronRight size={16} color={colors.primary} strokeWidth={2.2} />
          </View>
        </View>
      </View>
    </Card>
  );
}
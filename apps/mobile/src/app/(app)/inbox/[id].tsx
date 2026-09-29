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
import { ChevronLeft, Send, Check, CheckCheck, Lock, ShieldCheck, MessageCircle, Stethoscope } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  usePatientConversation,
  useSendPatientMessage,
  useMarkPatientConversationRead,
} from "@/hooks/useApi";
import { Screen, ErrorState, Skeleton, IconTile } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function PatientConversationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  const { colors, spacing, typography, fontFamily, scheme, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === "dark";
  const edge = isDark ? colors.borderStrong : colors.hairline;
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
    const isMine = item.senderRole === "patient";
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
                backgroundColor: isMine ? colors.primary : theirBubble,
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
            <Text style={[typography.body.md, { fontSize: 16, lineHeight: 21, color: isMine ? colors.onPrimary : colors.text }]}>
              {item.body}
            </Text>
          </View>
          {!groupedWithNext && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4, marginHorizontal: 6 }}>
              <Text style={[typography.caption, { fontSize: 11, color: colors.textSubtle, fontVariant: ["tabular-nums"] }]}>
                {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </Text>
              {isMine && (item.readAt
                ? <CheckCheck size={13} color={colors.primary} />
                : <Check size={13} color={colors.textSubtle} />
              )}
            </View>
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
  const doctorName = doctor?.name || t("inbox.yourDoctor");
  const canSend = !!draft.trim() && !sendMutation.isPending;
  const starters = [
    t("inbox.patientStarterMeds"),
    t("inbox.patientStarterUpdate"),
    t("inbox.patientStarterFollowUp"),
  ];

  const securePill = (
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
      <Text style={[typography.label.xs, { color: colors.success }]}>{t("inbox.secureNote")}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
              backgroundColor: barBg,
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
              width: 38, height: 38, borderRadius: 19, alignItems: "center",
              justifyContent: "center", marginRight: 10,
              backgroundColor: pressed ? colors.fillStrong : colors.well,
            })}
          >
            <ChevronLeft size={22} color={colors.text} strokeWidth={2.4} />
          </Pressable>
          <View style={{ marginRight: 12 }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft,
              alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {doctor?.photo
                ? <Image source={{ uri: doctor.photo }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                : <Text style={[typography.label.lg, { color: colors.primary, fontFamily: fontFamily.displayBold }]}>{initials}</Text>
              }
            </View>
            <View style={{
              position: "absolute", right: -2, bottom: -2,
              width: 18, height: 18, borderRadius: 9,
              alignItems: "center", justifyContent: "center",
              borderWidth: 2, borderColor: barBg,
              backgroundColor: isClosed ? colors.warning : colors.primary,
            }}>
              {isClosed
                ? <Lock size={8} color="#FFFFFF" strokeWidth={3} />
                : <Stethoscope size={8} color="#FFFFFF" strokeWidth={3} />}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
              {doctorName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
              {isClosed
                ? <Lock size={11} color={colors.warning} strokeWidth={2.4} />
                : <ShieldCheck size={12} color={colors.success} strokeWidth={2.4} />}
              <Text numberOfLines={1} style={[typography.caption, { color: isClosed ? colors.warning : colors.textMuted }]}>
                {isClosed ? t("inbox.closedByDoctor") : t("inbox.secureChat")}
              </Text>
            </View>
          </View>
        </View>

        {/* Closed banner */}
        {isClosed && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: colors.warningSoft, paddingHorizontal: spacing.lg, paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: edge,
          }}>
            <Lock size={14} color={colors.warning} strokeWidth={2.4} />
            <Text style={[typography.body.sm, { color: colors.warning, flex: 1 }]}>
              {t("inbox.closedBannerPatient")}
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
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, paddingTop: spacing.xs, paddingBottom: spacing.lg }}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListHeaderComponent={
              messages.length > 0 ? (
                <View style={{ alignItems: "center", paddingTop: spacing.md }}>{securePill}</View>
              ) : null
            }
            ListEmptyComponent={
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.xl }}>
                <IconTile icon={MessageCircle} tone="primary" appearance="solid" size={64} style={isDark ? null : shadow.primary} />
                <Text style={[typography.title.lg, { color: colors.text, textAlign: "center", marginTop: spacing.lg }]}>
                  {t("inbox.emptyPatientTitle")}
                </Text>
                <Text style={[typography.body.md, { color: colors.textMuted, textAlign: "center", marginTop: 6, maxWidth: 300 }]}>
                  {t("inbox.emptyPatientBody", { name: doctorName })}
                </Text>
                <View style={{ marginTop: spacing.md }}>{securePill}</View>

                {!isClosed && (
                  <View style={{ alignSelf: "stretch", marginTop: spacing.xl }}>
                    <Text style={[typography.label.xs, {
                      color: colors.textSubtle, textTransform: "uppercase", letterSpacing: 0.8,
                      marginBottom: spacing.sm, textAlign: "center",
                    }]}>
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
                              flexDirection: "row", alignItems: "center", gap: 10,
                              paddingHorizontal: 14, paddingVertical: 12,
                              borderRadius: 16, borderCurve: "continuous",
                              backgroundColor: theirBubble,
                              borderWidth: StyleSheet.hairlineWidth, borderColor: edge,
                              opacity: pressed ? 0.75 : 1,
                              transform: [{ scale: pressed ? 0.98 : 1 }],
                            },
                            isDark ? null : shadow.xs,
                          ]}
                        >
                          <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>{line}</Text>
                          <View style={{
                            width: 26, height: 26, borderRadius: 13,
                            alignItems: "center", justifyContent: "center", backgroundColor: colors.well,
                          }}>
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

        {/* Composer — disabled if closed */}
        <View style={{
          paddingHorizontal: spacing.md, paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: edge, backgroundColor: barBg,
        }}>
          {!isClosed ? (
            <View style={{
              flexDirection: "row", alignItems: "flex-end",
              minHeight: 46, paddingLeft: 16, paddingRight: 4, paddingVertical: 4,
              borderRadius: 23, borderCurve: "continuous",
              backgroundColor: colors.well,
              borderWidth: StyleSheet.hairlineWidth, borderColor: edge,
            }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                multiline
                placeholder={t("inbox.replyPlaceholder")}
                placeholderTextColor={colors.textSubtle}
                style={{
                  flex: 1, maxHeight: 120, paddingTop: 9, paddingBottom: 9,
                  ...typography.body.md, fontSize: 16, lineHeight: 20, color: colors.text,
                }}
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                style={({ pressed }) => [
                  {
                    width: 38, height: 38, borderRadius: 19, marginLeft: 8,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: canSend || sendMutation.isPending ? colors.primary : colors.fillStrong,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                  canSend && !isDark ? shadow.primary : null,
                ]}
              >
                {sendMutation.isPending
                  ? <ActivityIndicator color={colors.onPrimary} size="small" />
                  : <Send size={17} color={canSend ? colors.onPrimary : colors.textSubtle} strokeWidth={2.25} style={{ marginLeft: -2, marginTop: 1 }} />
                }
              </Pressable>
            </View>
          ) : (
            <View style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              minHeight: 46, borderRadius: 23, borderCurve: "continuous", backgroundColor: colors.well,
            }}>
              <Lock size={14} color={colors.textSubtle} strokeWidth={2.4} />
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {t("inbox.repliesDisabled")}
              </Text>
            </View>
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

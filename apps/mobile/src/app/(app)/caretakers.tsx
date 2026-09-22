// @ts-nocheck

// Caretaker Profiles: principal-side screen for managing caretakers.
// Mirrors apps/mobile/src/app/(app)/family.tsx structure: gradient hero
// + marketplace CTA + link cards with action strip + pending invites.

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  UserPlus,
  Plus,
  BadgeCheck,
  Search,
  ShieldCheck,
  Pause,
  Play,
  Ban,
  Mail,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Button,
  Card,
  Pill,
  Avatar,
  Divider,
  ListItem,
  EmptyState,
  Pressable,
  useToast,
  Screen,
  ScreenHeader,
} from "@/components/ui";
import { CaretakerInviteSheet } from "@/components/CaretakerInviteSheet";
import {
  useCaretakerLinks,
  useCaretakerInvites,
  useRevokeCaretakerLink,
  usePatchCaretakerLink,
  useRevokeCaretakerInvite,
} from "@/hooks/useCaretaker";

export default function CaretakersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow } = useTheme();
  const toast = useToast();

  const links = useCaretakerLinks();
  const invites = useCaretakerInvites();
  const patch = usePatchCaretakerLink();
  const revokeLink = useRevokeCaretakerLink();
  const revokeInvite = useRevokeCaretakerInvite();

  const [inviteOpen, setInviteOpen] = useState(false);

  const rows = links.data?.links ?? [];
  const inviteRows = invites.data?.invites ?? [];
  const refreshing = links.isFetching || invites.isFetching;
  const activeCount = rows.filter((l) => l.status === "active").length;
  const pendingInvites = inviteRows.filter(
    (i) => !i.consumedAt && !i.revoked
  ).length;

  function handleRevoke(linkId: string) {
    revokeLink.mutate(linkId, {
      onSuccess: () => toast.show(t("caretaker.link.revoked"), "info"),
      onError: () => toast.show(t("caretaker.switchFailed"), "danger"),
    });
  }

  function handleTogglePause(linkId: string, current: string) {
    const next = current === "paused" ? "active" : "paused";
    patch.mutate({ linkId, status: next });
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        title={t("caretaker.title")}
        right={
          <Button
            label={t("caretaker.addCta")}
            onPress={() => setInviteOpen(true)}
            icon={Plus}
            compact
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              links.refetch();
              invites.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Hero ──────────────────────────────────────────────── */}
        <Card
          padded={false}
          elevated={false}
          style={{
            borderRadius: radius.xxxl,
            borderWidth: 0,
            overflow: "hidden",
            ...shadow.hero,
          }}
        >
          <LinearGradient
            colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: spacing.lg, paddingBottom: spacing.lg }}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "#0C8B8C",
                  opacity: 0.32,
                  borderRadius: 200,
                  transform: [{ translateX: 120 }, { translateY: -80 }],
                },
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "#FFFFFF",
                  opacity: 0.06,
                  borderRadius: 160,
                  transform: [{ scale: 1.1 }],
                },
              ]}
              pointerEvents="none"
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 44,
                backgroundColor: "rgba(255, 255, 255, 0.10)",
              }}
              pointerEvents="none"
            />
            <ShieldCheck
              size={150}
              color="#FFFFFF"
              strokeWidth={1}
              style={{
                position: "absolute",
                right: -30,
                bottom: -30,
                opacity: 0.1,
              }}
              pointerEvents="none"
            />

            <View style={{ gap: spacing.sm }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.16)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.30)",
                }}
              >
                <ShieldCheck size={22} color="#FFFFFF" strokeWidth={2.2} />
              </View>

              <View style={{ gap: 4 }}>
                <Text
                  style={[
                    typography.display.sm,
                    { color: "#FFFFFF", fontSize: 22 },
                  ]}
                >
                  {t("caretaker.title")}
                </Text>
                <Text
                  style={{
                    ...typography.body.sm,
                    color: "rgba(255, 255, 255, 0.85)",
                    lineHeight: 18,
                  }}
                >
                  {t("caretaker.subtitle")}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.xs,
                  marginTop: spacing.xs,
                }}
              >
                <HeroChip
                  label={t("caretaker.countActive", { count: activeCount })}
                />
                {pendingInvites > 0 ? (
                  <HeroChip
                    label={t("caretaker.countPending", {
                      count: pendingInvites,
                    })}
                  />
                ) : null}
              </View>
            </View>
          </LinearGradient>
        </Card>

        {/* ── Marketplace discovery CTA ─────────────────────────── */}
        <Card padded={false} style={{ overflow: "hidden" }}>
          <ListItem
            icon={Search}
            iconTone="primary"
            title={t("marketplace.title")}
            subtitle={t("marketplace.subtitle")}
            showChevron
            onPress={() => router.push("/(app)/marketplace" as any)}
          />
        </Card>

        {/* ── Empty state ───────────────────────────────────────── */}
        {rows.length === 0 && inviteRows.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={t("caretaker.emptyTitle")}
            body={t("caretaker.emptyBody")}
            actionLabel={t("caretaker.addCta")}
            onAction={() => setInviteOpen(true)}
          />
        ) : null}

        {/* ── Active / paused links ─────────────────────────────── */}
        {rows.map((l) => {
          const statusTone =
            l.status === "active"
              ? "success"
              : l.status === "paused"
              ? "warning"
              : "neutral";
          return (
            <Card key={l.linkId} style={{ gap: 0, padding: 0 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                }}
              >
                <Avatar
                  source={
                    l.caretakerPhoto ? { uri: l.caretakerPhoto } : undefined
                  }
                  name={l.caretakerName ?? ""}
                  size="lg"
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={[
                        typography.body.md,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {l.caretakerName ?? t("caretaker.role.other")}
                    </Text>
                    {l.caretakerVerified ? (
                      <BadgeCheck size={15} color={colors.success} />
                    ) : null}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textMuted },
                      ]}
                    >
                      {t(`caretaker.role.${l.careRole}`)}
                    </Text>
                    {l.caretakerVerified ? (
                      <Pill
                        label={t("caretaker.verification.verified")}
                        tone="success"
                        icon={<BadgeCheck size={12} />}
                      />
                    ) : null}
                  </View>
                </View>
                <Pill
                  label={t(`caretaker.link.${l.status}`)}
                  tone={statusTone as any}
                />
              </View>

              {l.status !== "revoked" ? (
                <>
                  <Divider style={{ marginHorizontal: spacing.md }} />
                  <View
                    style={{
                      flexDirection: "row",
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                    }}
                  >
                    {l.status === "active" ? (
                      <CaretakerAction
                        icon={Pause}
                        tone="warning"
                        label={t("caretaker.actionPause")}
                        onPress={() => handleTogglePause(l.linkId, l.status)}
                      />
                    ) : (
                      <CaretakerAction
                        icon={Play}
                        tone="success"
                        label={t("caretaker.actionResume")}
                        onPress={() => handleTogglePause(l.linkId, l.status)}
                      />
                    )}
                    <CaretakerAction
                      icon={Ban}
                      tone="danger"
                      label={t("caretaker.actionRevoke")}
                      onPress={() => handleRevoke(l.linkId)}
                    />
                  </View>
                </>
              ) : null}
            </Card>
          );
        })}

        {/* ── Pending invites ───────────────────────────────────── */}
        {inviteRows.length > 0 ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <Text
              style={[
                typography.label.md,
                {
                  color: colors.textMuted,
                  fontWeight: "700",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  paddingHorizontal: spacing.xs,
                },
              ]}
            >
              {t("caretaker.invitesTitle")}
            </Text>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {inviteRows.map((inv, i) => {
                const actionable = !inv.consumedAt && !inv.revoked;
                return (
                  <View key={inv.id}>
                    {i > 0 ? (
                      <Divider style={{ marginHorizontal: spacing.md }} />
                    ) : null}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        padding: spacing.md,
                      }}
                    >
                      <Avatar name={inv.caretakerName} size="md" />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={[
                            typography.body.md,
                            { color: colors.text, fontWeight: "600" },
                          ]}
                          numberOfLines={1}
                        >
                          {inv.caretakerName}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Mail size={11} color={colors.textMuted} />
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textMuted },
                            ]}
                            numberOfLines={1}
                          >
                            {inv.consumedAt
                              ? t("caretaker.inviteAcceptedBody", {
                                  name: inv.caretakerName,
                                })
                              : `${inv.channel} • ${t(
                                  `caretaker.role.${inv.careRole}`
                                )}`}
                          </Text>
                        </View>
                      </View>
                      {actionable ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t("caretaker.actionRevoke")}
                          haptic="light"
                          onPress={() => revokeInvite.mutate(inv.id)}
                          style={{
                            paddingHorizontal: spacing.sm + 2,
                            paddingVertical: 7,
                            borderRadius: radius.full,
                            backgroundColor: colors.dangerSoft,
                          }}
                        >
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.danger, fontWeight: "700" },
                            ]}
                          >
                            {t("caretaker.actionRevoke")}
                          </Text>
                        </Pressable>
                      ) : (
                        <Pill
                          label={
                            inv.consumedAt
                              ? t("caretaker.link.active")
                              : t("caretaker.link.revoked")
                          }
                          tone={inv.revoked ? "neutral" : "primary"}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}
      </ScrollView>

      <CaretakerInviteSheet
        visible={inviteOpen}
        onDismiss={() => setInviteOpen(false)}
      />
    </Screen>
  );
}

/** Translucent chip rendered on the gradient hero card. */
function HeroChip({ label }: { label: string }) {
  const { spacing, typography } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(255, 255, 255, 0.16)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.30)",
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={[
          typography.caption,
          { color: "#FFFFFF", fontWeight: "700", fontSize: 11 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** Labeled icon column inside a link card's action strip. */
function CaretakerAction({
  icon: Icon,
  tone,
  onPress,
  label,
  a11y,
}: {
  icon: LucideIcon;
  tone: Tone;
  onPress: () => void;
  label: string;
  a11y?: string;
}) {
  const { spacing, typography } = useTheme();
  const pal = useTone(tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      haptic="light"
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        gap: 4,
        paddingVertical: spacing.xs,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pal.bg,
        }}
      >
        <Icon size={16} color={pal.fg} strokeWidth={2.5} />
      </View>
      <Text
        style={[
          typography.caption,
          { color: pal.fg, fontWeight: "700", fontSize: 10.5 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

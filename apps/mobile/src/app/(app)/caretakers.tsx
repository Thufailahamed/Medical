// @ts-nocheck

// Caretaker Profiles: principal-side screen for managing caretakers.
// Mirrors apps/mobile/src/app/(app)/family.tsx structure: gradient hero
// + marketplace CTA + link cards with action strip + pending invites.

import { Fragment, useState } from "react";
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
  Lock,
  FileText,
  CalendarCheck,
  Pill as PillIcon,
  UserRound,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Button,
  Card,
  IconButton,
  IconTile,
  SectionHeader,
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
  const isEmpty = rows.length === 0 && inviteRows.length === 0;
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
          isEmpty ? undefined : (
            <IconButton
              icon={Plus}
              variant="solid"
              onPress={() => setInviteOpen(true)}
              accessibilityLabel={t("caretaker.addCta")}
            />
          )
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
        <View
          style={[
            {
              borderRadius: radius.xxl,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: colors.primaryGradientEnd,
            },
            shadow.hero,
          ]}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -120,
              right: -90,
              width: 280,
              height: 280,
              borderRadius: 140,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />
          <ShieldCheck
            size={140}
            color="#FFFFFF"
            strokeWidth={1}
            style={{ position: "absolute", right: -24, bottom: -28, opacity: 0.1 }}
          />
          {isEmpty ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>
              {/* You + caretaker, linked by a shield */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <UserRound size={22} color={colors.primary} strokeWidth={2.3} />
                </View>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {[0, 1, 2].map((d) => (
                    <View
                      key={d}
                      style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)" }}
                    />
                  ))}
                </View>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.18)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.4)",
                  }}
                >
                  <ShieldCheck size={17} color="#FFFFFF" strokeWidth={2.3} />
                </View>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {[0, 1, 2].map((d) => (
                    <View
                      key={d}
                      style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)" }}
                    />
                  ))}
                </View>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.14)",
                    borderWidth: 2,
                    borderStyle: "dashed",
                    borderColor: "rgba(255,255,255,0.7)",
                  }}
                >
                  <UserPlus size={20} color="#FFFFFF" strokeWidth={2.3} />
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <Text
                  style={[
                    typography.kicker,
                    { color: colors.glassOnPrimarySoft, textTransform: "uppercase" },
                  ]}
                >
                  {t("caretaker.emptyTitle")}
                </Text>
                <Text
                  style={[
                    typography.display.sm,
                    { color: colors.onPrimary, letterSpacing: -0.6 },
                  ]}
                >
                  {t("caretaker.heroTitle")}
                </Text>
                <Text
                  style={[
                    typography.body.md,
                    { color: colors.glassOnPrimarySoft, lineHeight: 21 },
                  ]}
                >
                  {t("caretaker.emptyBody")}
                </Text>
              </View>
              <Pressable
                onPress={() => setInviteOpen(true)}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={t("caretaker.addCta")}
                style={{
                  height: 50,
                  borderRadius: 25,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Plus size={18} color={colors.primary} strokeWidth={2.6} />
                <Text style={[typography.label.lg, { color: colors.primary }]}>
                  {t("caretaker.addCta")}
                </Text>
              </Pressable>
            </View>
          ) : (
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            <View style={{ gap: 4 }}>
              <Text
                style={[
                  typography.kicker,
                  { color: colors.glassOnPrimarySoft, textTransform: "uppercase" },
                ]}
              >
                {t("caretaker.title")}
              </Text>
              <Text
                style={[
                  typography.body.md,
                  { color: colors.onPrimary, lineHeight: 21, maxWidth: 280 },
                ]}
              >
                {t("caretaker.subtitle")}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                borderRadius: radius.xl,
                borderCurve: "continuous",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
                paddingVertical: spacing.md,
              }}
            >
              {[
                { n: activeCount, label: t("caretaker.stat.active", "Active") },
                { n: pendingInvites, label: t("caretaker.stat.pending", "Pending") },
              ].map((s, i) => (
                <View
                  key={s.label}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    gap: 2,
                    borderLeftWidth: i ? StyleSheet.hairlineWidth : 0,
                    borderLeftColor: "rgba(255,255,255,0.28)",
                  }}
                >
                  <Text
                    style={[
                      typography.display.md,
                      { color: colors.onPrimary, letterSpacing: -0.8 },
                    ]}
                  >
                    {s.n}
                  </Text>
                  <Text
                    style={[typography.label.sm, { color: colors.glassOnPrimarySoft }]}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          )}
        </View>

        {/* ── Empty state ───────────────────────────────────────── */}
        {isEmpty ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              title={t("caretaker.canHelpTitle", "What a caretaker can help with")}
              style={{ paddingBottom: 0 }}
            />
            <Card padded={false}>
              {[
                {
                  icon: FileText,
                  tone: "primary" as const,
                  title: t("caretaker.help.recordsTitle", "Health records"),
                  body: t("caretaker.help.recordsBody", "View and organise reports and history."),
                },
                {
                  icon: PillIcon,
                  tone: "success" as const,
                  title: t("caretaker.help.medsTitle", "Medicines"),
                  body: t("caretaker.help.medsBody", "Keep doses and refills on track."),
                },
                {
                  icon: CalendarCheck,
                  tone: "warning" as const,
                  title: t("caretaker.help.apptsTitle", "Appointments"),
                  body: t("caretaker.help.apptsBody", "Book and remember upcoming visits."),
                },
              ].map((f, i) => (
                <Fragment key={f.title}>
                  {i > 0 ? <Divider inset={spacing.lg + 40 + spacing.md} /> : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                    }}
                  >
                    <IconTile icon={f.icon} tone={f.tone} size={40} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[typography.title.sm, { color: colors.text }]}>
                        {f.title}
                      </Text>
                      <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                        {f.body}
                      </Text>
                    </View>
                  </View>
                </Fragment>
              ))}
            </Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: spacing.md,
                borderRadius: radius.xl,
                borderCurve: "continuous",
                backgroundColor: colors.successSoft,
              }}
            >
              <Lock size={15} color={colors.success} strokeWidth={2.3} />
              <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
                {t("caretaker.controlNote", "You stay in control. Pause or revoke access anytime.")}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── Marketplace discovery CTA ─────────────────────────── */}
        <Card padded={false} variant="elevated" style={{ overflow: "hidden" }}>
          <ListItem
            icon={Search}
            iconTone="primary"
            title={t("marketplace.title")}
            subtitle={t("marketplace.subtitle")}
            showChevron
            onPress={() => router.push("/(app)/marketplace" as any)}
          />
        </Card>

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
          borderCurve: "continuous",
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

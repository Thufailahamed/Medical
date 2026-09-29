// @ts-nocheck

// QR-Code Check-in & Dispensing (Health ID) — bottom-nav tab.
//
// Renders a rotating personal QR the patient shows at reception /
// pharmacy. The card auto-issues a fresh token every rotationSeconds
// (25s default) so the displayed QR is always the live one — a stolen
// old QR can't be scanned because the prior row was revoked in the
// same write as the new issue.
//
// Subscribes to the realtime SSE stream so a `walk_in` event with
// `origin: "qr_scan"` for the active principal triggers a "you're
// checked in" toast — closes the loop with the receptionist scanning
// the QR at the desk.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ScanLine,
  RefreshCcw,
  Power,
  Users,
  ShieldCheck,
  Lock,
  QrCode,
  CheckCircle2,
  ChevronRight,
  Info,
  LogIn,
  Pill as PillIcon,
  IdCard,
  Layers,
} from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { Screen, useToast, Button, Pill, IconButton, IconTile } from "@/components/ui";
import { ActivePrincipalPill } from "@/components/ActivePrincipalPill";
import { HealthIdCard } from "@/components/HealthIdCard";
import { useTheme } from "@/theme/ThemeProvider";
import { useActivePrincipalStore } from "@/stores/activePrincipal";
import { useRole } from "@/hooks/useRole";
import { usePatientProfile } from "@/hooks/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  useCurrentHealthId,
  useIssueHealthId,
  useRevokeHealthId,
  useRotationTick,
  type HealthIdPurpose,
} from "@/lib/healthId";

const PURPOSES: HealthIdPurpose[] = ["checkin", "dispense", "id", "all"];

export default function HealthIdScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const toast = useToast();
  const router = useRouter();

  // Caretaker context: when the user has an active principal we render
  // the principal's QR (the caretaker is acting on their behalf).
  const activePrincipal = useActivePrincipalStore(
    (s) => s.activePrincipalPatientId,
  );
  const { data: roleData } = useRole();
  const role = roleData?.role ?? "patient";
  const isCaretaker = role === "caretaker";

  // Patient identity for the header row of the QR card. Caretakers
  // piggyback on the same /patients/me resolution but the server
  // returns the principal's row when an active principal is set.
  const profile = usePatientProfile();
  const patientName =
    profile.data?.patient?.users?.name ?? t("healthId.unnamed");
  const patientPhoto = profile.data?.patient?.users?.photo ?? null;
  const bloodGroup = profile.data?.patient?.patients?.bloodGroup ?? null;
  const nic = profile.data?.patient?.users?.email
    ? null
    : null; // We never expose full NIC on a QR card; the card only
            // shows the tail (last 4) when we have it.
  const nicTail = null; // The PatientProfileResponse doesn't include nic;
                        // keeping it null for now preserves the type.

  const [purpose, setPurpose] = useState<HealthIdPurpose>("all");
  const current = useCurrentHealthId(purpose);
  const issue = useIssueHealthId();
  const revoke = useRevokeHealthId();

  // Rotation timer. When it expires we issue a fresh token, which
  // revokes the prior row in the same write.
  const rotationSeconds = current.data?.rotationSeconds ?? 25;
  const secondsRemaining = useRotationTick(rotationSeconds, () => {
    // Re-issue automatically; this is what makes the QR rotate.
    issue.mutate(purpose, {
      onError: () =>
        toast.show(t("healthId.rotateFailed"), "danger"),
    });
  });

  // Force-rotate now (user-triggered).
  const handleRotate = useCallback(() => {
    issue.mutate(purpose, {
      onError: () =>
        toast.show(t("healthId.rotateFailed"), "danger"),
    });
  }, [purpose, issue, t, toast]);

  const handleRevoke = useCallback(() => {
    revoke.mutate(purpose, {
      onSuccess: () =>
        toast.show(t("healthId.revoked"), "info"),
      onError: () =>
        toast.show(t("healthId.revokeFailed"), "danger"),
    });
  }, [purpose, revoke, t, toast]);

  // On first mount + when the user switches principal (caretaker),
  // pull the existing live token. If none exists, the card shows the
  // "tap to issue" CTA instead.
  useEffect(() => {
    if (current.isFetched && !current.data) {
      // Auto-issue for the default 'all' purpose so first-time users
      // don't see an empty state.
      issue.mutate("all");
    }
    // Only on mount / principal change. `issue.mutate` and `current` are
    // intentionally excluded from deps to avoid re-issuing on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePrincipal]);

  // Realtime: when a walk_in event arrives with origin === "qr_scan"
  // and the principal matches, fire a toast. We open a tiny second
  // SSE channel just for this — useRealtime() already drains the
  // global /realtime stream for query invalidation, so we don't want
  // to perturb it. Connection is cheap; lifecycle-bound to this screen.
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useEffect(() => {
    if (!userId) return;
    let es: EventSource | null = null;
    let cancelled = false;
    (async () => {
      let token: string | null = null;
      try {
        token = await SecureStore.getItemAsync("auth_token");
      } catch {
        token = null;
      }
      if (cancelled || !token) return;
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";
      try {
        es = new EventSource(
          `${apiUrl}/realtime?token=${encodeURIComponent(token)}`,
          { withCredentials: false },
        );
      } catch {
        return;
      }
      es.addEventListener("walk_in", (ev: MessageEvent) => {
        let payload: any = {};
        try {
          payload = JSON.parse(ev.data);
        } catch {
          return;
        }
        const origin = payload?.origin ?? "manual";
        const patientId = payload?.patientId ?? null;
        if (origin !== "qr_scan") return;
        if (
          isCaretaker &&
          activePrincipal &&
          patientId !== activePrincipal
        ) {
          return;
        }
        toast.show(t("healthId.checkedInToast"), "success");
      });
    })();
    return () => {
      cancelled = true;
      try {
        es?.close();
      } catch {
        /* EventSource closed already */
      }
    };
  }, [userId, isCaretaker, activePrincipal, t, toast]);

  const refreshing = current.isFetching || issue.isPending;
  const onRefresh = useCallback(() => {
    current.refetch();
  }, [current]);

  const isDark = scheme === "dark";
  const styles = makeStyles({ colors, spacing, typography, shadow, scheme });
  const hasToken = !!current.data?.token;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)" as any);
    }
  };

  return (
    <Screen
      scroll
      padded={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentContainerStyle={styles.scroll}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <IconButton
          icon={ArrowLeft}
          variant="surface"
          onPress={goBack}
          accessibilityLabel={t("common.back", { defaultValue: "Go back" })}
        />
        <View style={styles.securePill}>
          <Lock size={12} color={colors.success} strokeWidth={2.6} />
          <Text style={styles.securePillText}>
            {t("healthId.secure", { defaultValue: "Encrypted · rotating" })}
          </Text>
        </View>
      </View>

      {/* Header */}
      <Text style={styles.kicker}>{t("healthId.kicker")}</Text>
      <Text style={styles.title}>{t("healthId.title")}</Text>
      <Text style={styles.subtitle}>{t("healthId.caption")}</Text>

      {isCaretaker ? (
        <View style={styles.principalRow}>
          <ActivePrincipalPill />
          <Pill tone="neutral">{t("healthId.actingAsCaretaker")}</Pill>
        </View>
      ) : null}

      {/* Purpose segmented control */}
      <View style={styles.segmentTrack}>
        {PURPOSES.map((p) => {
          const active = purpose === p;
          const Icon = PURPOSE_ICONS[p];
          return (
            <Pressable
              key={p}
              onPress={() => setPurpose(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Icon
                size={15}
                color={active ? colors.primary : colors.textSubtle}
                strokeWidth={2.3}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? colors.text : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {t(`healthId.purpose.${p}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* QR stage — brand "wallet pass" backdrop */}
      <LinearGradient
        colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.stage, isDark ? null : shadow.hero]}
      >
        <View pointerEvents="none" style={[styles.orb, { top: -120, right: -90 }]} />
        <View
          pointerEvents="none"
          style={[styles.orb, { width: 160, height: 160, borderRadius: 80, bottom: -70, left: -50, opacity: 0.7 }]}
        />

        <View style={styles.stageHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <IconTile icon={QrCode} appearance="glass" size={34} />
            <View>
              <Text style={styles.stageTitle}>
                {t("healthId.passTitle", { defaultValue: "Health pass" })}
              </Text>
              <Text style={styles.stageSub}>
                {t(`healthId.purpose.${purpose}`)}
              </Text>
            </View>
          </View>
          <View style={styles.livePill}>
            <View
              style={[
                styles.liveDot,
                { backgroundColor: hasToken ? "#4ADE80" : "rgba(255,255,255,0.5)" },
              ]}
            />
            <Text style={styles.livePillText}>
              {hasToken
                ? t("healthId.live", { defaultValue: "Live" })
                : t("healthId.inactive", { defaultValue: "Inactive" })}
            </Text>
          </View>
        </View>

        {current.isLoading ? (
          <View style={[styles.innerCard, styles.centerCard]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : hasToken && current.data ? (
          <HealthIdCard
            token={current.data.token}
            purpose={current.data.purpose}
            expiresAt={current.data.expiresAt}
            rotationSeconds={current.data.rotationSeconds}
            secondsRemaining={secondsRemaining}
            patientName={patientName}
            patientPhoto={patientPhoto}
            nicTail={nicTail}
            bloodGroup={bloodGroup}
          />
        ) : (
          <View style={[styles.innerCard, styles.centerCard]}>
            <View style={styles.qrGhost}>
              <QrCode size={64} color={colors.primary} strokeWidth={1.6} />
              <View style={styles.qrGhostBadge}>
                <ShieldCheck size={16} color="#FFFFFF" strokeWidth={2.6} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>{t("healthId.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("healthId.emptyBody")}</Text>
            <Button
              title={t("healthId.issue")}
              icon={QrCode}
              onPress={() => issue.mutate(purpose)}
              loading={issue.isPending}
              variant="primary"
              size="lg"
              fullWidth
              haptic="medium"
            />
          </View>
        )}
      </LinearGradient>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <ActionTile
          icon={RefreshCcw}
          tone="primary"
          title={t("healthId.rotateNow")}
          subtitle={t("healthId.rotateHint", { defaultValue: "Fresh code now" })}
          onPress={handleRotate}
          disabled={issue.isPending}
        />
        <ActionTile
          icon={Power}
          tone="danger"
          title={t("healthId.revoke")}
          subtitle={t("healthId.revokeHint", { defaultValue: "Invalidate code" })}
          onPress={handleRevoke}
          disabled={revoke.isPending || !hasToken}
        />
      </View>

      {/* How it works */}
      <View style={styles.card}>
        <Text style={styles.cardKicker}>
          {t("healthId.howTitle", { defaultValue: "How it works" })}
        </Text>
        <View style={styles.stepsRow}>
          {[
            { icon: QrCode, label: t("healthId.step1", { defaultValue: "Show your QR" }) },
            { icon: ScanLine, label: t("healthId.step2", { defaultValue: "Staff scan it" }) },
            { icon: CheckCircle2, label: t("healthId.step3", { defaultValue: "You're checked in" }) },
          ].map((s, i, arr) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepIconRow}>
                <IconTile icon={s.icon} tone={i === arr.length - 1 ? "success" : "primary"} size={40} />
                {i < arr.length - 1 ? <View style={styles.stepLine} /> : null}
              </View>
              <Text style={styles.stepLabel} numberOfLines={2}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Caretakers */}
      <Pressable
        onPress={() => router.push("/caretakers")}
        style={({ pressed }) => [styles.card, styles.linkRow, { opacity: pressed ? 0.85 : 1 }]}
      >
        <IconTile icon={Users} tone="accent2" size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.linkTitle}>{t("healthId.showPicker")}</Text>
          <Text style={styles.linkSub}>
            {t("healthId.caretakersHint", { defaultValue: "Let family show a QR on your behalf" })}
          </Text>
        </View>
        <View style={styles.chevronWell}>
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.4} />
        </View>
      </Pressable>

      {/* Footnote */}
      <View style={styles.footnoteRow}>
        <Info size={14} color={colors.textSubtle} strokeWidth={2.2} style={{ marginTop: 1 }} />
        <Text style={styles.footnote}>{t("healthId.footnote")}</Text>
      </View>
    </Screen>
  );
}

const PURPOSE_ICONS: Record<HealthIdPurpose, any> = {
  checkin: LogIn,
  dispense: PillIcon,
  id: IdCard,
  all: Layers,
};

function ActionTile({
  icon,
  tone,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  icon: any;
  tone: "primary" | "danger";
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm + 2,
        padding: spacing.md,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.hairline,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        ...(isDark ? null : shadow.xs),
      })}
    >
      <IconTile icon={icon} tone={tone} size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[typography.title.xs, { color: tone === "danger" ? colors.danger : colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={[typography.caption, { color: colors.textSubtle, marginTop: 1 }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────

function makeStyles({ colors, spacing, typography, shadow, scheme }: any) {
  const isDark = scheme === "dark";
  const surfaceCard = {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderCurve: "continuous" as const,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? colors.borderStrong : colors.hairline,
    ...(isDark ? null : shadow.xs),
  };
  return StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    securePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 30,
      paddingHorizontal: spacing.md,
      borderRadius: 15,
      backgroundColor: colors.successSoft,
    },
    securePillText: {
      ...typography.label.sm,
      color: colors.success,
    },
    kicker: {
      ...typography.kicker,
      textTransform: "uppercase",
      color: colors.primary,
    },
    title: {
      ...typography.display.sm,
      color: colors.text,
      marginTop: 6,
    },
    subtitle: {
      ...typography.body.md,
      color: colors.textMuted,
      marginTop: 6,
    },
    principalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    segmentTrack: {
      flexDirection: "row",
      marginTop: spacing.lg,
      padding: 4,
      borderRadius: 18,
      borderCurve: "continuous",
      backgroundColor: colors.fill,
    },
    segment: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: 8,
      borderRadius: 14,
      borderCurve: "continuous",
    },
    segmentActive: {
      backgroundColor: colors.surface,
      ...(isDark ? null : shadow.sm),
    },
    segmentText: {
      ...typography.label.sm,
    },
    stage: {
      marginTop: spacing.lg,
      borderRadius: 30,
      borderCurve: "continuous",
      padding: spacing.md,
      paddingTop: spacing.lg,
      overflow: "hidden",
    },
    orb: {
      position: "absolute",
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: "rgba(255,255,255,0.09)",
    },
    stageHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.md,
    },
    stageTitle: {
      ...typography.title.sm,
      color: "#FFFFFF",
    },
    stageSub: {
      ...typography.caption,
      color: "rgba(255,255,255,0.78)",
    },
    livePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 13,
      backgroundColor: "rgba(255,255,255,0.16)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.28)",
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    livePillText: {
      ...typography.label.xs,
      color: "#FFFFFF",
    },
    innerCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderCurve: "continuous",
      padding: spacing.xl,
    },
    centerCard: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 300,
      gap: spacing.md,
    },
    qrGhost: {
      width: 112,
      height: 112,
      borderRadius: 30,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.primary + "55",
      marginBottom: spacing.xs,
    },
    qrGhostBadge: {
      position: "absolute",
      right: -8,
      bottom: -8,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.success,
      borderWidth: 3,
      borderColor: colors.surface,
    },
    emptyTitle: {
      ...typography.title.lg,
      color: colors.text,
      textAlign: "center",
    },
    emptyBody: {
      ...typography.body.sm,
      color: colors.textMuted,
      textAlign: "center",
      paddingHorizontal: spacing.md,
      marginTop: -spacing.xs,
      marginBottom: spacing.xs,
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    card: {
      ...surfaceCard,
      padding: spacing.lg,
      marginTop: spacing.md,
    },
    cardKicker: {
      ...typography.overline,
      textTransform: "uppercase",
      color: colors.textSubtle,
    },
    stepsRow: {
      flexDirection: "row",
      marginTop: spacing.md,
    },
    step: {
      flex: 1,
    },
    stepIconRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    stepLine: {
      flex: 1,
      height: 2,
      marginHorizontal: spacing.sm,
      borderRadius: 1,
      backgroundColor: colors.separator,
    },
    stepLabel: {
      ...typography.label.sm,
      color: colors.text,
      marginTop: spacing.sm,
      paddingRight: spacing.sm,
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    linkTitle: {
      ...typography.title.sm,
      color: colors.text,
    },
    linkSub: {
      ...typography.caption,
      color: colors.textSubtle,
      marginTop: 1,
    },
    chevronWell: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.well,
    },
    footnoteRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.xs,
    },
    footnote: {
      ...typography.caption,
      color: colors.textSubtle,
      flex: 1,
    },
  });
}

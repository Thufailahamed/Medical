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
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ScanLine,
  RefreshCcw,
  Power,
  Users,
  ShieldCheck,
} from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { Screen, useToast, Button, Pill } from "@/components/ui";
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
  const { colors, spacing, typography } = useTheme();
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
        toast.show({
          title: t("healthId.rotateFailed"),
          tone: "danger",
        }),
    });
  });

  // Force-rotate now (user-triggered).
  const handleRotate = useCallback(() => {
    issue.mutate(purpose, {
      onError: () =>
        toast.show({ title: t("healthId.rotateFailed"), tone: "danger" }),
    });
  }, [purpose, issue, t, toast]);

  const handleRevoke = useCallback(() => {
    revoke.mutate(purpose, {
      onSuccess: () =>
        toast.show({ title: t("healthId.revoked"), tone: "neutral" }),
      onError: () =>
        toast.show({ title: t("healthId.revokeFailed"), tone: "danger" }),
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
        toast.show({
          title: t("healthId.checkedInToast"),
          tone: "success",
        });
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

  const styles = makeStyles({ colors, spacing, typography });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{t("healthId.kicker")}</Text>
            <Text style={styles.title}>{t("healthId.title")}</Text>
            <Text style={styles.subtitle}>{t("healthId.caption")}</Text>
          </View>
          <ScanLine size={28} color={colors.primary} />
        </View>

        {isCaretaker ? (
          <View style={styles.principalRow}>
            <ActivePrincipalPill />
            <Pill tone="muted">{t("healthId.actingAsCaretaker")}</Pill>
          </View>
        ) : null}

        {/* Purpose chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {PURPOSES.map((p) => {
            const active = purpose === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPurpose(p)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active
                      ? colors.primary
                      : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? "#FFFFFF" : colors.text },
                  ]}
                >
                  {t(`healthId.purpose.${p}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* The QR card itself, or empty / loading state */}
        {current.isLoading ? (
          <View style={styles.cardShell}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : current.data?.token ? (
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
          <Pressable
            style={[styles.cardShell, styles.emptyCard]}
            onPress={() => issue.mutate(purpose)}
          >
            <ShieldCheck size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>{t("healthId.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("healthId.emptyBody")}</Text>
            <Button
              label={t("healthId.issue")}
              onPress={() => issue.mutate(purpose)}
              variant="primary"
              size="md"
            />
          </Pressable>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[
              styles.actionBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            onPress={handleRotate}
            disabled={issue.isPending}
          >
            <RefreshCcw
              size={18}
              color={colors.text}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.actionLabel}>{t("healthId.rotateNow")}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.actionBtn,
              { borderColor: colors.danger, backgroundColor: colors.surface },
            ]}
            onPress={handleRevoke}
            disabled={revoke.isPending}
          >
            <Power size={18} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={[styles.actionLabel, { color: colors.danger }]}>
              {t("healthId.revoke")}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.caretakersRow}
          onPress={() => router.push("/caretakers")}
        >
          <Users size={18} color={colors.textSubtle} style={{ marginRight: 8 }} />
          <Text style={styles.caretakersLabel}>
            {t("healthId.showPicker")}
          </Text>
        </Pressable>

        <Text style={styles.footnote}>{t("healthId.footnote")}</Text>
      </ScrollView>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────

function makeStyles({ colors, spacing, typography }: any) {
  return StyleSheet.create({
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    kicker: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: colors.primary,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      marginTop: 2,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSubtle,
      marginTop: 4,
    },
    principalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chipsRow: {
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 999,
      borderWidth: 1,
      marginRight: spacing.sm,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "700",
    },
    cardShell: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 320,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyCard: {
      gap: spacing.md,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    emptyBody: {
      fontSize: 13,
      color: colors.textSubtle,
      textAlign: "center",
      paddingHorizontal: spacing.md,
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.md,
      borderRadius: 14,
      borderWidth: 1,
    },
    actionLabel: {
      fontSize: 13,
      fontWeight: "700",
    },
    caretakersRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    caretakersLabel: {
      fontSize: 13,
      color: colors.textSubtle,
      fontWeight: "600",
    },
    footnote: {
      fontSize: 12,
      color: colors.textSubtle,
      textAlign: "center",
      marginTop: spacing.md,
    },
  });
}
import React from "react";
import { View, Text, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { UserCog, ShieldAlert, Clock, LogOut } from "lucide-react-native";
import {
  Screen,
  Button,
  Avatar,
  useToast,
  EmptyState,
  Pill,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useImpersonateStart,
  useImpersonateEnd,
} from "@/hooks/useAdminApi";
import { useAdminImpersonation } from "@/stores/adminImpersonation";
import { useAuthStore } from "@/stores/auth";
import {
  AdminHero,
  AdminSection,
  AdminCard,
  InfoPanel,
  KV,
} from "@/components/admin/ui";

// ADM-4 user impersonation. The minted token carries aud:"admin" and is
// meant for the web admin portal — mobile endpoints reject it. This
// screen starts/ends the session (audit-logged, step-up-gated) and shows
// the active impersonation banner state.

export default function AdminImpersonateScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const me = useAuthStore((s) => s.user);

  const start = useImpersonateStart();
  const end = useImpersonateEnd();
  const { session, start: setSession, end: clearSession } =
    useAdminImpersonation();

  const targetUser = params.userId;

  const onStart = () => {
    if (!targetUser) return;
    Alert.alert(
      "Start impersonation",
      "You'll get a 15-minute token scoped to this user. Every action is audit-logged. The token only works on the web admin portal.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          style: "destructive",
          onPress: () =>
            start.mutate(targetUser, {
              onSuccess: (res: any) => {
                setSession({
                  targetUser: res.targetUser ?? res.target_user ?? {},
                  expiresAt: res.expiresAt ?? res.expires_at ?? "",
                });
                toast.show("Impersonation started", "success");
              },
              onError: (e: any) =>
                toast.show(e?.message ?? "Failed to start", "danger"),
            }),
        },
      ]
    );
  };

  const onEnd = () => {
    end.mutate(undefined, {
      onSuccess: () => {
        clearSession();
        toast.show("Impersonation ended", "success");
      },
      onError: () => {
        // End is best-effort; clear local state regardless.
        clearSession();
        toast.show("Session cleared locally", "success");
      },
    });
  };

  const expires = session?.expiresAt
    ? new Date(session.expiresAt)
    : null;
  const active = !!session;

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="System"
          title="Impersonation"
          subtitle="Step into a user's admin view"
          icon={UserCog}
          stats={[{ value: active ? "Active" : "Idle", label: "Session" }]}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xl,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        <InfoPanel
          icon={ShieldAlert}
          tone="warning"
          title="Guarded action"
        >
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, lineHeight: 18 },
            ]}
          >
            Impersonation is step-up-gated, capped at 15 minutes, and fully
            audit-logged. The token is admin-scoped — use it in the web
            console, not this app.
          </Text>
        </InfoPanel>

        {active ? (
          <View>
            <AdminSection title="Active session" />
            <AdminCard tone="warning">
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Avatar
                name={session!.targetUser.name ?? "?"}
                size="lg"
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.title.md, { color: colors.text }]}>
                  {session!.targetUser.name ?? "User"}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {session!.targetUser.email ?? ""} ·{" "}
                  {session!.targetUser.role ?? ""}
                </Text>
                {expires ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 4,
                    }}
                  >
                    <Clock size={11} color={colors.warning} />
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.warning, fontWeight: "700" },
                      ]}
                    >
                      Expires {expires.toLocaleTimeString()}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Pill label="Live" tone="warning" size="sm" />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <Button
                title="End session"
                variant="danger"
                icon={LogOut}
                onPress={onEnd}
                loading={end.isPending}
              />
            </View>
            </AdminCard>
          </View>
        ) : targetUser ? (
          <View>
            <AdminSection title="Start a session" />
            <AdminCard>
            <KV label="Target user" value={targetUser} />
            <KV label="Token scope" value="admin (web)" />
            <KV label="Duration" value="15 minutes" />
            <KV label="Actor" value={me?.email ?? me?.name ?? "—"} />
            <View style={{ marginTop: spacing.md }}>
              <Button
                title="Start impersonation"
                icon={UserCog}
                onPress={onStart}
                loading={start.isPending}
              />
            </View>
            </AdminCard>
          </View>
        ) : (
          <EmptyState
            icon={UserCog}
            title="No target selected"
            message="Open a user in the admin directory and choose Impersonate."
            actionLabel="Open users"
            onAction={() => router.push("/(admin)/users" as any)}
          />
        )}
      </View>
    </Screen>
  );
}

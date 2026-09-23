import React from "react";
import { View, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  KeyRound,
  ShieldCheck,
  LogOut,
  Fingerprint,
} from "lucide-react-native";
import {
  Screen,
  Button,
  Avatar,
  Pill,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/stores/auth";
import { useAdminStepUpStore } from "@/stores/adminStepUp";
import { ensureStepUp } from "@/lib/admin-api";
import {
  AdminHero,
  AdminSection,
  AdminCard,
  IconTile,
  KV,
} from "@/components/admin/ui";

export default function AdminSecurityScreen() {
  const { colors, spacing, typography } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { token, expiresAt, clear } = useAdminStepUpStore();
  const [verifying, setVerifying] = React.useState(false);

  const fresh = !!token && expiresAt - 10_000 > Date.now();
  const remainingMin = fresh
    ? Math.max(1, Math.round((expiresAt - Date.now()) / 60000))
    : 0;

  const onVerifyNow = async () => {
    setVerifying(true);
    try {
      await ensureStepUp();
      toast.show("Step-up verified — sensitive actions unlocked", "success");
    } catch (e: any) {
      toast.show(e?.message ?? "Verification cancelled", "danger");
    } finally {
      setVerifying(false);
    }
  };

  const onLogout = () => {
    Alert.alert("Sign out", "Sign out of the admin console?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          clear();
          await logout();
          router.replace("/(auth)/login" as any);
        },
      },
    ]);
  };

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="System"
          title="Security"
          subtitle="Admin session & verification"
          icon={ShieldCheck}
          stats={[
            { value: fresh ? "Active" : "Idle", label: "Step-up" },
            { value: fresh ? `${remainingMin}m` : "—", label: "Remaining" },
          ]}
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
        <View>
          <AdminSection title="Account" />
          <AdminCard>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              <Avatar name={user?.name ?? "A"} size="lg" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.title.sm, { color: colors.text }]}>
                  {user?.name ?? "Admin"}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {user?.email ?? "—"}
                </Text>
              </View>
              <Pill label="Super admin" tone="danger" size="sm" />
            </View>
            <KV label="Role" value={user?.role} />
          </AdminCard>
        </View>

        <View>
          <AdminSection title="Step-up session" />
          <AdminCard>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <IconTile icon={KeyRound} tone="primary" size={32} />
            <Text style={[typography.title.sm, { color: colors.text }]}>
              Step-up session
            </Text>
          </View>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginBottom: spacing.md },
            ]}
          >
            Sensitive actions (approvals, payouts, suspensions) require a fresh
            verification, valid for 5 minutes.
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <Pill
              label={fresh ? `Verified · ${remainingMin}m left` : "Not verified"}
              tone={fresh ? "success" : "neutral"}
              size="sm"
            />
          </View>
          <Button
            title={fresh ? "Refresh verification" : "Verify now"}
            variant="secondary"
            icon={Fingerprint}
            onPress={onVerifyNow}
            loading={verifying}
          />
          </AdminCard>
        </View>

        <View>
          <AdminSection title="Passkeys" />
          <AdminCard>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <IconTile icon={ShieldCheck} tone="success" size={32} />
            <Text style={[typography.title.sm, { color: colors.text }]}>
              Passkeys
            </Text>
          </View>
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            WebAuthn passkey enrollment is managed from the web admin console.
            On mobile, step-up uses your admin password.
          </Text>
          </AdminCard>
        </View>

        <Button
          title="Sign out"
          variant="danger"
          icon={LogOut}
          onPress={onLogout}
        />
      </View>
    </Screen>
  );
}

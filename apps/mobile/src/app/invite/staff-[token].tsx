// @ts-nocheck

// Phase 3.1 slice 3 — public deep-link landing page for hospital
// staff invites. Mirrors apps/mobile/src/app/invite/[token].tsx
// (family pattern), but routes the pre-auth CTA into the register
// screen with ?invite=<token> so the server consumes the token
// inline at registration time. Authenticated staff users (role:
// "hospital_staff") get auto-accept.

import { useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  Hospital as HospitalIcon,
  X,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Card,
  Button,
  Skeleton,
  useToast,
} from "@/components/ui";
import { useAuthStore } from "@/stores/auth";
import {
  useStaffInvitePreview,
  useAcceptStaffInvite,
} from "@/hooks/useApi";

export default function StaffInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string }>();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { isAuthenticated, user } = useAuthStore();

  const token = typeof params.token === "string" ? params.token : null;
  const preview = useStaffInvitePreview(token);
  const accept = useAcceptStaffInvite();

  // Authenticated hospital_staff user — auto-accept on mount.
  // The server enforces the role gate; here we just check the JWT's
  // user.role claim so we don't spam the endpoint for non-staff users.
  useEffect(() => {
    if (
      isAuthenticated &&
      user?.role === "hospital_staff" &&
      preview.data &&
      !accept.isSuccess &&
      !accept.isPending
    ) {
      accept.mutate(token!);
    }
  }, [isAuthenticated, user, preview.data, accept, token]);

  // After accept, send them into the hospital portal so they see the
  // active hospital context. Mirrors how family invites land on the
  // family tab (apps/mobile/src/app/invite/[token].tsx:58-69).
  useEffect(() => {
    if (accept.isSuccess) {
      toast.show(t("staffInviteLanding.accepted"), "success");
      router.replace("/(app)/hospital/dashboard" as any);
    }
  }, [accept.isSuccess]);

  useEffect(() => {
    if (preview.error) {
      const status = (preview.error as any)?.status;
      const msg =
        status === 410
          ? t("staffInviteLanding.expired")
          : status === 404
          ? t("staffInviteLanding.invalid")
          : t("staffInviteLanding.error");
      toast.show(msg, "danger");
    }
  }, [preview.error]);

  const data = preview.data;
  const isStaffUser = user?.role === "hospital_staff";

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          paddingBottom: 120,
        }}
      >
        <View
          style={{
            alignItems: "center",
            marginTop: spacing.xl,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UserPlus size={28} color={colors.primary} strokeWidth={2.25} />
          </View>
          <Text
            style={[
              typography.heading.h2,
              { color: colors.text, textAlign: "center" },
            ]}
          >
            {t("staffInviteLanding.title")}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, textAlign: "center" },
            ]}
          >
            {t("staffInviteLanding.subtitle")}
          </Text>
        </View>

        {preview.isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={120} radius="lg" />
            <Skeleton height={48} radius="lg" />
          </View>
        ) : preview.error ? (
          <Card>
            <View
              style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}
            >
              <ShieldAlert size={24} color={colors.danger} strokeWidth={2.25} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.sm, { color: colors.text }]}>
                  {t("staffInviteLanding.invalid")}
                </Text>
              </View>
            </View>
            <Button
              title={t("common.cancel", { defaultValue: "Done" })}
              onPress={() => router.replace("/")}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : data ? (
          <>
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.md,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.lg,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HospitalIcon size={22} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[typography.overline, { color: colors.textMuted }]}
                  >
                    {t("staffInviteLanding.hospital").toUpperCase()}
                  </Text>
                  <Text
                    style={[typography.title.md, { color: colors.text }]}
                  >
                    {data.hospitalName}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: spacing.md,
                }}
              />

              <Row
                label={t("staffInviteLanding.role")}
                value={data.role}
              />
              <Row
                label={t("staffInviteLanding.name")}
                value={data.fullName}
              />
              <Row
                label={t("staffInviteLanding.email")}
                value={data.email}
              />
              <Row
                label={t("staffInviteLanding.expires")}
                value={new Date(data.expiresAt).toLocaleDateString()}
              />
            </Card>

            {/* CTAs depend on auth state */}
            {accept.isSuccess ? (
              <Card tone="success">
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.sm,
                    alignItems: "center",
                  }}
                >
                  <CheckCircle2 size={18} color={colors.success} strokeWidth={2.25} />
                  <Text
                    style={[typography.body.md, { color: colors.text }]}
                  >
                    {t("staffInviteLanding.linked", { hospital: data.hospitalName })}
                  </Text>
                </View>
              </Card>
            ) : !isAuthenticated ? (
              <View style={{ gap: spacing.sm }}>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, textAlign: "center" },
                  ]}
                >
                  {t("staffInviteLanding.createAccountPrompt")}
                </Text>
                <Button
                  title={t("staffInviteLanding.createAccount")}
                  onPress={() =>
                    router.replace({
                      pathname: "/(auth)/register" as any,
                      params: { invite: token! },
                    })
                  }
                  size="lg"
                  fullWidth
                />
                <Button
                  title={t("staffInviteLanding.haveAccount")}
                  variant="ghost"
                  onPress={() =>
                    router.replace({
                      pathname: "/(auth)/login" as any,
                      params: { next: `/invite/staff-${token}` },
                    })
                  }
                  fullWidth
                />
              </View>
            ) : isStaffUser ? (
              <Button
                title={t("staffInviteLanding.accept")}
                icon={UserPlus}
                onPress={() => accept.mutate(token!)}
                loading={accept.isPending}
                size="lg"
                fullWidth
              />
            ) : (
              <Card tone="warning">
                <Text
                  style={[typography.body.sm, { color: colors.text }]}
                >
                  {t("staffInviteLanding.wrongRole", { role: user?.role })}
                </Text>
                <Button
                  title={t("staffInviteLanding.signOutSwitch")}
                  variant="ghost"
                  onPress={() => router.replace("/(auth)/login")}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>
            )}

            <Button
              title={t("staffInviteLanding.dismiss")}
              variant="ghost"
              icon={X}
              onPress={() => router.replace("/")}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { spacing, colors, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={[typography.body.sm, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[typography.body.md, { color: colors.text, fontWeight: "600" }]}
      >
        {value}
      </Text>
    </View>
  );
}

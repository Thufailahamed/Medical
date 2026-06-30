// @ts-nocheck

import { useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { UserPlus, ShieldAlert, CheckCircle2, X } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Card,
  Avatar,
  Button,
  Skeleton,
  useToast,
} from "@/components/ui";
import { useAuthStore } from "@/stores/auth";
import {
  useFamilyInvitePreview,
  useAcceptFamilyInvite,
} from "@/hooks/useApi";

// Phase 2.3.1: deep-link route mounted OUTSIDE the (app) group so a
// fresh, unauthenticated user opening an invite link lands here, can see
// the preview, and is bounced to /login if they tap Accept without a
// session. The route calls the public preview endpoint so it works
// pre-auth and post-auth.
export default function InviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string }>();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { isAuthenticated } = useAuthStore();

  const token = typeof params.token === "string" ? params.token : null;
  const preview = useFamilyInvitePreview(token);
  const accept = useAcceptFamilyInvite();

  // Auto-accept if the user is already signed in and the invite is still
  // open (e.g. user pasted the link while logged in). UX: skip the
  // manual tap.
  useEffect(() => {
    if (
      isAuthenticated &&
      preview.data &&
      !preview.data.consumed &&
      !accept.isSuccess &&
      !accept.isPending
    ) {
      accept.mutate(token!);
    }
  }, [isAuthenticated, preview.data, accept, token]);

  // After successful accept, push them into the family tab so they see
  // the freshly-added member. We could also leave them here with a
  // confirmation card — for now, jump to the family surface.
  useEffect(() => {
    if (accept.isSuccess) {
      toast.show(
        t("family.invite.accepted", {
          name: preview.data?.inviterName ?? "",
          relationship: preview.data?.relationship ?? "",
        }),
        "success"
      );
      router.replace("/(app)/family" as any);
    }
  }, [accept.isSuccess]);

  // Error surface (invalid / expired / consumed / network).
  useEffect(() => {
    if (preview.error) {
      const status = (preview.error as any)?.status;
      if (status === 410) {
        toast.show(t("family.invite.alreadyAccepted"), "warning");
      } else if (status === 404) {
        toast.show(t("family.invite.invalidOrExpired"), "danger");
      }
    }
  }, [preview.error]);

  const data = preview.data;

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
        <View style={{ alignItems: "center", marginTop: spacing.xl, gap: spacing.sm }}>
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
            {t("family.invite.summary.title")}
          </Text>
        </View>

        {preview.isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={120} radius="lg" />
            <Skeleton height={48} radius="lg" />
          </View>
        ) : preview.error ? (
          <Card>
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <ShieldAlert size={24} color={colors.danger} strokeWidth={2.25} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.sm, { color: colors.text }]}>
                  {t("family.invite.invalidOrExpired")}
                </Text>
              </View>
            </View>
            <Button
              title={t("common.done", { defaultValue: "Done" })}
              onPress={() => router.replace("/")}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : data ? (
          <>
            <Card>
              <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                <Avatar
                  size={48}
                  uri={data.inviterPhoto ?? undefined}
                  name={data.inviterName}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.overline, { color: colors.textMuted }]}>
                    {t("family.invite.summary.inviter").toUpperCase()}
                  </Text>
                  <Text style={[typography.title.md, { color: colors.text }]}>
                    {data.inviterName}
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
                label={t("family.invite.summary.invitee")}
                value={data.name || "—"}
              />
              <Row
                label={t("family.invite.summary.relationship")}
                value={
                  data.relationship
                    ? t(`family.relationship.${data.relationship}`, {
                        defaultValue: data.relationship,
                      })
                    : "—"
                }
              />
            </Card>

            {data.consumed ? (
              <Card tone="neutral">
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  <CheckCircle2 size={18} color={colors.textMuted} strokeWidth={2.25} />
                  <Text style={[typography.body.md, { color: colors.textMuted }]}>
                    {t("family.invite.alreadyAccepted")}
                  </Text>
                </View>
              </Card>
            ) : isAuthenticated ? (
              <Button
                title={t("family.invite.acceptTitle")}
                icon={UserPlus}
                onPress={() => accept.mutate(token!)}
                loading={accept.isPending}
                size="lg"
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
                  {t("family.invite.loginRequired")}
                </Text>
                <Button
                  title={t("family.invite.loginButton")}
                  onPress={() =>
                    router.replace({
                      pathname: "/(auth)/login" as any,
                      params: { next: `/invite/${token}` },
                    })
                  }
                  size="lg"
                />
              </View>
            )}

            <Button
              title={t("family.invite.dismiss")}
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
      <Text style={[typography.body.md, { color: colors.text, fontWeight: "600" }]}>
        {value}
      </Text>
    </View>
  );
}
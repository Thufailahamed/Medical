// @ts-nocheck

// Caretaker Profiles: deep-link landing for invited caretakers.
// Mirrors apps/mobile/src/app/invite/[token].tsx. Two steps:
//   1) Preview (inviter, role, channel hint) — public, no auth.
//   2) OTP verify → accept. After accept, auth role flips to caretaker
//      and the user is routed into the (caretaker) group.

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  X,
  KeyRound,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Card,
  Avatar,
  Button,
  Skeleton,
  TextField,
  FormField,
  useToast,
} from "@/components/ui";
import { useAuthStore } from "@/stores/auth";
import {
  useCaretakerInvitePreview,
  useAcceptCaretakerInvite,
} from "@/hooks/useCaretaker";

export default function CaretakerInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string }>();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const { isAuthenticated, user } = useAuthStore();

  const token = typeof params.token === "string" ? params.token : null;
  const preview = useCaretakerInvitePreview(token);
  const accept = useAcceptCaretakerInvite();
  const [otp, setOtp] = useState("");

  // If the user is authenticated and we somehow already accepted, jump
  // out (e.g. universal link re-opened post-accept).
  useEffect(() => {
    if (user?.role === "caretaker" && preview.data?.consumed) {
      router.replace("/(caretaker)" as any);
    }
  }, [user?.role, preview.data?.consumed]);

  function handleAccept() {
    if (!token || otp.length < 6) return;
    accept.mutate(
      { token, otp },
      {
        onSuccess: () => {
          toast.show(
            t("caretaker.inviteAcceptedBody", {
              name: preview.data?.inviterName ?? "",
            }),
            "success" as any
          );
          router.replace("/(caretaker)" as any);
        },
        onError: (err: any) => {
          const status = err?.status;
          if (status === 401 || status === 410) {
            toast.show(t("caretaker.previewLocked", {
              name: preview.data?.inviterName ?? "",
            }), "danger" as any);
          } else {
            toast.show(t("caretaker.inviteFailed", {
              action: t("caretaker.verify").toLowerCase(),
            }), "danger" as any);
          }
        },
      }
    );
  }

  const data = preview.data;

  return (
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
          style={{
            ...typography.h2,
            color: colors.text,
            textAlign: "center",
          }}
        >
          {t("caretaker.previewTitle")}
        </Text>
      </View>

      {preview.isLoading ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={120} radius="lg" />
          <Skeleton height={48} radius="lg" />
        </View>
      ) : preview.error || !data ? (
        <Card>
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              alignItems: "center",
            }}
          >
            <ShieldAlert size={24} color={colors.danger} strokeWidth={2.25} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.title, color: colors.text }}>
                {t("caretaker.previewExpired")}
              </Text>
            </View>
          </View>
          <Button
            label={t("common.done", { defaultValue: "Done" })}
            onPress={() => router.replace("/")}
          />
        </Card>
      ) : (
        <>
          <Card>
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                alignItems: "center",
              }}
            >
              <Avatar
                size={48}
                uri={data.inviterPhoto ?? undefined}
                name={data.inviterName}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textMuted,
                  }}
                >
                  {t("caretaker.previewFrom", { name: data.inviterName })}
                </Text>
                <Text
                  style={{
                    ...typography.title,
                    color: colors.text,
                  }}
                >
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
              label={t("caretaker.nameField")}
              value={data.caretakerName || "—"}
            />
            <Row
              label={t("caretaker.previewRoleLabel")}
              value={t(`caretaker.role.${data.careRole}`)}
            />
            <Row label={t("caretaker.channelLabel")} value={data.channelHint} />
          </Card>

          {data.consumed ? (
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  alignItems: "center",
                }}
              >
                <CheckCircle2
                  size={18}
                  color={colors.textMuted}
                  strokeWidth={2.25}
                />
                <Text
                  style={{
                    ...typography.body,
                    color: colors.textMuted,
                  }}
                >
                  {t("caretaker.previewConsumed")}
                </Text>
              </View>
            </Card>
          ) : data.locked ? (
            <Card>
              <Text style={{ ...typography.body, color: colors.danger }}>
                {t("caretaker.previewLocked", {
                  name: data.inviterName,
                })}
              </Text>
            </Card>
          ) : !isAuthenticated ? (
            <View style={{ gap: spacing.sm }}>
              <Button
                label={t("caretaker.previewAccept")}
                icon={<KeyRound size={18} color={colors.onPrimary} />}
                onPress={() =>
                  router.replace({
                    pathname: "/(auth)/login" as any,
                    params: { next: `/caretaker/${token}` },
                  })
                }
              />
            </View>
          ) : (
            <Card>
              <FormField
                label={t("caretaker.otpTitle")}
                helper={t("caretaker.otpHelper", { contact: data.channelHint })}
              >
                <TextField
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("caretaker.otpPlaceholder")}
                  keyboardType="number-pad"
                  returnKeyType="send"
                  onSubmitEditing={handleAccept}
                  autoFocus
                />
              </FormField>
              <Button
                label={t("caretaker.verify")}
                onPress={handleAccept}
                disabled={otp.length < 6}
                loading={accept.isPending}
              />
            </Card>
          )}

          <Button
            label={t("common.done", { defaultValue: "Done" })}
            variant="ghost"
            icon={<X size={18} color={colors.text} />}
            onPress={() => router.replace("/")}
          />
        </>
      )}
    </ScrollView>
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
      <Text style={{ ...typography.caption, color: colors.textMuted }}>
        {label}
      </Text>
      <Text
        style={{
          ...typography.body,
          color: colors.text,
          fontWeight: "600",
        }}
      >
        {value}
      </Text>
    </View>
  );
}
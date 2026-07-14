// @ts-nocheck

// Caretaker Profiles: principal-side screen for managing caretakers.
// Mirrors apps/mobile/src/app/(app)/family.tsx structure (if exists)
// or the family-invite list shape: hero card + add CTA + list of
// active/paused/revoked links with revoke/pause/resume actions.

import { useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import { UserPlus, Plus } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Card, Pill, Avatar, useToast, Screen, ScreenHeader } from "@/components/ui";
import { CaretakerInviteSheet } from "@/components/CaretakerInviteSheet";
import {
  useCaretakerLinks,
  useCaretakerInvites,
  useRevokeCaretakerLink,
  usePatchCaretakerLink,
  useRevokeCaretakerInvite,
} from "@/hooks/useCaretaker";

export default function CaretakersScreen() {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
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

  function handleRevoke(linkId: string, name: string) {
    revokeLink.mutate(linkId, {
      onSuccess: () =>
        toast.show({
          title: t("caretaker.link.revoked"),
          tone: "neutral",
        }),
      onError: () =>
        toast.show({ title: t("caretaker.switchFailed"), tone: "danger" }),
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
        subtitle={t("caretaker.subtitle")}
        right={
          <Button
            label={t("caretaker.addCta")}
            onPress={() => setInviteOpen(true)}
            icon={<Plus color={colors.primary} size={18} />}
            compact
          />
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
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

        {rows.length === 0 && inviteRows.length === 0 ? (
          <Card>
            <Text
              style={{
                ...typography.h3,
                color: colors.text,
                marginBottom: spacing.xs,
              }}
            >
              {t("caretaker.emptyTitle")}
            </Text>
            <Text
              style={{
                ...typography.bodySmall,
                color: colors.textSecondary,
              }}
            >
              {t("caretaker.emptyBody")}
            </Text>
          </Card>
        ) : null}

        {rows.map((l) => {
          const tone =
            l.status === "active"
              ? "primary"
              : l.status === "paused"
              ? "neutral"
              : "danger";
          return (
            <Card key={l.linkId} style={{ gap: spacing.sm }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Avatar
                  uri={l.caretakerPhoto ?? undefined}
                  name={l.caretakerName ?? ""}
                  size={40}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.text }}>
                    {l.caretakerName ?? t("caretaker.role.other")}
                  </Text>
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.textSecondary,
                    }}
                  >
                    {t(`caretaker.role.${l.careRole}`)}
                  </Text>
                </View>
                <Pill
                  label={t(`caretaker.link.${l.status}`)}
                  tone={tone as any}
                />
              </View>

              {l.status !== "revoked" ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {l.status === "active" ? (
                    <Button
                      label={t("caretaker.actionPause")}
                      onPress={() =>
                        handleTogglePause(l.linkId, l.status)
                      }
                      variant="outline"
                      compact
                    />
                  ) : (
                    <Button
                      label={t("caretaker.actionResume")}
                      onPress={() =>
                        handleTogglePause(l.linkId, l.status)
                      }
                      variant="outline"
                      compact
                    />
                  )}
                  <Button
                    label={t("caretaker.actionRevoke")}
                    onPress={() =>
                      handleRevoke(
                        l.linkId,
                        l.caretakerName ?? t("caretaker.role.other")
                      )
                    }
                    variant="danger"
                    compact
                  />
                </View>
              ) : null}
            </Card>
          );
        })}

        {inviteRows.map((inv) => (
          <Card
            key={inv.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Avatar uri={null} name={inv.caretakerName} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.text }}>
                {inv.caretakerName}
              </Text>
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textSecondary,
                }}
              >
                {inv.consumedAt
                  ? t("caretaker.inviteAcceptedBody", {
                      name: inv.caretakerName,
                    })
                  : `${inv.channel} • ${t(`caretaker.role.${inv.careRole}`)}`}
              </Text>
            </View>
            {!inv.consumedAt && !inv.revoked ? (
              <Button
                label={t("caretaker.actionRevoke")}
                onPress={() => revokeInvite.mutate(inv.id)}
                variant="outline"
                compact
              />
            ) : (
              <Pill
                label={inv.consumedAt ? t("caretaker.link.active") : t("caretaker.link.revoked")}
                tone={inv.revoked ? "neutral" : "primary"}
              />
            )}
          </Card>
        ))}
      </ScrollView>

      <CaretakerInviteSheet
        visible={inviteOpen}
        onDismiss={() => setInviteOpen(false)}
      />
    </Screen>
  );
}
// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share as RNShare,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Copy, Share2, UserPlus } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  BottomSheet,
  Button,
  FormField,
  Chip,
  TextField,
  useToast,
} from "@/components/ui";
import { useAuthStore } from "@/stores/auth";
import { getPublicBaseUrl } from "@/lib/api";
import {
  useCreateFamilyInvite,
  type FamilyInvite,
} from "@/hooks/useApi";

const RELATIONSHIPS = [
  "Spouse",
  "Father",
  "Mother",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandfather",
  "Grandmother",
  "Uncle",
  "Aunt",
  "Cousin",
  "Other",
];

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** Called after a successful invite generation with the new invite. */
  onCreated?: (invite: FamilyInvite) => void;
};

function buildInviteUrl(token: string): string {
  // Same env-derived origin as the share-link page. Recipients deep-link
  // to /invite/<token>; the route handles unauthenticated users.
  return `${getPublicBaseUrl()}/invite/${token}`;
}

// Phase 2.3.1: 2-step sheet. Step 1 collects name + relationship; step 2
// shows the URL with Copy + Share buttons. Closes on Cancel / Done.
export function FamilyInviteSheet({ visible, onDismiss, onCreated }: Props) {
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();
  const createInvite = useCreateFamilyInvite();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<string>(RELATIONSHIPS[0]);
  const [generated, setGenerated] = useState<{
    token: string;
    url: string;
  } | null>(null);

  function reset() {
    setStep(1);
    setName("");
    setRelationship(RELATIONSHIPS[0]);
    setGenerated(null);
    createInvite.reset();
  }

  function dismiss() {
    reset();
    onDismiss();
  }

  async function handleGenerate() {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      toast.show(t("family.invite.nameRequired"), "warning");
      return;
    }
    try {
      const res = await createInvite.mutateAsync({
        name: trimmed,
        relationship,
        expiresInHours: 24 * 14,
      });
      const url = buildInviteUrl(res.token);
      setGenerated({ token: res.token, url });
      setStep(2);
      onCreated?.(res.invite);
    } catch (err: any) {
      toast.show(
        err?.message || t("family.invite.error", { action: t("common.create") }),
        "danger"
      );
    }
  }

  async function handleCopy() {
    if (!generated) return;
    try {
      await Clipboard.setStringAsync(generated.url);
      toast.show(t("family.invite.urlCopied"), "success");
    } catch {
      toast.show(t("common.copyFailed", { defaultValue: "Copy failed" }), "danger");
    }
  }

  async function handleShare() {
    if (!generated) return;
    try {
      await RNShare.share({
        message: t("family.invite.shareMessage", {
          inviter: user?.name || t("common.me", { defaultValue: "Me" }),
          url: generated.url,
        }),
      });
    } catch (err: any) {
      toast.show(err?.message || t("common.shareFailed", { defaultValue: "Share failed" }), "danger");
    }
  }

  const introLine = useMemo(
    () =>
      t("family.invite.intro", {
        name: name.trim() || "—",
        relationship: t(`family.relationship.${relationship}`, {
          defaultValue: relationship,
        }),
      }),
    [name, relationship, t]
  );

  return (
    <BottomSheet visible={visible} onDismiss={dismiss} title={t("family.invite.sheetTitle")}>
      <ScrollView keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserPlus size={20} color={colors.primary} strokeWidth={2.25} />
              </View>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, flex: 1 },
                ]}
              >
                {introLine}
              </Text>
            </View>

            <FormField label={t("family.invite.nameField")} required>
              <TextField
                value={name}
                onChangeText={setName}
                placeholder={t("family.invite.namePlaceholder")}
                maxLength={120}
              />
            </FormField>

            <FormField label={t("family.invite.relationshipField")}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {RELATIONSHIPS.map((r) => {
                  const active = relationship === r;
                  return (
                    <Chip
                      key={r}
                      label={t(`family.relationship.${r}`, { defaultValue: r })}
                      selected={active}
                      tone={active ? "primary" : "neutral"}
                      onPress={() => setRelationship(r)}
                      size="sm"
                    />
                  );
                })}
              </View>
            </FormField>

            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                marginTop: spacing.sm,
              }}
            >
              <Button
                title={t("common.cancel")}
                variant="outline"
                onPress={dismiss}
                style={{ flex: 1 }}
              />
              <Button
                title={
                  createInvite.isPending
                    ? t("family.invite.generating")
                    : t("family.invite.generate")
                }
                onPress={handleGenerate}
                loading={createInvite.isPending}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        )}

        {step === 2 && generated && (
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted },
              ]}
            >
              {t("family.invite.linkHelper")}
            </Text>

            <Pressable
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel={t("family.invite.copyButton")}
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={[
                  typography.label.md,
                  {
                    color: colors.textMuted,
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  },
                ]}
              >
                {t("family.invite.linkLabel")}
              </Text>
              <Text
                style={[
                  typography.body.md,
                  { color: colors.text, fontWeight: "600" },
                ]}
                selectable
              >
                {generated.url}
              </Text>
            </Pressable>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                title={t("family.invite.copyButton")}
                icon={Copy}
                variant="outline"
                onPress={handleCopy}
                style={{ flex: 1 }}
              />
              <Button
                title={t("family.invite.shareButton")}
                icon={Share2}
                onPress={handleShare}
                style={{ flex: 1 }}
              />
            </View>

            <Button
              title={t("common.done", { defaultValue: "Done" })}
              onPress={dismiss}
              variant="ghost"
            />
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
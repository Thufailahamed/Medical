// @ts-nocheck

// Caretaker Profiles: principal-side sheet for inviting a caretaker.
// Mirrors FamilyInviteSheet shape (steps, theme tokens, primitives)
// but the underlying API requires a 6-digit OTP that the recipient
// receives on their phone/email before a user row is provisioned.

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import * as Clipboard from "expo-clipboard";
import {
  BottomSheet,
  Button,
  FormField,
  Chip,
  TextField,
  useToast,
} from "@/components/ui";
import {
  useCreateCaretakerInvite,
  type CareRole,
} from "@/hooks/useCaretaker";

const CARE_ROLES: CareRole[] = [
  "child_caregiver",
  "spouse_caregiver",
  "sibling_caregiver",
  "guardian",
  "parent",
  "other",
];

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function CaretakerInviteSheet({ visible, onDismiss }: Props) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const createInvite = useCreateCaretakerInvite();

  const [name, setName] = useState("");
  const [role, setRole] = useState<CareRole>("child_caregiver");
  const [channel, setChannel] = useState<"mobile" | "email">("mobile");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setRole("child_caregiver");
    setChannel("mobile");
    setContact("");
    setSubmitting(false);
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  async function handleSubmit() {
    if (!name.trim() || !contact.trim()) return;
    setSubmitting(true);
    try {
      const res = await createInvite.mutateAsync({
        caretakerName: name.trim(),
        careRole: role,
        channel,
        contact: contact.trim(),
      });
      if (res?.url) {
        await Clipboard.setStringAsync(res.url);
      }
      toast.show({
        title: t("caretaker.invite.linkCopied", {
          defaultValue: "Invite sent",
        }),
        tone: "success",
      });
      handleDismiss();
    } catch (err: any) {
      const status = err?.status;
      const msg =
        status === 429
          ? t("caretaker.tooManyRequests")
          : t("caretaker.inviteFailed", {
              action: t("caretaker.sendInvite").toLowerCase(),
            });
      toast.show({ title: msg, tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onDismiss={handleDismiss}
      title={t("caretaker.inviteSheetTitle")}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.md }}>
          <FormField label={t("caretaker.nameField")} helper={t("caretaker.nameHelper")}>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder={t("caretaker.nameField")}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </FormField>

          <View>
            <Text
              style={{
                ...typography.bodySmall,
                color: colors.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              {t("caretaker.roleLabel")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
            >
              {CARE_ROLES.map((r) => (
                <Chip
                  key={r}
                  label={t(`caretaker.role.${r}`)}
                  selected={role === r}
                  onPress={() => setRole(r)}
                />
              ))}
            </View>
          </View>

          <View>
            <Text
              style={{
                ...typography.bodySmall,
                color: colors.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              {t("caretaker.channelLabel")}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              <Chip
                label={t("caretaker.channel.mobile")}
                selected={channel === "mobile"}
                onPress={() => setChannel("mobile")}
              />
              <Chip
                label={t("caretaker.channel.email")}
                selected={channel === "email"}
                onPress={() => setChannel("email")}
              />
            </View>
          </View>

          <FormField helper={t("caretaker.contactHelper")}>
            <TextField
              value={contact}
              onChangeText={setContact}
              placeholder={t("caretaker.contactPlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={channel === "mobile" ? "phone-pad" : "email-address"}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
            />
          </FormField>

          <Button
            label={submitting ? t("caretaker.sending") : t("caretaker.sendInvite")}
            onPress={handleSubmit}
            disabled={submitting || !name.trim() || !contact.trim()}
            icon={<UserPlus color={colors.onPrimary} size={18} />}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
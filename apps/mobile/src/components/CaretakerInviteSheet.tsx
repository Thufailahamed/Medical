// @ts-nocheck

// Caretaker Profiles: principal-side sheet for inviting a caretaker.
// Mirrors FamilyInviteSheet shape (steps, theme tokens, primitives)
// but the underlying API requires a 6-digit OTP that the recipient
// receives on their phone/email before a user row is provisioned.

import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import {
  UserPlus,
  User,
  Phone,
  Mail,
  ShieldCheck,
  KeyRound,
  HeartHandshake,
  Heart,
  Users,
  UserRound,
  Shield,
  Check,
  type LucideIcon,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import * as Clipboard from "expo-clipboard";
import {
  BottomSheet,
  Button,
  FormField,
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

const ROLE_ICONS: Record<string, LucideIcon> = {
  child_caregiver: HeartHandshake,
  spouse_caregiver: Heart,
  sibling_caregiver: Users,
  guardian: Shield,
  parent: UserRound,
  other: UserPlus,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function CaretakerInviteSheet({ visible, onDismiss }: Props) {
  const { t } = useTranslation();
  const { spacing, colors, typography, shadow } = useTheme();
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
    if (!name.trim() || !contact.trim() || submitting) return;
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
      toast.show(
        t("caretaker.invite.linkCopied", { defaultValue: "Invite sent" }),
        "success"
      );
      handleDismiss();
    } catch (err: any) {
      const status = err?.status;
      const msg =
        status === 429
          ? t("caretaker.tooManyRequests")
          : t("caretaker.inviteFailed", {
              action: t("caretaker.sendInvite").toLowerCase(),
            });
      toast.show(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  }

  const trimmedContact = contact.trim();
  const contactValid =
    channel === "email"
      ? EMAIL_RE.test(trimmedContact)
      : trimmedContact.replace(/[^\d]/g, "").length >= 7;
  const canSubmit = !!name.trim() && contactValid && !submitting;

  return (
    <BottomSheet
      visible={visible}
      onDismiss={handleDismiss}
      title={t("caretaker.inviteSheetTitle")}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.md }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.lg }}>
          {/* What a caretaker can do */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: colors.primarySoft,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
              }}
            >
              <ShieldCheck size={18} color={colors.onPrimary} strokeWidth={2.25} />
            </View>
            <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
              {t(
                "caretaker.inviteIntro",
                "They can help manage your records, medicines and appointments. Pause or revoke anytime."
              )}
            </Text>
          </View>

          <FormField label={t("caretaker.nameField")} helper={t("caretaker.nameHelper")}>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder={t("caretaker.namePlaceholder", "e.g., Nimal Perera")}
              autoCapitalize="words"
              textContentType="name"
              returnKeyType="next"
              leadingIcon={User}
              tone="soft"
            />
          </FormField>

          <FormField label={t("caretaker.roleLabel")}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {CARE_ROLES.map((r) => {
                const selected = role === r;
                const Icon = ROLE_ICONS[r] ?? UserPlus;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRole(r)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => ({
                      flexBasis: "46%",
                      flexGrow: 1,
                      minHeight: 52,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 16,
                      borderCurve: "continuous",
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : "transparent",
                      backgroundColor: selected ? colors.primarySoft : colors.fill,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected ? colors.primary : colors.surface,
                      }}
                    >
                      {selected ? (
                        <Check size={15} color={colors.onPrimary} strokeWidth={3} />
                      ) : (
                        <Icon size={15} color={colors.textMuted} strokeWidth={2.25} />
                      )}
                    </View>
                    <Text
                      style={[
                        typography.label.md,
                        { color: selected ? colors.primary : colors.text, flex: 1 },
                      ]}
                      numberOfLines={2}
                    >
                      {t(`caretaker.role.${r}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          <FormField label={t("caretaker.channelLabel")}>
            {/* Segmented channel switch */}
            <View
              style={{
                flexDirection: "row",
                padding: 4,
                gap: 4,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: colors.fill,
              }}
            >
              {(["mobile", "email"] as const).map((c) => {
                const selected = channel === c;
                const Icon = c === "mobile" ? Phone : Mail;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      if (channel !== c) setContact("");
                      setChannel(c);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      {
                        flex: 1,
                        height: 40,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: selected ? colors.surface : "transparent",
                      },
                      selected ? shadow.xs : null,
                    ]}
                  >
                    <Icon
                      size={15}
                      color={selected ? colors.primary : colors.textMuted}
                      strokeWidth={2.25}
                    />
                    <Text
                      style={[
                        typography.label.lg,
                        { color: selected ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {t(`caretaker.channel.${c}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextField
              value={contact}
              onChangeText={setContact}
              placeholder={
                channel === "mobile"
                  ? t("caretaker.mobilePlaceholder", "+94 77 123 4567")
                  : t("caretaker.emailPlaceholder", "name@example.com")
              }
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={channel === "mobile" ? "phone-pad" : "email-address"}
              textContentType={channel === "mobile" ? "telephoneNumber" : "emailAddress"}
              returnKeyType="send"
              onSubmitEditing={() => canSubmit && handleSubmit()}
              leadingIcon={channel === "mobile" ? Phone : Mail}
              tone="soft"
              containerStyle={{ marginTop: spacing.xs }}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 2 }}>
              <KeyRound size={13} color={colors.textSubtle} strokeWidth={2.25} />
              <Text style={[typography.caption, { color: colors.textSubtle, flex: 1 }]}>
                {t("caretaker.contactHelper")}
              </Text>
            </View>
          </FormField>

          <Button
            title={submitting ? t("caretaker.sending") : t("caretaker.sendInvite")}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            icon={UserPlus}
            size="lg"
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

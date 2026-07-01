// @ts-nocheck

// Phase 3.1 slice 3 — admin screen for hospital staff invites.
// Mirrors the family-invite pattern (apps/mobile/src/app/(app)/family.tsx:
// family/invite.* keys). Admins generate a token, share the deep link,
// and can revoke pending invites. Consumed/revoked invites stay listed
// for the audit trail but no longer expose the token.

import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Alert,
  ScrollView,
  Share,
  Pressable,
  Clipboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Send,
  X,
  Copy,
  Link as LinkIcon,
  Users,
  UserPlus,
  ShieldAlert,
} from "lucide-react-native";
import {
  useStaffInvites,
  useCreateStaffInvite,
  useRevokeStaffInvite,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Pill as PillCmp,
  EmptyState,
  Skeleton,
  FormField,
  TextInput,
  ChipGroup,
  IconButton,
  useToast,
} from "@/components/ui";

function roleTone(r: string): any {
  switch (r) {
    case "nurse":
      return "primary";
    case "manager":
      return "warning";
    case "receptionist":
      return "info";
    default:
      return "neutral";
  }
}

function statusTone(s: string): any {
  switch (s) {
    case "pending":
      return "warning";
    case "consumed":
      return "success";
    case "revoked":
      return "danger";
    case "expired":
      return "neutral";
    default:
      return "neutral";
  }
}

export default function StaffInvitesScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const { data, isLoading } = useStaffInvites();
  const createInvite = useCreateStaffInvite();
  const revoke = useRevokeStaffInvite();
  const invites: any[] = data?.invites || [];
  const pending = invites.filter((i) => i.status === "pending");
  const past = invites.filter((i) => i.status !== "pending");

  const [showForm, setShowForm] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("nurse");
  const [expiresInHours, setExpiresInHours] = useState("336"); // 14 days

  const ROLES = [
    { value: "nurse", label: t("hospitalStaff.roleNurse") },
    { value: "receptionist", label: t("hospitalStaff.roleReceptionist") },
    { value: "technician", label: t("hospitalStaff.roleTechnician") },
    { value: "manager", label: t("hospitalStaff.roleManager") },
    { value: "housekeeping", label: t("hospitalStaff.roleHousekeeping") },
    { value: "security", label: t("hospitalStaff.roleSecurity") },
  ];

  const EXPIRIES = [
    { value: "24", label: "1 day" },
    { value: "168", label: "1 week" },
    { value: "336", label: "14 days" },
    { value: "720", label: "30 days" },
  ];

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setRole("nurse");
    setExpiresInHours("336");
    setGeneratedLink(null);
  }

  async function submit() {
    if (!fullName.trim()) {
      toast.show("Name required", "warning");
      return;
    }
    if (!email.trim()) {
      toast.show("Email required", "warning");
      return;
    }
    try {
      const res = await createInvite.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        role: role as any,
        expiresInHours: parseInt(expiresInHours, 10),
      } as any);
      setGeneratedLink(res.deepLink || res.link || null);
      toast.show("Invite created", "success");
    } catch (err: any) {
      toast.show(err?.message || "Could not create invite", "danger");
    }
  }

  async function shareLink(link: string) {
    try {
      await Share.share({
        message: `Join our hospital team on HealthHub: ${link}`,
      });
    } catch {
      // User cancelled share sheet — no-op.
    }
  }

  async function copyLink(link: string) {
    Clipboard.setString(link);
    toast.show("Link copied", "success");
  }

  function confirmRevoke(id: string, name: string) {
    Alert.alert(
      "Revoke invite?",
      `Cancel the pending invite for "${name}". They won't be able to use the link.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              await revoke.mutateAsync(id);
              toast.show("Invite revoked", "success");
            } catch (err: any) {
              toast.show(err?.message || "Could not revoke", "danger");
            }
          },
        },
      ]
    );
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("hospitalStaffInvites.title", { defaultValue: "Staff invites" })}
        right={
          <IconButton
            icon={Plus}
            onPress={() => {
              reset();
              setShowForm(true);
            }}
            accessibilityLabel={t("hospitalStaffInvites.sendCta", { defaultValue: "Send invite" })}
            variant="soft"
          />
        }
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={80} radius={20} />
          ))}
        </View>
      ) : invites.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={UserPlus}
            title={t("hospitalStaffInvites.emptyTitle", {
              defaultValue: "No invites yet",
            })}
            message={t("hospitalStaffInvites.emptyBody", {
              defaultValue:
                "Generate a link to onboard nurses, receptionists, and other staff.",
            })}
            actionLabel={t("hospitalStaffInvites.sendCta", { defaultValue: "Send invite" })}
            onAction={() => {
              reset();
              setShowForm(true);
            }}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}
        >
          {pending.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginLeft: spacing.xs },
                ]}
              >
                {t("hospitalStaffInvites.pendingHeading", { defaultValue: "PENDING" })}
              </Text>
              {pending.map((inv: any) => (
                <Card key={inv.id} padded={false}>
                  <View
                    style={{
                      padding: spacing.lg,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: colors.surface,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <UserPlus size={20} color={colors.primary} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.title.sm, { color: colors.text }]}>
                          {inv.fullName}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 6,
                            marginTop: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <PillCmp
                            label={inv.role}
                            tone={roleTone(inv.role)}
                            size="sm"
                          />
                          <PillCmp
                            label={statusTone(inv.status) === "warning" ? "pending" : inv.status}
                            tone={statusTone(inv.status)}
                            size="sm"
                          />
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textMuted, alignSelf: "center" },
                            ]}
                          >
                            {`expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                          </Text>
                        </View>
                      </View>
                      <IconButton
                        icon={X}
                        onPress={() => confirmRevoke(inv.id, inv.fullName)}
                        accessibilityLabel={`Revoke invite for ${inv.fullName}`}
                        tint={colors.danger}
                      />
                    </View>
                  {inv.deepLink ? (
                    <View
                      style={{
                        paddingHorizontal: spacing.lg,
                        paddingBottom: spacing.lg,
                        gap: spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <LinkIcon size={14} color={colors.textMuted} strokeWidth={2.2} />
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textMuted, flex: 1 },
                          ]}
                          numberOfLines={1}
                        >
                          {inv.deepLink}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: spacing.sm }}>
                        <Button
                          title={t("hospitalStaffInvites.copyLink", { defaultValue: "Copy" })}
                          icon={Copy}
                          variant="soft"
                          size="sm"
                          onPress={() => copyLink(inv.deepLink)}
                          style={{ flex: 1 }}
                        />
                        <Button
                          title={t("hospitalStaffInvites.shareLink", { defaultValue: "Share" })}
                          icon={Send}
                          variant="primary"
                          size="sm"
                          onPress={() => shareLink(inv.deepLink)}
                          style={{ flex: 1 }}
                        />
                      </View>
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}

          {past.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginLeft: spacing.xs },
                ]}
              >
                {t("hospitalStaffInvites.historyHeading", { defaultValue: "HISTORY" })}
              </Text>
              {past.map((inv: any) => (
                <Card key={inv.id} padded={false}>
                  <View
                    style={{
                      padding: spacing.lg,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: colors.surface,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Users size={20} color={colors.textMuted} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.title.sm, { color: colors.text }]}>
                          {inv.fullName}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 6,
                            marginTop: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <PillCmp
                            label={inv.role}
                            tone={roleTone(inv.role)}
                            size="sm"
                          />
                          <PillCmp
                            label={inv.status}
                            tone={statusTone(inv.status)}
                            size="sm"
                          />
                          {inv.consumedByName ? (
                            <PillCmp
                              label={`→ ${inv.consumedByName}`}
                              tone="neutral"
                              size="sm"
                            />
                          ) : null}
                        </View>
                      </View>
                    </View>
                </Card>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowForm(false);
          reset();
        }}
      >
        <Screen padded={false} edges={["top"]} bottomInset>
          <ScreenHeader
            title={t("hospitalStaffInvites.formTitle", { defaultValue: "Send invite" })}
            right={
              <Button
                title={t("common.cancel", { defaultValue: "Cancel" })}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => {
                  setShowForm(false);
                  reset();
                }}
              />
            }
          />
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            {generatedLink ? (
              <Card tone="success">
                <View style={{ gap: spacing.md }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <Send size={18} color={colors.success} strokeWidth={2.25} />
                    <Text style={[typography.title.sm, { color: colors.text }]}>
                      Invite created
                    </Text>
                  </View>
                  <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                    Share this link with the staff member. It expires in {expiresInHours === "24" ? "1 day" : expiresInHours === "168" ? "1 week" : expiresInHours === "720" ? "30 days" : "14 days"}.
                  </Text>
                  <View
                    style={{
                      padding: spacing.md,
                      borderRadius: 12,
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.text, fontFamily: "monospace" },
                      ]}
                      selectable
                    >
                      {generatedLink}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Button
                      title="Copy"
                      icon={Copy}
                      variant="soft"
                      onPress={() => copyLink(generatedLink)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Share"
                      icon={Send}
                      onPress={() => shareLink(generatedLink)}
                      style={{ flex: 1 }}
                    />
                  </View>
                  <Button
                    title="Done"
                    variant="ghost"
                    onPress={() => {
                      setShowForm(false);
                      reset();
                    }}
                  />
                </View>
              </Card>
            ) : (
              <>
                <FormField label="Full name" required>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="e.g., Priya Fernando"
                    autoFocus
                    autoCapitalize="words"
                  />
                </FormField>
                <FormField label="Email" required>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="staff@hospital.lk"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </FormField>
                <FormField label="Phone (optional)">
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+94 77 123 4567"
                    keyboardType="phone-pad"
                  />
                </FormField>
                <FormField label="Role">
                  <ChipGroup options={ROLES} value={role} onChange={setRole} />
                </FormField>
                <FormField label="Expires in">
                  <ChipGroup
                    options={EXPIRIES}
                    value={expiresInHours}
                    onChange={setExpiresInHours}
                  />
                </FormField>
                <Button
                  title="Generate invite link"
                  onPress={submit}
                  loading={createInvite.isPending}
                  icon={Send}
                  size="lg"
                />
              </>
            )}
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}
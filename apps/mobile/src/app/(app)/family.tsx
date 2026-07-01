import { useState } from "react";
import { View, Text, Linking, Alert, Pressable, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Users,
  Plus,
  UserPlus,
  Phone,
  MessageCircle,
  Trash2,
  Link2Off,
  Lock,
  LockOpen,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  useFamilyMembers,
  useAddFamilyMember,
  useDeleteFamilyMember,
  useFamilyInvites,
  useRevokeFamilyInvite,
  useToggleFamilyLock,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { parseDob } from "@/lib/format";
import {
  Screen,
  ScreenHeader,
  IconButton,
  ListItem,
  EmptyState,
  Skeleton,
  Avatar,
  Card,
  TextInput,
  FormField,
  Button,
  Chip,
  useToast,
} from "@/components/ui";
import { FamilyInviteSheet } from "@/components/FamilyInviteSheet";

// DB values; rendered via t("family.relationship.<value>")
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

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// DB values; rendered via t("family.condition.<value>")
const HEREDITARY_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "Heart disease",
  "Stroke",
  "Cancer",
  "Asthma",
  "Thyroid disorder",
  "Mental health condition",
  "Alzheimer's / dementia",
  "Parkinson's",
  "Kidney disease",
  "Liver disease",
  "Other",
];

export default function FamilyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useFamilyMembers();
  const addMember = useAddFamilyMember();
  const deleteMember = useDeleteFamilyMember();
  const toggleLock = useToggleFamilyLock();
  const { data: inviteData } = useFamilyInvites();
  const revokeInvite = useRevokeFamilyInvite();
  const family: any[] = data?.family || [];
  const pendingInvites: any[] =
    (inviteData?.invites ?? []).filter(
      (i: any) => !i.revoked && !i.consumedAt
    );

  const [composing, setComposing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState("");
  const [isDeceased, setIsDeceased] = useState(false);
  const [causeOfDeath, setCauseOfDeath] = useState("");
  const [notes, setNotes] = useState("");

  function callNumber(num?: string) {
    if (!num) {
      toast.show(t("family.toast.noPhone"), "warning");
      return;
    }
    Linking.openURL(`tel:${num.replace(/\s/g, "")}`);
  }

  function textNumber(num?: string) {
    if (!num) {
      toast.show(t("family.toast.noPhone"), "warning");
      return;
    }
    Linking.openURL(`sms:${num.replace(/\s/g, "")}`);
  }

  async function saveMember() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.show(t("family.compose.nameRequired"), "warning");
      return;
    }
    if (trimmedName.length > 60) {
      toast.show(t("family.compose.nameTooLong"), "warning");
      return;
    }
    const cleanedPhone = phone.replace(/[^\d+]/g, "").trim();
    if (phone.trim() && (cleanedPhone.length < 7 || cleanedPhone.length > 16)) {
      toast.show(t("family.compose.phoneRangeError"), "warning");
      return;
    }
    try {
      await addMember.mutateAsync({
        name: trimmedName,
        relationship,
        dateOfBirth: dateOfBirth.trim() || undefined,
        phone: cleanedPhone || undefined,
        bloodGroup: bloodGroup || undefined,
        conditions: conditions.length ? conditions : undefined,
        isDeceased,
        causeOfDeath: isDeceased ? causeOfDeath.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      toast.show(t("family.toast.added", { name: trimmedName }), "success");
      setComposing(false);
      setName("");
      setPhone("");
      setRelationship(RELATIONSHIPS[0]);
      setDateOfBirth("");
      setBloodGroup(null);
      setConditions([]);
      setConditionInput("");
      setIsDeceased(false);
      setCauseOfDeath("");
      setNotes("");
    } catch (err: any) {
      toast.show(err?.message || t("family.toast.addError"), "danger");
    }
  }

  function toggleCondition(c: string) {
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function confirmDelete(member: any) {
    Alert.alert(
      t("family.deleteConfirm.title", { name: member.name }),
      t("family.deleteConfirm.body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.remove"),
          style: "destructive",
          onPress: () => deleteMember.mutate(member.id),
        },
      ]
    );
  }

  // Phase 2.3.3: privacy lock toggle. Locked members' records vanish
  // from the principal's family-context views (timeline, vitals, etc.).
  // Deceased members can't be locked — the gate is on the server.
  function confirmLockToggle(member: any) {
    const locked = !!member.isLocked;
    Alert.alert(
      locked
        ? t("family.lock.confirmUnlockTitle")
        : t("family.lock.confirmLockTitle"),
      locked
        ? t("family.lock.confirmUnlock", { name: member.name })
        : t("family.lock.confirmLock", { name: member.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: locked
            ? t("family.lock.toggleUnlock")
            : t("family.lock.toggleLock"),
          style: locked ? "default" : "destructive",
          onPress: async () => {
            try {
              await toggleLock.mutateAsync({ id: member.id, locked: !locked });
              toast.show(
                locked
                  ? t("family.lock.toastUnlocked", { name: member.name })
                  : t("family.lock.toastLocked", { name: member.name }),
                "success",
              );
            } catch {
              toast.show(t("family.lock.toastError"), "danger");
            }
          },
        },
      ]
    );
  }

  if (composing) {
    return (
      <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => setComposing(false)}
          title={t("family.composeTitle")}
        />
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <FormField label={t("family.compose.nameLabel")} required>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("family.compose.namePlaceholder")}
              autoCapitalize="words"
            />
          </FormField>

          <FormField label={t("family.compose.relationshipLabel")}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
            >
              {RELATIONSHIPS.map((r) => (
                <Chip
                  key={r}
                  label={t(`family.relationship.${r}`)}
                  selected={relationship === r}
                  tone={relationship === r ? "primary" : "neutral"}
                  onPress={() => setRelationship(r)}
                />
              ))}
            </View>
          </FormField>

          <FormField label={t("family.compose.phoneLabel")} helper={t("family.compose.phoneHelper")}>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t("family.compose.phonePlaceholder")}
              keyboardType="phone-pad"
            />
          </FormField>

          {/* Phase 1.2b: optional DOB. Encouraged for child entries so
              downstream features (pediatric vs adult dosing) can be
              age-aware. Soft warning if the relationship says "child"
              but the DOB parses to an adult. */}
          <FormField
            label={t("family.compose.dobLabel")}
            helper={t("family.compose.dobHelper")}
          >
            <TextInput
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder={t("family.compose.dobPlaceholder")}
              keyboardType="numbers-and-punctuation"
              autoComplete="birthdate-full"
            />
          </FormField>

          {(() => {
            const childRelationships = new Set(["Son", "Daughter"]);
            if (!childRelationships.has(relationship)) return null;
            const parsed = parseDob(dateOfBirth.trim());
            if (!parsed) return null;
            const now = new Date();
            let age = now.getFullYear() - parsed.getFullYear();
            if (
              now.getMonth() < parsed.getMonth() ||
              (now.getMonth() === parsed.getMonth() &&
                now.getDate() < parsed.getDate())
            ) {
              age--;
            }
            if (age < 18) return null;
            return (
              <View
                style={{
                  backgroundColor: colors.warningSoft ?? colors.primarySoft,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: colors.text, flex: 1, lineHeight: 18 },
                  ]}
                >
                  {t("family.compose.adultDobWarning")}
                </Text>
              </View>
            );
          })()}

          <FormField label={t("family.compose.bloodGroupLabel")} helper={t("family.compose.bloodGroupHelper")}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
            >
              {BLOOD_GROUPS.map((bg) => (
                <Chip
                  key={bg}
                  label={bg}
                  selected={bloodGroup === bg}
                  tone={bloodGroup === bg ? "primary" : "neutral"}
                  onPress={() => setBloodGroup(bloodGroup === bg ? null : bg)}
                />
              ))}
            </View>
          </FormField>

          <FormField
            label={t("family.compose.conditionsLabel")}
            helper={t("family.compose.conditionsHelper")}
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
                marginBottom: spacing.xs,
              }}
            >
              {HEREDITARY_CONDITIONS.map((c) => (
                <Chip
                  key={c}
                  label={t(`family.condition.${c}`)}
                  selected={conditions.includes(c)}
                  tone={conditions.includes(c) ? "warning" : "neutral"}
                  onPress={() => toggleCondition(c)}
                />
              ))}
            </View>
            <TextInput
              value={conditionInput}
              onChangeText={setConditionInput}
              onSubmitEditing={() => {
                const v = conditionInput.trim();
                if (v && !conditions.includes(v)) {
                  setConditions((p) => [...p, v]);
                }
                setConditionInput("");
              }}
              placeholder={t("family.compose.conditionsPlaceholder")}
              returnKeyType="done"
              style={{ marginTop: spacing.xs }}
            />
            {conditions.length > 0 && (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 4 },
                ]}
              >
                {t("family.compose.conditionsSelected", { count: conditions.length })}
              </Text>
            )}
          </FormField>

          <FormField label={t("family.compose.deceasedLabel")}>
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              <Chip
                label={t("family.compose.living")}
                selected={!isDeceased}
                tone={!isDeceased ? "success" : "neutral"}
                onPress={() => setIsDeceased(false)}
              />
              <Chip
                label={t("family.compose.deceased")}
                selected={isDeceased}
                tone={isDeceased ? "danger" : "neutral"}
                onPress={() => setIsDeceased(true)}
              />
            </View>
          </FormField>

          {isDeceased && (
            <FormField label={t("family.compose.causeOfDeathLabel")}>
              <TextInput
                value={causeOfDeath}
                onChangeText={setCauseOfDeath}
                placeholder={t("family.compose.causeOfDeathPlaceholder")}
              />
            </FormField>
          )}

          <FormField label={t("family.compose.notesLabel")} helper={t("family.compose.notesHelper")}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("family.compose.notesPlaceholder")}
              multiline
              numberOfLines={3}
              tone="soft"
            />
          </FormField>

          <Button
            title={t("family.addButton")}
            onPress={saveMember}
            loading={addMember.isPending}
            icon={Plus}
            size="lg"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader
          onBack={() => router.back()}
          title={t("family.title")}
          subtitle={t("family.subtitle", { count: family.length })}
          right={
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              <IconButton
                icon={UserPlus}
                variant="ghost"
                onPress={() => setInviteOpen(true)}
                accessibilityLabel={t("family.invite.buttonTitle")}
              />
              <IconButton
                icon={Plus}
                variant="solid"
                onPress={() => setComposing(true)}
                accessibilityLabel={t("family.addLabel")}
              />
            </View>
          }
        />

        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
          }}
        >
          <View
            style={{
              padding: spacing.lg,
              borderRadius: 24,
              backgroundColor: colors.primarySoft,
              flexDirection: "row",
              gap: spacing.md,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
              }}
            >
              <Users size={20} color={colors.primary} strokeWidth={2.25} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("family.heroTitle")}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
                numberOfLines={2}
              >
                {t("family.heroBody")}
              </Text>
            </View>
          </View>
        </View>

        {isLoading ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={84} radius={20} />
            ))}
          </View>
        ) : family.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("family.empty.title")}
            message={t("family.empty.message")}
            actionLabel={t("family.addButton")}
            onAction={() => setComposing(true)}
            tone="primary"
          />
        ) : (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
            }}
          >
            {family.map((m) => (
              <Card key={m.id} padded={false}>
                <ListItem
                  icon={undefined}
                  iconTone="primary"
                  variant="contact"
                  mediaSlot={
                    <Avatar
                      name={m.name}
                      source={m.photo ? { uri: m.photo } : undefined}
                      size="md"
                      tone="primary"
                      ring
                    />
                  }
                  title={m.name || t("family.fallback")}
                  subtitle={
                    [m.relationship, m.phone].filter(Boolean).join(" · ") ||
                    t("family.fallback")
                  }
                  pill={
                    m.isLocked
                      ? {
                          label: t("family.lock.lockedBadge"),
                          tone: "warning" as const,
                        }
                      : m.bloodGroup
                        ? { label: m.bloodGroup, tone: "danger" }
                        : undefined
                  }
                  rightSlot={
                    <View
                      style={{
                        flexDirection: "row",
                        gap: spacing.xs,
                      }}
                    >
                      <ActionDot
                        icon={Phone}
                        tone="success"
                        onPress={() => callNumber(m.phone)}
                        label={t("family.action.call", { name: m.name })}
                      />
                      <ActionDot
                        icon={MessageCircle}
                        tone="info"
                        onPress={() => textNumber(m.phone)}
                        label={t("family.action.message", { name: m.name })}
                      />
                      {!m.isDeceased ? (
                        <ActionDot
                          icon={m.isLocked ? LockOpen : Lock}
                          tone="warning"
                          onPress={() => confirmLockToggle(m)}
                          label={
                            m.isLocked
                              ? t("family.lock.toggleUnlock")
                              : t("family.lock.toggleLock")
                          }
                        />
                      ) : null}
                      <ActionDot
                        icon={Trash2}
                        tone="danger"
                        onPress={() => confirmDelete(m)}
                        label={t("family.action.remove", { name: m.name })}
                      />
                    </View>
                  }
                />
              </Card>
            ))}

            {pendingInvites.length > 0 && (
              <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
                <Text style={[typography.overline, { color: colors.textMuted }]}>
                  {t("family.invite.pendingTitle")}
                </Text>
                {pendingInvites.map((inv: any) => {
                  let parsed: { name?: string; relationship?: string } = {};
                  try {
                    parsed = JSON.parse(inv.scope || "{}");
                  } catch {
                    parsed = {};
                  }
                  return (
                    <Card key={inv.id}>
                      <ListItem
                        icon={UserPlus}
                        iconBg={colors.accentSoft}
                        title={parsed.name || inv.label || "—"}
                        subtitle={
                          parsed.relationship
                            ? t(`family.relationship.${parsed.relationship}`, {
                                defaultValue: parsed.relationship,
                              })
                            : ""
                        }
                        rightSlot={
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("family.invite.revoke")}
                            onPress={() => revokeInvite.mutate(inv.token)}
                            style={{
                              paddingHorizontal: spacing.md,
                              paddingVertical: spacing.sm,
                              borderRadius: radius.md,
                              backgroundColor: colors.dangerSoft,
                              flexDirection: "row",
                              gap: spacing.xs,
                              alignItems: "center",
                            }}
                          >
                            <Link2Off size={14} color={colors.danger} strokeWidth={2.25} />
                            <Text
                              style={[
                                typography.label.md,
                                { color: colors.danger, fontWeight: "700" },
                              ]}
                            >
                              {t("family.invite.revoke")}
                            </Text>
                          </Pressable>
                        }
                      />
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <FamilyInviteSheet
        visible={inviteOpen}
        onDismiss={() => setInviteOpen(false)}
      />
    </Screen>
  );
}

function ActionDot({
  icon: Icon,
  tone,
  onPress,
  label,
}: {
  icon: any;
  tone: "success" | "info" | "danger" | "warning";
  onPress: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  const bg =
    tone === "success"
      ? colors.successSoft
      : tone === "info"
      ? colors.infoSoft
      : tone === "warning"
      ? colors.warningSoft
      : colors.dangerSoft;
  const fg =
    tone === "success"
      ? colors.success
      : tone === "info"
      ? colors.info
      : tone === "warning"
      ? colors.warning
      : colors.danger;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      <Icon size={16} color={fg} strokeWidth={2.5} />
    </Pressable>
  );
}
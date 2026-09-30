// @ts-nocheck

import { Fragment, useState } from "react";
import {
  View,
  Text,
  Linking,
  Alert,
  ScrollView,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  Users,
  Plus,
  UserPlus,
  Phone,
  MessageCircle,
  Share2,
  Trash2,
  Link2Off,
  Lock,
  LockOpen,
  Droplet,
  HeartPulse,
  Activity,
  ShieldCheck,
  Calendar,
  Clock,
  User,
  FileText,
  X,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  UserRound,
  HeartHandshake,
  Baby,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
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
import { useTone, type Tone } from "@/theme/tone";
import { parseDob } from "@/lib/format";

function getMemberAge(dob?: string): string | null {
  if (!dob) return null;
  const parsed = parseDob(dob.trim());
  if (!parsed) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  if (
    now.getMonth() < parsed.getMonth() ||
    (now.getMonth() === parsed.getMonth() && now.getDate() < parsed.getDate())
  ) {
    age--;
  }
  if (age < 0 || age > 130) return null;
  return `${age} yrs`;
}
import {
  Screen,
  ScreenHeader,
  IconButton,
  ListItem,
  EmptyState,
  ErrorState,
  Skeleton,
  Avatar,
  Card,
  IconTile,
  SectionHeader,
  TextInput,
  FormField,
  Button,
  Chip,
  Pill,
  Divider,
  Pressable,
  DateField,
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

const PRIMARY_RELATIONSHIPS = [
  "Spouse",
  "Father",
  "Mother",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
];

const EXTENDED_RELATIONSHIPS = [
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
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useFamilyMembers();
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
  const [showAllConditions, setShowAllConditions] = useState(false);

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
    const isChild = relationship === "Son" || relationship === "Daughter";
    const parsedDob = parseDob(dateOfBirth.trim());
    let adultDobWarning = false;
    if (isChild && parsedDob) {
      const now = new Date();
      let age = now.getFullYear() - parsedDob.getFullYear();
      if (
        now.getMonth() < parsedDob.getMonth() ||
        (now.getMonth() === parsedDob.getMonth() && now.getDate() < parsedDob.getDate())
      ) {
        age--;
      }
      if (age >= 18) {
        adultDobWarning = true;
      }
    }

    const displayedConditions = showAllConditions
      ? HEREDITARY_CONDITIONS
      : HEREDITARY_CONDITIONS.slice(0, 6);


    const previewAge = getMemberAge(dateOfBirth);
    const relLabel = t(`family.relationship.${relationship}`, { defaultValue: relationship });
    const customConditions = conditions.filter((c) => !HEREDITARY_CONDITIONS.includes(c));
    const addCustomCondition = () => {
      const v = conditionInput.trim();
      if (v && !conditions.some((c) => c.toLowerCase() === v.toLowerCase())) {
        setConditions((p) => [...p, v]);
      }
      setConditionInput("");
    };

    const relChip = (r: string) => {
      const isSelected = relationship === r;
      return (
        <Pressable
          key={r}
          onPress={() => setRelationship(r)}
          haptic="light"
          accessibilityRole="radio"
          accessibilityState={{ selected: isSelected }}
          style={{
            height: 38,
            paddingHorizontal: 14,
            borderRadius: 19,
            borderCurve: "continuous",
            borderWidth: 1.5,
            borderColor: isSelected ? colors.primary : "transparent",
            backgroundColor: isSelected ? colors.primarySoft : colors.fill,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          {isSelected && <Check size={13} color={colors.primary} strokeWidth={3} />}
          <Text style={[typography.label.md, { color: isSelected ? colors.primary : colors.text }]}>
            {t(`family.relationship.${r}`, { defaultValue: r })}
          </Text>
        </Pressable>
      );
    };

    return (
      <Screen scroll={false} keyboard padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => setComposing(false)}
          title={t("family.composeTitle", "Add family member")}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Live preview of the member being created */}
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl }}>
            <Avatar name={name.trim() || relLabel} size="lg" tone={isDeceased ? "neutral" : "primary"} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
                {name.trim() || t("family.compose.previewName", "New family member")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <Pill tone="primary" size="sm">{relLabel}</Pill>
                {previewAge ? <Pill tone="neutral" size="sm" icon={Calendar}>{previewAge}</Pill> : null}
                {bloodGroup ? <Pill tone="danger" size="sm" icon={Droplet}>{bloodGroup}</Pill> : null}
                {isDeceased ? (
                  <Pill tone="neutral" size="sm">{t("family.compose.deceased", "Deceased")}</Pill>
                ) : null}
              </View>
            </View>
          </Card>

          {/* ─── Relationship ─── */}
          <ComposeSection title={t("family.compose.relationshipLabel", "Relationship")}>
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.textSubtle, marginLeft: 2 }]}>
                {t("family.compose.immediateCaption", "Immediate family")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {PRIMARY_RELATIONSHIPS.map(relChip)}
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.textSubtle, marginLeft: 2 }]}>
                {t("family.compose.extendedCaption", "Extended family")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {EXTENDED_RELATIONSHIPS.map(relChip)}
              </View>
            </View>
          </ComposeSection>

          {/* ─── Personal details ─── */}
          <ComposeSection title={t("family.compose.personalSection", "Personal Details")}>
            <FormField label={t("family.compose.nameLabel", "Name")} required>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("family.compose.fullNamePlaceholder", "e.g., Sarah Perera")}
                autoCapitalize="words"
                textContentType="name"
                leadingIcon={User}
                tone="soft"
                maxLength={60}
              />
            </FormField>

            <FormField
              label={t("family.compose.phoneLabel", "Phone Number")}
              helper={t("family.compose.phoneHelper", "Used for emergency calling & secure share notifications")}
            >
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={t("family.compose.phonePlaceholder", "+94 77 123 4567")}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                leadingIcon={Phone}
                tone="soft"
              />
            </FormField>

            <FormField
              label={t("family.compose.dobLabel", "Date of Birth")}
              helper={
                previewAge
                  ? t("family.compose.ageHelper", { age: previewAge, defaultValue: "Age {{age}}" })
                  : t("family.compose.dobHelper", "Encouraged for children — used for age-aware care.")
              }
            >
              <DateField
                value={parseDob(dateOfBirth.trim()) ?? undefined}
                maximumDate={new Date()}
                placeholder={t("family.compose.dobPick", "Select date of birth")}
                onChange={(d) => {
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const dd = String(d.getDate()).padStart(2, "0");
                  setDateOfBirth(`${d.getFullYear()}-${mm}-${dd}`);
                }}
              />
            </FormField>

            {adultDobWarning && (
              <View
                style={{
                  backgroundColor: colors.warningSoft,
                  padding: spacing.md,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: spacing.sm,
                }}
              >
                <AlertCircle size={18} color={colors.warning} style={{ marginTop: 1 }} />
                <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
                  {t("family.compose.adultDobWarning")}
                </Text>
              </View>
            )}

            {/* Living / deceased — quiet toggle row rather than a primary control */}
            <Pressable
              onPress={() => setIsDeceased(!isDeceased)}
              haptic="light"
              accessibilityRole="switch"
              accessibilityState={{ checked: isDeceased }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingTop: spacing.md,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.title.xs, { color: colors.text }]}>
                  {t("family.compose.passedAway", "Has passed away")}
                </Text>
                <Text style={[typography.caption, { color: colors.textSubtle }]}>
                  {t("family.compose.passedAwayHelper", "Still counts toward hereditary risk")}
                </Text>
              </View>
              <View
                style={{
                  width: 50,
                  height: 30,
                  borderRadius: 15,
                  padding: 3,
                  backgroundColor: isDeceased ? colors.primary : colors.fillStrong,
                  alignItems: isDeceased ? "flex-end" : "flex-start",
                }}
              >
                <View
                  style={[
                    { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" },
                    shadow.xs,
                  ]}
                />
              </View>
            </Pressable>

            {isDeceased && (
              <FormField
                label={t("family.compose.causeOfDeathLabel", "Cause of death")}
                helper={t("family.compose.causeOfDeathHelper", "Optional — helps assess hereditary risk")}
              >
                <TextInput
                  value={causeOfDeath}
                  onChangeText={setCauseOfDeath}
                  placeholder={t("family.compose.causeOfDeathExample", "e.g., Heart condition")}
                  tone="soft"
                />
              </FormField>
            )}
          </ComposeSection>

          {/* ─── Medical profile ─── */}
          <ComposeSection
            title={t("family.compose.medicalSection", "Medical Profile")}
            trailing={t("family.compose.optional", "Optional")}
          >
            <FormField
              label={t("family.compose.bloodGroupLabel", "Blood Group")}
              helper={t("family.compose.bloodGroupHelper", "Optional — used for emergency profile")}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {BLOOD_GROUPS.map((bg) => {
                  const isSelected = bloodGroup === bg;
                  return (
                    <Pressable
                      key={bg}
                      onPress={() => setBloodGroup(isSelected ? null : bg)}
                      haptic="light"
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      style={{
                        flexBasis: "22%",
                        flexGrow: 1,
                        height: 46,
                        borderRadius: 14,
                        borderCurve: "continuous",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 4,
                        borderWidth: 1.5,
                        borderColor: isSelected ? colors.danger : "transparent",
                        backgroundColor: isSelected ? colors.dangerSoft : colors.fill,
                      }}
                    >
                      {isSelected && (
                        <Droplet size={13} color={colors.danger} fill={colors.danger} strokeWidth={2} />
                      )}
                      <Text
                        style={[typography.title.sm, { color: isSelected ? colors.danger : colors.text }]}
                      >
                        {bg}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </FormField>

            <FormField
              label={t("family.compose.conditionsLabel", "Hereditary Conditions")}
              helper={t("family.compose.conditionsHelper", "Helps assess your personal and family health risks")}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {displayedConditions.map((c) => {
                  const isSelected = conditions.includes(c);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => toggleCondition(c)}
                      haptic="light"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      style={{
                        height: 36,
                        paddingHorizontal: 13,
                        borderRadius: 18,
                        borderWidth: 1.5,
                        borderColor: isSelected ? colors.warning : "transparent",
                        backgroundColor: isSelected ? colors.warningSoft : colors.fill,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      {isSelected && <Check size={12} color={colors.warning} strokeWidth={3} />}
                      <Text style={[typography.label.md, { color: isSelected ? colors.warning : colors.text }]}>
                        {t(`family.condition.${c}`, { defaultValue: c })}
                      </Text>
                    </Pressable>
                  );
                })}
                {customConditions.map((c) => (
                  <Pressable
                    key={`custom-${c}`}
                    onPress={() => toggleCondition(c)}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityLabel={t("family.compose.removeCondition", { name: c, defaultValue: "Remove {{name}}" })}
                    style={{
                      height: 36,
                      paddingLeft: 13,
                      paddingRight: 9,
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: colors.warning,
                      backgroundColor: colors.warningSoft,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Text style={[typography.label.md, { color: colors.warning }]}>{c}</Text>
                    <X size={13} color={colors.warning} strokeWidth={2.75} />
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setShowAllConditions(!showAllConditions)}
                  haptic="light"
                  style={{
                    height: 36,
                    paddingHorizontal: 12,
                    borderRadius: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Text style={[typography.label.md, { color: colors.primary }]}>
                    {showAllConditions
                      ? t("common.showLess", "Show fewer")
                      : t("family.compose.moreConditions", {
                          count: HEREDITARY_CONDITIONS.length - displayedConditions.length,
                          defaultValue: "+{{count}} more",
                        })}
                  </Text>
                  {showAllConditions ? (
                    <ChevronUp size={14} color={colors.primary} />
                  ) : (
                    <ChevronDown size={14} color={colors.primary} />
                  )}
                </Pressable>
              </View>

              <TextInput
                value={conditionInput}
                onChangeText={setConditionInput}
                onSubmitEditing={addCustomCondition}
                blurOnSubmit={false}
                placeholder={t("family.compose.conditionsPlaceholder", "Type custom condition…")}
                returnKeyType="done"
                tone="soft"
                leadingIcon={Plus}
                trailingIcon={conditionInput.trim() ? Check : undefined}
                onTrailingIconPress={addCustomCondition}
                containerStyle={{ marginTop: spacing.xs }}
              />
            </FormField>
          </ComposeSection>

          {/* ─── Notes ─── */}
          <ComposeSection
            title={t("family.compose.notesSection", "Additional Context")}
            trailing={t("family.compose.optional", "Optional")}
          >
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("family.compose.notesPlaceholder", "e.g., Medical history, allergies, pediatric notes…")}
              multiline
              numberOfLines={3}
              tone="soft"
              leadingIcon={FileText}
              style={{ minHeight: 84, textAlignVertical: "top" }}
            />
          </ComposeSection>
        </ScrollView>

        {/* Sticky save */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.hairline,
          }}
        >
          <Button
            title={
              name.trim()
                ? t("family.compose.addNamed", { name: name.trim().split(/\s+/)[0], defaultValue: "Add {{name}}" })
                : t("family.addButton", "Add member")
            }
            onPress={saveMember}
            loading={addMember.isPending}
            icon={Plus}
            size="lg"
            variant="primary"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  function renderPendingInvitesList() {
    if (pendingInvites.length === 0) return null;
    return (
      <View style={{ marginTop: spacing.lg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
            paddingHorizontal: 2,
          }}
        >
          <Text
            style={[
              typography.overline,
              {
                color: colors.textSubtle,
              },
            ]}
          >
            {t("family.invite.pendingTitle", "PENDING INVITES").toUpperCase()}
          </Text>
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.full,
              backgroundColor: colors.primarySoft,
            }}
          >
            <Text
              style={[
                typography.label.sm,
                { color: colors.primary },
              ]}
            >
              {pendingInvites.length}
            </Text>
          </View>
        </View>

        <Card padded={false}>
          {pendingInvites.map((inv: any, i: number) => {
            let parsed: { name?: string; relationship?: string } = {};
            try {
              parsed = JSON.parse(inv.scope || "{}");
            } catch {
              parsed = {};
            }
            return (
              <View key={inv.id}>
                <ListItem
                  icon={UserPlus}
                  iconTone="accent"
                  title={parsed.name || inv.label || "—"}
                  subtitle={
                    parsed.relationship
                      ? t(`family.relationship.${parsed.relationship}`, {
                          defaultValue: parsed.relationship,
                        })
                      : t("family.invite.pendingExpires", { date: "Active" })
                  }
                  rightSlot={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("family.invite.revoke")}
                      haptic="light"
                      onPress={() => revokeInvite.mutate(inv.token)}
                      style={{
                        paddingHorizontal: spacing.md,
                        height: 32,
                        borderRadius: 999,
                        backgroundColor: colors.dangerSoft,
                        flexDirection: "row",
                        gap: spacing.xs,
                        alignItems: "center",
                      }}
                    >
                      <Link2Off size={13} color={colors.danger} strokeWidth={2.5} />
                      <Text
                        style={[
                          typography.label.sm,
                          { color: colors.danger },
                        ]}
                      >
                        {t("family.invite.revoke")}
                      </Text>
                    </Pressable>
                  }
                  bordered={false}
                />
                {i < pendingInvites.length - 1 ? <Divider /> : null}
              </View>
            );
          })}
        </Card>
      </View>
    );
  }

  const showActionBar = !isLoading && !isError && family.length === 0;

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: showActionBar ? spacing.xxl : spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          onBack={() => router.back()}
          title={t("family.title")}
          subtitle={
            family.length > 0
              ? t("family.subtitle", { count: family.length })
              : undefined
          }
          right={
            family.length === 0 ? undefined : (
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
            )
          }
        />

        {isLoading ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={120} radius={radius.card} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load family")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : family.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xl }}>
            <AuroraSurface>
              <View style={{ padding: spacing.xl, gap: spacing.lg }}>
                {/* Family avatar cluster with an open "+" seat */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {[
                    { Ic: UserRound, tone: "primary" as const },
                    { Ic: HeartHandshake, tone: "danger" as const },
                    { Ic: Baby, tone: "success" as const },
                  ].map(({ Ic, tone }, i) => (
                    <ClusterAvatar key={i} icon={Ic} tone={tone} first={i === 0} />
                  ))}
                  <Pressable
                    onPress={() => setComposing(true)}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityLabel={t("family.addLabel", "Add family member")}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      marginLeft: -12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255,255,255,0.14)",
                      borderWidth: 2,
                      borderStyle: "dashed",
                      borderColor: "rgba(255,255,255,0.7)",
                    }}
                  >
                    <Plus size={20} color={colors.onPrimary} strokeWidth={2.6} />
                  </Pressable>
                </View>
                <View style={{ gap: spacing.xs }}>
                  <Text
                    style={[
                      typography.display.md,
                      { color: colors.onPrimary, letterSpacing: -0.8 },
                    ]}
                  >
                    {t("family.heroTitle", "Care together")}
                  </Text>
                  <Text
                    style={[
                      typography.body.md,
                      { color: colors.glassOnPrimarySoft, lineHeight: 21 },
                    ]}
                  >
                    {t("family.heroBody")}
                  </Text>
                </View>
              </View>
            </AuroraSurface>

            {/* Quick start — preset the relationship and jump into the form */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title={t("family.quickStart.title", "Who are you adding?")}
                style={{ paddingBottom: 0 }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {[
                  { rel: "Spouse", icon: HeartHandshake, tone: "danger" as const },
                  { rel: "Mother", icon: UserRound, tone: "accent2" as const },
                  { rel: "Father", icon: UserRound, tone: "primary" as const },
                  { rel: "Son", icon: Baby, tone: "success" as const },
                  { rel: "Daughter", icon: Baby, tone: "warning" as const },
                  { rel: null, icon: Users, tone: "neutral" as const },
                ].map((q) => (
                  <QuickStartTile
                    key={q.rel ?? "other"}
                    icon={q.icon}
                    tone={q.tone}
                    label={
                      q.rel
                        ? t(`family.relationship.${q.rel}`, { defaultValue: q.rel })
                        : t("family.quickStart.other", "Someone else")
                    }
                    onPress={() => {
                      if (q.rel) setRelationship(q.rel);
                      setComposing(true);
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title={t("family.features.sectionTitle", "What you get")}
                style={{ paddingBottom: 0 }}
              />
              <Card padded={false}>
                {[
                  {
                    icon: HeartPulse,
                    tone: "danger" as const,
                    title: t("family.features.emergencyTitle", "Emergency Ready"),
                    description: t(
                      "family.features.emergencyDesc",
                      "Blood type, hereditary risks and ICE contacts on hand."
                    ),
                  },
                  {
                    icon: Activity,
                    tone: "success" as const,
                    title: t("family.features.dependentsTitle", "Coordinated Care"),
                    description: t(
                      "family.features.dependentsDesc",
                      "Medications and visits for children and parents."
                    ),
                  },
                  {
                    icon: ShieldCheck,
                    tone: "primary" as const,
                    title: t("family.features.privacyTitle", "Private by default"),
                    description: t(
                      "family.features.privacyDesc",
                      "Lock any record, or invite with a secure link."
                    ),
                  },
                ].map((f, i) => (
                  <Fragment key={f.title}>
                    {i > 0 ? <Divider inset={spacing.lg + 44 + spacing.md} /> : null}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: spacing.md,
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md + 2,
                      }}
                    >
                      <IconTile icon={f.icon} tone={f.tone} size={44} />
                      <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
                        <Text style={[typography.title.sm, { color: colors.text }]}>
                          {f.title}
                        </Text>
                        <Text
                          style={[
                            typography.body.sm,
                            { color: colors.textMuted, lineHeight: 19 },
                          ]}
                        >
                          {f.description}
                        </Text>
                      </View>
                    </View>
                  </Fragment>
                ))}
              </Card>
            </View>

            {/* How it works — compact horizontal stepper */}
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title={t("family.howTitle", "How it works")}
                style={{ paddingBottom: 0 }}
              />
              <Card style={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.md }}>
                <View style={{ flexDirection: "row" }}>
                  {[
                    { icon: UserPlus, title: t("family.how.addShort", "Add") , body: t("family.how.addBody", "Create a profile for a child, parent or partner.") },
                    { icon: Share2, title: t("family.how.inviteShort", "Invite"), body: t("family.how.inviteBody", "Let adults manage their own records securely.") },
                    { icon: HeartPulse, title: t("family.how.careShort", "Care"), body: t("family.how.careBody", "Track medicines, visits and emergency info together.") },
                  ].map((s, i, all) => (
                    <View key={s.title} style={{ flex: 1, alignItems: "center", gap: spacing.sm }}>
                      <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch" }}>
                        <View
                          style={{
                            flex: 1,
                            height: 2,
                            borderRadius: 1,
                            backgroundColor: i === 0 ? "transparent" : colors.primarySoft,
                          }}
                        />
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: i === 0 ? colors.primary : colors.primarySoft,
                          }}
                        >
                          <s.icon
                            size={19}
                            color={i === 0 ? colors.onPrimary : colors.primary}
                            strokeWidth={2.3}
                          />
                        </View>
                        <View
                          style={{
                            flex: 1,
                            height: 2,
                            borderRadius: 1,
                            backgroundColor: i === all.length - 1 ? "transparent" : colors.primarySoft,
                          }}
                        />
                      </View>
                      <Text style={[typography.overline, { color: colors.primary, fontSize: 10 }]}>
                        {t("family.how.step", { n: i + 1, defaultValue: `Step ${i + 1}` })}
                      </Text>
                      <Text style={[typography.title.sm, { color: colors.text, marginTop: -4 }]}>
                        {s.title}
                      </Text>
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textMuted, textAlign: "center", paddingHorizontal: 4 },
                        ]}
                      >
                        {s.body}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>

            {renderPendingInvitesList()}
          </View>
        ) : (
          <View>
            {/* Active Family Network Header */}
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.md,
              }}
            >
              <AuroraSurface>
                <View style={{ padding: spacing.xl, gap: spacing.md }}>
                  <Text
                    style={[
                      typography.kicker,
                      {
                        color: colors.glassOnPrimarySoft,
                        textTransform: "uppercase",
                      },
                    ]}
                  >
                    {t("family.title")}
                  </Text>

                  <View style={{ gap: 2 }}>
                    <Text
                      style={[
                        typography.display.lg,
                        {
                          color: colors.onPrimary,
                          fontSize: 46,
                          lineHeight: 52,
                          letterSpacing: -1.6,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {family.length}
                    </Text>
                    <Text
                      style={[
                        typography.body.md,
                        { color: colors.glassOnPrimarySoft },
                      ]}
                    >
                      {t("family.heroNumeralLabel", "People in your care circle")}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing.sm,
                      alignItems: "center",
                      marginTop: spacing.xs,
                    }}
                  >
                    {pendingInvites.length > 0 ? (
                      <HeroChip
                        icon={Clock}
                        label={t("family.invite.pendingCount", {
                          count: pendingInvites.length,
                        })}
                      />
                    ) : null}
                    <HeroChip
                      icon={ShieldCheck}
                      label={t("family.emergencyReady", "Emergency ready")}
                    />
                  </View>
                </View>
              </AuroraSurface>
            </View>

            {/* Member Cards List */}
            <View
              style={{
                paddingHorizontal: spacing.lg,
                gap: spacing.md,
              }}
            >
              {family.map((m) => (
                <Card
                  key={m.id}
                  padded={false}
                  style={{
                    overflow: "hidden",
                  }}
                >
                  {/* Identity Row */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: spacing.md,
                      padding: spacing.lg,
                      paddingBottom: spacing.sm,
                    }}
                  >
                    <Avatar
                      name={m.name}
                      source={m.photo ? { uri: m.photo } : undefined}
                      size="lg"
                      tone="primary"
                      ring
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: spacing.xs,
                        }}
                      >
                        <Text
                          style={[
                            typography.title.md,
                            { color: colors.text, flexShrink: 1 },
                          ]}
                          numberOfLines={1}
                        >
                          {m.name || t("family.fallback")}
                        </Text>

                        {m.bloodGroup && (
                          <Pill
                            icon={Droplet}
                            label={m.bloodGroup}
                            tone="danger"
                            size="sm"
                          />
                        )}
                      </View>

                      {/* Badges row */}
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: spacing.xs,
                          marginTop: 2,
                        }}
                      >
                        {m.relationship && (
                          <Pill
                            label={t(`family.relationship.${m.relationship}`, {
                              defaultValue: m.relationship,
                            })}
                            tone="primary"
                            size="sm"
                          />
                        )}
                        {m.isLocked && (
                          <Pill
                            icon={Lock}
                            label={t("family.lock.lockedBadge")}
                            tone="warning"
                            size="sm"
                          />
                        )}
                        {m.isDeceased && (
                          <Pill
                            label={t("family.compose.deceased", "Deceased")}
                            tone="neutral"
                            size="sm"
                          />
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Contact & Medical details */}
                  <View
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingBottom: spacing.md,
                      gap: 6,
                    }}
                  >
                    {m.phone && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.xs,
                        }}
                      >
                        <Phone size={13} color={colors.textSubtle} />
                        <Text
                          style={[typography.body.sm, { color: colors.textMuted }]}
                        >
                          {m.phone}
                        </Text>
                      </View>
                    )}

                    {m.dateOfBirth && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.xs,
                        }}
                      >
                        <Calendar size={13} color={colors.textSubtle} />
                        <Text
                          style={[typography.body.sm, { color: colors.textMuted }]}
                        >
                          {[getMemberAge(m.dateOfBirth), m.dateOfBirth]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                    )}

                    {/* Hereditary conditions */}
                    {Array.isArray(m.conditions) && m.conditions.length > 0 && (
                      <View style={{ marginTop: 4, gap: 4 }}>
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textSubtle },
                          ]}
                        >
                          {t("family.compose.conditionsLabel", "Hereditary conditions")}:
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                          {m.conditions.map((c: string) => (
                            <Pill
                              key={c}
                              label={t(`family.condition.${c}`, { defaultValue: c })}
                              tone="warning"
                              size="sm"
                            />
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Notes */}
                    {m.notes && (
                      <View
                        style={{
                          marginTop: 6,
                          padding: spacing.md,
                          borderRadius: 14,
                          borderCurve: "continuous",
                          backgroundColor: colors.fill,
                        }}
                      >
                        <Text
                          style={[
                            typography.body.sm,
                            { color: colors.textMuted, fontStyle: "italic" },
                          ]}
                          numberOfLines={2}
                        >
                          "{m.notes}"
                        </Text>
                      </View>
                    )}
                  </View>

                  <Divider />

                  {/* Action Strip */}
                  <View
                    style={{
                      flexDirection: "row",
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                    }}
                  >
                    <MemberAction
                      icon={Phone}
                      tone="success"
                      label={t("family.act.call")}
                      a11y={t("family.action.call", { name: m.name })}
                      disabled={!m.phone}
                      onPress={() => callNumber(m.phone)}
                    />
                    <MemberAction
                      icon={MessageCircle}
                      tone="info"
                      label={t("family.act.message")}
                      a11y={t("family.action.message", { name: m.name })}
                      disabled={!m.phone}
                      onPress={() => textNumber(m.phone)}
                    />
                    <MemberAction
                      icon={Share2}
                      tone="primary"
                      label={t("family.act.share")}
                      a11y={t("family.action.share", { name: m.name })}
                      onPress={() =>
                        router.push({
                          pathname: "/share",
                          params: {
                            prefillFmId: m.id,
                            prefillFmName: m.name,
                          },
                        })
                      }
                    />
                    {!m.isDeceased ? (
                      <MemberAction
                        icon={m.isLocked ? LockOpen : Lock}
                        tone="warning"
                        label={
                          m.isLocked
                            ? t("family.lock.toggleUnlock")
                            : t("family.lock.toggleLock")
                        }
                        a11y={
                          m.isLocked
                            ? t("family.lock.toggleUnlock")
                            : t("family.lock.toggleLock")
                        }
                        onPress={() => confirmLockToggle(m)}
                      />
                    ) : null}
                    <MemberAction
                      icon={Trash2}
                      tone="danger"
                      label={t("family.act.remove")}
                      a11y={t("family.action.remove", { name: m.name })}
                      onPress={() => confirmDelete(m)}
                    />
                  </View>
                </Card>
              ))}

              {/* Pending invites */}
              {renderPendingInvitesList()}
            </View>
          </View>
        )}
      </ScrollView>

      {showActionBar ? (
        <FamilyActionBar
          onAdd={() => setComposing(true)}
          onInvite={() => setInviteOpen(true)}
        />
      ) : null}

      <FamilyInviteSheet
        visible={inviteOpen}
        onDismiss={() => setInviteOpen(false)}
      />
    </Screen>
  );
}

/** One face in the hero's family cluster — white disc with a tone glyph. */
function ClusterAvatar({ icon: Icon, tone, first }: { icon: LucideIcon; tone: Tone; first?: boolean }) {
  const pal = useTone(tone);
  return (
    <View
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        marginLeft: first ? 0 : -12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.9)",
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pal.bg,
        }}
      >
        <Icon size={20} color={pal.fg} strokeWidth={2.3} />
      </View>
    </View>
  );
}

/** Translucent chip rendered on the gradient hero card. */
function HeroChip({
  icon: Icon,
  label,
  onPress,
}: {
  icon?: LucideIcon;
  label: string;
  onPress?: () => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: spacing.md - 2,
        paddingVertical: 5,
        borderRadius: radius.full,
        backgroundColor: colors.glassOnPrimary,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255, 255, 255, 0.22)",
        alignSelf: "flex-start",
      }}
    >
      {Icon && <Icon size={11} color={colors.glassOnPrimarySoft} strokeWidth={2.4} />}
      <Text
        style={[
          typography.label.sm,
          { color: colors.glassOnPrimarySoft },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} haptic="light">
        {content}
      </Pressable>
    );
  }
  return content;
}

/**
 * Brand-gradient surface: a restrained aurora (two large, low-opacity
 * off-canvas glows) plus a hairline top highlight, so the card reads as
 * depth rather than decoration. Shared by the empty and active headers.
 */
function AuroraSurface({ children }: { children: React.ReactNode }) {
  const { colors, radius, shadow, scheme } = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: radius.xxl,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: colors.primaryGradientEnd,
        },
        scheme === "dark" ? null : shadow.hero,
      ]}
    >
      <LinearGradient
        colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -120,
          right: -100,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: "rgba(255, 255, 255, 0.13)",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -140,
          left: -90,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: "rgba(4, 120, 190, 0.20)",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "rgba(255, 255, 255, 0.24)",
        }}
      />
      {children}
    </View>
  );
}

/** Relationship shortcut on the empty state — opens the form preset. */
function QuickStartTile({
  icon: Icon,
  tone,
  label,
  onPress,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const pal = useTone(tone);
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          flexBasis: "30%",
          flexGrow: 1,
          alignItems: "center",
          gap: spacing.sm,
          paddingVertical: spacing.md + 2,
          paddingHorizontal: spacing.xs,
          borderRadius: 20,
          borderCurve: "continuous",
          backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
        },
        scheme === "dark" ? null : shadow.xs,
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pal.bg,
        }}
      >
        <Icon size={20} color={pal.fg} strokeWidth={2.3} />
      </View>
      <Text style={[typography.label.md, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Pinned bottom action bar for the empty state — one full-width primary
 * action, with the invite path as a quieter secondary line underneath.
 */
function FamilyActionBar({
  onAdd,
  onInvite,
}: {
  onAdd: () => void;
  onInvite: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.hairline,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: Math.max(insets.bottom, spacing.md),
        backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
        gap: spacing.sm,
      }}
    >
      <Button
        title={t("family.addLabel", "Add family member")}
        icon={Plus}
        size="lg"
        variant="primary"
        onPress={onAdd}
      />
      <Pressable
        onPress={onInvite}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={t("family.invite.buttonTitle", "Invite by link")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: spacing.sm,
        }}
      >
        <Text style={[typography.body.sm, { color: colors.textMuted }]}>
          {t("family.invite.prompt", "Adult with their own phone?")}
        </Text>
        <Share2 size={14} color={colors.primary} strokeWidth={2.5} />
        <Text style={[typography.label.lg, { color: colors.primary }]}>
          {t("family.invite.buttonTitle", "Invite by link")}
        </Text>
      </Pressable>
    </View>
  );
}

/** Labeled icon column inside a member card's action strip. */
function MemberAction({
  icon: Icon,
  tone,
  onPress,
  label,
  a11y,
  disabled = false,
}: {
  icon: LucideIcon;
  tone: Tone;
  onPress: () => void;
  label: string;
  a11y?: string;
  disabled?: boolean;
}) {
  const { spacing, typography, colors } = useTheme();
  const pal = useTone(tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      haptic={disabled ? "none" : "light"}
      onPress={disabled ? undefined : onPress}
      style={{
        flex: 1,
        alignItems: "center",
        gap: 4,
        paddingVertical: spacing.xs,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pal.bg,
        }}
      >
        <Icon size={16} color={pal.fg} strokeWidth={2.5} />
      </View>
      <Text
        style={[
          typography.label.xs,
          {
            color: disabled ? colors.textMuted : pal.fg,
            letterSpacing: 0,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Section header inside the composer cards */
/** Overline-titled grouped card used by the add-member form. */
function ComposeSection({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: string;
  children: React.ReactNode;
}) {
  const { spacing, typography, colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          marginHorizontal: 4,
        }}
      >
        <Text style={[typography.overline, { color: colors.textMuted }]}>{title}</Text>
        {trailing ? (
          <Text style={[typography.caption, { color: colors.textSubtle }]}>{trailing}</Text>
        ) : null}
      </View>
      <Card padded={false}>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>{children}</View>
      </Card>
    </View>
  );
}

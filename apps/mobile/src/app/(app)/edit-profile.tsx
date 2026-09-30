import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput as RNTextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  ShieldCheck,
  Save,
  Trash2,
  Plus,
  Phone,
  User as UserIcon,
  Camera,
  Droplet,
  Ruler,
  Weight,
  Cake,
  Activity,
  X,
  HeartHandshake,
  AlertTriangle,
  Stethoscope,
  type LucideIcon,
} from "lucide-react-native";
import {
  useUpdatePatientProfile,
  usePatientProfile,
} from "@/hooks/useApi";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import {
  Screen,
  ScreenHeader,
  Card,
  Avatar,
  Button,
  useToast,
  DateField,
  FormField,
  TextInput,
} from "@/components/ui";

const BLOOD_GROUPS = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];
const GENDER_VALUES = ["male", "female", "other"] as const;
const RELATIONSHIP_KEYS = ["parent", "spouse", "sibling", "child", "friend"] as const;

type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, scheme, shadow } = useTheme();
  const toast = useToast();
  const { data, isLoading } = usePatientProfile();
  const updateProfile = useUpdatePatientProfile();
  const setUser = useAuthStore((s) => s.setUser);

  const patient = data?.patient?.patients;
  const userRow = data?.patient?.users;

  const [bloodGroup, setBloodGroup] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const dobDate = useMemo(() => {
    if (!dateOfBirth) return undefined;
    const d = new Date(dateOfBirth);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, [dateOfBirth]);
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  // Uncommitted text in the tag inputs — merged on save so nothing typed is lost.
  const [allergyDraft, setAllergyDraft] = useState("");
  const [conditionDraft, setConditionDraft] = useState("");
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [savingPhoto, setSavingPhoto] = useState(false);

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (patient && !initialized) {
      setBloodGroup(patient.bloodGroup || "");
      setHeight(patient.height?.toString() || "");
      setWeight(patient.weight?.toString() || "");
      setGender(patient.gender || "");
      setDateOfBirth(patient.dateOfBirth || "");
      setAllergies(parseList(patient.allergies));
      setConditions(parseList(patient.medicalConditions));
      setContacts(parseContacts(patient.emergencyContacts));
      setPhotoUri(userRow?.photo || undefined);
      setInitialized(true);
    }
  }, [patient, userRow, initialized]);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.show(t("editProfile.photo.permissionDenied"), "warning");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    // ─── Client-side validation ──────────────────────────
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      toast.show(t("editProfile.error.dobFormat"), "danger");
      return;
    }
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (Number.isNaN(d.getTime()) || d.getTime() > Date.now()) {
        toast.show(t("editProfile.error.dobInvalid"), "danger");
        return;
      }
    }
    const heightNum = height ? parseFloat(height) : NaN;
    const weightNum = weight ? parseFloat(weight) : NaN;
    if (height && (Number.isNaN(heightNum) || heightNum < 50 || heightNum > 250)) {
      toast.show(t("editProfile.error.heightRange"), "danger");
      return;
    }
    if (weight && (Number.isNaN(weightNum) || weightNum < 10 || weightNum > 400)) {
      toast.show(t("editProfile.error.weightRange"), "danger");
      return;
    }
    if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup)) {
      toast.show(t("editProfile.error.bloodGroup"), "danger");
      return;
    }
    const cleanedContacts = contacts
      .map((c) => ({
        name: c.name.trim(),
        relationship: c.relationship.trim(),
        phone: c.phone.replace(/[^\d+]/g, "").trim(),
      }))
      .filter((c) => c.name || c.phone);
    for (const c of cleanedContacts) {
      if (!c.name) {
        toast.show(t("editProfile.error.contactName"), "danger");
        return;
      }
      if (!c.phone || c.phone.length < 7) {
        toast.show(t("editProfile.error.contactPhone"), "danger");
        return;
      }
    }

    try {
      if (photoUri && photoUri !== userRow?.photo) {
        setSavingPhoto(true);
        // Upload via existing files endpoint (patient allowed)
        const file = {
          uri: photoUri,
          name: "avatar.jpg",
          type: "image/jpeg",
        } as any;
        const uploadRes = await api<{ file: { url: string } }>("/files/upload", {
          method: "POST",
          body: (() => {
            const fd = new FormData();
            fd.append("file", file as any);
            return fd;
          })(),
          isFormData: true,
        });
        const updated = await api<{ user: any }>("/auth/me", {
          method: "PUT",
          body: { photo: uploadRes.file.url },
        });
        setUser(updated.user);
      }

      await updateProfile.mutateAsync({
        bloodGroup: bloodGroup || undefined,
        height: height ? heightNum : undefined,
        weight: weight ? weightNum : undefined,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        allergies: splitList(joinTags(allergies, allergyDraft)),
        medicalConditions: splitList(joinTags(conditions, conditionDraft)),
        emergencyContacts: cleanedContacts.length ? JSON.stringify(cleanedContacts) : undefined,
      });

      toast.show(t("editProfile.toast.saved"), "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("editProfile.toast.saveError"), "danger");
    } finally {
      setSavingPhoto(false);
    }
  }

  const age = useMemo(() => {
    if (!dobDate) return null;
    const now = new Date();
    let a = now.getFullYear() - dobDate.getFullYear();
    const m = now.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dobDate.getDate())) a--;
    return a >= 0 && a < 150 ? a : null;
  }, [dobDate]);

  const bmi = useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w || h < 50 || w < 10) return null;
    return w / Math.pow(h / 100, 2);
  }, [height, weight]);

  const bmiBand =
    bmi == null
      ? null
      : bmi < 18.5
        ? { key: "under", color: colors.warning }
        : bmi < 25
          ? { key: "healthy", color: colors.success }
          : bmi < 30
            ? { key: "over", color: colors.warning }
            : { key: "obese", color: colors.danger };

  const saving = updateProfile.isPending || savingPhoto;

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title={t("editProfile.title")} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
      >
        {/* ─── Identity ─── */}
        <Card style={{ alignItems: "center", paddingVertical: spacing.xl, marginBottom: spacing.xl }}>
          <Pressable
            onPress={pickPhoto}
            accessibilityRole="button"
            accessibilityLabel={t("editProfile.accessibilityLabel.changePhoto")}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Avatar
              name={userRow?.name || t("common.you")}
              uri={photoUri}
              size="2xl"
              tone="primary"
              ring
            />
            <View
              style={{
                position: "absolute",
                right: 0,
                bottom: 2,
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
                borderWidth: 3,
                borderColor: colors.surface,
              }}
            >
              <Camera size={15} color={colors.onPrimary} strokeWidth={2.5} />
            </View>
          </Pressable>

          <Text
            style={[typography.title.lg, { color: colors.text, marginTop: spacing.md }]}
            numberOfLines={1}
          >
            {userRow?.name || "—"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              marginTop: 6,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.successSoft,
            }}
          >
            <ShieldCheck size={13} color={colors.success} strokeWidth={2.5} />
            <Text style={[typography.label.sm, { color: colors.success }]}>
              {userRow?.verified
                ? t("editProfile.verifiedStatus.verified")
                : t("editProfile.verifiedStatus.goodStanding")}
            </Text>
          </View>

          {/* Live vitals summary */}
          <View
            style={{
              flexDirection: "row",
              alignSelf: "stretch",
              marginTop: spacing.lg,
              marginHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: colors.fill,
            }}
          >
            <Vital label={t("editProfile.vitals.age")} value={age != null ? String(age) : "—"} />
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
            <Vital
              label={t("editProfile.vitals.blood")}
              value={bloodGroup || "—"}
              color={bloodGroup ? colors.danger : undefined}
            />
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
            <Vital
              label={t("editProfile.vitals.bmi")}
              value={bmi != null ? bmi.toFixed(1) : "—"}
              color={bmiBand?.color}
            />
          </View>
        </Card>

        {/* ─── Basics ─── */}
        <FormSection title={t("editProfile.basicsHeading")}>
          <FormField label={t("editProfile.bloodGroup.label")}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {BLOOD_GROUPS.map((bg) => {
                const selected = bloodGroup === bg;
                return (
                  <Pressable
                    key={bg}
                    onPress={() => setBloodGroup(bg)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => ({
                      flexBasis: "22%",
                      flexGrow: 1,
                      height: 46,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      borderWidth: 1.5,
                      borderColor: selected ? colors.danger : "transparent",
                      backgroundColor: selected ? colors.dangerSoft : colors.fill,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    {selected ? (
                      <Droplet size={13} color={colors.danger} fill={colors.danger} strokeWidth={2} />
                    ) : null}
                    <Text
                      style={[
                        typography.title.sm,
                        { color: selected ? colors.danger : colors.text },
                      ]}
                    >
                      {bg}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          <FormField label={t("editProfile.gender.label")}>
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
              {GENDER_VALUES.map((g) => {
                const selected = gender?.toLowerCase() === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGender(g)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      {
                        flex: 1,
                        height: 40,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: selected ? colors.surface : "transparent",
                      },
                      selected ? shadow.xs : null,
                    ]}
                  >
                    <Text
                      style={[
                        typography.label.lg,
                        { color: selected ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {t(`editProfile.gender.${g}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          <FormField
            label={t("editProfile.dob.label")}
            helper={age != null ? t("editProfile.vitals.ageHelper", { count: age }) : undefined}
          >
            <DateField
              value={dobDate}
              maximumDate={new Date()}
              onChange={(date) => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, "0");
                const dd = String(date.getDate()).padStart(2, "0");
                setDateOfBirth(`${yyyy}-${mm}-${dd}`);
              }}
              placeholder={t("editProfile.dob.placeholder")}
            />
          </FormField>

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <NumberField
                icon={Ruler}
                labelKey="editProfile.height.label"
                value={height}
                onChange={setHeight}
                unitKey="editProfile.height.unit"
                placeholderKey="editProfile.height.placeholder"
              />
              <NumberField
                icon={Weight}
                labelKey="editProfile.weight.label"
                value={weight}
                onChange={setWeight}
                unitKey="editProfile.weight.unit"
                placeholderKey="editProfile.weight.placeholder"
              />
            </View>
            {bmi != null && bmiBand ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 2 }}>
                <Activity size={13} color={bmiBand.color} strokeWidth={2.5} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t("editProfile.vitals.bmiLine", {
                    value: bmi.toFixed(1),
                    band: t(`editProfile.vitals.bmiBand.${bmiBand.key}`),
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        </FormSection>

        {/* ─── Health notes ─── */}
        <FormSection title={t("editProfile.healthNotesHeading")}>
          <FormField label={t("editProfile.allergies.label")} helper={t("editProfile.tagHelper")}>
            <TagInput
              value={allergies}
              onChange={setAllergies}
              draft={allergyDraft}
              onDraftChange={setAllergyDraft}
              placeholder={t("editProfile.allergies.placeholder")}
              icon={AlertTriangle}
              tone="danger"
            />
          </FormField>
          <FormField label={t("editProfile.conditions.label")} helper={t("editProfile.tagHelper")}>
            <TagInput
              value={conditions}
              onChange={setConditions}
              draft={conditionDraft}
              onDraftChange={setConditionDraft}
              placeholder={t("editProfile.conditions.placeholder")}
              icon={Stethoscope}
              tone="warning"
            />
          </FormField>
        </FormSection>

        {/* ─── Emergency contacts ─── */}
        <FormSection
          title={t("editProfile.emergencyContactsHeading")}
          action={
            contacts.length > 0 ? (
              <Pressable
                onPress={() =>
                  setContacts((prev) => [...prev, { name: "", relationship: "", phone: "" }])
                }
                accessibilityRole="button"
                accessibilityLabel={t("editProfile.accessibilityLabel.addContact")}
                hitSlop={8}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: colors.primarySoft,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Plus size={13} color={colors.primary} strokeWidth={2.75} />
                <Text style={[typography.label.sm, { color: colors.primary }]}>
                  {t("editProfile.addContactButton")}
                </Text>
              </Pressable>
            ) : null
          }
        >
          {contacts.length === 0 ? (
            <Pressable
              onPress={() => setContacts([{ name: "", relationship: "", phone: "" }])}
              accessibilityRole="button"
              accessibilityLabel={t("editProfile.accessibilityLabel.addContact")}
              style={({ pressed }) => ({
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.md,
                borderRadius: 18,
                borderCurve: "continuous",
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: colors.borderStrong,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.dangerSoft,
                }}
              >
                <HeartHandshake size={22} color={colors.danger} strokeWidth={2.25} />
              </View>
              <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
                {t("editProfile.emptyContacts")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Plus size={15} color={colors.primary} strokeWidth={2.75} />
                <Text style={[typography.label.lg, { color: colors.primary }]}>
                  {t("editProfile.addFirstContact")}
                </Text>
              </View>
            </Pressable>
          ) : (
            contacts.map((c, idx) => (
              <ContactRow
                key={idx}
                index={idx}
                contact={c}
                onChange={(next) =>
                  setContacts((prev) => prev.map((x, i) => (i === idx ? next : x)))
                }
                onRemove={() => setContacts((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))
          )}
        </FormSection>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : null}
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
          title={t("editProfile.saveButton")}
          accessibilityLabel={t("editProfile.accessibilityLabel.saveProfile")}
          onPress={handleSave}
          loading={saving}
          disabled={isLoading}
          icon={Save}
          size="lg"
        />
      </View>
    </Screen>
  );
}

function FormSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          marginHorizontal: 4,
          minHeight: 24,
        }}
      >
        <Text style={[typography.overline, { color: colors.textMuted }]}>{title}</Text>
        {action}
      </View>
      <Card padded={false}>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>{children}</View>
      </Card>
    </View>
  );
}

function Vital({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={[typography.title.md, { color: color ?? colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.overline, { color: colors.textSubtle, fontSize: 10 }]}>
        {label}
      </Text>
    </View>
  );
}

function TagInput({
  value,
  onChange,
  draft,
  onDraftChange,
  placeholder,
  icon,
  tone,
}: {
  value: string;
  onChange: (v: string) => void;
  draft: string;
  onDraftChange: (v: string) => void;
  placeholder: string;
  icon: LucideIcon;
  tone: "danger" | "warning";
}) {
  const { colors, typography } = useTheme();
  const { t } = useTranslation();
  const tags = splitList(value) ?? [];
  const fg = tone === "danger" ? colors.danger : colors.warning;
  const bg = tone === "danger" ? colors.dangerSoft : colors.warningSoft;

  const commit = (text: string) => {
    const next = joinTags(value, text);
    if (next !== value) onChange(next);
    onDraftChange("");
  };

  return (
    <View style={{ gap: 10 }}>
      {tags.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {tags.map((tag, i) => (
            <View
              key={`${tag}-${i}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingLeft: 12,
                paddingRight: 6,
                height: 32,
                borderRadius: 16,
                backgroundColor: bg,
              }}
            >
              <Text style={[typography.label.md, { color: fg }]}>{tag}</Text>
              <Pressable
                onPress={() => onChange(tags.filter((_, j) => j !== i).join(", "))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("editProfile.removeTag", { tag })}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={13} color={fg} strokeWidth={2.75} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        value={draft}
        onChangeText={(text) => {
          // A comma finishes the current tag.
          if (text.includes(",")) commit(text);
          else onDraftChange(text);
        }}
        onSubmitEditing={() => commit(draft)}
        onBlur={() => commit(draft)}
        blurOnSubmit={false}
        returnKeyType="done"
        placeholder={tags.length ? undefined : placeholder}
        leadingIcon={draft ? Plus : icon}
        tone="soft"
      />
    </View>
  );
}

function NumberField({
  icon: Icon,
  labelKey,
  value,
  onChange,
  unitKey,
  placeholderKey,
}: {
  icon: LucideIcon;
  labelKey: string;
  value: string;
  onChange: (v: string) => void;
  unitKey: string;
  placeholderKey: string;
}) {
  const { colors, spacing, typography, fontFamily } = useTheme();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: colors.fill,
        borderWidth: 1.5,
        borderColor: focused ? colors.primary : "transparent",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={focused ? colors.primary : colors.textSubtle} strokeWidth={2.5} />
        <Text style={[typography.overline, { color: colors.textSubtle, fontSize: 10.5 }]}>
          {t(labelKey)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 6 }}>
        <RNTextInput
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ""))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="decimal-pad"
          maxLength={5}
          placeholder={t(placeholderKey)}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          style={{
            flex: 1,
            padding: 0,
            fontSize: 26,
            fontFamily: fontFamily.displayBold,
            color: colors.text,
          }}
        />
        <Text style={[typography.label.md, { color: colors.textMuted, marginLeft: 4 }]}>
          {t(unitKey)}
        </Text>
      </View>
    </View>
  );
}

function ContactRow({
  index,
  contact,
  onChange,
  onRemove,
}: {
  index: number;
  contact: EmergencyContact;
  onChange: (next: EmergencyContact) => void;
  onRemove: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const relLabels = RELATIONSHIP_KEYS.map((k) => t(`editProfile.relationship.${k}`));
  return (
    <View
      style={{
        gap: spacing.sm,
        paddingTop: index > 0 ? spacing.lg : 0,
        borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
        borderTopColor: colors.separator,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Avatar name={contact.name || "?"} size="sm" tone="accent2" />
        <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          {contact.name.trim() || t("editProfile.contact.newContact", { n: index + 1 })}
        </Text>
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t("editProfile.accessibilityLabel.removeContact")}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.dangerSoft,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Trash2 size={14} color={colors.danger} strokeWidth={2.5} />
        </Pressable>
      </View>

      <TextInput
        value={contact.name}
        onChangeText={(v) => onChange({ ...contact, name: v })}
        placeholder={t("editProfile.contact.namePlaceholder")}
        leadingIcon={UserIcon}
        tone="soft"
        autoCapitalize="words"
        textContentType="name"
      />
      <TextInput
        value={contact.phone}
        onChangeText={(v) => onChange({ ...contact, phone: v })}
        placeholder={t("editProfile.contact.phonePlaceholder")}
        leadingIcon={Phone}
        tone="soft"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {relLabels.map((label) => {
          const selected = contact.relationship.trim().toLowerCase() === label.toLowerCase();
          return (
            <Pressable
              key={label}
              onPress={() => onChange({ ...contact, relationship: selected ? "" : label })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                height: 32,
                borderRadius: 16,
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: selected ? colors.primary : "transparent",
                backgroundColor: selected ? colors.primarySoft : colors.fill,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text
                style={[typography.label.md, { color: selected ? colors.primary : colors.textMuted }]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {contact.relationship &&
      !relLabels.some((l) => l.toLowerCase() === contact.relationship.trim().toLowerCase()) ? (
        <Text style={[typography.caption, { color: colors.textSubtle, marginLeft: 2 }]}>
          {contact.relationship}
        </Text>
      ) : null}
    </View>
  );
}

function parseList(v: string | null | undefined): string {
  if (!v) return "";
  try {
    const arr = JSON.parse(v);
    if (Array.isArray(arr)) return arr.join(", ");
  } catch {
    return v;
  }
  return "";
}

function joinTags(value: string, draft: string): string {
  const extra = draft.split(",").map((x) => x.trim()).filter(Boolean);
  if (!extra.length) return value;
  const existing = splitList(value) ?? [];
  const seen = new Set(existing.map((x) => x.toLowerCase()));
  const merged = [...existing, ...extra.filter((x) => !seen.has(x.toLowerCase()))];
  return merged.join(", ");
}

function splitList(v: string): string[] | undefined {
  const parts = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

function parseContacts(v: string | null | undefined): EmergencyContact[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    if (Array.isArray(arr)) {
      return arr
        .filter((c) => c && typeof c === "object")
        .map((c) => ({
          name: String(c.name || ""),
          relationship: String(c.relationship || ""),
          phone: String(c.phone || ""),
        }));
    }
  } catch {
    return [];
  }
  return [];
}
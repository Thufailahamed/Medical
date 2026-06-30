import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  ShieldCheck,
  Save,
  Trash2,
  Plus,
  Phone,
  User as UserIcon,
  Camera,
} from "lucide-react-native";
import {
  useUpdatePatientProfile,
  usePatientProfile,
} from "@/hooks/useApi";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import { Screen, Card, Avatar, Button, useToast, DateField } from "@/components/ui";

const BLOOD_GROUPS = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];
const GENDER_VALUES = ["male", "female", "other"] as const;

type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
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
        allergies: splitList(allergies),
        medicalConditions: splitList(conditions),
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

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("editProfile.accessibilityLabel.goBack")}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          })}
        >
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text
          style={[
            typography.title.md,
            { color: colors.text, fontWeight: "800", fontSize: 18 },
          ]}
        >
          {t("editProfile.title")}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={updateProfile.isPending || savingPhoto}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("editProfile.accessibilityLabel.saveProfile")}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.sm,
            paddingVertical: 6,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {updateProfile.isPending || savingPhoto ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.primary,
              }}
            >
              {t("editProfile.save")}
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Photo + identity */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
            padding: spacing.lg,
            borderRadius: radius.xxl,
            backgroundColor: colors.primarySoft,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.lg,
          }}
        >
          <View style={{ position: "relative" }}>
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.surfaceMuted,
                }}
              />
            ) : (
              <Avatar name={userRow?.name || t("common.you")} size="2xl" tone="primary" ring />
            )}
            <Pressable
              onPress={pickPhoto}
              accessibilityRole="button"
              accessibilityLabel={t("editProfile.accessibilityLabel.changePhoto")}
              style={({ pressed }) => ({
                position: "absolute",
                right: -4,
                bottom: -4,
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.primaryMuted : colors.primary,
                borderWidth: 2,
                borderColor: colors.surface,
              })}
            >
              <Camera size={14} color={colors.onPrimary} strokeWidth={2.5} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[typography.title.md, { color: colors.text, fontWeight: "800" }]}
              numberOfLines={1}
            >
              {userRow?.name || "—"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                marginTop: 2,
              }}
            >
              <ShieldCheck size={14} color={colors.success} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.success,
                  fontWeight: "700",
                }}
              >
                {userRow?.verified
                  ? t("editProfile.verifiedStatus.verified")
                  : t("editProfile.verifiedStatus.goodStanding")}
              </Text>
            </View>
          </View>
        </View>

        {/* Basics */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: spacing.lg,
            marginTop: spacing.lg,
          }}
        >
          <Card>
            <Text
              style={[
                typography.title.sm,
                {
                  color: colors.textMuted,
                  fontWeight: "800",
                  marginBottom: spacing.md,
                  letterSpacing: 0.6,
                },
              ]}
            >
              {t("editProfile.basicsHeading")}
            </Text>

            <LabeledRow label={t("editProfile.bloodGroup.label")}>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.xs,
                }}
              >
                {BLOOD_GROUPS.map((bg) => {
                  const selected = bloodGroup === bg;
                  return (
                    <Pressable
                      key={bg}
                      onPress={() => setBloodGroup(bg)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: 8,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primarySoft : colors.surface,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: selected ? colors.primary : colors.text,
                        }}
                      >
                        {bg}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </LabeledRow>

            <LabeledRow label={t("editProfile.gender.label")}>
              <View style={{ flexDirection: "row", gap: spacing.xs }}>
                {GENDER_VALUES.map((g) => {
                  const selected = gender?.toLowerCase() === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => setGender(g)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primarySoft : colors.surface,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: selected ? colors.primary : colors.text,
                        }}
                      >
                        {t(`editProfile.gender.${g}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </LabeledRow>

            <LabeledRow label={t("editProfile.dob.label")}>
              <DateField
                value={dobDate}
                onChange={(date) => {
                  const yyyy = date.getFullYear();
                  const mm = String(date.getMonth() + 1).padStart(2, "0");
                  const dd = String(date.getDate()).padStart(2, "0");
                  setDateOfBirth(`${yyyy}-${mm}-${dd}`);
                }}
                placeholder={t("editProfile.dob.placeholder")}
              />
            </LabeledRow>

            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
              <NumberField
                labelKey="editProfile.height.label"
                value={height}
                onChange={setHeight}
                unitKey="editProfile.height.unit"
                placeholderKey="editProfile.height.placeholder"
              />
              <NumberField
                labelKey="editProfile.weight.label"
                value={weight}
                onChange={setWeight}
                unitKey="editProfile.weight.unit"
                placeholderKey="editProfile.weight.placeholder"
              />
            </View>
          </Card>

          {/* Health notes */}
          <Card>
            <Text
              style={[
                typography.title.sm,
                {
                  color: colors.textMuted,
                  fontWeight: "800",
                  marginBottom: spacing.md,
                  letterSpacing: 0.6,
                },
              ]}
            >
              {t("editProfile.healthNotesHeading")}
            </Text>

            <LabeledRow
              label={t("editProfile.allergies.label")}
              helper={t("editProfile.allergies.helper")}
            >
              <TextInput
                value={allergies}
                onChangeText={setAllergies}
                placeholder={t("editProfile.allergies.placeholder")}
                placeholderTextColor={colors.textSubtle}
                multiline
                numberOfLines={2}
                style={inputStyle(colors, radius, spacing)}
              />
            </LabeledRow>

            <LabeledRow
              label={t("editProfile.conditions.label")}
              helper={t("editProfile.conditions.helper")}
            >
              <TextInput
                value={conditions}
                onChangeText={setConditions}
                placeholder={t("editProfile.conditions.placeholder")}
                placeholderTextColor={colors.textSubtle}
                multiline
                numberOfLines={2}
                style={inputStyle(colors, radius, spacing)}
              />
            </LabeledRow>
          </Card>

          {/* Emergency contacts */}
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.md,
              }}
            >
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.textMuted, fontWeight: "800", letterSpacing: 0.6 },
                ]}
              >
                {t("editProfile.emergencyContactsHeading")}
              </Text>
              <Pressable
                onPress={() =>
                  setContacts((prev) => [
                    ...prev,
                    { name: "", relationship: "", phone: "" },
                  ])
                }
                accessibilityRole="button"
                accessibilityLabel={t("editProfile.accessibilityLabel.addContact")}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: pressed ? colors.primaryMuted : colors.primarySoft,
                })}
              >
                <Plus size={14} color={colors.primary} strokeWidth={2.5} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.primary,
                  }}
                >
                  {t("editProfile.addContactButton")}
                </Text>
              </Pressable>
            </View>

            {contacts.length === 0 ? (
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  paddingVertical: spacing.sm,
                }}
              >
                {t("editProfile.emptyContacts")}
              </Text>
            ) : (
              <View style={{ gap: spacing.md }}>
                {contacts.map((c, idx) => (
                  <ContactRow
                    key={idx}
                    contact={c}
                    onChange={(next) =>
                      setContacts((prev) =>
                        prev.map((x, i) => (i === idx ? next : x))
                      )
                    }
                    onRemove={() =>
                      setContacts((prev) => prev.filter((_, i) => i !== idx))
                    }
                  />
                ))}
              </View>
            )}
          </Card>
        </View>

        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing.lg }}
          />
        ) : (
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl }}>
            <Button
              title={t("editProfile.saveButton")}
              onPress={handleSave}
              loading={updateProfile.isPending || savingPhoto}
              icon={Save}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function LabeledRow({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text
        style={[
          typography.label.md,
          { color: colors.text, fontWeight: "700", marginBottom: spacing.xs },
        ]}
      >
        {label}
      </Text>
      {children}
      {helper ? (
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, marginTop: 4 },
          ]}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

function NumberField({
  labelKey,
  value,
  onChange,
  unitKey,
  placeholderKey,
}: {
  labelKey: string;
  value: string;
  onChange: (v: string) => void;
  unitKey: string;
  placeholderKey: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          color: colors.textMuted,
          letterSpacing: 0.6,
        }}
      >
        {t(labelKey)}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={t(placeholderKey)}
          placeholderTextColor={colors.textSubtle}
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: colors.text,
            flex: 1,
            padding: 0,
          }}
        />
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: colors.textMuted,
            marginLeft: 4,
          }}
        >
          {t(unitKey)}
        </Text>
      </View>
    </View>
  );
}

function ContactRow({
  contact,
  onChange,
  onRemove,
}: {
  contact: EmergencyContact;
  onChange: (next: EmergencyContact) => void;
  onRemove: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <UserIcon size={14} color={colors.textMuted} />
        <TextInput
          value={contact.name}
          onChangeText={(v) => onChange({ ...contact, name: v })}
          placeholder={t("editProfile.contact.namePlaceholder")}
          placeholderTextColor={colors.textSubtle}
          style={miniInputStyle(colors, typography)}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Text
          style={{ fontSize: 12, color: colors.textMuted, fontWeight: "700", width: 14 }}
        >
          ↳
        </Text>
        <TextInput
          value={contact.relationship}
          onChangeText={(v) => onChange({ ...contact, relationship: v })}
          placeholder={t("editProfile.contact.relationshipPlaceholder")}
          placeholderTextColor={colors.textSubtle}
          style={miniInputStyle(colors, typography)}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Phone size={14} color={colors.textMuted} />
        <TextInput
          value={contact.phone}
          onChangeText={(v) => onChange({ ...contact, phone: v })}
          placeholder={t("editProfile.contact.phonePlaceholder")}
          placeholderTextColor={colors.textSubtle}
          keyboardType="phone-pad"
          style={miniInputStyle(colors, typography)}
        />
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
            backgroundColor: pressed ? colors.danger : colors.dangerSoft,
          })}
        >
          <Trash2 size={14} color={colors.danger} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

function inputStyle(colors: any, radius: any, spacing: any) {
  return {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: "top" as const,
    minHeight: 60,
  };
}

function miniInputStyle(colors: any, typography: any) {
  return {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 4,
  };
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
// @ts-nocheck

import { useState } from "react";
import { View, Text, Modal, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Plus, Users, Trash2 } from "lucide-react-native";
import {
  useStaff,
  useCreateStaff,
  useDeleteStaff,
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
    case "doctor":
      return "info";
    case "manager":
      return "warning";
    default:
      return "neutral";
  }
}

function shiftTone(s: string): any {
  switch (s) {
    case "morning":
      return "warning";
    case "evening":
      return "accent";
    case "night":
      return "info";
    default:
      return "neutral";
  }
}

export default function StaffScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const { data, isLoading } = useStaff();
  const createStaff = useCreateStaff();
  const deleteStaff = useDeleteStaff();
  const list = (data?.staff || []).filter((s: any) => s.active !== false);

  const ROLES = [
    { value: "nurse", label: t("hospitalStaff.roleNurse") },
    { value: "receptionist", label: t("hospitalStaff.roleReceptionist") },
    { value: "technician", label: t("hospitalStaff.roleTechnician") },
    { value: "manager", label: t("hospitalStaff.roleManager") },
    { value: "housekeeping", label: t("hospitalStaff.roleHousekeeping") },
    { value: "security", label: t("hospitalStaff.roleSecurity") },
  ];

  const SHIFTS = [
    { value: "morning", label: t("hospitalStaff.shiftMorning") },
    { value: "evening", label: t("hospitalStaff.shiftEvening") },
    { value: "night", label: t("hospitalStaff.shiftNight") },
    { value: "rotating", label: t("hospitalStaff.shiftRotating") },
  ];

  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("nurse");
  const [shift, setShift] = useState("morning");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  function reset() {
    setFullName("");
    setRole("nurse");
    setShift("morning");
    setPhone("");
    setEmail("");
  }

  async function submit() {
    if (!fullName.trim()) {
      toast.show(t("hospitalStaff.nameRequired"), "warning");
      return;
    }
    try {
      await createStaff.mutateAsync({
        fullName: fullName.trim(),
        role: role as any,
        shift: shift as any,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      toast.show(t("hospitalStaff.staffAddedToast"), "success");
      reset();
      setShowForm(false);
    } catch (err: any) {
      toast.show(err?.message || t("hospitalStaff.staffAddedError"), "danger");
    }
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert(
      t("hospitalStaff.removeAlertTitle"),
      t("hospitalStaff.removeAlertBody", { name }),
      [
        { text: t("hospitalStaff.cancel"), style: "cancel" },
        {
          text: t("hospitalStaff.removeConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteStaff.mutateAsync(id);
              toast.show(t("hospitalStaff.staffRemovedToast"), "success");
            } catch (err: any) {
              toast.show(err?.message || t("hospitalStaff.staffRemovedError"), "danger");
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
        title={t("hospitalStaff.title")}
        right={
          <IconButton
            icon={Plus}
            onPress={() => setShowForm(true)}
            accessibilityLabel={t("hospitalStaff.addA11y")}
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
      ) : list.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={Users}
            title={t("hospitalStaff.emptyTitle")}
            message={t("hospitalStaff.emptyBody")}
            actionLabel={t("hospitalStaff.emptyAction")}
            onAction={() => setShowForm(true)}
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {list.map((s: any) => (
            <Card key={s.id} padded={false}>
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
                  <Users size={20} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {s.fullName}
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
                      label={s.role}
                      tone={roleTone(s.role)}
                      size="sm"
                    />
                    <PillCmp
                      label={s.shift}
                      tone={shiftTone(s.shift)}
                      size="sm"
                    />
                    {s.phone ? (
                      <PillCmp label={s.phone} tone="neutral" size="sm" />
                    ) : null}
                  </View>
                </View>
                <IconButton
                  icon={Trash2}
                  onPress={() => confirmDelete(s.id, s.fullName)}
                  accessibilityLabel={t("hospitalStaff.removeA11y", { name: s.fullName })}
                  tint={colors.danger}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}
      >
        <Screen padded={false} edges={["top"]} bottomInset>
          <ScreenHeader
            title={t("hospitalStaff.formTitle")}
            right={
              <Button
                title={t("hospitalStaff.cancel")}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setShowForm(false)}
              />
            }
          />
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            <FormField label={t("hospitalStaff.fullName")} required>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder={t("hospitalStaff.fullNamePlaceholder")}
                autoFocus
              />
            </FormField>
            <FormField label={t("hospitalStaff.role")}>
              <ChipGroup options={ROLES} value={role} onChange={setRole} />
            </FormField>
            <FormField label={t("hospitalStaff.shift")}>
              <ChipGroup options={SHIFTS} value={shift} onChange={setShift} />
            </FormField>
            <FormField label={t("hospitalStaff.phone")}>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={t("hospitalStaff.phonePlaceholder")}
                keyboardType="phone-pad"
              />
            </FormField>
            <FormField label={t("hospitalStaff.email")}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t("hospitalStaff.emailPlaceholder")}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </FormField>
            <Button
              title={t("hospitalStaff.addAction")}
              onPress={submit}
              loading={createStaff.isPending}
              icon={Plus}
              size="lg"
            />
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}
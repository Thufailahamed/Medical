// @ts-nocheck

import { useState } from "react";
import { View, Text, Modal, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Plus, Bed, ChevronRight, Building2, Trash2 } from "lucide-react-native";
import {
  useWards,
  useCreateWard,
  useDeleteWard,
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

function wardTone(type: string): any {
  switch (type) {
    case "icu":
      return "danger";
    case "emergency":
      return "warning";
    case "pediatric":
      return "accent";
    case "maternity":
      return "info";
    case "surgical":
      return "primary";
    default:
      return "neutral";
  }
}

export default function WardsScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const { data, isLoading } = useWards();
  const createWard = useCreateWard();
  const deleteWard = useDeleteWard();
  const list = data?.wards || [];

  const WARD_TYPES = [
    { value: "general", label: t("hospitalWards.typeGeneral") },
    { value: "icu", label: t("hospitalWards.typeIcu") },
    { value: "pediatric", label: t("hospitalWards.typePediatric") },
    { value: "maternity", label: t("hospitalWards.typeMaternity") },
    { value: "surgical", label: t("hospitalWards.typeSurgical") },
    { value: "emergency", label: t("hospitalWards.typeEmergency") },
  ];

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("general");
  const [capacity, setCapacity] = useState("20");
  const [floor, setFloor] = useState("");

  function reset() {
    setName("");
    setType("general");
    setCapacity("20");
    setFloor("");
  }

  async function submit() {
    if (!name.trim()) {
      toast.show(t("hospitalWards.nameRequired"), "warning");
      return;
    }
    const cap = parseInt(capacity, 10);
    if (!cap || cap < 1) {
      toast.show(t("hospitalWards.capacityRequired"), "warning");
      return;
    }
    try {
      await createWard.mutateAsync({
        name: name.trim(),
        type: type as any,
        capacity: cap,
        floor: floor ? parseInt(floor, 10) : undefined,
      });
      toast.show(t("hospitalWards.wardCreatedToast"), "success");
      reset();
      setShowForm(false);
    } catch (err: any) {
      toast.show(err?.message || t("hospitalWards.createError"), "danger");
    }
  }

  function confirmDelete(id: string, wardName: string) {
    Alert.alert(
      t("hospitalWards.deleteAlertTitle"),
      t("hospitalWards.deleteAlertBody", { name: wardName }),
      [
        { text: t("hospitalWards.cancel"), style: "cancel" },
        {
          text: t("hospitalWards.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteWard.mutateAsync(id);
              toast.show(t("hospitalWards.wardRemovedToast"), "success");
            } catch (err: any) {
              toast.show(err?.message || t("hospitalWards.deleteError"), "danger");
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
        title={t("hospitalWards.title")}
        right={
          <IconButton
            icon={Plus}
            onPress={() => setShowForm(true)}
            accessibilityLabel={t("hospitalWards.addA11y")}
            variant="soft"
          />
        }
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={88} radius={20} />
          ))}
        </View>
      ) : list.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={Building2}
            title={t("hospitalWards.emptyTitle")}
            message={t("hospitalWards.emptyBody")}
            actionLabel={t("hospitalWards.emptyAction")}
            onAction={() => setShowForm(true)}
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {list.map((w: any) => (
            <Card
              key={w.id}
              onPress={() =>
                router.push({
                  pathname: "/hospital/ward-detail",
                  params: { id: w.id, name: w.name },
                })
              }
              padded={false}
              accessibilityLabel={t("hospitalWards.wardA11y", { name: w.name })}
            >
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
                  <Bed size={20} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Text
                      style={[typography.title.sm, { color: colors.text }]}
                    >
                      {w.name}
                    </Text>
                    <PillCmp
                      label={w.type}
                      tone={wardTone(w.type)}
                      size="sm"
                    />
                  </View>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {w.floor != null
                      ? t("hospitalWards.capacityFloorWithFloor", {
                          capacity: w.capacity,
                          floor: w.floor,
                        })
                      : t("hospitalWards.capacityFloor", { capacity: w.capacity })}
                  </Text>
                </View>
                <IconButton
                  icon={Trash2}
                  onPress={() => confirmDelete(w.id, w.name)}
                  accessibilityLabel={t("hospitalWards.deleteA11y", { name: w.name })}
                  tint={colors.danger}
                />
                <ChevronRight
                  size={18}
                  color={colors.textSubtle}
                  strokeWidth={2.2}
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
            title={t("hospitalWards.formTitle")}
            right={
              <Button
                title={t("hospitalWards.cancel")}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setShowForm(false)}
              />
            }
          />
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label={t("hospitalWards.name")} required>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("hospitalWards.namePlaceholder")}
              />
            </FormField>
            <FormField label={t("hospitalWards.type")}>
              <ChipGroup
                options={WARD_TYPES}
                value={type}
                onChange={setType}
              />
            </FormField>
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <FormField label={t("hospitalWards.capacity")} required>
                  <TextInput
                    value={capacity}
                    onChangeText={setCapacity}
                    keyboardType="number-pad"
                  />
                </FormField>
              </View>
              <View style={{ flex: 1 }}>
                <FormField label={t("hospitalWards.floor")}>
                  <TextInput
                    value={floor}
                    onChangeText={setFloor}
                    keyboardType="number-pad"
                    placeholder={t("hospitalWards.optional")}
                  />
                </FormField>
              </View>
            </View>
            <Button
              title={t("hospitalWards.createWard")}
              onPress={submit}
              loading={createWard.isPending}
              icon={Plus}
              size="lg"
            />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}
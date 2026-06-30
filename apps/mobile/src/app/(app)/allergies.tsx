// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ShieldAlert,
  Plus,
  Trash2,
  X,
  CircleAlert,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  useAllergies,
  useAddAllergy,
  useUpdateAllergy,
  useDeleteAllergy,
  type Allergy,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Chip,
  ChipGroup,
  EmptyState,
  BottomSheet,
  FormField,
  useToast,
} from "@/components/ui";

type Severity = "mild" | "moderate" | "severe" | "critical";

const SEVERITIES: { value: Severity; key: string; tone: any }[] = [
  { value: "mild", key: "allergies.severity.mild", tone: "info" },
  { value: "moderate", key: "allergies.severity.moderate", tone: "warning" },
  { value: "severe", key: "allergies.severity.severe", tone: "danger" },
  { value: "critical", key: "allergies.severity.critical", tone: "danger" },
];

const SEVERITY_COLOR: Record<Severity, { bg: string; fg: string }> = {
  mild: { bg: "info", fg: "info" },
  moderate: { bg: "warning", fg: "warning" },
  severe: { bg: "dangerSoft", fg: "danger" },
  critical: { bg: "danger", fg: "danger" },
};

export default function AllergiesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data, isLoading, refetch } = useAllergies();
  const addAllergy = useAddAllergy();
  const updateAllergy = useUpdateAllergy();
  const deleteAllergy = useDeleteAllergy();

  const allergies: Allergy[] = useMemo(
    () => data?.allergies ?? [],
    [data?.allergies]
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Allergy | null>(null);
  const [substance, setSubstance] = useState("");
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [reaction, setReaction] = useState("");
  const [notes, setNotes] = useState("");

  const activeCount = allergies.filter((a) => a.active !== false).length;
  const critical = allergies.filter(
    (a) => a.severity === "critical" && a.active !== false
  );

  function openAdd() {
    setEditing(null);
    setSubstance("");
    setSeverity("moderate");
    setReaction("");
    setNotes("");
    setSheetOpen(true);
  }

  function openEdit(a: Allergy) {
    setEditing(a);
    setSubstance(a.substance || "");
    setSeverity((a.severity as Severity) || "moderate");
    setReaction(a.reaction || "");
    setNotes(a.notes || "");
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  async function onSave() {
    const trimmed = substance.trim();
    if (trimmed.length < 2) {
      toast.show({ message: t("allergies.error.substanceRequired"), tone: "warning" });
      return;
    }
    try {
      if (editing) {
        await updateAllergy.mutateAsync({
          id: editing.id,
          payload: {
            substance: trimmed,
            severity,
            reaction: reaction.trim() || undefined,
            notes: notes.trim() || undefined,
          },
        });
        toast.show({ message: t("allergies.toast.updated"), tone: "success" });
      } else {
        await addAllergy.mutateAsync({
          substance: trimmed,
          severity,
          reaction: reaction.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast.show({ message: t("allergies.toast.added"), tone: "success" });
      }
      closeSheet();
    } catch (e: any) {
      toast.show({
        message: e?.message || t("allergies.toast.saveError"),
        tone: "danger",
      });
    }
  }

  function onDelete(a: Allergy) {
    Alert.alert(
      t("allergies.deleteConfirm.title"),
      t("allergies.deleteConfirm.body", { substance: a.substance }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.remove"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAllergy.mutateAsync(a.id);
              toast.show({ message: t("allergies.toast.removed"), tone: "success" });
            } catch (e: any) {
              toast.show({
                message: e?.message || t("allergies.toast.removeError"),
                tone: "danger",
              });
            }
          },
        },
      ]
    );
  }

  async function toggleActive(a: Allergy) {
    try {
      await updateAllergy.mutateAsync({
        id: a.id,
        payload: { active: a.active === false },
      });
    } catch (e: any) {
      toast.show({ message: e?.message || t("allergies.toast.updateError"), tone: "danger" });
    }
  }

  const subtitle =
    allergies.length === 0
      ? t("allergies.subtitleEmpty")
      : t("allergies.subtitleCount", { active: activeCount, total: allergies.length });

  return (
    <Screen>
      <ScreenHeader
        title={t("allergies.title")}
        subtitle={subtitle}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        {critical.length > 0 && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.danger,
              flexDirection: "row",
              gap: spacing.sm,
              alignItems: "flex-start",
            }}
            accessible
            accessibilityRole="alert"
          >
            <ShieldAlert
              size={20}
              color="#fff"
              strokeWidth={2.25}
              style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.title.sm,
                  { color: "#fff", fontWeight: "800" },
                ]}
              >
                {t("allergies.banner.title")}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: "#fff", opacity: 0.92, marginTop: 2 },
                ]}
              >
                {critical
                  .map((c) => c.substance)
                  .join(", ")}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: "#fff", opacity: 0.85, marginTop: 6 },
                ]}
              >
                {t("allergies.banner.description")}
              </Text>
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg }}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : allergies.length === 0 ? (
            <EmptyState
              icon={CircleAlert}
              title={t("allergies.empty.title")}
              message={t("allergies.empty.message")}
              actionLabel={t("allergies.empty.action")}
              onAction={openAdd}
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {allergies.map((a) => {
                const sev = (a.severity as Severity) || "moderate";
                const colorTone = SEVERITY_COLOR[sev] ?? SEVERITY_COLOR.moderate;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => openEdit(a)}
                    onLongPress={() => onDelete(a)}
                    accessibilityRole="button"
                    accessibilityHint={t("allergies.accessibilityHint")}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Card>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: spacing.md,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: (colors as any)[colorTone.bg] || colors.warningSoft,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <AlertTriangle
                            size={20}
                            color={(colors as any)[colorTone.fg] || colors.warning}
                            strokeWidth={2.25}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.xs,
                              flexWrap: "wrap",
                            }}
                          >
                            <Text
                              style={[
                                typography.title.sm,
                                { color: colors.text, fontWeight: "700" },
                              ]}
                              numberOfLines={1}
                            >
                              {a.substance}
                            </Text>
                            <Chip
                              label={t(SEVERITIES.find((s) => s.value === sev)?.key || "")}
                              tone={colorTone.fg as any}
                              size="sm"
                            />
                            {a.active === false && (
                              <Chip label={t("allergies.status.inactive")} tone="neutral" size="sm" />
                            )}
                          </View>
                          {!!a.reaction && (
                            <Text
                              style={[
                                typography.body.sm,
                                { color: colors.textMuted, marginTop: 2 },
                              ]}
                              numberOfLines={2}
                            >
                              {a.reaction}
                            </Text>
                          )}
                          {!!a.notes && (
                            <Text
                              style={[
                                typography.caption,
                                { color: colors.textSubtle, marginTop: 2 },
                              ]}
                              numberOfLines={2}
                            >
                              {a.notes}
                            </Text>
                          )}
                          {a.onsetDate && (
                            <Text
                              style={[
                                typography.caption,
                                { color: colors.textSubtle, marginTop: 4 },
                              ]}
                            >
                              {t("allergies.since", {
                                date: String(a.onsetDate).slice(0, 10),
                              })}
                            </Text>
                          )}
                        </View>
                        <Pressable
                          onPress={() => toggleActive(a)}
                          hitSlop={10}
                          accessibilityLabel={
                            a.active === false
                              ? t("allergies.toggle.reactivateLabel")
                              : t("allergies.toggle.deactivateLabel")
                          }
                          accessibilityRole="button"
                          style={{
                            paddingHorizontal: spacing.xs,
                            paddingVertical: 4,
                            borderRadius: radius.sm,
                          }}
                        >
                          <Text
                            style={[
                              typography.caption,
                              {
                                color:
                                  a.active === false
                                    ? colors.textSubtle
                                    : colors.success,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {a.active === false
                              ? t("allergies.toggle.off")
                              : t("allergies.toggle.on")}
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB-style add row */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.lg,
        }}
      >
        <Button
          title={t("allergies.addButton")}
          icon={Plus}
          onPress={openAdd}
          size="lg"
        />
      </View>

      <BottomSheet
        visible={sheetOpen}
        onDismiss={closeSheet}
        title={editing ? t("allergies.sheet.editTitle") : t("allergies.sheet.newTitle")}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <FormField label={t("allergies.field.substanceLabel")} required>
            <TextInput
              value={substance}
              onChangeText={setSubstance}
              placeholder={t("allergies.field.substancePlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                fontSize: 16,
              }}
              autoFocus
            />
          </FormField>

          <FormField label={t("allergies.field.severityLabel")}>
            <ChipGroup
              options={SEVERITIES.map((s) => ({
                value: s.value,
                label: t(s.key),
              }))}
              value={severity}
              onChange={(v) => setSeverity(v as Severity)}
            />
          </FormField>

          <FormField label={t("allergies.field.reactionLabel")}>
            <TextInput
              value={reaction}
              onChangeText={setReaction}
              placeholder={t("allergies.field.reactionPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              multiline
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                minHeight: 64,
                color: colors.text,
                fontSize: 16,
                textAlignVertical: "top",
              }}
            />
          </FormField>

          <FormField label={t("allergies.field.notesLabel")}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("allergies.field.notesPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              multiline
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                minHeight: 56,
                color: colors.text,
                fontSize: 16,
                textAlignVertical: "top",
              }}
            />
          </FormField>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            {editing && (
              <Button
                title={t("common.remove")}
                variant="outline"
                tone="danger"
                icon={Trash2}
                onPress={() => {
                  closeSheet();
                  setTimeout(() => onDelete(editing), 250);
                }}
                style={{ flex: 1 }}
              />
            )}
            <Button
              title={t("common.cancel")}
              variant="outline"
              onPress={closeSheet}
              style={{ flex: 1 }}
            />
            <Button
              title={editing ? t("common.save") : t("common.add")}
              icon={editing ? undefined : Plus}
              onPress={onSave}
              loading={addAllergy.isPending || updateAllergy.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}
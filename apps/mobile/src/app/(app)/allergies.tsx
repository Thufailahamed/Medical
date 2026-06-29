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

const SEVERITIES = [
  { value: "mild", label: "Mild", tone: "info" },
  { value: "moderate", label: "Moderate", tone: "warning" },
  { value: "severe", label: "Severe", tone: "danger" },
  { value: "critical", label: "Critical", tone: "danger" },
] as const;

const SEVERITY_COLOR = {
  mild: { bg: "info", fg: "info" },
  moderate: { bg: "warning", fg: "warning" },
  severe: { bg: "dangerSoft", fg: "danger" },
  critical: { bg: "danger", fg: "danger" },
};

export default function AllergiesScreen() {
  const router = useRouter();
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
  const [severity, setSeverity] = useState<string>("moderate");
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
    setSeverity(a.severity || "moderate");
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
      toast.show({ message: "Substance required (min 2 chars)", tone: "warning" });
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
        toast.show({ message: "Allergy updated", tone: "success" });
      } else {
        await addAllergy.mutateAsync({
          substance: trimmed,
          severity,
          reaction: reaction.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast.show({ message: "Allergy added", tone: "success" });
      }
      closeSheet();
    } catch (e: any) {
      toast.show({
        message: e?.message || "Could not save allergy",
        tone: "danger",
      });
    }
  }

  function onDelete(a: Allergy) {
    Alert.alert(
      "Remove allergy?",
      `This will permanently remove "${a.substance}".`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAllergy.mutateAsync(a.id);
              toast.show({ message: "Allergy removed", tone: "success" });
            } catch (e: any) {
              toast.show({
                message: e?.message || "Remove failed",
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
      toast.show({ message: e?.message || "Update failed", tone: "danger" });
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Allergies"
        subtitle={
          allergies.length === 0
            ? "Track drugs, food, and environmental triggers"
            : `${activeCount} active of ${allergies.length}`
        }
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
                Critical allergies on file
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
                Shown to every doctor with access. Also blocks conflicting
                medicines at save-time.
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
              title="No allergies recorded"
              message="Add drug, food, latex, or environmental triggers so providers can avoid them."
              actionLabel="Add allergy"
              onAction={openAdd}
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {allergies.map((a) => {
                const sev = (a.severity as keyof typeof SEVERITY_COLOR) || "moderate";
                const colorTone = SEVERITY_COLOR[sev] ?? SEVERITY_COLOR.moderate;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => openEdit(a)}
                    onLongPress={() => onDelete(a)}
                    accessibilityRole="button"
                    accessibilityHint="Tap to edit, hold to remove"
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
                              label={
                                SEVERITIES.find((s) => s.value === sev)?.label ||
                                sev
                              }
                              tone={colorTone.fg as any}
                              size="sm"
                            />
                            {a.active === false && (
                              <Chip label="Inactive" tone="neutral" size="sm" />
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
                              Since {String(a.onsetDate).slice(0, 10)}
                            </Text>
                          )}
                        </View>
                        <Pressable
                          onPress={() => toggleActive(a)}
                          hitSlop={10}
                          accessibilityLabel={
                            a.active === false ? "Reactivate" : "Deactivate"
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
                            {a.active === false ? "Off" : "On"}
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
          title="Add allergy"
          icon={Plus}
          onPress={openAdd}
          size="lg"
        />
      </View>

      <BottomSheet
        visible={sheetOpen}
        onDismiss={closeSheet}
        title={editing ? "Edit allergy" : "New allergy"}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <FormField label="Substance" required>
            <TextInput
              value={substance}
              onChangeText={setSubstance}
              placeholder="Penicillin, peanuts, latex…"
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

          <FormField label="Severity">
            <ChipGroup
              options={SEVERITIES.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
              value={severity}
              onChange={setSeverity}
            />
          </FormField>

          <FormField label="Reaction (optional)">
            <TextInput
              value={reaction}
              onChangeText={setReaction}
              placeholder="Hives, swelling, anaphylaxis…"
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

          <FormField label="Notes (optional)">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Diagnosed 2019, EpiPen carried…"
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
                title="Remove"
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
              title="Cancel"
              variant="outline"
              onPress={closeSheet}
              style={{ flex: 1 }}
            />
            <Button
              title={editing ? "Save" : "Add"}
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

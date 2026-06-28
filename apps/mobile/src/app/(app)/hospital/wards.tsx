import { useState } from "react";
import { View, Text, Modal, Alert } from "react-native";
import { useRouter } from "expo-router";
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

const WARD_TYPES = [
  { value: "general", label: "General" },
  { value: "icu", label: "ICU" },
  { value: "pediatric", label: "Pediatric" },
  { value: "maternity", label: "Maternity" },
  { value: "surgical", label: "Surgical" },
  { value: "emergency", label: "Emergency" },
];

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
  const toast = useToast();
  const { data, isLoading } = useWards();
  const createWard = useCreateWard();
  const deleteWard = useDeleteWard();
  const list = data?.wards || [];

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
      toast.show("Name required", "warning");
      return;
    }
    const cap = parseInt(capacity, 10);
    if (!cap || cap < 1) {
      toast.show("Capacity must be at least 1", "warning");
      return;
    }
    try {
      await createWard.mutateAsync({
        name: name.trim(),
        type: type as any,
        capacity: cap,
        floor: floor ? parseInt(floor, 10) : undefined,
      });
      toast.show("Ward created", "success");
      reset();
      setShowForm(false);
    } catch (err: any) {
      toast.show(err?.message || "Could not create ward", "danger");
    }
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert("Delete ward?", `Remove "${name}" (soft delete).`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteWard.mutateAsync(id);
            toast.show("Ward removed", "success");
          } catch (err: any) {
            toast.show(err?.message || "Could not delete", "danger");
          }
        },
      },
    ]);
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Wards & beds"
        right={
          <IconButton
            icon={Plus}
            onPress={() => setShowForm(true)}
            accessibilityLabel="Add ward"
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
            title="No wards yet"
            message="Add your first ward to start managing beds."
            actionLabel="Add ward"
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
              accessibilityLabel={`Ward ${w.name}`}
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
                    Capacity {w.capacity}
                    {w.floor != null ? ` · Floor ${w.floor}` : ""}
                  </Text>
                </View>
                <IconButton
                  icon={Trash2}
                  onPress={() => confirmDelete(w.id, w.name)}
                  accessibilityLabel={`Delete ${w.name}`}
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
            title="New ward"
            right={
              <Button
                title="Cancel"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setShowForm(false)}
              />
            }
          />
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label="Name" required>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., ICU North"
              />
            </FormField>
            <FormField label="Type">
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
                <FormField label="Capacity" required>
                  <TextInput
                    value={capacity}
                    onChangeText={setCapacity}
                    keyboardType="number-pad"
                  />
                </FormField>
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Floor">
                  <TextInput
                    value={floor}
                    onChangeText={setFloor}
                    keyboardType="number-pad"
                    placeholder="Optional"
                  />
                </FormField>
              </View>
            </View>
            <Button
              title="Create ward"
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
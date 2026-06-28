import { useState } from "react";
import { View, Text, Modal, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Plus, Users, ChevronRight, Trash2 } from "lucide-react-native";
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

const ROLES = [
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
  { value: "technician", label: "Technician" },
  { value: "manager", label: "Manager" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "security", label: "Security" },
];

const SHIFTS = [
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
  { value: "rotating", label: "Rotating" },
];

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
  const toast = useToast();
  const { data, isLoading } = useStaff();
  const createStaff = useCreateStaff();
  const deleteStaff = useDeleteStaff();
  const list = (data?.staff || []).filter((s: any) => s.active !== false);

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
      toast.show("Name required", "warning");
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
      toast.show("Staff added", "success");
      reset();
      setShowForm(false);
    } catch (err: any) {
      toast.show(err?.message || "Could not add staff", "danger");
    }
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert("Remove staff?", `Remove "${name}" from the roster.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteStaff.mutateAsync(id);
            toast.show("Staff removed", "success");
          } catch (err: any) {
            toast.show(err?.message || "Could not remove", "danger");
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
        title="Staff roster"
        right={
          <IconButton
            icon={Plus}
            onPress={() => setShowForm(true)}
            accessibilityLabel="Add staff"
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
            title="No staff yet"
            message="Build your roster."
            actionLabel="Add staff"
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
                  accessibilityLabel={`Remove ${s.fullName}`}
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
            title="Add staff"
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
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            <FormField label="Full name" required>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g., Priya Fernando"
                autoFocus
              />
            </FormField>
            <FormField label="Role">
              <ChipGroup options={ROLES} value={role} onChange={setRole} />
            </FormField>
            <FormField label="Shift">
              <ChipGroup options={SHIFTS} value={shift} onChange={setShift} />
            </FormField>
            <FormField label="Phone">
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Optional"
                keyboardType="phone-pad"
              />
            </FormField>
            <FormField label="Email">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Optional"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </FormField>
            <Button
              title="Add to roster"
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
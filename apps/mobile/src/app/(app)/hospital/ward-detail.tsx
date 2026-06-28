import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Plus,
  Bed,
  Search,
  UserPlus,
  CheckCircle2,
  Brush,
  Wrench,
  Lock,
  User,
} from "lucide-react-native";
import {
  useBeds,
  useCreateBed,
  useUpdateBedStatus,
  useAssignBed,
  useDischargeBed,
  useSearchPatients,
  useHospitalPatients,
} from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
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
  Avatar,
  useToast,
  ListItem,
  Divider,
} from "@/components/ui";

type BedAction = "status" | "assign" | "discharge" | null;

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "cleaning", label: "Cleaning" },
  { value: "maintenance", label: "Maintenance" },
  { value: "reserved", label: "Reserved" },
];

function statusTone(s: string): any {
  switch (s) {
    case "occupied":
      return "danger";
    case "available":
      return "success";
    case "cleaning":
      return "warning";
    case "maintenance":
      return "neutral";
    case "reserved":
      return "info";
    default:
      return "neutral";
  }
}

function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function WardDetailScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const toast = useToast();

  const { data, isLoading } = useBeds(id);
  const createBed = useCreateBed();
  const updateStatus = useUpdateBedStatus();
  const assignBed = useAssignBed();
  const dischargeBed = useDischargeBed();
  const { data: admitted } = useHospitalPatients();

  // Determine which beds have active assignments
  const assignedBedIds = new Set(
    (admitted?.patients || []).map((p: any) => p.bedId)
  );
  const admittedByPatientId = new Map(
    (admitted?.patients || []).map((p: any) => [p.patientId, p])
  );

  const beds = data?.beds || [];

  const [bedNumber, setBedNumber] = useState("");
  const [showAddBed, setShowAddBed] = useState(false);
  const [bedAction, setBedAction] = useState<{
    type: BedAction;
    bedId: string;
  } | null>(null);

  // Status change
  const [newStatus, setNewStatus] = useState("available");

  // Assign
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const { data: searchResults } = useSearchPatients(debouncedQuery);
  const [assignNotes, setAssignNotes] = useState("");

  async function addBed() {
    if (!id || !bedNumber.trim()) {
      toast.show("Bed number required", "warning");
      return;
    }
    try {
      await createBed.mutateAsync({
        wardId: id,
        bedNumber: bedNumber.trim(),
        status: "available",
      });
      toast.show("Bed added", "success");
      setBedNumber("");
      setShowAddBed(false);
    } catch (err: any) {
      toast.show(err?.message || "Could not add bed", "danger");
    }
  }

  async function changeStatus() {
    if (!bedAction) return;
    try {
      await updateStatus.mutateAsync({
        id: bedAction.bedId,
        status: newStatus as any,
      });
      toast.show("Bed updated", "success");
      setBedAction(null);
    } catch (err: any) {
      toast.show(err?.message || "Update failed", "danger");
    }
  }

  async function doAssign(patientId: string) {
    if (!bedAction) return;
    try {
      await assignBed.mutateAsync({
        bedId: bedAction.bedId,
        patientId,
        notes: assignNotes.trim() || undefined,
      });
      toast.show("Patient admitted", "success");
      setBedAction(null);
      setSearchQuery("");
      setAssignNotes("");
    } catch (err: any) {
      toast.show(err?.message || "Assignment failed", "danger");
    }
  }

  function confirmDischarge(bedId: string) {
    Alert.alert("Discharge patient?", "Move the bed to cleaning status.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discharge",
        style: "destructive",
        onPress: async () => {
          try {
            await dischargeBed.mutateAsync(bedId);
            toast.show("Patient discharged", "success");
          } catch (err: any) {
            toast.show(err?.message || "Discharge failed", "danger");
          }
        },
      },
    ]);
  }

  if (!id) {
    return (
      <Screen padded>
        <ScreenHeader title="Ward" back onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={name || "Ward"}
        right={
          <IconButton
            icon={Plus}
            onPress={() => setShowAddBed(true)}
            accessibilityLabel="Add bed"
            variant="soft"
          />
        }
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={80} radius={16} />
          ))}
        </View>
      ) : beds.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={Bed}
            title="No beds yet"
            message="Add the first bed for this ward."
            actionLabel="Add bed"
            onAction={() => setShowAddBed(true)}
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {beds.map((row: any) => {
            // When no wardId filter, row is {bed, ward}; when filtered, row is bed row directly
            const bed = row.bed || row;
            const occupied = assignedBedIds.has(bed.id);
            const admittedPatient = (admitted?.patients || []).find(
              (p: any) => p.bedId === bed.id
            );

            return (
              <Card key={bed.id} padded={false}>
                <View
                  style={{
                    padding: spacing.lg,
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
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
                      <Bed
                        size={20}
                        color={
                          occupied
                            ? colors.danger
                            : bed.status === "available"
                            ? colors.success
                            : colors.textSubtle
                        }
                        strokeWidth={2.2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[typography.title.sm, { color: colors.text }]}
                      >
                        Bed {bed.bedNumber}
                      </Text>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted, marginTop: 2 },
                        ]}
                      >
                        {admittedPatient
                          ? `Admitted: ${admittedPatient.patientName}`
                          : bed.notes || "—"}
                      </Text>
                    </View>
                    <PillCmp
                      label={occupied ? "Occupied" : statusLabel(bed.status)}
                      tone={occupied ? "danger" : statusTone(bed.status)}
                      size="sm"
                    />
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                      flexWrap: "wrap",
                    }}
                  >
                    {occupied ? (
                      <>
                        <Button
                          title="Open chart"
                          icon={User}
                          variant="primary"
                          size="sm"
                          fullWidth={false}
                          onPress={() =>
                            router.push({
                              pathname: "/hospital/patient-detail",
                              params: { id: admittedPatient.patientId },
                            })
                          }
                        />
                        <Button
                          title="Discharge"
                          icon={CheckCircle2}
                          variant="danger"
                          size="sm"
                          fullWidth={false}
                          onPress={() => confirmDischarge(bed.id)}
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          title="Assign"
                          icon={UserPlus}
                          variant="primary"
                          size="sm"
                          fullWidth={false}
                          onPress={() => {
                            setBedAction({ type: "assign", bedId: bed.id });
                            setNewStatus("available");
                            setSearchQuery("");
                            setAssignNotes("");
                          }}
                        />
                        <Button
                          title="Status"
                          icon={Brush}
                          variant="outline"
                          size="sm"
                          fullWidth={false}
                          onPress={() => {
                            setBedAction({ type: "status", bedId: bed.id });
                            setNewStatus(bed.status);
                          }}
                        />
                      </>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Add bed modal */}
      <Modal
        visible={showAddBed}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddBed(false)}
      >
        <Screen padded={false} edges={["top"]} bottomInset>
          <ScreenHeader
            title="Add bed"
            right={
              <Button
                title="Cancel"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setShowAddBed(false)}
              />
            }
          />
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label="Bed number" required>
              <TextInput
                value={bedNumber}
                onChangeText={setBedNumber}
                placeholder="e.g., 101A"
                autoFocus
              />
            </FormField>
            <Button
              title="Add bed"
              onPress={addBed}
              loading={createBed.isPending}
              icon={Plus}
              size="lg"
            />
          </View>
        </Screen>
      </Modal>

      {/* Status change modal */}
      <Modal
        visible={bedAction?.type === "status"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBedAction(null)}
      >
        <Screen padded={false} edges={["top"]} bottomInset>
          <ScreenHeader
            title="Change bed status"
            right={
              <Button
                title="Cancel"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setBedAction(null)}
              />
            }
          />
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label="New status">
              <ChipGroup
                options={STATUS_OPTIONS}
                value={newStatus}
                onChange={setNewStatus}
              />
            </FormField>
            <Button
              title="Update status"
              onPress={changeStatus}
              loading={updateStatus.isPending}
              icon={Brush}
              size="lg"
            />
          </View>
        </Screen>
      </Modal>

      {/* Assign patient modal */}
      <Modal
        visible={bedAction?.type === "assign"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBedAction(null)}
      >
        <Screen padded={false} edges={["top"]} bottomInset>
          <ScreenHeader
            title="Assign patient"
            right={
              <Button
                title="Cancel"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setBedAction(null)}
              />
            }
          />
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            <FormField label="Notes">
              <TextInput
                value={assignNotes}
                onChangeText={setAssignNotes}
                placeholder="Optional admission notes"
                multiline
                numberOfLines={2}
                tone="soft"
              />
            </FormField>

            <FormField label="Search patient">
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Name, NIC, or phone"
                leadingIcon={Search}
                autoCapitalize="none"
              />
            </FormField>

            {searchQuery.length >= 2 ? (
              <View style={{ gap: spacing.sm }}>
                {(searchResults?.patients || []).map((p: any) => {
                  const alreadyAdmitted = admittedByPatientId.has(p.id);
                  return (
                    <ListItem
                      key={p.id}
                      variant="contact"
                      iconTone={alreadyAdmitted ? "neutral" : "primary"}
                      title={p.name || "Patient"}
                      subtitle={
                        alreadyAdmitted
                          ? `Already admitted to ${admittedByPatientId.get(p.id)?.wardName}`
                          : p.phone || "Tap to admit"
                      }
                      mediaSlot={
                        <Avatar
                          name={p.name}
                          size="md"
                          tone="primary"
                          source={p.photo ? { uri: p.photo } : undefined}
                        />
                      }
                      pill={
                        alreadyAdmitted
                          ? { label: "Admitted", tone: "warning" }
                          : { label: "Admit", tone: "primary" }
                      }
                      onPress={() => !alreadyAdmitted && doAssign(p.id)}
                    />
                  );
                })}
                {(searchResults?.patients || []).length === 0 ? (
                  <EmptyState icon={Search} title="No patients found" />
                ) : null}
              </View>
            ) : (
              <EmptyState
                icon={Search}
                title="Search to find a patient"
                message="Type at least 2 characters"
              />
            )}
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}
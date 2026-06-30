// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
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
} from "@/components/ui";

type BedAction = "status" | "assign" | "discharge" | null;

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

export default function WardDetailScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const toast = useToast();

  const { data, isLoading } = useBeds(id);
  const createBed = useCreateBed();
  const updateStatus = useUpdateBedStatus();
  const assignBed = useAssignBed();
  const dischargeBed = useDischargeBed();
  const { data: admitted } = useHospitalPatients();

  const STATUS_OPTIONS = [
    { value: "available", label: t("hospitalWardDetail.statusAvailable") },
    { value: "cleaning", label: t("hospitalWardDetail.statusCleaning") },
    { value: "maintenance", label: t("hospitalWardDetail.statusMaintenance") },
    { value: "reserved", label: t("hospitalWardDetail.statusReserved") },
  ];

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

  const [newStatus, setNewStatus] = useState("available");

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const { data: searchResults } = useSearchPatients(debouncedQuery);
  const [assignNotes, setAssignNotes] = useState("");

  async function addBed() {
    if (!id || !bedNumber.trim()) {
      toast.show(t("hospitalWardDetail.bedNumberRequired"), "warning");
      return;
    }
    try {
      await createBed.mutateAsync({
        wardId: id,
        bedNumber: bedNumber.trim(),
        status: "available",
      });
      toast.show(t("hospitalWardDetail.bedAddedToast"), "success");
      setBedNumber("");
      setShowAddBed(false);
    } catch (err: any) {
      toast.show(err?.message || t("hospitalWardDetail.addBedError"), "danger");
    }
  }

  async function changeStatus() {
    if (!bedAction) return;
    try {
      await updateStatus.mutateAsync({
        id: bedAction.bedId,
        status: newStatus as any,
      });
      toast.show(t("hospitalWardDetail.bedUpdatedToast"), "success");
      setBedAction(null);
    } catch (err: any) {
      toast.show(err?.message || t("hospitalWardDetail.updateError"), "danger");
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
      toast.show(t("hospitalWardDetail.patientAdmittedToast"), "success");
      setBedAction(null);
      setSearchQuery("");
      setAssignNotes("");
    } catch (err: any) {
      toast.show(err?.message || t("hospitalWardDetail.assignError"), "danger");
    }
  }

  function confirmDischarge(bedId: string) {
    Alert.alert(
      t("hospitalWardDetail.dischargeAlertTitle"),
      t("hospitalWardDetail.dischargeAlertBody"),
      [
        { text: t("hospitalWardDetail.cancel"), style: "cancel" },
        {
          text: t("hospitalWardDetail.discharge"),
          style: "destructive",
          onPress: async () => {
            try {
              await dischargeBed.mutateAsync(bedId);
              toast.show(t("hospitalWardDetail.patientDischargedToast"), "success");
            } catch (err: any) {
              toast.show(err?.message || t("hospitalWardDetail.dischargeError"), "danger");
            }
          },
        },
      ]
    );
  }

  if (!id) {
    return (
      <Screen padded>
        <ScreenHeader title={t("hospitalWardDetail.fallbackTitle")} back onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={name || t("hospitalWardDetail.fallbackTitle")}
        right={
          <IconButton
            icon={Plus}
            onPress={() => setShowAddBed(true)}
            accessibilityLabel={t("hospitalWardDetail.addBedA11y")}
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
            title={t("hospitalWardDetail.emptyTitle")}
            message={t("hospitalWardDetail.emptyBody")}
            actionLabel={t("hospitalWardDetail.emptyAction")}
            onAction={() => setShowAddBed(true)}
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {beds.map((row: any) => {
            const bed = row.bed || row;
            const occupied = assignedBedIds.has(bed.id);
            const admittedPatient = (admitted?.patients || []).find(
              (p: any) => p.bedId === bed.id
            );

            const statusKey = `status.${bed.status}`;
            const bedStatusLabel = t(statusKey, { defaultValue: bed.status });

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
                        {t("hospitalWardDetail.bedLabel", { number: bed.bedNumber })}
                      </Text>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted, marginTop: 2 },
                        ]}
                      >
                        {admittedPatient
                          ? t("hospitalWardDetail.admittedSubtitle", {
                              name: admittedPatient.patientName,
                            })
                          : bed.notes || "—"}
                      </Text>
                    </View>
                    <PillCmp
                      label={occupied ? t("hospitalWardDetail.occupiedPill") : bedStatusLabel}
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
                          title={t("hospitalWardDetail.openChart")}
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
                          title={t("hospitalWardDetail.discharge")}
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
                          title={t("hospitalWardDetail.assign")}
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
                          title={t("hospitalWardDetail.statusBtn")}
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

      <Modal
        visible={showAddBed}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddBed(false)}
      >
        <Screen padded={false} edges={["top"]} bottomInset>
          <ScreenHeader
            title={t("hospitalWardDetail.addBedTitle")}
            right={
              <Button
                title={t("hospitalWardDetail.cancel")}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setShowAddBed(false)}
              />
            }
          />
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label={t("hospitalWardDetail.bedNumber")} required>
              <TextInput
                value={bedNumber}
                onChangeText={setBedNumber}
                placeholder={t("hospitalWardDetail.bedNumberPlaceholder")}
                autoFocus
              />
            </FormField>
            <Button
              title={t("hospitalWardDetail.emptyAction")}
              onPress={addBed}
              loading={createBed.isPending}
              icon={Plus}
              size="lg"
            />
          </View>
        </Screen>
      </Modal>

      <Modal
        visible={bedAction?.type === "status"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBedAction(null)}
      >
        <Screen padded={false} edges={["top"]} bottomInset>
          <ScreenHeader
            title={t("hospitalWardDetail.changeStatusTitle")}
            right={
              <Button
                title={t("hospitalWardDetail.cancel")}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setBedAction(null)}
              />
            }
          />
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label={t("hospitalWardDetail.newStatus")}>
              <ChipGroup
                options={STATUS_OPTIONS}
                value={newStatus}
                onChange={setNewStatus}
              />
            </FormField>
            <Button
              title={t("hospitalWardDetail.updateStatus")}
              onPress={changeStatus}
              loading={updateStatus.isPending}
              icon={Brush}
              size="lg"
            />
          </View>
        </Screen>
      </Modal>

      <Modal
        visible={bedAction?.type === "assign"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBedAction(null)}
      >
        <Screen padded={false} edges={["top"]} bottomInset>
          <ScreenHeader
            title={t("hospitalWardDetail.assignPatientTitle")}
            right={
              <Button
                title={t("hospitalWardDetail.cancel")}
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
            <FormField label={t("hospitalWardDetail.notes")}>
              <TextInput
                value={assignNotes}
                onChangeText={setAssignNotes}
                placeholder={t("hospitalWardDetail.notesPlaceholder")}
                multiline
                numberOfLines={2}
                tone="soft"
              />
            </FormField>

            <FormField label={t("hospitalWardDetail.searchPatient")}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("hospitalWardDetail.searchPlaceholder")}
                leadingIcon={Search}
                autoCapitalize="none"
              />
            </FormField>

            {searchQuery.length >= 2 ? (
              <View style={{ gap: spacing.sm }}>
                {(searchResults?.patients || []).map((p: any) => {
                  const alreadyAdmitted = admittedByPatientId.has(p.id);
                  const admissionInfo = admittedByPatientId.get(p.id);
                  return (
                    <ListItem
                      key={p.id}
                      variant="contact"
                      iconTone={alreadyAdmitted ? "neutral" : "primary"}
                      title={p.name || t("hospitalWardDetail.patientFallback")}
                      subtitle={
                        alreadyAdmitted
                          ? t("hospitalWardDetail.alreadyAdmittedTo", {
                              ward: admissionInfo?.wardName,
                            })
                          : p.phone || t("hospitalWardDetail.tapToAdmit")
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
                          ? { label: t("hospitalWardDetail.admittedPill"), tone: "warning" }
                          : { label: t("hospitalWardDetail.admitPill"), tone: "primary" }
                      }
                      onPress={() => !alreadyAdmitted && doAssign(p.id)}
                    />
                  );
                })}
                {(searchResults?.patients || []).length === 0 ? (
                  <EmptyState icon={Search} title={t("hospitalWardDetail.noPatientsFound")} />
                ) : null}
              </View>
            ) : (
              <EmptyState
                icon={Search}
                title={t("hospitalWardDetail.searchToFindPatient")}
                message={t("hospitalWardDetail.searchHelper")}
              />
            )}
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}
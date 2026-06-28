import { useState } from "react";
import { View, Text } from "react-native";
import {
  Save,
  FileText,
  Stethoscope,
  Pill as PillIcon,
  ChevronRight,
  Users,
  Search,
  Clock,
} from "lucide-react-native";
import {
  useDoctorDashboard,
  useSearchPatients,
  useCreatePrescription,
} from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  TextInput,
  Card,
  Pill as PillCmp,
  ChipGroup,
  FormField,
  Button,
  Avatar,
  Skeleton,
  EmptyState,
  ListItem,
  Timeline,
  useToast,
} from "@/components/ui";

const FREQUENCIES = [
  { value: "Once daily", label: "Once daily" },
  { value: "Twice daily", label: "Twice daily" },
  { value: "Three times daily", label: "Three times" },
];

export default function DoctorScreen() {
  const { spacing, colors, typography, radius } = useTheme();
  const { data: dashboard, isLoading } = useDoctorDashboard();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 350);
  const { data: searchResults } = useSearchPatients(debouncedQuery);
  const createPrescription = useCreatePrescription();
  const toast = useToast();

  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("");

  async function handleCreate() {
    if (!selectedPatient || !medName || !medDosage) {
      toast.show("Medicine name and dosage are required", "warning");
      return;
    }
    try {
      await createPrescription.mutateAsync({
        patientId: selectedPatient.id,
        diagnosis,
        notes,
        medicines: [
          {
            name: medName,
            dosage: medDosage,
            frequency: medFrequency,
          },
        ],
      });
      toast.show("Prescription created", "success");
      setSelectedPatient(null);
      setDiagnosis("");
      setNotes("");
      setMedName("");
      setMedDosage("");
      setMedFrequency("");
    } catch (err: any) {
      toast.show(err?.message || "Could not create prescription", "danger");
    }
  }

  if (selectedPatient) {
    return (
      <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => setSelectedPatient(null)}
          title="New prescription"
          right={<PillCmp label="Draft" tone="warning" size="sm" />}
        />

        <View
          style={{
            margin: spacing.lg,
            padding: spacing.lg,
            borderRadius: radius.glass,
            backgroundColor: colors.primarySoft,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Avatar
            name={selectedPatient.name}
            size="lg"
            tone="primary"
            ring
          />
          <View style={{ flex: 1 }}>
            <Text style={[typography.title.md, { color: colors.text }]}>
              {selectedPatient.name || "Patient"}
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, marginTop: 2 },
              ]}
            >
              {selectedPatient.phone || "No phone on file"}
            </Text>
          </View>
        </View>

        <View
          style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}
        >
          <Card padded={false}>
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.sm,
              }}
            >
              <Text
                style={[typography.label.lg, { color: colors.textMuted }]}
              >
                ASSESSMENT
              </Text>
            </View>
            <View style={{ padding: spacing.lg, gap: spacing.lg }}>
              <FormField label="Diagnosis">
                <TextInput
                  value={diagnosis}
                  onChangeText={setDiagnosis}
                  placeholder="e.g., Acute pharyngitis"
                  leadingIcon={Stethoscope}
                  multiline
                  numberOfLines={2}
                />
              </FormField>

              <FormField label="Medicine" required>
                <TextInput
                  value={medName}
                  onChangeText={setMedName}
                  placeholder="e.g., Amoxicillin"
                  leadingIcon={PillIcon}
                />
              </FormField>

              <FormField label="Dosage" required>
                <TextInput
                  value={medDosage}
                  onChangeText={setMedDosage}
                  placeholder="e.g., 500mg"
                />
              </FormField>

              <FormField label="Frequency">
                <ChipGroup
                  options={FREQUENCIES}
                  value={medFrequency}
                  onChange={setMedFrequency}
                />
              </FormField>

              <FormField label="Notes">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional instructions"
                  leadingIcon={FileText}
                  multiline
                  numberOfLines={3}
                  tone="soft"
                />
              </FormField>
            </View>
          </Card>

          <Button
            title="Create prescription"
            onPress={handleCreate}
            loading={createPrescription.isPending}
            icon={Save}
            size="lg"
          />
        </View>
      </Screen>
    );
  }

  const queue: any[] = dashboard?.todaysAppointments || [];
  const todayCount = dashboard?.stats?.todayAppointments ?? 0;
  const totalPatients = dashboard?.stats?.totalPatients ?? 0;
  const results: any[] = searchResults?.patients || [];

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader title="Doctor portal" subtitle="Manage your patients" />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={140} radius={24} />
          <Skeleton height={56} radius={16} />
          <Skeleton height={120} radius={20} />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {/* Hero stats strip */}
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radius.glass,
              backgroundColor: colors.primarySoft,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.lg,
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Text
                style={[
                  typography.display.lg,
                  {
                    color: colors.primary,
                    fontSize: 44,
                    lineHeight: 48,
                  },
                ]}
              >
                {todayCount}
              </Text>
              <Text
                style={[
                  typography.overline,
                  { color: colors.primary, marginTop: 4 },
                ]}
              >
                TODAY
              </Text>
            </View>
            <View
              style={{
                width: 1,
                alignSelf: "stretch",
                backgroundColor: colors.primary,
                opacity: 0.2,
              }}
            />
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  marginBottom: 4,
                }}
              >
                <Users size={14} color={colors.primary} strokeWidth={2.5} />
                <Text
                  style={[
                    typography.label.md,
                    { color: colors.primary },
                  ]}
                >
                  {totalPatients} patients
                </Text>
              </View>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted },
                ]}
                numberOfLines={2}
              >
                Tap a patient below to start a prescription.
              </Text>
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text
              style={[
                typography.title.sm,
                { color: colors.text },
              ]}
            >
              Search patients
            </Text>
            <TextInput
              placeholder="Name, NIC, or phone..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              leadingIcon={Search}
              tone="soft"
              autoCapitalize="none"
            />
          </View>

          {results.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {results.map((p) => (
                <ListItem
                  key={p.id}
                  variant="contact"
                  iconTone="primary"
                  title={p.name || "Patient"}
                  subtitle={p.phone || "Tap to prescribe"}
                  mediaSlot={
                    <Avatar
                      name={p.name}
                      size="md"
                      tone="primary"
                      source={p.photo ? { uri: p.photo } : undefined}
                    />
                  }
                  pill={{ label: "Prescribe", tone: "primary" }}
                  trailing={
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.primary,
                      }}
                    >
                      <ChevronRight
                        size={18}
                        color={colors.onPrimary}
                        strokeWidth={2.5}
                      />
                    </View>
                  }
                  onPress={() => setSelectedPatient(p)}
                />
              ))}
            </View>
          ) : searchQuery.length > 0 ? (
            <EmptyState
              icon={Search}
              title="No patients found"
              message="Try a different name, NIC, or phone"
              tone="neutral"
            />
          ) : null}

          {queue.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.text },
                ]}
              >
                Today's queue
              </Text>
              <Timeline
                data={queue}
                groupBy={(q: any) => {
                  const status = q.status?.toLowerCase();
                  if (status === "completed" || status === "cancelled") {
                    return "done";
                  }
                  const t = q.time;
                  if (!t) return "later";
                  const [hh, mm] = t.split(":").map((n: string) =>
                    parseInt(n, 10)
                  );
                  if (Number.isNaN(hh) || Number.isNaN(mm)) return "later";
                  const now = new Date();
                  const slot = new Date(now);
                  slot.setHours(hh, mm, 0, 0);
                  const diff = (slot.getTime() - now.getTime()) / (1000 * 60);
                  if (diff < -30) return "done";
                  if (diff < 30) return "now";
                  return "later";
                }}
                groupMeta={{
                  now: { label: "Now", tone: "accent2" },
                  later: { label: "Later today", tone: "primary" },
                  done: { label: "Done", tone: "neutral" },
                }}
                keyExtractor={(q: any) => q.id}
                flush
                renderItem={(item: any) => {
                  const tone =
                    item.status === "completed"
                      ? "success"
                      : item.status === "cancelled"
                      ? "danger"
                      : "primary";
                  return (
                    <ListItem
                      icon={Clock}
                      iconTone={tone as any}
                      variant="timeline"
                      title={`${item.time || "—"} · Queue #${item.queueNumber ?? "—"}`}
                      subtitle={item.reason || item.status || ""}
                      pill={{
                        label: item.status,
                        tone: tone as any,
                      }}
                    />
                  );
                }}
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
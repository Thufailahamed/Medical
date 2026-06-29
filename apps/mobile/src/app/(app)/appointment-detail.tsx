import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Stethoscope,
  Pill,
  FlaskConical,
  CalendarClock,
  ClipboardList,
  Activity,
  FileText,
  Hash,
  Clock,
  Building2,
  Sparkles,
} from "lucide-react-native";
import {
  useAppointmentRecords,
  useRescheduleAppointment,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  PillTone,
  EmptyState,
  Skeleton,
  Button,
  SectionHeader,
  Divider,
  BottomSheet,
  FormField,
  TextInput,
  useToast,
} from "@/components/ui";

const STATUS_TONE: Record<string, PillTone> = {
  scheduled: "primary",
  confirmed: "success",
  in_progress: "primary",
  completed: "info",
  cancelled: "danger",
  no_show: "danger",
};

const RECORD_ICONS: Record<string, any> = {
  clinical_note: Stethoscope,
  prescription: Pill,
  lab_order: FlaskConical,
  follow_up: CalendarClock,
  lab_report: FlaskConical,
  hospital_visit: Building2,
};

const RECORD_LABEL: Record<string, string> = {
  clinical_note: "Clinical note",
  prescription: "Prescription",
  lab_order: "Lab order",
  follow_up: "Follow-up",
  lab_report: "Lab report",
  hospital_visit: "Hospital visit",
};

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const { data, isLoading } = useAppointmentRecords(id || null);
  const reschedule = useRescheduleAppointment();
  const [reschedOpen, setReschedOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const appt = data?.appointment;
  const records: any[] = data?.records || [];

  function startReschedule() {
    if (!appt) return;
    setNewDate(appt.date);
    setNewTime(appt.time);
    setReschedOpen(true);
  }

  async function submitReschedule() {
    if (!id || !newDate || !newTime) {
      toast.show("Date and time required", "warning");
      return;
    }
    try {
      await reschedule.mutateAsync({ id, date: newDate, time: newTime });
      toast.show("Appointment rescheduled", "success");
      setReschedOpen(false);
    } catch (err: any) {
      toast.show(err?.message || "Could not reschedule", "danger");
    }
  }

  return (
    <Screen keyboard padded={false} bottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScreenHeader
          back
          onBack={() => router.back()}
          title="Appointment"
        />

        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.lg,
            paddingBottom: spacing.xl * 2,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={120} radius={20} />
              <Skeleton height={180} radius={20} />
            </View>
          ) : !appt ? (
            <EmptyState
              icon={ClipboardList}
              title="Appointment not found"
              message="This visit may have been deleted."
            />
          ) : (
            <>
              {/* Summary card */}
              <Card>
                <View style={{ gap: spacing.md }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      flexWrap: "wrap",
                    }}
                  >
                    <PillCmp
                      label={appt.status.replace("_", " ")}
                      tone={STATUS_TONE[appt.status] || "neutral"}
                      size="sm"
                    />
                    <PillCmp icon={Clock} label={appt.time} tone="neutral" size="sm" />
                    <PillCmp icon={Hash} label={`#${appt.queueNumber ?? "—"}`} tone="neutral" size="sm" />
                  </View>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {appt.date}
                  </Text>
                  {appt.reason ? (
                    <Text
                      style={[typography.body.md, { color: colors.textMuted }]}
                    >
                      {appt.reason}
                    </Text>
                  ) : null}
                  {appt.notes ? (
                    <Text
                      style={[typography.caption, { color: colors.textSubtle }]}
                    >
                      {appt.notes}
                    </Text>
                  ) : null}

                  {["scheduled", "confirmed"].includes(appt.status) ? (
                    <Button
                      title="Reschedule"
                      icon={CalendarClock}
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      onPress={startReschedule}
                    />
                  ) : null}
                </View>
              </Card>

              {/* Records tied to this appointment */}
              <SectionHeader title={`Visit notes (${records.length})`} />

              {records.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No records yet"
                  message="Your doctor hasn't written up this visit."
                  tone="neutral"
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  {records.map((r: any) => {
                    const Icon = RECORD_ICONS[r.recordType] || Stethoscope;
                    return (
                      <Card key={r.id}>
                        <View style={{ gap: spacing.sm }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.sm,
                            }}
                          >
                            <Icon size={18} color={colors.primary} />
                            <Text
                              style={[
                                typography.title.sm,
                                { color: colors.text, flex: 1 },
                              ]}
                            >
                              {r.title || RECORD_LABEL[r.recordType] || r.recordType}
                            </Text>
                            <PillCmp
                              label={RECORD_LABEL[r.recordType] || r.recordType}
                              tone="primary"
                              size="sm"
                            />
                          </View>
                          {r.diagnosis ? (
                            <Text style={[typography.body.md, { color: colors.text }]}>
                              <Text style={{ fontWeight: "700" }}>Dx: </Text>
                              {r.diagnosis}
                            </Text>
                          ) : null}
                          {r.summary ? (
                            <Text
                              style={[typography.body.sm, { color: colors.textMuted }]}
                              numberOfLines={6}
                            >
                              {r.summary}
                            </Text>
                          ) : null}
                          {r.notes ? (
                            <Text
                              style={[typography.caption, { color: colors.textSubtle }]}
                            >
                              {r.notes}
                            </Text>
                          ) : null}
                          {r.followUpDate ? (
                            <PillCmp
                              icon={CalendarClock}
                              label={`Follow-up: ${r.followUpDate}`}
                              tone="warning"
                              size="sm"
                            />
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <BottomSheet
          visible={reschedOpen}
          onDismiss={() => setReschedOpen(false)}
          title="Reschedule"
        >
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <FormField label="New date">
              <TextInput
                value={newDate}
                onChangeText={setNewDate}
                placeholder="YYYY-MM-DD"
              />
            </FormField>
            <FormField label="New time">
              <TextInput
                value={newTime}
                onChangeText={setNewTime}
                placeholder="HH:MM"
              />
            </FormField>
            <Button
              title="Save"
              icon={Sparkles}
              onPress={submitReschedule}
              loading={reschedule.isPending}
            />
          </View>
        </BottomSheet>
      </KeyboardAvoidingView>
    </Screen>
  );
}
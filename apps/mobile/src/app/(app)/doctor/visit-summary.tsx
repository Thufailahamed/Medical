import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Sparkles,
  Plus,
  Trash2,
  Pill,
  FlaskConical,
  CalendarClock,
  CheckCircle2,
} from "lucide-react-native";
import { usePatientSummary, useCreateVisitSummary } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  TextInput,
  FormField,
  Button,
  Pill as PillCmp,
  SectionHeader,
  Divider,
  useToast,
} from "@/components/ui";

type RxDraft = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type LabDraft = { testName: string; instructions: string };

export default function VisitSummaryScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const { patientId, appointmentId } = useLocalSearchParams<{
    patientId: string;
    appointmentId?: string;
  }>();

  const toast = useToast();
  const { mutate, isPending } = useCreateVisitSummary();

  const { data: summary } = usePatientSummary(patientId || null);

  const [title, setTitle] = useState("Visit summary");
  const [diagnosis, setDiagnosis] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [notes, setNotes] = useState("");

  const [rx, setRx] = useState<RxDraft>({
    name: "",
    dosage: "",
    frequency: "",
    duration: "",
    instructions: "",
  });
  const [rxList, setRxList] = useState<RxDraft[]>([]);

  const [lab, setLab] = useState<LabDraft>({ testName: "", instructions: "" });
  const [labList, setLabList] = useState<LabDraft[]>([]);

  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [followUpTitle, setFollowUpTitle] = useState("Follow-up");
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [markCompleted, setMarkCompleted] = useState(!!appointmentId);

  const patientName = (summary as any)?.user?.name || null;

  const addRx = () => {
    if (!rx.name.trim()) {
      toast.show("Medicine name required", "warning");
      return;
    }
    setRxList((prev) => [...prev, { ...rx, name: rx.name.trim() }]);
    setRx({ name: "", dosage: "", frequency: "", duration: "", instructions: "" });
  };

  const addLab = () => {
    if (!lab.testName.trim()) {
      toast.show("Test name required", "warning");
      return;
    }
    setLabList((prev) => [
      ...prev,
      { testName: lab.testName.trim(), instructions: lab.instructions },
    ]);
    setLab({ testName: "", instructions: "" });
  };

  const submit = () => {
    if (!patientId) {
      toast.show("Missing patient", "danger");
      return;
    }
    if (
      !diagnosis.trim() &&
      !subjective.trim() &&
      !objective.trim() &&
      !assessment.trim() &&
      !plan.trim() &&
      !notes.trim() &&
      rxList.length === 0 &&
      labList.length === 0 &&
      !followUpEnabled
    ) {
      toast.show("Fill at least diagnosis or one SOAP section", "warning");
      return;
    }

    mutate(
      {
        patientId,
        appointmentId: appointmentId || undefined,
        title,
        diagnosis: diagnosis || undefined,
        subjective: subjective || undefined,
        objective: objective || undefined,
        assessment: assessment || undefined,
        plan: plan || undefined,
        notes: notes || undefined,
        prescriptionItems: rxList.length ? rxList : undefined,
        labOrders: labList.length ? labList : undefined,
        followUp: followUpEnabled
          ? { followUpDate, title: followUpTitle, notes: followUpNotes }
          : undefined,
        markAppointmentCompleted: markCompleted && !!appointmentId,
      },
      {
        onSuccess: () => {
          toast.show("Visit summary saved", "success");
          router.back();
        },
        onError: (err: any) => {
          const msg =
            typeof err?.message === "string" && err.message
              ? err.message
              : "Failed to save visit summary";
          toast.show(msg, "danger");
        },
      }
    );
  };

  const headerSubtitle = patientName ? `For ${patientName}` : "Patient visit";

  return (
    <Screen keyboard padded={false} scroll={false} bottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScreenHeader
          back
          onBack={() => router.back()}
          title="Complete visit"
          subtitle={headerSubtitle}
        />
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.lg,
            paddingBottom: spacing.xl * 2,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Visit title */}
          <Card>
            <Text
              style={[
                typography.label.md,
                { color: colors.text, fontWeight: "700", marginBottom: spacing.sm },
              ]}
            >
              Visit
            </Text>
            <FormField label="Title">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Follow-up consultation"
                leadingIcon={Sparkles}
                tone="soft"
              />
            </FormField>
            <FormField label="Diagnosis">
              <TextInput
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholder="ICD-10 or free text"
                tone="soft"
                multiline
              />
            </FormField>
          </Card>

          {/* SOAP */}
          <Card>
            <SectionHeader title="SOAP note" />
            <View style={{ gap: spacing.md }}>
              <FormField label="S — Subjective" helper="What the patient reports">
                <TextInput
                  value={subjective}
                  onChangeText={setSubjective}
                  placeholder="Chief complaint, history, symptoms…"
                  tone="soft"
                  multiline
                />
              </FormField>
              <FormField label="O — Objective" helper="Exam, vitals, labs reviewed">
                <TextInput
                  value={objective}
                  onChangeText={setObjective}
                  placeholder="Findings, measurements…"
                  tone="soft"
                  multiline
                />
              </FormField>
              <FormField label="A — Assessment" helper="Clinical impression">
                <TextInput
                  value={assessment}
                  onChangeText={setAssessment}
                  placeholder="Differential, working diagnosis…"
                  tone="soft"
                  multiline
                />
              </FormField>
              <FormField label="P — Plan" helper="Treatment plan">
                <TextInput
                  value={plan}
                  onChangeText={setPlan}
                  placeholder="Medications, procedures, referrals…"
                  tone="soft"
                  multiline
                />
              </FormField>
              <FormField label="Additional notes">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any other context"
                  tone="soft"
                  multiline
                />
              </FormField>
            </View>
          </Card>

          {/* Prescriptions */}
          <Card>
            <SectionHeader title="Prescriptions" />
            <View style={{ gap: spacing.sm }}>
              {rxList.map((r, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    backgroundColor: colors.surfaceMuted,
                    padding: spacing.sm,
                    borderRadius: radius.md,
                  }}
                >
                  <PillCmp icon={Pill} label={r.name} tone="primary" size="sm" />
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {[r.dosage, r.frequency, r.duration]
                      .filter(Boolean)
                      .join(" • ") || "No details"}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      setRxList((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <FormField label="Medicine name">
                <TextInput
                  value={rx.name}
                  onChangeText={(v) => setRx((p) => ({ ...p, name: v }))}
                  placeholder="e.g. Amoxicillin"
                  tone="soft"
                />
              </FormField>
              <View
                style={{ flexDirection: "row", gap: spacing.sm }}
              >
                <View style={{ flex: 1 }}>
                  <FormField label="Dosage">
                    <TextInput
                      value={rx.dosage}
                      onChangeText={(v) => setRx((p) => ({ ...p, dosage: v }))}
                      placeholder="500mg"
                      tone="soft"
                    />
                  </FormField>
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Frequency">
                    <TextInput
                      value={rx.frequency}
                      onChangeText={(v) =>
                        setRx((p) => ({ ...p, frequency: v }))
                      }
                      placeholder="3x/day"
                      tone="soft"
                    />
                  </FormField>
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Duration">
                    <TextInput
                      value={rx.duration}
                      onChangeText={(v) => setRx((p) => ({ ...p, duration: v }))}
                      placeholder="7 days"
                      tone="soft"
                    />
                  </FormField>
                </View>
              </View>
              <FormField label="Instructions">
                <TextInput
                  value={rx.instructions}
                  onChangeText={(v) =>
                    setRx((p) => ({ ...p, instructions: v }))
                  }
                  placeholder="Take with food…"
                  tone="soft"
                  multiline
                />
              </FormField>
              <Button
                title="Add medicine"
                icon={Plus}
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={addRx}
              />
            </View>
          </Card>

          {/* Lab orders */}
          <Card>
            <SectionHeader title="Lab orders" />
            <View style={{ gap: spacing.sm }}>
              {labList.map((l, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    backgroundColor: colors.surfaceMuted,
                    padding: spacing.sm,
                    borderRadius: radius.md,
                  }}
                >
                  <PillCmp
                    icon={FlaskConical}
                    label={l.testName}
                    tone="neutral"
                    size="sm"
                  />
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {l.instructions || "No notes"}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      setLabList((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <FormField label="Test name">
                <TextInput
                  value={lab.testName}
                  onChangeText={(v) =>
                    setLab((p) => ({ ...p, testName: v }))
                  }
                  placeholder="e.g. CBC"
                  tone="soft"
                />
              </FormField>
              <FormField label="Notes">
                <TextInput
                  value={lab.instructions}
                  onChangeText={(v) =>
                    setLab((p) => ({ ...p, instructions: v }))
                  }
                  placeholder="Fasting, fasting glucose…"
                  tone="soft"
                  multiline
                />
              </FormField>
              <Button
                title="Add test"
                icon={Plus}
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={addLab}
              />
            </View>
          </Card>

          {/* Follow-up */}
          <Card>
            <SectionHeader title="Follow-up" />
            <Pressable
              onPress={() => setFollowUpEnabled(!followUpEnabled)}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.xs,
              }}
            >
              <CheckCircle2
                size={18}
                color={followUpEnabled ? colors.primary : colors.textSubtle}
                strokeWidth={2.2}
              />
              <Text style={[typography.body.md, { color: colors.text }]}>
                Schedule a follow-up
              </Text>
            </Pressable>

            {followUpEnabled && (
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <FormField label="Date">
                  <TextInput
                    value={followUpDate}
                    onChangeText={setFollowUpDate}
                    placeholder="YYYY-MM-DD"
                    tone="soft"
                  />
                </FormField>
                <FormField label="Title">
                  <TextInput
                    value={followUpTitle}
                    onChangeText={setFollowUpTitle}
                    placeholder="Follow-up review"
                    tone="soft"
                  />
                </FormField>
                <FormField label="Notes">
                  <TextInput
                    value={followUpNotes}
                    onChangeText={setFollowUpNotes}
                    placeholder="What to recheck"
                    tone="soft"
                    multiline
                  />
                </FormField>
              </View>
            )}
          </Card>

          {/* Appointment */}
          {appointmentId ? (
            <Card>
              <Pressable
                onPress={() => setMarkCompleted(!markCompleted)}
                hitSlop={8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <CheckCircle2
                  size={18}
                  color={markCompleted ? colors.primary : colors.textSubtle}
                  strokeWidth={2.2}
                />
                <Text style={[typography.body.md, { color: colors.text }]}>
                  Mark related appointment as completed
                </Text>
              </Pressable>
            </Card>
          ) : null}

          <Divider />

          <Button
            title="Save visit summary"
            icon={Sparkles}
            size="lg"
            loading={isPending}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

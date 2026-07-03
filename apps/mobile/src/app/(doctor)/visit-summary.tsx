// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Plus,
  Trash2,
  Pill,
  FlaskConical,
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
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const { patientId, appointmentId } = useLocalSearchParams<{
    patientId: string;
    appointmentId?: string;
  }>();

  const toast = useToast();
  const { mutate, isPending } = useCreateVisitSummary();

  const { data: summary } = usePatientSummary(patientId || null);

  const [title, setTitle] = useState(t("visitSummary.defaultTitle"));
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
  const [followUpTitle, setFollowUpTitle] = useState(t("visitSummary.followUpDefaultTitle"));
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [markCompleted, setMarkCompleted] = useState(!!appointmentId);

  const patientName = (summary as any)?.user?.name || null;

  const addRx = () => {
    if (!rx.name.trim()) {
      toast.show(t("visitSummary.medicineRequired"), "warning");
      return;
    }
    setRxList((prev) => [...prev, { ...rx, name: rx.name.trim() }]);
    setRx({ name: "", dosage: "", frequency: "", duration: "", instructions: "" });
  };

  const addLab = () => {
    if (!lab.testName.trim()) {
      toast.show(t("visitSummary.testRequired"), "warning");
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
      toast.show(t("visitSummary.missingPatient"), "danger");
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
      toast.show(t("visitSummary.fillSomething"), "warning");
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
          toast.show(t("visitSummary.savedToast"), "success");
          router.back();
        },
        onError: (err: any) => {
          const msg =
            typeof err?.message === "string" && err.message
              ? err.message
              : t("visitSummary.saveError");
          toast.show(msg, "danger");
        },
      }
    );
  };

  const headerSubtitle = patientName
    ? t("visitSummary.subtitleFor", { name: patientName })
    : t("visitSummary.subtitleFallback");

  return (
    <Screen keyboard padded={false} scroll={false} bottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScreenHeader
          back
          onBack={() => router.back()}
          title={t("visitSummary.title")}
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
              {t("visitSummary.cardVisit")}
            </Text>
            <FormField label={t("visitSummary.titleLabel")}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t("visitSummary.titlePlaceholder")}
                leadingIcon={Sparkles}
                tone="soft"
              />
            </FormField>
            <FormField label={t("visitSummary.diagnosis")}>
              <TextInput
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholder={t("visitSummary.diagnosisPlaceholder")}
                tone="soft"
                multiline
              />
            </FormField>
          </Card>

          {/* SOAP */}
          <Card>
            <SectionHeader title={t("visitSummary.soapHeading")} />
            <View style={{ gap: spacing.md }}>
              <FormField
                label={t("visitSummary.subjective")}
                helper={t("visitSummary.subjectiveHelper")}
              >
                <TextInput
                  value={subjective}
                  onChangeText={setSubjective}
                  placeholder={t("visitSummary.subjectivePlaceholder")}
                  tone="soft"
                  multiline
                />
              </FormField>
              <FormField
                label={t("visitSummary.objective")}
                helper={t("visitSummary.objectiveHelper")}
              >
                <TextInput
                  value={objective}
                  onChangeText={setObjective}
                  placeholder={t("visitSummary.objectivePlaceholder")}
                  tone="soft"
                  multiline
                />
              </FormField>
              <FormField
                label={t("visitSummary.assessment")}
                helper={t("visitSummary.assessmentHelper")}
              >
                <TextInput
                  value={assessment}
                  onChangeText={setAssessment}
                  placeholder={t("visitSummary.assessmentPlaceholder")}
                  tone="soft"
                  multiline
                />
              </FormField>
              <FormField
                label={t("visitSummary.plan")}
                helper={t("visitSummary.planHelper")}
              >
                <TextInput
                  value={plan}
                  onChangeText={setPlan}
                  placeholder={t("visitSummary.planPlaceholder")}
                  tone="soft"
                  multiline
                />
              </FormField>
              <FormField label={t("visitSummary.notes")}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t("visitSummary.notesPlaceholder")}
                  tone="soft"
                  multiline
                />
              </FormField>
            </View>
          </Card>

          {/* Prescriptions */}
          <Card>
            <SectionHeader title={t("visitSummary.rxHeading")} />
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
                      .join(" • ") || t("visitSummary.noDetails")}
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
              <FormField label={t("visitSummary.medicineName")}>
                <TextInput
                  value={rx.name}
                  onChangeText={(v) => setRx((p) => ({ ...p, name: v }))}
                  placeholder={t("visitSummary.medicinePlaceholder")}
                  tone="soft"
                />
              </FormField>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <FormField label={t("visitSummary.dosage")}>
                    <TextInput
                      value={rx.dosage}
                      onChangeText={(v) => setRx((p) => ({ ...p, dosage: v }))}
                      placeholder={t("visitSummary.dosagePlaceholder")}
                      tone="soft"
                    />
                  </FormField>
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label={t("visitSummary.frequency")}>
                    <TextInput
                      value={rx.frequency}
                      onChangeText={(v) =>
                        setRx((p) => ({ ...p, frequency: v }))
                      }
                      placeholder={t("visitSummary.frequencyPlaceholder")}
                      tone="soft"
                    />
                  </FormField>
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label={t("visitSummary.duration")}>
                    <TextInput
                      value={rx.duration}
                      onChangeText={(v) => setRx((p) => ({ ...p, duration: v }))}
                      placeholder={t("visitSummary.durationPlaceholder")}
                      tone="soft"
                    />
                  </FormField>
                </View>
              </View>
              <FormField label={t("visitSummary.instructions")}>
                <TextInput
                  value={rx.instructions}
                  onChangeText={(v) =>
                    setRx((p) => ({ ...p, instructions: v }))
                  }
                  placeholder={t("visitSummary.instructionsPlaceholder")}
                  tone="soft"
                  multiline
                />
              </FormField>
              <Button
                title={t("visitSummary.addMedicine")}
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
            <SectionHeader title={t("visitSummary.labHeading")} />
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
                    {l.instructions || t("visitSummary.noNotes")}
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
              <FormField label={t("visitSummary.testName")}>
                <TextInput
                  value={lab.testName}
                  onChangeText={(v) =>
                    setLab((p) => ({ ...p, testName: v }))
                  }
                  placeholder={t("visitSummary.testNamePlaceholder")}
                  tone="soft"
                />
              </FormField>
              <FormField label={t("visitSummary.testNotes")}>
                <TextInput
                  value={lab.instructions}
                  onChangeText={(v) =>
                    setLab((p) => ({ ...p, instructions: v }))
                  }
                  placeholder={t("visitSummary.testNotesPlaceholder")}
                  tone="soft"
                  multiline
                />
              </FormField>
              <Button
                title={t("visitSummary.addTest")}
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
            <SectionHeader title={t("visitSummary.followUpHeading")} />
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
                {t("visitSummary.scheduleFollowUp")}
              </Text>
            </Pressable>

            {followUpEnabled && (
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <FormField label={t("doctorAvailability.date")}>
                  <TextInput
                    value={followUpDate}
                    onChangeText={setFollowUpDate}
                    placeholder={t("doctorAvailability.datePlaceholder")}
                    tone="soft"
                  />
                </FormField>
                <FormField label={t("visitSummary.titleLabel")}>
                  <TextInput
                    value={followUpTitle}
                    onChangeText={setFollowUpTitle}
                    placeholder={t("visitSummary.followUpTitlePlaceholder")}
                    tone="soft"
                  />
                </FormField>
                <FormField label={t("visitSummary.notes")}>
                  <TextInput
                    value={followUpNotes}
                    onChangeText={setFollowUpNotes}
                    placeholder={t("visitSummary.followUpNotesPlaceholder")}
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
                  {t("visitSummary.markAppointment")}
                </Text>
              </Pressable>
            </Card>
          ) : null}

          <Divider />

          <Button
            title={t("visitSummary.saveAction")}
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
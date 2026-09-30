// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  TextInput as RNTextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Plus,
  X,
  Pill,
  FlaskConical,
  Check,
  Stethoscope,
  ClipboardList,
  CalendarClock,
  CalendarCheck,
  ChevronDown,
} from "lucide-react-native";
import { usePatientSummary, useCreateVisitSummary } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
import { Screen, ScreenHeader, Avatar, Button, useToast } from "@/components/ui";

type RxDraft = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type LabDraft = { testName: string; instructions: string };

type SectionKey = "visit" | "soap" | "rx" | "labs" | "followUp";

const FREQ_PRESETS = [
  { short: "OD", value: "Once daily" },
  { short: "BD", value: "Twice daily" },
  { short: "TDS", value: "Three times daily" },
  { short: "QID", value: "Four times daily" },
  { short: "PRN", value: "When needed" },
];
const COMMON_LABS = ["FBC", "FBS", "HbA1c", "Lipid profile", "UFR", "SGPT", "Serum creatinine", "TSH", "CRP", "ESR"];
const FOLLOW_UP_PRESETS = [7, 14, 30, 90];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDay(iso: string): string {
  const [y, m, d] = (iso || "").split("-").map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : iso;
}

export default function VisitSummaryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme, fontFamily } = useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.hairline;
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
  const [followUpDate, setFollowUpDate] = useState<string>(() => isoPlusDays(14));
  const [followUpTitle, setFollowUpTitle] = useState(t("visitSummary.followUpDefaultTitle"));
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [markCompleted, setMarkCompleted] = useState(!!appointmentId);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    visit: true,
    soap: true,
    rx: false,
    labs: false,
    followUp: false,
  });
  const toggle = (k: SectionKey) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const patientName = (summary as any)?.user?.name || null;
  const patientPhoto = (summary as any)?.user?.photo || null;

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

  const toggleCommonLab = (name: string) => {
    setLabList((prev) =>
      prev.some((l) => l.testName === name)
        ? prev.filter((l) => l.testName !== name)
        : [...prev, { testName: name, instructions: "" }]
    );
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

  const soapFilled = [subjective, objective, assessment, plan].filter((v) => v.trim()).length;
  const summaries: Record<SectionKey, { text: string; done: boolean }> = {
    visit: { text: diagnosis.trim() || t("visitSummary.statusNoDiagnosis", "No diagnosis yet"), done: !!diagnosis.trim() },
    soap: {
      text: soapFilled
        ? t("visitSummary.statusSoap", { count: soapFilled, defaultValue: `${soapFilled} of 4 sections` })
        : t("visitSummary.statusEmpty", "Not started"),
      done: soapFilled > 0 || !!notes.trim(),
    },
    rx: {
      text: rxList.length
        ? rxList.map((r) => r.name).join(", ")
        : t("visitSummary.statusNone", "None added"),
      done: rxList.length > 0,
    },
    labs: {
      text: labList.length
        ? labList.map((l) => l.testName).join(", ")
        : t("visitSummary.statusNone", "None added"),
      done: labList.length > 0,
    },
    followUp: {
      text: followUpEnabled ? fmtDay(followUpDate) : t("visitSummary.statusOff", "Not scheduled"),
      done: followUpEnabled,
    },
  };

  const reviewItems = [
    (diagnosis.trim() || soapFilled > 0 || notes.trim()) && t("visitSummary.reviewNote", "Visit note"),
    rxList.length > 0 &&
      t("visitSummary.reviewRx", { count: rxList.length, defaultValue: `${rxList.length} medicines` }),
    labList.length > 0 &&
      t("visitSummary.reviewLabs", { count: labList.length, defaultValue: `${labList.length} lab tests` }),
    followUpEnabled &&
      t("visitSummary.reviewFollowUp", { date: fmtDay(followUpDate), defaultValue: `Follow-up ${fmtDay(followUpDate)}` }),
  ].filter(Boolean) as string[];

  const chip = (label: string, active: boolean, onPress: () => void, key?: string) => (
    <Pressable
      key={key ?? label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 30,
        paddingHorizontal: 11,
        borderRadius: 15,
        borderCurve: "continuous",
        backgroundColor: active ? colors.primary : pressed ? colors.primarySoft : colors.fill,
      })}
    >
      {active ? <Check size={12} color={colors.onPrimary} strokeWidth={3} /> : null}
      <Text style={[typography.label.sm, { color: active ? colors.onPrimary : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );

  const field = (
    label: string,
    value: string,
    onChangeText: (v: string) => void,
    placeholder?: string,
    opts: { multiline?: boolean; flex?: number } = {}
  ) => (
    <View
      style={{
        flex: opts.flex,
        paddingHorizontal: 12,
        paddingTop: 7,
        paddingBottom: 3,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Text style={[typography.caption, { fontSize: 11, color: colors.textSubtle }]}>{label}</Text>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        multiline={opts.multiline}
        accessibilityLabel={label}
        style={{
          paddingVertical: 4,
          paddingHorizontal: 0,
          fontSize: 15,
          color: colors.text,
          fontFamily: fontFamily.body,
          minHeight: opts.multiline ? 44 : undefined,
          textAlignVertical: opts.multiline ? "top" : "center",
        }}
      />
    </View>
  );

  const addedRow = (
    icon: any,
    titleText: string,
    sub: string,
    onRemove: () => void,
    key: string
  ) => {
    const Icon = icon;
    return (
      <View
        key={key}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.sm,
          paddingRight: spacing.sm,
          borderRadius: 14,
          borderCurve: "continuous",
          backgroundColor: withOpacity(colors.primary, 0.06),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: withOpacity(colors.primary, 0.2),
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon size={15} color={colors.primary} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[typography.label.md, { color: colors.text }]}>
            {titleText}
          </Text>
          {sub ? (
            <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
              {sub}
            </Text>
          ) : null}
        </View>
        <Pressable
          hitSlop={8}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t("common.delete")}
          style={({ pressed }) => ({
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.dangerSoft : colors.well,
          })}
        >
          {({ pressed }) => <X size={13} color={pressed ? colors.danger : colors.textMuted} strokeWidth={2.6} />}
        </Pressable>
      </View>
    );
  };

  const SOAP_ROWS = [
    { letter: "S", label: t("visitSummary.subjective"), value: subjective, set: setSubjective, ph: t("visitSummary.subjectivePlaceholder") },
    { letter: "O", label: t("visitSummary.objective"), value: objective, set: setObjective, ph: t("visitSummary.objectivePlaceholder") },
    { letter: "A", label: t("visitSummary.assessment"), value: assessment, set: setAssessment, ph: t("visitSummary.assessmentPlaceholder") },
    { letter: "P", label: t("visitSummary.plan"), value: plan, set: setPlan, ph: t("visitSummary.planPlaceholder") },
  ];

  return (
    <Screen keyboard padded={false} scroll={false} bottomInset>
      <>
        <ScreenHeader
          back
          onBack={() => router.back()}
          title={t("visitSummary.title")}
          subtitle={headerSubtitle}
        />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xs,
            gap: spacing.md,
            paddingBottom: spacing.xl * 2,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Patient context */}
          {patientName ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 2 }}>
              <Avatar name={patientName} size="sm" tone="primary" source={patientPhoto ? { uri: patientPhoto } : undefined} />
              <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
                {t("visitSummary.stepsHint", "Fill what applies — everything saves in one go.")}
              </Text>
            </View>
          ) : null}

          {/* 1. Visit */}
          <Section
            icon={Stethoscope}
            title={t("visitSummary.cardVisit")}
            status={summaries.visit}
            open={open.visit}
            onToggle={() => toggle("visit")}
          >
            {field(t("visitSummary.titleLabel"), title, setTitle, t("visitSummary.titlePlaceholder"))}
            {field(t("visitSummary.diagnosis"), diagnosis, setDiagnosis, t("visitSummary.diagnosisPlaceholder"), { multiline: true })}
          </Section>

          {/* 2. SOAP */}
          <Section
            icon={ClipboardList}
            title={t("visitSummary.soapHeading")}
            status={summaries.soap}
            open={open.soap}
            onToggle={() => toggle("soap")}
            flush
          >
            {SOAP_ROWS.map((s, idx) => (
              <View
                key={s.letter}
                style={{
                  flexDirection: "row",
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm + 2,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.separator,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    marginTop: 2,
                    borderRadius: 9,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: s.value.trim() ? colors.primary : colors.primarySoft,
                  }}
                >
                  <Text style={{ fontFamily: fontFamily.heavy, fontSize: 13, color: s.value.trim() ? colors.onPrimary : colors.primary }}>
                    {s.letter}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.label.md, { color: colors.text }]}>
                    {String(s.label).replace(/^[SOAP]\s*[—-]\s*/, "")}
                  </Text>
                  <RNTextInput
                    value={s.value}
                    onChangeText={s.set}
                    placeholder={s.ph}
                    placeholderTextColor={colors.textSubtle}
                    multiline
                    accessibilityLabel={s.label}
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: 0,
                      fontSize: 15,
                      lineHeight: 21,
                      minHeight: 42,
                      color: colors.text,
                      fontFamily: fontFamily.body,
                      textAlignVertical: "top",
                    }}
                  />
                </View>
              </View>
            ))}
            <View style={{ padding: spacing.md, paddingTop: 0 }}>
              {field(t("visitSummary.notes"), notes, setNotes, t("visitSummary.notesPlaceholder"), { multiline: true })}
            </View>
          </Section>

          {/* 3. Prescriptions */}
          <Section
            icon={Pill}
            title={t("visitSummary.rxHeading")}
            status={summaries.rx}
            count={rxList.length}
            open={open.rx}
            onToggle={() => toggle("rx")}
          >
            {rxList.map((r, i) =>
              addedRow(
                Pill,
                r.name,
                [r.dosage, r.frequency, r.duration].filter(Boolean).join(" · ") || t("visitSummary.noDetails"),
                () => setRxList((prev) => prev.filter((_, j) => j !== i)),
                `rx-${i}`
              )
            )}
            {field(t("visitSummary.medicineName"), rx.name, (v) => setRx((p) => ({ ...p, name: v })), t("visitSummary.medicinePlaceholder"))}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {field(t("visitSummary.dosage"), rx.dosage, (v) => setRx((p) => ({ ...p, dosage: v })), t("visitSummary.dosagePlaceholder"), { flex: 1 })}
              {field(t("visitSummary.duration"), rx.duration, (v) => setRx((p) => ({ ...p, duration: v })), t("visitSummary.durationPlaceholder"), { flex: 1 })}
            </View>
            {field(t("visitSummary.frequency"), rx.frequency, (v) => setRx((p) => ({ ...p, frequency: v })), t("visitSummary.frequencyPlaceholder"))}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {FREQ_PRESETS.map((f) =>
                chip(f.short, rx.frequency === f.value, () => setRx((p) => ({ ...p, frequency: f.value })), f.short)
              )}
            </View>
            {field(t("visitSummary.instructions"), rx.instructions, (v) => setRx((p) => ({ ...p, instructions: v })), t("visitSummary.instructionsPlaceholder"))}
            <AddButton label={t("visitSummary.addMedicine")} onPress={addRx} disabled={!rx.name.trim()} />
          </Section>

          {/* 4. Labs */}
          <Section
            icon={FlaskConical}
            title={t("visitSummary.labHeading")}
            status={summaries.labs}
            count={labList.length}
            open={open.labs}
            onToggle={() => toggle("labs")}
          >
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              {t("visitSummary.commonTests", "Common tests — tap to add")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {COMMON_LABS.map((name) => chip(name, labList.some((l) => l.testName === name), () => toggleCommonLab(name)))}
            </View>
            {labList
              .map((l, i) => ({ l, i }))
              .filter(({ l }) => !COMMON_LABS.includes(l.testName) || l.instructions)
              .map(({ l, i }) =>
                addedRow(
                  FlaskConical,
                  l.testName,
                  l.instructions || "",
                  () => setLabList((prev) => prev.filter((_, j) => j !== i)),
                  `lab-${i}`
                )
              )}
            {field(t("visitSummary.testName"), lab.testName, (v) => setLab((p) => ({ ...p, testName: v })), t("visitSummary.testNamePlaceholder"))}
            {field(t("visitSummary.testNotes"), lab.instructions, (v) => setLab((p) => ({ ...p, instructions: v })), t("visitSummary.testNotesPlaceholder"))}
            <AddButton label={t("visitSummary.addTest")} onPress={addLab} disabled={!lab.testName.trim()} />
          </Section>

          {/* 5. Follow-up */}
          <Section
            icon={CalendarClock}
            title={t("visitSummary.followUpHeading")}
            status={summaries.followUp}
            open={open.followUp}
            onToggle={() => toggle("followUp")}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Text style={[typography.label.md, { color: colors.text, flex: 1 }]}>
                {t("visitSummary.scheduleFollowUp")}
              </Text>
              <Switch
                value={followUpEnabled}
                onValueChange={setFollowUpEnabled}
                trackColor={{ true: colors.primary, false: colors.fillStrong }}
                ios_backgroundColor={colors.fillStrong}
              />
            </View>
            {followUpEnabled ? (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {FOLLOW_UP_PRESETS.map((d) =>
                    chip(
                      d < 30
                        ? t("visitSummary.inWeeks", { count: d / 7, defaultValue: `${d / 7} wk` })
                        : t("visitSummary.inMonths", { count: d / 30, defaultValue: `${d / 30} mo` }),
                      followUpDate === isoPlusDays(d),
                      () => setFollowUpDate(isoPlusDays(d)),
                      `fu${d}`
                    )
                  )}
                </View>
                {field(t("doctorAvailability.date"), followUpDate, setFollowUpDate, t("doctorAvailability.datePlaceholder"))}
                {field(t("visitSummary.titleLabel"), followUpTitle, setFollowUpTitle, t("visitSummary.followUpTitlePlaceholder"))}
                {field(t("visitSummary.notes"), followUpNotes, setFollowUpNotes, t("visitSummary.followUpNotesPlaceholder"), { multiline: true })}
              </>
            ) : null}
          </Section>

          {/* Review & save */}
          <View
            style={{
              marginTop: spacing.sm,
              padding: spacing.lg,
              gap: spacing.md,
              borderRadius: radius.card,
              borderCurve: "continuous",
              backgroundColor: colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: hairline,
              ...(isDark ? {} : shadow.card),
            }}
          >
            <Text style={[typography.kicker, { color: colors.textSubtle, textTransform: "uppercase" }]}>
              {t("visitSummary.reviewHeading", "Will be saved")}
            </Text>
            {reviewItems.length ? (
              <View style={{ gap: 6 }}>
                {reviewItems.map((item) => (
                  <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.successSoft,
                      }}
                    >
                      <Check size={11} color={colors.success} strokeWidth={3} />
                    </View>
                    <Text numberOfLines={1} style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {t("visitSummary.reviewEmpty", "Add a diagnosis, notes, medicines or tests to save this visit.")}
              </Text>
            )}

            {appointmentId ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingTop: spacing.md,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.separator,
                }}
              >
                <CalendarCheck size={18} color={colors.primary} strokeWidth={2.2} />
                <Text style={[typography.label.md, { color: colors.text, flex: 1 }]}>
                  {t("visitSummary.markAppointment")}
                </Text>
                <Switch
                  value={markCompleted}
                  onValueChange={setMarkCompleted}
                  trackColor={{ true: colors.primary, false: colors.fillStrong }}
                  ios_backgroundColor={colors.fillStrong}
                />
              </View>
            ) : null}

            <Button
              title={t("visitSummary.saveAction")}
              icon={Sparkles}
              size="lg"
              loading={isPending}
              disabled={reviewItems.length === 0}
              onPress={submit}
            />
          </View>
        </ScrollView>
      </>
    </Screen>
  );
}

/** Collapsible form section with a live one-line status. */
function Section({
  icon: Icon,
  title,
  status,
  count,
  open,
  onToggle,
  flush,
  children,
}: {
  icon: any;
  title: string;
  status: { text: string; done: boolean };
  count?: number;
  open: boolean;
  onToggle: () => void;
  /** Children manage their own horizontal padding. */
  flush?: boolean;
  children: any;
}) {
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  return (
    <View
      style={{
        borderRadius: radius.card,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.hairline,
        overflow: "hidden",
        ...(isDark ? {} : shadow.card),
      }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.fill : "transparent",
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: status.done ? colors.primary : colors.primarySoft,
          }}
        >
          {status.done ? (
            <Check size={17} color={colors.onPrimary} strokeWidth={2.8} />
          ) : (
            <Icon size={17} color={colors.primary} strokeWidth={2.3} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}>
              {title}
            </Text>
            {count ? (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 6,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primarySoft,
                }}
              >
                <Text style={[typography.label.xs, { color: colors.primary }]}>{count}</Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={[typography.caption, { color: status.done ? colors.textMuted : colors.textSubtle, marginTop: 1 }]}
          >
            {status.text}
          </Text>
        </View>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.well,
            transform: [{ rotate: open ? "180deg" : "0deg" }],
          }}
        >
          <ChevronDown size={15} color={colors.textMuted} strokeWidth={2.5} />
        </View>
      </Pressable>
      {open ? (
        flush ? (
          <View>{children}</View>
        ) : (
          <View
            style={{
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.md,
              paddingTop: spacing.sm,
              gap: spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.separator,
            }}
          >
            {children}
          </View>
        )
      ) : null}
    </View>
  );
}

function AddButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 42,
        borderRadius: 14,
        borderCurve: "continuous",
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: disabled ? colors.separator : withOpacity(colors.primary, 0.5),
        backgroundColor: pressed ? colors.primarySoft : "transparent",
      })}
    >
      <Plus size={15} color={disabled ? colors.textSubtle : colors.primary} strokeWidth={2.6} />
      <Text style={[typography.label.md, { color: disabled ? colors.textSubtle : colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

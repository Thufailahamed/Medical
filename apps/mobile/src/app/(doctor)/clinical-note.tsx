// @ts-nocheck

import { useState } from "react";
import { View, Text, Pressable, TextInput as RNTextInput, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Check, Stethoscope, AlignLeft, LayoutList } from "lucide-react-native";
import { useCreateClinicalNote, usePatientSummary } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, ScreenHeader, Avatar, Button, useToast } from "@/components/ui";

type Mode = "soap" | "free";
type SoapKey = "subjective" | "objective" | "plan";

const TITLE_PRESETS = [
  { key: "initial", fallback: "Initial assessment" },
  { key: "followUp", fallback: "Follow-up visit" },
  { key: "review", fallback: "Results review" },
  { key: "procedure", fallback: "Procedure note" },
];

export default function ClinicalNoteScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme, fontFamily } = useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.hairline;
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const toast = useToast();
  const { data: patientData } = usePatientSummary(patientId || null);
  const patientName = patientData?.user?.name;

  const [title, setTitle] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [mode, setMode] = useState<Mode>("soap");
  const [soap, setSoap] = useState<Record<SoapKey, string>>({ subjective: "", objective: "", plan: "" });
  const [freeNotes, setFreeNotes] = useState("");

  const createNote = useCreateClinicalNote();

  const SOAP_SECTIONS: { key: SoapKey; letter: string; label: string; hint: string }[] = [
    {
      key: "subjective",
      letter: "S",
      label: t("clinicalNote.soap.subjective", "Subjective"),
      hint: t("clinicalNote.soap.subjectiveHint", "Complaint, history, symptoms in the patient's words"),
    },
    {
      key: "objective",
      letter: "O",
      label: t("clinicalNote.soap.objective", "Objective"),
      hint: t("clinicalNote.soap.objectiveHint", "Exam findings, vitals, test results"),
    },
    {
      key: "plan",
      letter: "P",
      label: t("clinicalNote.soap.plan", "Plan"),
      hint: t("clinicalNote.soap.planHint", "Treatment, advice, referrals, follow-up"),
    },
  ];

  // SOAP sections are stored in the existing free-text `notes` field.
  const composedNotes =
    mode === "free"
      ? freeNotes.trim()
      : SOAP_SECTIONS.filter((s) => soap[s.key].trim())
          .map((s) => `${s.label}:\n${soap[s.key].trim()}`)
          .join("\n\n");

  const canSave = !!title.trim() && !!composedNotes && !createNote.isPending;
  const dirty =
    !!title.trim() || !!diagnosis.trim() || !!freeNotes.trim() || Object.values(soap).some((v) => v.trim());

  function switchMode(next: Mode) {
    if (next === mode) return;
    // Carry text across so switching never loses work.
    if (next === "free" && !freeNotes.trim()) setFreeNotes(composedNotes);
    if (next === "soap" && !Object.values(soap).some((v) => v.trim()) && freeNotes.trim()) {
      setSoap({ subjective: freeNotes.trim(), objective: "", plan: "" });
    }
    setMode(next);
  }

  function goBack() {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(
      t("clinicalNote.discardTitle", "Discard this note?"),
      t("clinicalNote.discardBody", "What you've written will be lost."),
      [
        { text: t("rxTemplates.keepEditing", "Keep editing"), style: "cancel" },
        { text: t("rxTemplates.discard", "Discard"), style: "destructive", onPress: () => router.back() },
      ]
    );
  }

  async function save() {
    if (!patientId || !title.trim() || !composedNotes) {
      toast.show(t("clinicalNote.requiredError"), "warning");
      return;
    }
    try {
      await createNote.mutateAsync({
        patientId,
        title: title.trim(),
        diagnosis: diagnosis.trim() || undefined,
        notes: composedNotes,
      });
      toast.show(t("clinicalNote.savedToast"), "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("clinicalNote.saveError"), "danger");
    }
  }

  if (!patientId) {
    return (
      <Screen padded>
        <ScreenHeader title={t("clinicalNote.title")} back onBack={() => router.back()} />
      </Screen>
    );
  }

  const cardStyle = {
    borderRadius: radius.card,
    borderCurve: "continuous" as const,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    overflow: "hidden" as const,
    ...(isDark ? {} : shadow.card),
  };

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={goBack}
        title={t("clinicalNote.title")}
        subtitle={t("clinicalNote.subtitle")}
        right={
          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            style={({ pressed }) => ({
              height: 38,
              paddingHorizontal: 16,
              borderRadius: 19,
              borderCurve: "continuous",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: canSave || createNote.isPending ? colors.primary : colors.fill,
              opacity: pressed ? 0.85 : 1,
              ...(canSave && !isDark ? shadow.primary : {}),
            })}
          >
            {createNote.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <Check size={15} color={canSave ? colors.onPrimary : colors.textSubtle} strokeWidth={2.6} />
                <Text style={[typography.label.md, { color: canSave ? colors.onPrimary : colors.textSubtle }]}>
                  {t("common.save")}
                </Text>
              </>
            )}
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xxl, gap: spacing.lg }}>
        {/* Patient context */}
        {patientName ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 2 }}>
            <Avatar
              name={patientName}
              size="sm"
              tone="primary"
              source={patientData?.user?.photo ? { uri: patientData.user.photo } : undefined}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {t("clinicalNote.forPatient", "Note for")}{" "}
              <Text style={[typography.label.md, { color: colors.text }]}>{patientName}</Text>
            </Text>
          </View>
        ) : null}

        {/* Title + diagnosis */}
        <View style={cardStyle}>
          <FieldRow label={t("clinicalNote.titleLabel")} required>
            <RNTextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t("clinicalNote.titlePlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={inputStyle(colors, fontFamily, { fontSize: 17, fontFamily: fontFamily.bodySemibold })}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {TITLE_PRESETS.map((p) => {
                const label = t(`clinicalNote.titlePresets.${p.key}`, p.fallback);
                const active = title.trim() === label;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => setTitle(label)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => ({
                      height: 28,
                      paddingHorizontal: 11,
                      justifyContent: "center",
                      borderRadius: 14,
                      borderCurve: "continuous",
                      backgroundColor: active ? colors.primary : pressed ? colors.primarySoft : colors.fill,
                    })}
                  >
                    <Text style={[typography.label.sm, { color: active ? colors.onPrimary : colors.textMuted }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FieldRow>
          <FieldRow label={t("clinicalNote.diagnosisLabel")} icon={Stethoscope} last>
            <RNTextInput
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder={t("clinicalNote.diagnosisPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              multiline
              style={inputStyle(colors, fontFamily)}
            />
          </FieldRow>
        </View>

        {/* Notes */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 }}>
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {t("clinicalNote.notesLabel")}
              <Text style={{ color: colors.danger }}> *</Text>
            </Text>
            <View
              style={{
                flexDirection: "row",
                padding: 3,
                borderRadius: 999,
                backgroundColor: colors.fill,
              }}
            >
              {([
                { key: "soap", icon: LayoutList, label: t("clinicalNote.modeSoap", "SOAP") },
                { key: "free", icon: AlignLeft, label: t("clinicalNote.modeFree", "Free text") },
              ] as const).map((m) => {
                const active = mode === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => switchMode(m.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      height: 28,
                      paddingHorizontal: 11,
                      borderRadius: 999,
                      backgroundColor: active ? colors.surface : "transparent",
                      ...(active && !isDark ? shadow.xs : {}),
                    }}
                  >
                    <m.icon size={13} color={active ? colors.text : colors.textMuted} strokeWidth={2.4} />
                    <Text style={[typography.label.sm, { color: active ? colors.text : colors.textMuted }]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={cardStyle}>
            {mode === "soap" ? (
              SOAP_SECTIONS.map((s, idx) => (
                <View
                  key={s.key}
                  style={{
                    flexDirection: "row",
                    gap: spacing.md,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
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
                      backgroundColor: soap[s.key].trim() ? colors.primary : colors.primarySoft,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fontFamily.heavy,
                        fontSize: 13,
                        color: soap[s.key].trim() ? colors.onPrimary : colors.primary,
                      }}
                    >
                      {s.letter}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.label.md, { color: colors.text }]}>{s.label}</Text>
                    <RNTextInput
                      value={soap[s.key]}
                      onChangeText={(v) => setSoap((prev) => ({ ...prev, [s.key]: v }))}
                      placeholder={s.hint}
                      placeholderTextColor={colors.textSubtle}
                      multiline
                      accessibilityLabel={s.label}
                      style={inputStyle(colors, fontFamily, { minHeight: 56 })}
                    />
                  </View>
                </View>
              ))
            ) : (
              <View style={{ padding: spacing.lg }}>
                <RNTextInput
                  value={freeNotes}
                  onChangeText={setFreeNotes}
                  placeholder={t("clinicalNote.notesPlaceholder")}
                  placeholderTextColor={colors.textSubtle}
                  multiline
                  accessibilityLabel={t("clinicalNote.notesLabel")}
                  style={inputStyle(colors, fontFamily, { minHeight: 200 })}
                />
              </View>
            )}
          </View>
          <Text style={[typography.caption, { color: colors.textSubtle, paddingHorizontal: 4 }]}>
            {mode === "soap"
              ? t("clinicalNote.soapHint", "Fill any sections that apply — empty ones are left out.")
              : t("clinicalNote.freeHint", "Write the note in your own format.")}
          </Text>
        </View>

        <Button
          title={t("clinicalNote.saveAction")}
          onPress={save}
          loading={createNote.isPending}
          disabled={!canSave}
          icon={Check}
          size="lg"
        />
      </View>
    </Screen>
  );
}

function inputStyle(colors: any, fontFamily: any, extra: any = {}) {
  return {
    paddingVertical: 6,
    paddingHorizontal: 0,
    fontSize: 15.5,
    lineHeight: 22,
    color: colors.text,
    fontFamily: fontFamily.body,
    textAlignVertical: "top" as const,
    ...extra,
  };
}

function FieldRow({
  label,
  icon: Icon,
  required,
  last,
  children,
}: {
  label: string;
  icon?: any;
  required?: boolean;
  last?: boolean;
  children: any;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.separator,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {Icon ? <Icon size={12} color={colors.textSubtle} strokeWidth={2.3} /> : null}
        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      </View>
      {children}
    </View>
  );
}

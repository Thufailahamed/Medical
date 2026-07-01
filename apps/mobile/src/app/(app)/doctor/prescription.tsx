// @ts-nocheck

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Search,
  Save,
  FileText,
  Stethoscope,
  Pill as PillIcon,
  ChevronRight,
  Users,
  X,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react-native";
import {
  useSearchPatients,
  useCreatePrescription,
  useMedicineSearch,
  useSafetyCheck,
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
  BottomSheet,
  useToast,
} from "@/components/ui";
import type { DrugWarning, SafetyCheckCandidate } from "@/hooks/useApi";

const PRESET_MEDS = [
  "Amoxicillin",
  "Paracetamol",
  "Ibuprofen",
  "Metformin",
  "Amlodipine",
  "Atorvastatin",
  "Omeprazole",
  "Salbutamol",
];

const COMMON_DOSAGES = ["250mg", "500mg", "1g", "5mg", "10mg", "20mg"];

export default function PrescriptionScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();

  const createPrescription = useCreatePrescription();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 350);
  const { data: searchResults } = useSearchPatients(debouncedQuery);

  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("");
  // Phase E-Rx 1: optional FK to the master catalogue. Set when the
  // doctor picks a suggestion; remains NULL for free-text entries.
  const [medMasterId, setMedMasterId] = useState<string | null>(null);

  // Debounced master search — only fires when there are 2+ chars.
  // Re-runs only when medName changes, not when the suggestion
  // picker sets it (we don't want to refetch after a tap).
  const [medQuery, setMedQuery] = useState("");
  const debouncedMedQuery = useDebounce(medQuery, 250);
  const { data: medResults } = useMedicineSearch(debouncedMedQuery);

  // Phase E-Rx 3: safety pre-flight. Fires once a patient is picked AND
  // a medicine name is typed. Calling `useSafetyCheck` returns either
  // the live warning set (when blocking) or `undefined` when the form
  // is incomplete. The override modal collects a free-text reason
  // before re-submitting with `X-Confirm-Warning: true`.
  const patientIdForCheck =
    selectedPatient?.patients?.id || selectedPatient?.id || patientId;
  const safetyEnabled = !!patientIdForCheck && !!medName.trim();
  const safetyPayload = safetyEnabled
    ? {
        patientId: patientIdForCheck,
        candidate: [
          {
            name: medName.trim(),
            dosage: medDosage.trim() || undefined,
            masterMedicineId: medMasterId || undefined,
          },
        ] as SafetyCheckCandidate[],
      }
    : null;
  const { data: safetyResult } = useSafetyCheck(
    safetyEnabled ? safetyPayload : null,
    safetyEnabled
  );
  const safetyWarnings: DrugWarning[] = safetyResult?.warnings || [];
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const FREQUENCIES = [
    { value: "Once daily", label: t("doctorPrescription.freqOnce") },
    { value: "Twice daily", label: t("doctorPrescription.freqTwice") },
    { value: "Three times daily", label: t("doctorPrescription.freqThree") },
  ];

  // Phase E-Rx 3: single entrypoint that handles validation, the
  // safety override modal, the POST, and error handling. `force` is
  // set to true when the doctor has acknowledged warnings and tapped
  // "Override and create" inside the bottom sheet.
  async function handleCreate(force = false) {
    const patient =
      selectedPatient ||
      searchResults?.patients?.find?.((p: any) => (p.patients?.id || p.id) === patientId);
    if (!patient || !medName || !medDosage) {
      toast.show(t("doctorPrescription.medicineRequired"), "warning");
      return;
    }

    // Block on severe/critical unless `force` is set. Mirrors the
    // server-side 409 contract — modal collects a reason that goes
    // into the audit log via the route handler.
    const top = safetyResult?.severity || null;
    const blocking = top === "severe" || top === "critical";
    if (blocking && !force) {
      setOverrideOpen(true);
      return;
    }

    try {
      await createPrescription.mutateAsync(
        {
          patientId: patient.patients?.id || patient.id || patientId,
          diagnosis,
          notes,
          medicines: [
            {
              name: medName,
              dosage: medDosage,
              frequency: medFrequency,
              // Phase E-Rx 1: link to the master catalogue when picked.
              masterMedicineId: medMasterId ?? null,
            },
          ],
        },
        {
          // Send the override header when the doctor explicitly
          // acknowledged a blocking warning.
          headers: force ? { "X-Confirm-Warning": "true" } : undefined,
        }
      );
      toast.show(t("doctorPrescription.savedToast"), "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("doctorPrescription.saveError"), "danger");
    }
  }

  function pickMasterMedicine(m: {
    id: string;
    genericName: string;
    brandName?: string | null;
    strength?: string | null;
  }) {
    // Display: prefer "Brand Generic Strength" when brand present,
    // fall back to "Generic Strength". Store the generic name in
    // medName so the `medicines.name` column stays clean + matches
    // other system matches (interaction check, adherence view).
    const left = m.brandName ? `${m.brandName} (${m.genericName})` : m.genericName;
    setMedName(m.strength ? `${left} ${m.strength}` : left);
    setMedMasterId(m.id);
    setMedQuery(""); // collapse the suggestion list
  }

  if (selectedPatient) {
    return (
      // Fragment wraps Screen + the override BottomSheet so the return
      // has a single JSX root. The override sheet is sibling to the
      // form so the doctor can keep the keyboard visible behind it.
      <>
      <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => setSelectedPatient(null)}
          title={t("doctorPrescription.newTitle")}
          right={<PillCmp label={t("doctorPrescription.draft")} tone="warning" size="sm" />}
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
            name={selectedPatient.name || selectedPatient.users?.name}
            size="lg"
            tone="primary"
            ring
            source={
              selectedPatient.photo
                ? { uri: selectedPatient.photo }
                : selectedPatient.users?.photo
                ? { uri: selectedPatient.users.photo }
                : undefined
            }
          />
          <View style={{ flex: 1 }}>
            <Text style={[typography.title.md, { color: colors.text }]}>
              {selectedPatient.name || selectedPatient.users?.name || t("doctorPrescription.patientFallback")}
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, marginTop: 2 },
              ]}
            >
              {selectedPatient.phone || selectedPatient.users?.phone || t("doctorPrescription.noPhone")}
            </Text>
          </View>
          <PillCmp
            icon={X}
            label={t("doctorPrescription.changePill")}
            tone="neutral"
            size="sm"
          />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          <Card padded={false}>
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.sm,
              }}
            >
              <Text style={[typography.label.lg, { color: colors.textMuted }]}>
                {t("doctorPrescription.assessment")}
              </Text>
            </View>
            <View style={{ padding: spacing.lg, gap: spacing.lg }}>
              <FormField label={t("doctorPrescription.diagnosis")}>
                <TextInput
                  value={diagnosis}
                  onChangeText={setDiagnosis}
                  placeholder={t("doctorPrescription.diagnosisPlaceholder")}
                  leadingIcon={Stethoscope}
                  multiline
                  numberOfLines={2}
                />
              </FormField>

              <FormField label={t("doctorPrescription.medicine")} required>
                <TextInput
                  value={medName}
                  onChangeText={(v) => {
                    setMedName(v);
                    // Only refetch when the user is typing freely —
                    // when a suggestion was just picked, we clear
                    // `medQuery` so we don't refetch on the same name.
                    setMedQuery(v);
                    setMedMasterId(null);
                  }}
                  placeholder={t("doctorPrescription.medicinePlaceholder")}
                  leadingIcon={PillIcon}
                />
              </FormField>

              {/* Phase E-Rx 1: master catalogue autocomplete. Shows when
                  the user has typed 2+ chars and the debounced query
                  returns results. Tap to fill `medName` + link the
                  master FK; the prescription POST carries both. */}
              {medResults?.medicines && medResults.medicines.length > 0 && medQuery.length >= 2 && !medMasterId ? (
                <View
                  style={{
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: spacing.xs,
                  }}
                >
                  {medResults.medicines.slice(0, 5).map((m: any, idx: number) => (
                    <View
                      key={m.id}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderBottomWidth:
                          idx === Math.min(4, medResults.medicines.length - 1) ? 0 : 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <ListItem
                        title={m.brandName ? `${m.brandName} (${m.genericName})` : m.genericName}
                        subtitle={[m.strength, m.scheduleClass].filter(Boolean).join(" • ") || undefined}
                        iconTone="primary"
                        mediaSlot={
                          <Avatar
                            name={m.genericName}
                            size="sm"
                            tone="soft"
                          />
                        }
                        onPress={() => pickMasterMedicine(m)}
                      />
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Active master-link badge so the doctor can see the
                  prescription is anchored to the catalogue. */}
              {medMasterId ? (
                <PillCmp
                  icon={PillIcon}
                  label={`Master linked ${medResults?.medicines?.find?.((x: any) => x.id === medMasterId)?.genericName ?? ""}`.trim()}
                  tone="success"
                  size="sm"
                />
              ) : null}

              <View style={{ gap: spacing.xs }}>
                <Text style={[typography.label.md, { color: colors.textMuted }]}>
                  {t("doctorPrescription.quickPick")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {PRESET_MEDS.map((m) => (
                    <PillCmp
                      key={m}
                      label={m}
                      tone={medName === m ? "primary" : "neutral"}
                      size="sm"
                      onPress={() => setMedName(m)}
                    />
                  ))}
                </View>
              </View>

              <FormField label={t("doctorPrescription.dosage")} required>
                <TextInput
                  value={medDosage}
                  onChangeText={setMedDosage}
                  placeholder={t("doctorPrescription.dosagePlaceholder")}
                />
              </FormField>

              <View style={{ gap: spacing.xs }}>
                <Text style={[typography.label.md, { color: colors.textMuted }]}>
                  {t("doctorPrescription.commonDosages")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {COMMON_DOSAGES.map((d) => (
                    <PillCmp
                      key={d}
                      label={d}
                      tone={medDosage === d ? "accent" : "neutral"}
                      size="sm"
                      onPress={() => setMedDosage(d)}
                    />
                  ))}
                </View>
              </View>

              <FormField label={t("doctorPrescription.frequency")}>
                <ChipGroup
                  options={FREQUENCIES}
                  value={medFrequency}
                  onChange={setMedFrequency}
                />
              </FormField>

              <FormField label={t("doctorPrescription.notes")}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t("doctorPrescription.notesPlaceholder")}
                  leadingIcon={FileText}
                  multiline
                  numberOfLines={3}
                  tone="soft"
                />
              </FormField>
            </View>
          </Card>

          {safetyResult ? (
            <SafetyCard
              warnings={safetyWarnings}
              severity={safetyResult.severity || null}
            />
          ) : null}

          <Button
            title={
              safetyResult?.severity === "severe" ||
              safetyResult?.severity === "critical"
                ? t("doctorPrescription.safetyOverrideRequired")
                : t("doctorPrescription.createPrescription")
            }
            onPress={() => handleCreate(false)}
            loading={createPrescription.isPending}
            icon={Save}
            size="lg"
          />
        </View>
      </Screen>

        <BottomSheet
          visible={overrideOpen}
          onDismiss={() => setOverrideOpen(false)}
          title={t("doctorPrescription.safetyOverrideTitle")}
        >
          <SafetyOverrideForm
            warnings={safetyWarnings}
            severity={safetyResult?.severity || null}
            reason={overrideReason}
            setReason={setOverrideReason}
            onConfirm={() => {
              setOverrideOpen(false);
              handleCreate(true);
            }}
            onCancel={() => setOverrideOpen(false)}
          />
        </BottomSheet>
      </>
    );
  }

  const results: any[] = searchResults?.patients || [];

  return (
    <Screen scroll padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorPrescription.title")}
        subtitle={t("doctorPrescription.subtitle")}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.title.sm, { color: colors.text }]}>
            {t("doctorPrescription.searchPatients")}
          </Text>
          <TextInput
            placeholder={t("doctorPrescription.searchPlaceholder")}
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
                title={p.name || t("doctorPrescription.patientFallback")}
                subtitle={p.phone || t("doctorPrescription.tapToPrescribe")}
                mediaSlot={
                  <Avatar
                    name={p.name}
                    size="md"
                    tone="primary"
                    source={p.photo ? { uri: p.photo } : undefined}
                  />
                }
                pill={{ label: t("doctorPrescription.pillPrescribe"), tone: "primary" }}
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
                    <ChevronRight size={18} color={colors.onPrimary} strokeWidth={2.5} />
                  </View>
                }
                onPress={() => setSelectedPatient(p)}
              />
            ))}
          </View>
        ) : searchQuery.length > 0 ? (
          <EmptyState
            icon={Search}
            title={t("doctorPrescription.emptySearchTitle")}
            message={t("doctorPrescription.emptySearchBody")}
            tone="neutral"
          />
        ) : (
          <EmptyState
            icon={Users}
            title={t("doctorPrescription.emptyInitialTitle")}
            message={t("doctorPrescription.emptyInitialBody")}
            tone="neutral"
          />
        )}
      </View>
    </Screen>
  );
}

// Phase E-Rx 3: safety warning card rendered between the form and the
// submit button. Severity ladder maps to tone — `critical` / `severe`
// use `danger`, `moderate` uses `warning`, `minor` uses `neutral`.
function SafetyCard({
  warnings,
  severity,
}: {
  warnings: DrugWarning[];
  severity: string | null;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  if (!warnings.length) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.successSoft,
        }}
      >
        <ShieldCheck size={18} color={colors.success} strokeWidth={2.25} />
        <Text style={[typography.body.sm, { color: colors.success, fontWeight: "600" }]}>
          {t("doctorPrescription.safetyEmpty")}
        </Text>
      </View>
    );
  }
  const tone =
    severity === "critical" || severity === "severe"
      ? "danger"
      : severity === "moderate"
      ? "warning"
      : "neutral";
  const bg =
    tone === "danger" ? colors.dangerSoft : tone === "warning" ? colors.warningSoft : colors.surface;
  const fg =
    tone === "danger" ? colors.danger : tone === "warning" ? colors.warning : colors.text;
  return (
    <View
      style={{
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.sm,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: tone === "danger" ? colors.danger : colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {tone === "danger" ? (
          <ShieldAlert size={18} color={fg} strokeWidth={2.25} />
        ) : (
          <AlertTriangle size={18} color={fg} strokeWidth={2.25} />
        )}
        <Text style={[typography.title.sm, { color: fg }]}>
          {t("doctorPrescription.safetyTitle")}
        </Text>
        {severity ? (
          <PillCmp
            label={t(`doctorPrescription.safetySeverity_${severity}`)}
            tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "neutral"}
            size="sm"
          />
        ) : null}
      </View>
      {warnings.map((w, i) => (
        <View
          key={`${w.type}-${i}`}
          style={{
            padding: spacing.sm,
            borderRadius: radius.sm,
            backgroundColor: colors.bgElevated,
            gap: 4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <PillCmp
              label={t(`doctorPrescription.safetyType_${w.type}`)}
              tone={tone === "danger" ? "danger" : "warning"}
              size="sm"
            />
            {w.medicines?.length ? (
              <Text style={[typography.body.xs, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
                {w.medicines.join(" + ")}
              </Text>
            ) : null}
          </View>
          <Text style={[typography.body.sm, { color: colors.text }]}>{w.message}</Text>
          <Text
            style={[typography.body.xs, { color: colors.textMuted, fontStyle: "italic" }]}
          >
            {t("doctorPrescription.safetyRecommendation")}: {w.recommendation}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SafetyOverrideForm({
  warnings,
  severity,
  reason,
  setReason,
  onConfirm,
  onCancel,
}: {
  warnings: DrugWarning[];
  severity: string | null;
  reason: string;
  setReason: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.body.sm, { color: colors.text }]}>
        {t("doctorPrescription.safetyOverrideBody", {
          severity: severity ? t(`doctorPrescription.safetySeverity_${severity}`) : "",
        })}
      </Text>
      <View style={{ gap: spacing.xs }}>
        {warnings.slice(0, 3).map((w, i) => (
          <View
            key={`${w.type}-${i}`}
            style={{
              padding: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: colors.warningSoft,
            }}
          >
            <Text
              style={[typography.body.xs, { color: colors.text, fontWeight: "600" }]}
            >
              {t(`doctorPrescription.safetyType_${w.type}`)}
            </Text>
            <Text style={[typography.body.xs, { color: colors.textMuted }]}>
              {w.message}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder={t("doctorPrescription.safetyOverridePlaceholder")}
        multiline
        numberOfLines={3}
        tone="soft"
      />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button
          title={t("doctorPrescription.safetyOverrideCancel")}
          onPress={onCancel}
          variant="ghost"
          style={{ flex: 1 }}
        />
        <Button
          title={t("doctorPrescription.safetyOverrideConfirm")}
          onPress={onConfirm}
          variant="primary"
          icon={ShieldCheck}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

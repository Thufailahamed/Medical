// @ts-nocheck

import { useState } from "react";
import { View, Text } from "react-native";
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
} from "lucide-react-native";
import {
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
  useToast,
} from "@/components/ui";

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

  const FREQUENCIES = [
    { value: "Once daily", label: t("doctorPrescription.freqOnce") },
    { value: "Twice daily", label: t("doctorPrescription.freqTwice") },
    { value: "Three times daily", label: t("doctorPrescription.freqThree") },
  ];

  async function handleCreate() {
    const patient =
      selectedPatient ||
      searchResults?.patients?.find?.((p: any) => (p.patients?.id || p.id) === patientId);
    if (!patient || !medName || !medDosage) {
      toast.show(t("doctorPrescription.medicineRequired"), "warning");
      return;
    }
    try {
      await createPrescription.mutateAsync({
        patientId: patient.patients?.id || patient.id || patientId,
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
      toast.show(t("doctorPrescription.savedToast"), "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("doctorPrescription.saveError"), "danger");
    }
  }

  if (selectedPatient) {
    return (
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
                  onChangeText={setMedName}
                  placeholder={t("doctorPrescription.medicinePlaceholder")}
                  leadingIcon={PillIcon}
                />
              </FormField>

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

          <Button
            title={t("doctorPrescription.createPrescription")}
            onPress={handleCreate}
            loading={createPrescription.isPending}
            icon={Save}
            size="lg"
          />
        </View>
      </Screen>
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

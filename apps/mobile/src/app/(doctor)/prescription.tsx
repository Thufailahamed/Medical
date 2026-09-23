// @ts-nocheck
import { useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { View, Text, ScrollView, Pressable, TextInput as RNTextInput } from "react-native";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
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
  Plus,
  Trash2,
  Layers,
  FilePenLine,
  Phone,
  Sparkles,
  UserRound,
} from "lucide-react-native";
import {
  useSearchPatients,
  useConsentsIssued,
  usePatientOverview,
  useCreatePrescription,
  useMedicineSearch,
  useSafetyCheck,
  useDoctorRxTemplates,
  useRecordRxTemplateUse,
  useRecentDoctorPatients,
  type MedicineEntry as TemplateMedicine,
} from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
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

const AVATAR_PALETTES = [
  { bg: "#EFF6FF", fg: "#2563EB", border: "#BFDBFE" }, // Sapphire
  { bg: "#ECFDF5", fg: "#059669", border: "#A7F3D0" }, // Emerald
  { bg: "#F5F3FF", fg: "#7C3AED", border: "#DDD6FE" }, // Violet
  { bg: "#FFF7ED", fg: "#EA580C", border: "#FED7AA" }, // Amber / Coral
  { bg: "#ECFEFF", fg: "#0891B2", border: "#A5F3FC" }, // Cyan
  { bg: "#FDF2F8", fg: "#DB2777", border: "#FBCFE8" }, // Rose
];

function getAvatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTES.length;
  }
  return AVATAR_PALETTES[hash];
}

function getInitials(name: string): string {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Medicine entry shape ───────────────────────────────────
// One MedicineEntry per line on the prescription. The local id
// (`key`) is for React lists only — never sent to the server.
// The `slots` object captures which time-of-day checkboxes are
// selected; `frequency` is derived from slot count.
type Slots = {
  morning: boolean;
  noon: boolean;
  evening: boolean;
  night: boolean;
};

type MedicineEntry = {
  key: string;
  name: string;
  dosage: string;
  slots: Slots;
  timing: "" | "Before food" | "After food" | "With food" | "Any time";
  durationDays: number;
  ongoing: boolean;
  masterMedicineId: string | null;
};

function emptyEntry(): MedicineEntry {
  return {
    key: Math.random().toString(36).slice(2, 10),
    name: "",
    dosage: "",
    slots: { morning: false, noon: false, evening: false, night: false },
    timing: "",
    durationDays: 7,
    ongoing: false,
    masterMedicineId: null,
  };
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function slotsToFrequency(s: Slots): string | null {
  const n = (s.morning ? 1 : 0) + (s.noon ? 1 : 0) + (s.evening ? 1 : 0) + (s.night ? 1 : 0);
  if (n === 0) return null;
  if (n === 1) return "Once daily";
  if (n === 2) return "Twice daily";
  if (n === 3) return "Three times daily";
  return "Four times daily";
}

export default function PrescriptionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { spacing, colors, typography, radius, fontFamily } = useTheme();
  const { t } = useTranslation();

  const toast = useToast();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();

  const createPrescription = useCreatePrescription();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 200);
  const { data: searchResults } = useSearchPatients(debouncedQuery);
  const { data: consentsData } = useConsentsIssued();
  const { data: recentPatientsData } = useRecentDoctorPatients(15);
  const { data: patientOverview } = usePatientOverview(patientId || null);

  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  // Dynamically hide bottom tab bar when actively writing a prescription
  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarStyle: selectedPatient ? { display: "none" } : undefined,
    });
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: selectedPatient ? { display: "none" } : undefined,
      });
    }
    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
      if (parent) parent.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation, selectedPatient]);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  // Phase 4: medicines are an array, not a single entry. The form
  // starts with one empty entry so the doctor has somewhere to type;
  // tapping "+ Add medicine" appends another.
  const [medicines, setMedicines] = useState<MedicineEntry[]>([emptyEntry()]);

  // Auto-select navigated patient when patientOverview resolves
  useEffect(() => {
    if (patientOverview) {
      setSelectedPatient({
        patient: patientOverview.patient,
        user: patientOverview.user,
      });
    }
  }, [patientOverview]);

  // Load draft on mount (skip if writing for a specific navigated patient)
  useEffect(() => {
    async function loadDraft() {
      if (patientId) return;
      try {
        const draftJson = await SecureStore.getItemAsync("prescription_draft");
        if (draftJson) {
          const draft = JSON.parse(draftJson);
          if (draft.selectedPatient) setSelectedPatient(draft.selectedPatient);
          if (draft.diagnosis) setDiagnosis(draft.diagnosis);
          if (draft.notes) setNotes(draft.notes);
          if (draft.medicines) setMedicines(draft.medicines);
        }
      } catch (err) {
        console.warn("[prescription] Failed to load draft:", err);
      }
    }
    loadDraft();
  }, [patientId]);

  // Save draft on form changes
  useEffect(() => {
    async function saveDraft() {
      try {
        const hasContent =
          selectedPatient ||
          diagnosis.trim() ||
          notes.trim() ||
          medicines.some((m) => m.name.trim() || m.dosage.trim());

        if (hasContent) {
          const draft = {
            selectedPatient,
            diagnosis,
            notes,
            medicines,
          };
          await SecureStore.setItemAsync("prescription_draft", JSON.stringify(draft));
        } else {
          await SecureStore.deleteItemAsync("prescription_draft");
        }
      } catch (err) {
        console.warn("[prescription] Failed to save draft:", err);
      }
    }
    saveDraft();
  }, [selectedPatient, diagnosis, notes, medicines]);

  // Phase 4.2: saved prescription templates. Tapping a chip fills the
  // medicine list (and diagnosis if empty) from the saved entry shape.
  const { data: templateData } = useDoctorRxTemplates();
  const recordTemplateUse = useRecordRxTemplateUse();
  const templates = templateData?.templates || [];

  function applyTemplate(tpl: { id: string; medicines: TemplateMedicine[]; diagnosis: string | null }) {
    if (!tpl.medicines?.length) return;
    const converted: MedicineEntry[] = tpl.medicines.map((m) => ({
      key: Math.random().toString(36).slice(2, 10),
      name: m.name || "",
      dosage: m.dosage || "",
      slots: frequencyToSlots(m.frequency),
      timing: "" as const,
      durationDays: parseDurationDays(m.duration) || 7,
      ongoing: false,
      masterMedicineId: null,
    }));
    setMedicines(converted);
    if (!diagnosis && tpl.diagnosis) setDiagnosis(tpl.diagnosis);
    recordTemplateUse.mutate(tpl.id);
  }

  function frequencyToSlots(freq?: string | null): Slots {
    const f = (freq || "").toLowerCase();
    if (f.includes("once") || f.includes("1")) return { morning: true, noon: false, evening: false, night: false };
    if (f.includes("twice") || f.includes("2")) return { morning: true, noon: false, evening: true, night: false };
    if (f.includes("three") || f.includes("3")) return { morning: true, noon: true, evening: true, night: false };
    if (f.includes("four") || f.includes("4")) return { morning: true, noon: true, evening: true, night: true };
    return { morning: true, noon: false, evening: false, night: false };
  }

  function parseDurationDays(d?: string | null): number {
    if (!d) return 0;
    const m = String(d).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function updateEntry(key: string, patch: Partial<MedicineEntry>) {
    setMedicines((prev) =>
      prev.map((m) => (m.key === key ? { ...m, ...patch } : m))
    );
  }

  function removeEntry(key: string) {
    setMedicines((prev) =>
      prev.length > 1 ? prev.filter((m) => m.key !== key) : prev
    );
  }

  function addEntry() {
    setMedicines((prev) => [...prev, emptyEntry()]);
  }

  // Phase E-Rx 3: safety pre-flight. Fires once a patient is picked AND
  // at least one medicine has a name. The full list of named medicines
  // (not just the one being typed) feeds the candidate payload so the
  // engine can catch pairwise interactions across the whole Rx.
  const patientIdForCheck =
    selectedPatient?.patient?.id || selectedPatient?.patients?.id || selectedPatient?.id || patientId;
  const namedMedicines = medicines.filter((m) => m.name.trim());
  const safetyEnabled = !!patientIdForCheck && namedMedicines.length > 0;
  const safetyPayload = safetyEnabled
    ? {
        patientId: patientIdForCheck,
        candidate: namedMedicines.map((m) => ({
          name: m.name.trim(),
          dosage: m.dosage.trim() || undefined,
          masterMedicineId: m.masterMedicineId || undefined,
        })) as SafetyCheckCandidate[],
      }
    : null;
  const { data: safetyResult } = useSafetyCheck(
    safetyEnabled ? safetyPayload : null,
    safetyEnabled
  );
  const safetyWarnings: DrugWarning[] = safetyResult?.warnings || [];
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const TIMING_OPTIONS = [
    { value: "Before food", label: t("doctorPrescription.timingBefore") },
    { value: "After food", label: t("doctorPrescription.timingAfter") },
    { value: "With food", label: t("doctorPrescription.timingWith") },
    { value: "Any time", label: t("doctorPrescription.timingAny") },
  ];

  // Phase E-Rx 3: validate the medicines array, surface safety
  // warnings, then POST. `force` is set when the doctor has tapped
  // "Override and create" in the bottom sheet.
  async function handleCreate(force = false) {
    const patient =
      selectedPatient ||
      searchResults?.patients?.find?.((p: any) => (p.patient?.id || p.patients?.id || p.id) === patientId);
    if (!patient) {
      toast.show(t("doctorPrescription.searchPatients"), "warning");
      return;
    }
    if (medicines.length === 0) {
      toast.show(t("doctorPrescription.emptyMedicinesTitle"), "warning");
      return;
    }

    // Per-entry validation: name + dosage required, slots required.
    for (let i = 0; i < medicines.length; i++) {
      const m = medicines[i];
      if (!m.name.trim()) {
        toast.show(t("doctorPrescription.medicineErrorEmpty"), "warning");
        return;
      }
      if (!m.dosage.trim()) {
        toast.show(t("doctorPrescription.medicineErrorDosage"), "warning");
        return;
      }
      if (slotsToFrequency(m.slots) === null) {
        toast.show(t("doctorPrescription.medicineErrorSlots"), "warning");
        return;
      }
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

    const startDate = todayISO();
    try {
      await createPrescription.mutateAsync({
        data: {
          patientId: patient.patient?.id || patient.patients?.id || patient.id || patientId,
          diagnosis,
          notes,
          medicines: medicines.map((m) => {
            const freq = slotsToFrequency(m.slots) as string;
            const endDate = m.ongoing ? undefined : addDays(startDate, m.durationDays);
            return {
              name: m.name,
              dosage: m.dosage,
              frequency: freq,
              timing: m.timing || undefined,
              startDate,
              endDate,
              masterMedicineId: m.masterMedicineId ?? null,
            };
          }),
        },
        // Send the override header when the doctor explicitly
        // acknowledged a blocking warning.
        headers: force ? { "X-Confirm-Warning": "true" } : undefined,
      });
      try {
        await SecureStore.deleteItemAsync("prescription_draft");
      } catch (err) {
        console.warn("[prescription] Failed to delete draft:", err);
      }
      toast.show(t("doctorPrescription.savedToast"), "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("doctorPrescription.saveError"), "danger");
    }
  }

  function pickMasterMedicine(
    entryKey: string,
    m: {
      id: string;
      genericName: string;
      brandName?: string | null;
      strength?: string | null;
    }
  ) {
    // Display: prefer "Brand Generic Strength" when brand present,
    // fall back to "Generic Strength". Store the display name in
    // `name` so the `medicines.name` column stays clean + matches
    // other system matches (interaction check, adherence view).
    const left = m.brandName ? `${m.brandName} (${m.genericName})` : m.genericName;
    const display = m.strength ? `${left} ${m.strength}` : left;
    updateEntry(entryKey, { name: display, masterMedicineId: m.id });
  }

  const [patientFilter, setPatientFilter] = useState<"all" | "careTeam" | "recent">("all");

  const consentPatients = useMemo(() => {
    return (consentsData?.items || []).map((c: any) => ({
      patient: { id: c.patientId },
      user: {
        name: c.patientName,
        phone: c.patientPhone,
        photo: c.patientPhoto,
      },
      isCareTeam: true,
    }));
  }, [consentsData]);

  const recentPatients = useMemo(() => {
    return (recentPatientsData?.patients || []).map((r: any) => ({
      ...r,
      isRecent: true,
    }));
  }, [recentPatientsData]);

  const allKnownPatients = useMemo(() => {
    const seen = new Set<string>();
    const list: any[] = [];
    for (const p of [...consentPatients, ...recentPatients]) {
      const id = p.patient?.id || p.patients?.id || p.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(p);
      }
    }
    return list;
  }, [consentPatients, recentPatients]);

  const remoteResults = searchResults?.patients || [];

  const results = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      const normalizedQuery = searchQuery.toLowerCase().trim();
      const localFiltered = allKnownPatients.filter((p: any) => {
        const name = (p.user?.name || p.users?.name || p.name || "").toLowerCase();
        const phone = (p.user?.phone || p.users?.phone || p.phone || "").toLowerCase();
        const nic = (p.user?.nic || p.users?.nic || p.nic || "").toLowerCase();
        return (
          name.includes(normalizedQuery) ||
          phone.includes(normalizedQuery) ||
          nic.includes(normalizedQuery)
        );
      });

      const seenIds = new Set<string>();
      return [...localFiltered, ...remoteResults].filter((p: any) => {
        const pId = p.patient?.id || p.patients?.id || p.id;
        if (!pId || seenIds.has(pId)) return false;
        seenIds.add(pId);
        return true;
      });
    }
    return allKnownPatients;
  }, [searchQuery, allKnownPatients, remoteResults]);

  const displayedPatients = useMemo(() => {
    if (patientFilter === "careTeam") {
      const activeIds = new Set(
        consentPatients.map((a: any) => a.patient?.id || a.id).filter(Boolean)
      );
      return results.filter((p: any) => {
        const id = p.patient?.id || p.patients?.id || p.id;
        return id && activeIds.has(id);
      });
    }
    if (patientFilter === "recent") {
      const recentIds = new Set(
        recentPatients.map((r: any) => r.patient?.id || r.id).filter(Boolean)
      );
      return results.filter((p: any) => {
        const id = p.patient?.id || p.patients?.id || p.id;
        return id && recentIds.has(id);
      });
    }
    return results;
  }, [results, patientFilter, consentPatients, recentPatients]);

  const hasDraft =
    !selectedPatient &&
    (diagnosis.trim().length > 0 ||
      medicines.some((m) => m.name.trim().length > 0));

  if (selectedPatient) {
    const patientName =
      selectedPatient.name ||
      selectedPatient.user?.name ||
      selectedPatient.users?.name ||
      t("doctorPrescription.patientFallback", { defaultValue: "Patient" });
    const patientPhone =
      selectedPatient.phone ||
      selectedPatient.user?.phone ||
      selectedPatient.users?.phone ||
      t("doctorPrescription.noPhone", { defaultValue: "No phone on file" });
    const patientPhoto =
      selectedPatient.photo ||
      selectedPatient.user?.photo ||
      selectedPatient.users?.photo;

    return (
      // Fragment wraps Screen + the override BottomSheet so the return
      // has a single JSX root. The override sheet is sibling to the
      // form so the doctor can keep the keyboard visible behind it.
      <>
      <Screen
        scroll
        keyboard
        padded={false}
        edges={["top"]}
        contentContainerStyle={{ paddingBottom: 170 }}
        style={{ backgroundColor: colors.bg }}
      >
        {/* ── Screen Header ── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            backgroundColor: colors.bg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <Pressable
              onPress={() => setSelectedPatient(null)}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderSubtle ?? colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <ChevronRight
                size={18}
                color={colors.text}
                style={{ transform: [{ rotate: "180deg" }] }}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.display.lg,
                  {
                    color: colors.text,
                    fontFamily: fontFamily.displayBold,
                    fontSize: 22,
                    lineHeight: 28,
                  },
                ]}
              >
                {t("doctorPrescription.newTitle", { defaultValue: "New Prescription" })}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                }}
              >
                E-Prescription • Clinical Order
              </Text>
            </View>
          </View>

          <PillCmp
            label={t("doctorPrescription.draft", { defaultValue: "Draft" })}
            tone="warning"
            size="sm"
          />
        </View>

        {/* ── Selected Patient Card ── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xs,
            marginBottom: spacing.md,
            padding: 14,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderSubtle ?? colors.border,
            flexDirection: "row",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Avatar
            name={patientName}
            size="md"
            tone="primary"
            source={patientPhoto ? { uri: patientPhoto } : undefined}
          />
          <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                numberOfLines={1}
                style={[
                  typography.bodyBold,
                  { color: colors.text, fontWeight: "700", fontSize: 15 },
                ]}
              >
                {patientName}
              </Text>
              <View
                style={{
                  backgroundColor: withOpacity(colors.primary, 0.12),
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: colors.primary,
                  }}
                >
                  Patient
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Phone size={11} color={colors.textSubtle} strokeWidth={2} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                }}
                numberOfLines={1}
              >
                {patientPhone}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setSelectedPatient(null)}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 14,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <X size={13} color={colors.textSubtle} />
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: "600",
                color: colors.textMuted,
              }}
            >
              Change
            </Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          <Card
            padded={false}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md + 2,
                paddingBottom: spacing.sm,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle ?? colors.border,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Stethoscope size={15} color={colors.primary} strokeWidth={2.4} />
              </View>
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.text, fontWeight: "700", fontSize: 14.5 },
                ]}
              >
                {t("doctorPrescription.assessment", { defaultValue: "Clinical Assessment" })}
              </Text>
            </View>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <FormField label={t("doctorPrescription.diagnosis", { defaultValue: "Diagnosis" })} required>
                <TextInput
                  value={diagnosis}
                  onChangeText={setDiagnosis}
                  placeholder={t("doctorPrescription.diagnosisPlaceholder", {
                    defaultValue: "e.g., Acute pharyngitis, Type 2 Diabetes",
                  })}
                  leadingIcon={Stethoscope}
                  multiline
                  numberOfLines={2}
                />
              </FormField>

              <FormField label={t("doctorPrescription.notes", { defaultValue: "Clinical Notes & Advice" })}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t("doctorPrescription.notesPlaceholder", {
                    defaultValue: "Additional instructions, diet advice, or notes...",
                  })}
                  leadingIcon={FileText}
                  multiline
                  numberOfLines={3}
                  tone="soft"
                />
              </FormField>
            </View>
          </Card>

          {/* Phase 4.2: saved prescription templates. Chip carousel so
              the doctor can autofill the medicine list with one tap.
              Hidden when no templates exist (avoid empty UI). */}
          {templates.length > 0 && (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: spacing.sm,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Layers size={14} color={colors.textMuted} strokeWidth={2.2} />
                  <Text
                    style={[
                      typography.label.lg,
                      { color: colors.textMuted },
                    ]}
                  >
                    {t("doctorPrescription.templatesHeading")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push("/(doctor)/rx-templates" as any)}
                  hitSlop={6}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.primary,
                      fontFamily: fontFamily.bodyBold,
                    }}
                  >
                    {t("doctorPrescription.manage")}
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: spacing.lg }}
              >
                {templates.map((tpl) => {
                  const count = (tpl.medicines || []).length;
                  return (
                    <Pressable
                      key={tpl.id}
                      onPress={() => applyTemplate(tpl as any)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: radius.pill,
                        backgroundColor: pressed ? colors.primary : colors.primarySoft,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: pressed ? "#FFFFFF" : colors.primary,
                          fontFamily: fontFamily.bodyBold,
                        }}
                        numberOfLines={1}
                      >
                        {tpl.name}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 999,
                          backgroundColor: pressed ? "rgba(255,255,255,0.25)" : colors.primary,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color: "#FFFFFF",
                            fontFamily: fontFamily.displayBold,
                          }}
                        >
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Phase 4: medicines list. Each entry renders its own
              MedicineCard with name + autocomplete, dosage, time-slot
              multi-select, food-relation chips, and duration. Tapping
              the + button appends an empty entry; tapping the trash
              removes one (always keeps at least one entry visible). */}
          <Card
            padded={false}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md + 2,
                paddingBottom: spacing.sm,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle ?? colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PillIcon size={15} color={colors.primary} strokeWidth={2.4} />
                </View>
                <Text
                  style={[
                    typography.title.sm,
                    { color: colors.text, fontWeight: "700", fontSize: 14.5 },
                  ]}
                >
                  {t("doctorPrescription.medicinesHeading", {
                    defaultValue: "Prescribed Medicines",
                  })}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: colors.primarySoft,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: colors.primary,
                    fontFamily: fontFamily.displayBold,
                  }}
                >
                  {medicines.length}
                </Text>
              </View>
            </View>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              {medicines.map((m, idx) => (
                <MedicineCard
                  key={m.key}
                  entry={m}
                  index={idx}
                  canRemove={medicines.length > 1}
                  onChange={(patch) => updateEntry(m.key, patch)}
                  onRemove={() => removeEntry(m.key)}
                  onPickMaster={(master) => pickMasterMedicine(m.key, master)}
                  slotsLabel={t("doctorPrescription.slotsLabel")}
                  slotLabels={{
                    morning: t("doctorPrescription.slotMorning"),
                    noon: t("doctorPrescription.slotNoon"),
                    evening: t("doctorPrescription.slotEvening"),
                    night: t("doctorPrescription.slotNight"),
                  }}
                  timingLabel={t("doctorPrescription.timingFoodLabel")}
                  timingOptions={TIMING_OPTIONS}
                  durationLabel={t("doctorPrescription.durationLabel")}
                  durationStartLabel={t("doctorPrescription.durationStart")}
                  durationEndLabel={t("doctorPrescription.durationEnd")}
                  durationDaysLabel={(n) => t("doctorPrescription.durationDays", { count: n })}
                  ongoingLabel={t("doctorPrescription.durationOngoing")}
                  medicineLabel={t("doctorPrescription.medicineCard", {
                    count: idx + 1,
                  })}
                  removeLabel={t("doctorPrescription.removeMedicine")}
                  medicinePlaceholder={t("doctorPrescription.medicinePlaceholder")}
                  dosageLabel={t("doctorPrescription.dosage")}
                  dosagePlaceholder={t("doctorPrescription.dosagePlaceholder")}
                  startDate={todayISO()}
                />
              ))}

              <Button
                title={t("doctorPrescription.addMedicine")}
                iconLeft={Plus}
                variant="secondary"
                size="md"
                fullWidth
                onPress={addEntry}
              />
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

  return (
    <Screen scroll padded={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* ── Top Header Bar ── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: colors.bg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: withOpacity(colors.primary, 0.2),
              }}
            >
              <FilePenLine size={20} color={colors.primary} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.display.lg,
                  {
                    color: colors.text,
                    fontFamily: fontFamily.displayBold,
                    fontSize: 22,
                    lineHeight: 28,
                    letterSpacing: -0.4,
                  },
                ]}
              >
                {t("doctorPrescription.title", { defaultValue: "Prescribe" })}
              </Text>
              <Text
                style={{
                  fontSize: 12.5,
                  color: colors.textMuted,
                  marginTop: 1,
                  fontFamily: fontFamily.body,
                }}
              >
                {t("doctorPrescription.subtitle", {
                  defaultValue: "Select a patient to issue an electronic Rx",
                })}
              </Text>
            </View>
          </View>

          {/* Templates Shortcut Button */}
          <Pressable
            onPress={() => router.push("/(doctor)/rx-templates" as any)}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 1,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Layers size={14} color={colors.primary} strokeWidth={2.4} />
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: "700",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              Templates
            </Text>
            {templates.length > 0 && (
              <View
                style={{
                  backgroundColor: colors.primarySoft,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 10,
                }}
              >
                <Text style={{ fontSize: 10.5, fontWeight: "800", color: colors.primary }}>
                  {templates.length}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Active Draft Banner ── */}
        {hasDraft && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
              borderRadius: 16,
              backgroundColor: withOpacity(colors.warning || "#F59E0B", 0.1),
              borderWidth: 1,
              borderColor: withOpacity(colors.warning || "#F59E0B", 0.28),
              marginTop: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Sparkles size={16} color={colors.warning || "#B45309"} strokeWidth={2.4} />
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "600",
                  color: colors.warning || "#B45309",
                  flex: 1,
                }}
                numberOfLines={1}
              >
                Unfinished Rx draft ({medicines.filter((m) => m.name.trim()).length} med
                {medicines.filter((m) => m.name.trim()).length === 1 ? "" : "s"} saved)
              </Text>
            </View>
            <Pressable
              onPress={async () => {
                setDiagnosis("");
                setNotes("");
                setMedicines([emptyEntry()]);
                try {
                  await SecureStore.deleteItemAsync("prescription_draft");
                } catch {}
              }}
              hitSlop={6}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.danger || "#DC2626",
                }}
              >
                Discard
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Single-Container Search Bar ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.borderSubtle ?? colors.border,
            paddingHorizontal: 14,
            height: 48,
            marginTop: 14,
            gap: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.03,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <Search size={18} color={colors.primary} strokeWidth={2.2} />
          <RNTextInput
            placeholder={t("doctorPrescription.searchPlaceholder", {
              defaultValue: "Search by patient name, phone, or NIC...",
            })}
            placeholderTextColor={colors.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            style={{
              flex: 1,
              fontSize: 14,
              color: colors.text,
              fontFamily: fontFamily.body,
              paddingVertical: 0,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: colors.surfaceMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={13} color={colors.textMuted} strokeWidth={2.2} />
            </Pressable>
          )}
        </View>

        {/* ── Filter Segment Chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingTop: 12,
          }}
        >
          <Pressable
            onPress={() => setPatientFilter("all")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              backgroundColor: patientFilter === "all" ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: patientFilter === "all" ? colors.primary : colors.borderSubtle ?? colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: patientFilter === "all" ? "700" : "600",
                color: patientFilter === "all" ? "#FFFFFF" : colors.textMuted,
                fontFamily: patientFilter === "all" ? fontFamily.bodyBold : fontFamily.body,
              }}
            >
              All Patients
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 10,
                backgroundColor:
                  patientFilter === "all" ? "rgba(255,255,255,0.25)" : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: "800",
                  color: patientFilter === "all" ? "#FFFFFF" : colors.textMuted,
                }}
              >
                {results.length}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setPatientFilter("careTeam")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              backgroundColor: patientFilter === "careTeam" ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: patientFilter === "careTeam" ? colors.primary : colors.borderSubtle ?? colors.border,
            }}
          >
            <Users
              size={13}
              color={patientFilter === "careTeam" ? "#FFFFFF" : colors.primary}
              strokeWidth={2.4}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: patientFilter === "careTeam" ? "700" : "600",
                color: patientFilter === "careTeam" ? "#FFFFFF" : colors.textMuted,
                fontFamily: patientFilter === "careTeam" ? fontFamily.bodyBold : fontFamily.body,
              }}
            >
              Care Team
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 10,
                backgroundColor:
                  patientFilter === "careTeam" ? "rgba(255,255,255,0.25)" : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: "800",
                  color: patientFilter === "careTeam" ? "#FFFFFF" : colors.textMuted,
                }}
              >
                {consentPatients.length}
              </Text>
            </View>
          </Pressable>

          {recentPatients.length > 0 && (
            <Pressable
              onPress={() => setPatientFilter("recent")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor: patientFilter === "recent" ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: patientFilter === "recent" ? colors.primary : colors.borderSubtle ?? colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: patientFilter === "recent" ? "700" : "600",
                  color: patientFilter === "recent" ? "#FFFFFF" : colors.textMuted,
                  fontFamily: patientFilter === "recent" ? fontFamily.bodyBold : fontFamily.body,
                }}
              >
                Recent
              </Text>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 10,
                  backgroundColor:
                    patientFilter === "recent" ? "rgba(255,255,255,0.25)" : colors.surfaceMuted,
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "800",
                    color: patientFilter === "recent" ? "#FFFFFF" : colors.textMuted,
                  }}
                >
                  {recentPatients.length}
                </Text>
              </View>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* ── Patients List / Content ── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: 150, // Clearance for floating navigation bar!
          gap: 10,
        }}
      >
        {displayedPatients.length > 0 ? (
          displayedPatients.map((p) => {
            const pId = p.patient?.id || p.patients?.id || p.id;
            const pName = p.user?.name || p.users?.name || p.name || "Patient";
            const pPhone = p.user?.phone || p.users?.phone || p.phone;
            const pNic = p.user?.nic || p.users?.nic || p.nic;
            const isCareTeam = consentPatients.some(
              (a: any) => (a.patient?.id || a.id) === pId
            );
            const palette = getAvatarPalette(pName);
            const initials = getInitials(pName);

            return (
              <Pressable
                key={pId}
                onPress={() => setSelectedPatient(p)}
                style={({ pressed }) => ({
                  backgroundColor: colors.surface,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle ?? colors.border,
                  padding: 14,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.03,
                  shadowRadius: 6,
                  elevation: 1.5,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.995 : 1 }],
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {/* Dynamic Squircle Avatar */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: palette.bg,
                      borderWidth: 1,
                      borderColor: palette.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: palette.fg,
                        fontFamily: fontFamily.displayBold,
                      }}
                    >
                      {initials}
                    </Text>
                  </View>

                  {/* Patient Details */}
                  <View style={{ flex: 1, marginLeft: 12, minWidth: 0, paddingRight: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.text,
                          fontWeight: "700",
                          fontSize: 15,
                          fontFamily: fontFamily.bodyBold,
                          flexShrink: 1,
                        }}
                      >
                        {pName}
                      </Text>
                      {isCareTeam && (
                        <View
                          style={{
                            backgroundColor: withOpacity(colors.primary, 0.1),
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "700",
                              color: colors.primary,
                            }}
                          >
                            Care Team
                          </Text>
                        </View>
                      )}
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 3,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Phone size={11} color={colors.textSubtle} strokeWidth={2} />
                        <Text
                          style={{
                            fontSize: 12.5,
                            color: colors.textMuted,
                            fontFamily: fontFamily.body,
                          }}
                          numberOfLines={1}
                        >
                          {pPhone || "No phone on file"}
                        </Text>
                      </View>

                      {pNic ? (
                        <Text
                          style={{
                            fontSize: 11.5,
                            color: colors.textSubtle,
                          }}
                          numberOfLines={1}
                        >
                          • NIC: {pNic}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Action Pill */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      backgroundColor: colors.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 14,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <FilePenLine size={13} color="#FFFFFF" strokeWidth={2.4} />
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 12,
                        fontWeight: "700",
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
                      Prescribe
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : searchQuery.length > 0 ? (
          <View
            style={{
              paddingVertical: 44,
              paddingHorizontal: spacing.lg,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              marginTop: 10,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.surfaceMuted,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
              }}
            >
              <Search size={22} color={colors.textSubtle} strokeWidth={2} />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              No patients found
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 18,
                paddingHorizontal: 20,
              }}
            >
              No patient matching "{searchQuery}". Check the phone number or NIC.
            </Text>
            <Pressable
              onPress={() => setSearchQuery("")}
              style={{
                marginTop: 6,
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 16,
                backgroundColor: colors.primarySoft,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                Clear Search
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              paddingVertical: 44,
              paddingHorizontal: spacing.lg,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              marginTop: 10,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
              }}
            >
              <Users size={22} color={colors.primary} strokeWidth={2} />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              No patients in this view
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 18,
              }}
            >
              Use the search bar above to look up any registered patient.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

// ─── MedicineCard ──────────────────────────────────────────
// One card per medicine on the prescription. Owns its own input
// state (controlled by parent via `entry` + `onChange`) and runs
// the master-catalogue autocomplete locally — each entry has its
// own debounced query so typing in one card doesn't show results
// under another.
//
// Layout per card:
//   [medicine X header — trash icon]
//   [Name input + master autocomplete]
//   [Quick-pick pills]
//   [Dosage input + common dosages]
//   [When to take: 4 slot pills, multi-select]
//   [Food relation: chip group]
//   [Duration: days input + ongoing toggle]
//
// The frequency string sent to the server is derived from the
// slot count via `slotsToFrequency`. The DB column `medicines.timing`
// stores the food relation; time slots are NOT stored separately —
// they're compressed into `frequency` because that matches what the
// PDF renders and what the verify endpoint signs.

function MedicineCard({
  entry,
  index,
  canRemove,
  onChange,
  onRemove,
  onPickMaster,
  slotsLabel,
  slotLabels,
  timingLabel,
  timingOptions,
  durationLabel,
  durationStartLabel,
  durationEndLabel,
  durationDaysLabel,
  ongoingLabel,
  medicineLabel,
  removeLabel,
  medicinePlaceholder,
  dosageLabel,
  dosagePlaceholder,
  startDate,
}: {
  entry: MedicineEntry;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<MedicineEntry>) => void;
  onRemove: () => void;
  onPickMaster: (m: any) => void;
  slotsLabel: string;
  slotLabels: { morning: string; noon: string; evening: string; night: string };
  timingLabel: string;
  timingOptions: { value: string; label: string }[];
  durationLabel: string;
  durationStartLabel: string;
  durationEndLabel: string;
  durationDaysLabel: (n: number) => string;
  ongoingLabel: string;
  medicineLabel: string;
  removeLabel: string;
  medicinePlaceholder: string;
  dosageLabel: string;
  dosagePlaceholder: string;
  startDate: string;
}) {
  const { spacing, colors, typography, radius } = useTheme();
  const [localQuery, setLocalQuery] = useState("");
  const debouncedLocal = useDebounce(localQuery, 250);
  const { data: localResults } = useMedicineSearch(debouncedLocal);

  const slotEntries: Array<{ key: keyof Slots; label: string }> = [
    { key: "morning", label: slotLabels.morning },
    { key: "noon", label: slotLabels.noon },
    { key: "evening", label: slotLabels.evening },
    { key: "night", label: slotLabels.night },
  ];

  const endDatePreview = entry.ongoing
    ? "—"
    : addDays(startDate, Math.max(1, entry.durationDays || 1));

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.borderSubtle ?? colors.border,
        backgroundColor: colors.surfaceMuted,
        padding: 16,
        gap: spacing.md,
      }}
    >
      {/* Header row: index + name + remove */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: colors.primary,
              }}
            >
              {index + 1}
            </Text>
          </View>
          <Text style={[typography.title.sm, { color: colors.text }]}>
            {medicineLabel}
          </Text>
        </View>
        {canRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.dangerSoft : "transparent",
            })}
          >
            <Trash2 size={16} color={colors.danger} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      {/* Name + autocomplete */}
      <FormField label="Medicine" required>
        <TextInput
          value={entry.name}
          onChangeText={(v) => {
            onChange({ name: v, masterMedicineId: null });
            setLocalQuery(v);
          }}
          placeholder={medicinePlaceholder}
          leadingIcon={PillIcon}
        />
      </FormField>
      {localResults?.medicines &&
      localResults.medicines.length > 0 &&
      localQuery.length >= 2 &&
      !entry.masterMedicineId ? (
        <View
          style={{
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.xs,
          }}
        >
          {localResults.medicines.slice(0, 5).map((m: any, idx: number) => (
            <View
              key={m.id}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderBottomWidth:
                  idx === Math.min(4, localResults.medicines.length - 1) ? 0 : 1,
                borderBottomColor: colors.border,
              }}
            >
              <ListItem
                title={m.brandName ? `${m.brandName} (${m.genericName})` : m.genericName}
                subtitle={[m.strength, m.scheduleClass].filter(Boolean).join(" • ") || undefined}
                iconTone="primary"
                mediaSlot={
                  <Avatar name={m.genericName} size="sm" tone="soft" />
                }
                onPress={() => {
                  onPickMaster(m);
                  setLocalQuery("");
                }}
              />
            </View>
          ))}
        </View>
      ) : null}
      {entry.masterMedicineId ? (
        <PillCmp
          icon={PillIcon}
          label={`Master linked`}
          tone="success"
          size="sm"
        />
      ) : null}

      {/* Quick-pick fallback when catalogue is empty */}
      {localQuery.length >= 2 &&
      (!localResults?.medicines || localResults.medicines.length === 0) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {PRESET_MEDS.filter((p) =>
            p.toLowerCase().includes(localQuery.toLowerCase())
          )
            .slice(0, 4)
            .map((p) => (
              <PillCmp
                key={p}
                label={p}
                tone="neutral"
                size="sm"
                onPress={() => {
                  onChange({ name: p });
                  setLocalQuery("");
                }}
              />
            ))}
        </View>
      ) : null}

      {/* Dosage */}
      <FormField label={dosageLabel} required>
        <TextInput
          value={entry.dosage}
          onChangeText={(v) => onChange({ dosage: v })}
          placeholder={dosagePlaceholder}
        />
      </FormField>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {COMMON_DOSAGES.map((d) => (
          <PillCmp
            key={d}
            label={d}
            tone={entry.dosage === d ? "accent" : "neutral"}
            size="sm"
            onPress={() => onChange({ dosage: d })}
          />
        ))}
      </View>

      {/* Time slots — multi-select */}
      <FormField label={slotsLabel}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {slotEntries.map(({ key, label }) => {
            const selected = entry.slots[key];
            return (
              <PillCmp
                key={key}
                label={label}
                tone={selected ? "primary" : "neutral"}
                size="sm"
                onPress={() =>
                  onChange({
                    slots: { ...entry.slots, [key]: !selected },
                  })
                }
              />
            );
          })}
        </View>
        {slotsToFrequency(entry.slots) ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, marginTop: 4 },
            ]}
          >
            {slotsToFrequency(entry.slots)}
          </Text>
        ) : null}
      </FormField>

      {/* Food relation — single-select chip group */}
      <FormField label={timingLabel}>
        <ChipGroup
          options={timingOptions}
          value={entry.timing}
          onChange={(v) => onChange({ timing: v as MedicineEntry["timing"] })}
        />
      </FormField>

      {/* Duration — days + ongoing toggle */}
      <FormField label={durationLabel}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextInput
              value={String(entry.durationDays)}
              onChangeText={(v) => {
                const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
                onChange({ durationDays: isNaN(n) ? 0 : n });
              }}
              keyboardType="number-pad"
              placeholder="7"
              editable={!entry.ongoing}
              tone={entry.ongoing ? "soft" : undefined}
            />
          </View>
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {durationDaysLabel(Math.max(1, entry.durationDays))}
          </Text>
        </View>
        <Pressable
          onPress={() => onChange({ ongoing: !entry.ongoing })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: entry.ongoing }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.xs,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              borderWidth: 2,
              borderColor: entry.ongoing ? colors.primary : colors.border,
              backgroundColor: entry.ongoing ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {entry.ongoing ? (
              <Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: "900" }}>
                ✓
              </Text>
            ) : null}
          </View>
          <Text style={[typography.body.sm, { color: colors.text }]}>
            {ongoingLabel}
          </Text>
        </Pressable>
        <Text
          style={[
            typography.caption,
            { color: colors.textSubtle, marginTop: 4 },
          ]}
        >
          {durationStartLabel}: {startDate}    {durationEndLabel}: {endDatePreview}
        </Text>
      </FormField>
    </View>
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

import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  Upload,
  FileText,
  Calendar as CalendarIcon,
  Check,
  Stethoscope,
  FileBadge,
  ScanText,
  Sparkles,
  Pill,
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import {
  useUploadRecordWithFile,
  useMedicalRecord,
  useAddMedicine,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  FormField,
  TextInput,
  Button,
  DateField,
  Card,
  Chip,
  BottomSheet,
  useToast,
} from "@/components/ui";

const RECORD_TYPES = [
  { value: "lab_report", label: "Lab report" },
  { value: "imaging", label: "Imaging" },
  { value: "prescription", label: "Prescription" },
  { value: "hospital_visit", label: "Hospital visit" },
  { value: "vaccination", label: "Vaccination" },
  { value: "surgery", label: "Surgery" },
  { value: "allergy", label: "Allergy" },
  { value: "insurance", label: "Insurance" },
  { value: "fitness", label: "Fitness" },
  { value: "discharge_summary", label: "Discharge" },
  { value: "medical_certificate", label: "Certificate" },
  { value: "operation_note", label: "Op note" },
  { value: "invoice", label: "Invoice" },
];

export default function AddRecordScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const upload = useUploadRecordWithFile();

  const [recordType, setRecordType] = useState("lab_report");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date());
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [pickedFile, setPickedFile] = useState<any>(null);

  const [lastRecordId, setLastRecordId] = useState<string | null>(null);
  const [ocrSheetOpen, setOcrSheetOpen] = useState(false);
  const [extractedMedicines, setExtractedMedicines] = useState<
    { name: string; dosage: string; frequency: string; timing?: string }[]
  >([]);

  const { data: lastRecord } = useMedicalRecord(lastRecordId || "");
  const addMedicine = useAddMedicine();

  // V3: When extractedData appears on a freshly-uploaded prescription,
  // open the medicine-confirm sheet.
  useEffect(() => {
    const ext = (lastRecord as any)?.record?.extractedData;
    if (!ext) return;
    try {
      const parsed = JSON.parse(ext);
      if (Array.isArray(parsed?.medicines) && parsed.medicines.length > 0) {
        setExtractedMedicines(parsed.medicines);
        setOcrSheetOpen(true);
      }
    } catch {}
  }, [(lastRecord as any)?.record?.extractedData]);

  async function addExtractedMedicines() {
    let added = 0;
    for (const m of extractedMedicines) {
      try {
        await addMedicine.mutateAsync({
          name: m.name,
          dosage: m.dosage || undefined,
          frequency: m.frequency || undefined,
          startDate: new Date().toISOString().slice(0, 10),
        });
        added++;
      } catch {}
    }
    setOcrSheetOpen(false);
    toast.show(
      added > 0
        ? `Added ${added} medicine${added === 1 ? "" : "s"}`
        : "Could not add medicines",
      added > 0 ? "success" : "danger"
    );
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPickedFile(result.assets[0]);
    }
  }

  async function handleSave() {
    // File attachment is always optional — title + type + date are the only
    // required fields (matches backend `medicalRecordSchema`).
    if (!title.trim()) {
      toast.show("Title is required", "warning");
      return;
    }
    try {
      const fileData = pickedFile
        ? {
            uri: pickedFile.uri,
            name: pickedFile.name,
            type: pickedFile.mimeType || "application/octet-stream",
          }
        : undefined;

      const res = await upload.mutateAsync({
        file: fileData as any,
        recordType,
        title: title.trim(),
        date: date.toISOString().slice(0, 10),
        diagnosis: diagnosis.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.show("Record added", "success");

      // V3: For prescriptions, fetch extracted meds once OCR completes.
      const recordId = (res as any)?.record?.id;
      if (recordType === "prescription" && recordId) {
        setLastRecordId(recordId);
        toast.show("Reading prescription…", "info");
      }
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Upload failed", "danger");
    }
  }

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title="Add record" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* File picker */}
        <Card padded={false}>
          <View
            style={{
              padding: spacing.lg,
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pickedFile ? colors.primary : colors.surfaceMuted,
              }}
            >
              {pickedFile ? (
                <Check size={26} color={colors.onPrimary} strokeWidth={2.5} />
              ) : (
                <Upload size={26} color={colors.primary} strokeWidth={2.25} />
              )}
            </View>
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, textAlign: "center" },
              ]}
            >
              {pickedFile ? pickedFile.name : "Attach file (optional)"}
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, textAlign: "center" },
              ]}
              numberOfLines={2}
            >
              {pickedFile
                ? `${(pickedFile.size / 1024).toFixed(0)} KB · ${
                    pickedFile.mimeType || "file"
                  }`
                : "PDF, image, DICOM — max 50MB · or skip to log a note"}
            </Text>
            <Button
              title={pickedFile ? "Choose another" : "Choose file"}
              variant="outline"
              onPress={pickFile}
              size="sm"
              icon={FileText}
            />
          </View>
        </Card>

        {/* Record type chips */}
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.label.md, { color: colors.textMuted }]}>
            RECORD TYPE
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.xs,
            }}
          >
            {RECORD_TYPES.map((rt) => (
              <Chip
                key={rt.value}
                label={rt.label}
                selected={recordType === rt.value}
                tone={recordType === rt.value ? "primary" : "neutral"}
                onPress={() => setRecordType(rt.value)}
              />
            ))}
          </View>
        </View>

        <FormField label="Title" required>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Lipid panel — March 2026"
            leadingIcon={FileBadge}
          />
        </FormField>

        <FormField label="Date" required>
          <DateField
            value={date}
            onChange={setDate}
            placeholder="Pick date"
            maximumDate={new Date()}
          />
        </FormField>

        <FormField label="Diagnosis" helper="Optional">
          <TextInput
            value={diagnosis}
            onChangeText={setDiagnosis}
            placeholder="e.g., Hypercholesterolemia"
            leadingIcon={Stethoscope}
          />
        </FormField>

        <FormField label="Notes" helper="Optional">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything your doctor should know..."
            multiline
            numberOfLines={3}
            tone="soft"
          />
        </FormField>

        <Button
          title="Save record"
          onPress={handleSave}
          loading={upload.isPending}
          icon={Upload}
          size="lg"
          fullWidth
        />
      </ScrollView>

      {/* V3: OCR medicine-confirm sheet */}
      <BottomSheet
        visible={ocrSheetOpen}
        onDismiss={() => setOcrSheetOpen(false)}
        title="Extracted from prescription"
      >
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Sparkles size={16} color={colors.primary} />
            <Text style={[typography.body.sm, { color: colors.textMuted }]}>
              We read {extractedMedicines.length} medicine
              {extractedMedicines.length === 1 ? "" : "s"} from your prescription.
            </Text>
          </View>

          {extractedMedicines.map((m, i) => (
            <View
              key={i}
              style={{
                padding: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 2,
              }}
            >
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.text, fontWeight: "700" },
                ]}
              >
                {m.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {[m.dosage, m.frequency, m.timing].filter(Boolean).join(" • ")}
              </Text>
            </View>
          ))}

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title="Skip"
              variant="outline"
              onPress={() => setOcrSheetOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              title={`Add ${extractedMedicines.length} to my list`}
              icon={Pill}
              onPress={addExtractedMedicines}
              loading={addMedicine.isPending}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  Upload,
  FileText,
  Calendar as CalendarIcon,
  Check,
  Stethoscope,
  FileBadge,
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { useUploadRecordWithFile } from "@/hooks/useApi";
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
    if (!pickedFile) {
      toast.show("Attach a file first", "warning");
      return;
    }
    if (!title.trim()) {
      toast.show("Title is required", "warning");
      return;
    }
    try {
      await upload.mutateAsync({
        file: {
          uri: pickedFile.uri,
          name: pickedFile.name,
          type: pickedFile.mimeType || "application/octet-stream",
        } as any,
        recordType,
        title: title.trim(),
        date: date.toISOString().slice(0, 10),
        diagnosis: diagnosis.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.show("Record added", "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Upload failed", "danger");
    }
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title="Add record" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
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
              {pickedFile ? pickedFile.name : "Attach a file"}
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
                : "PDF, image, DICOM — max 50MB"}
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
    </Screen>
  );
}
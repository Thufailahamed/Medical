// @ts-nocheck

import { useEffect, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Save,
  Trash2,
  FileBadge,
  Stethoscope,
  NotebookPen,
  FileText,
} from "lucide-react-native";
import {
  useMedicalRecord,
  useEditMedicalRecord,
  useDeleteMedicalRecord,
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
  useToast,
  Skeleton,
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

export default function EditRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useMedicalRecord(id || "");
  const edit = useEditMedicalRecord();
  const del = useDeleteMedicalRecord();

  const [recordType, setRecordType] = useState<string>("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [diagnosis, setDiagnosis] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate form once data arrives
  useEffect(() => {
    if (!data?.record || hydrated) return;
    const r = data.record;
    setRecordType(r.recordType || "");
    setTitle(r.title || "");
    const parsed = r.date ? new Date(r.date) : null;
    setDate(parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date());
    setDiagnosis(r.diagnosis || "");
    setSummary(r.summary || "");
    setNotes(r.notes || "");
    setHydrated(true);
  }, [data, hydrated]);

  const dirty =
    hydrated &&
    (recordType !== data?.record?.recordType ||
      title !== data?.record?.title ||
      date.toISOString().slice(0, 10) !== data?.record?.date ||
      (diagnosis || "") !== (data?.record?.diagnosis || "") ||
      (summary || "") !== (data?.record?.summary || "") ||
      (notes || "") !== (data?.record?.notes || ""));

  async function handleSave() {
    if (!id) return;
    if (!title.trim()) {
      toast.show("Title is required", "warning");
      return;
    }
    try {
      await edit.mutateAsync({
        id,
        title: title.trim(),
        recordType,
        date: date.toISOString().slice(0, 10),
        diagnosis: diagnosis.trim() || undefined,
        summary: summary.trim() || undefined,
        notes: notes.trim() || undefined,
      } as any);
      toast.show("Record updated", "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Update failed", "danger");
    }
  }

  function handleDelete() {
    if (!id) return;
    Alert.alert(
      "Delete record?",
      "This will remove the record and its attachments. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await del.mutateAsync(id);
              toast.show("Record deleted", "success");
              router.replace("/(app)/records" as any);
            } catch (err: any) {
              toast.show(err?.message || "Failed to delete", "danger");
            }
          },
        },
      ]
    );
  }

  if (isLoading || !hydrated) {
    return (
      <Screen padded={false} edges={["top"]}>
        <ScreenHeader back title="Edit record" />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={64} radius={16} />
          <Skeleton height={48} radius={12} />
          <Skeleton height={48} radius={12} />
          <Skeleton height={120} radius={16} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        title="Edit record"
        subtitle="Update details, save changes"
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type chips */}
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

        <FormField label="Summary" helper="Optional">
          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="Short plain-language summary"
            leadingIcon={FileText}
            multiline
            numberOfLines={2}
          />
        </FormField>

        <FormField label="Notes" helper="Optional">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything your doctor should know..."
            leadingIcon={NotebookPen}
            multiline
            numberOfLines={3}
            tone="soft"
          />
        </FormField>

        <Card style={{ padding: spacing.md }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Attachments can't be edited. Delete and re-upload to change a file.
          </Text>
        </Card>

        <Button
          title="Save changes"
          icon={Save}
          onPress={handleSave}
          loading={edit.isPending}
          size="lg"
          fullWidth
          disabled={!dirty}
        />

        <Button
          title="Delete record"
          icon={Trash2}
          variant="danger"
          onPress={handleDelete}
          loading={del.isPending}
          size="md"
          fullWidth
        />
      </ScrollView>
    </Screen>
  );
}

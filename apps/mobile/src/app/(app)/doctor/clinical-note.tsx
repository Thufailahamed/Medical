import { useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Save, FileText, Stethoscope } from "lucide-react-native";
import { useCreateClinicalNote } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  FormField,
  TextInput,
  Button,
  useToast,
} from "@/components/ui";

export default function ClinicalNoteScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  const createNote = useCreateClinicalNote();

  async function save() {
    if (!patientId || !title.trim() || !notes.trim()) {
      toast.show("Title and notes required", "warning");
      return;
    }
    try {
      await createNote.mutateAsync({
        patientId,
        title: title.trim(),
        diagnosis: diagnosis.trim() || undefined,
        notes: notes.trim(),
      });
      toast.show("Clinical note saved", "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Could not save note", "danger");
    }
  }

  if (!patientId) {
    return (
      <Screen padded>
        <ScreenHeader title="Clinical note" back onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Clinical note"
        subtitle="Document the visit"
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label="Title" required>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Initial assessment"
                leadingIcon={FileText}
              />
            </FormField>

            <FormField label="Diagnosis">
              <TextInput
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholder="Working or final diagnosis"
                leadingIcon={Stethoscope}
                multiline
                numberOfLines={2}
              />
            </FormField>

            <FormField label="Notes" required>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Subjective, objective, plan…"
                multiline
                numberOfLines={8}
                tone="soft"
              />
            </FormField>
          </View>
        </Card>

        <Button
          title="Save clinical note"
          onPress={save}
          loading={createNote.isPending}
          icon={Save}
          size="lg"
        />
      </View>
    </Screen>
  );
}
// @ts-nocheck

import { useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  const createNote = useCreateClinicalNote();

  async function save() {
    if (!patientId || !title.trim() || !notes.trim()) {
      toast.show(t("clinicalNote.requiredError"), "warning");
      return;
    }
    try {
      await createNote.mutateAsync({
        patientId,
        title: title.trim(),
        diagnosis: diagnosis.trim() || undefined,
        notes: notes.trim(),
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

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("clinicalNote.title")}
        subtitle={t("clinicalNote.subtitle")}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label={t("clinicalNote.titleLabel")} required>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t("clinicalNote.titlePlaceholder")}
                leadingIcon={FileText}
              />
            </FormField>

            <FormField label={t("clinicalNote.diagnosisLabel")}>
              <TextInput
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholder={t("clinicalNote.diagnosisPlaceholder")}
                leadingIcon={Stethoscope}
                multiline
                numberOfLines={2}
              />
            </FormField>

            <FormField label={t("clinicalNote.notesLabel")} required>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("clinicalNote.notesPlaceholder")}
                multiline
                numberOfLines={8}
                tone="soft"
              />
            </FormField>
          </View>
        </Card>

        <Button
          title={t("clinicalNote.saveAction")}
          onPress={save}
          loading={createNote.isPending}
          icon={Save}
          size="lg"
        />
      </View>
    </Screen>
  );
}
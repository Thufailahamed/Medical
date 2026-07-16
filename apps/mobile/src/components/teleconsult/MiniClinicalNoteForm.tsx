// @ts-nocheck

/**
 * MiniClinicalNoteForm — in-call clinical-note composer.
 *
 * Rendered inside a BottomSheet from DoctorSidePanel so the video stage
 * stays visible at the top. Reuses the full-screen composer's validation
 * and mutation contract; differs only in callbacks (onSaved/onCancel vs
 * router.back) and lack of SecureStore draft persistence.
 */

import { useState } from "react";
import { View, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Save, FileText, Stethoscope } from "lucide-react-native";
import { useCreateClinicalNote } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  BottomSheet,
  Card,
  FormField,
  TextInput,
  Button,
  useToast,
} from "@/components/ui";

type Props = {
  visible: boolean;
  patientId: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export default function MiniClinicalNoteForm({ visible, patientId, onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const toast = useToast();
  const createNote = useCreateClinicalNote();

  const [title, setTitle] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setTitle("");
    setDiagnosis("");
    setNotes("");
  }

  async function save() {
    if (!patientId || !title.trim() || !notes.trim()) {
      toast.show(t("clinicalNote.requiredError"), "warning");
      return;
    }
    try {
      const res = await createNote.mutateAsync({
        patientId,
        title: title.trim(),
        diagnosis: diagnosis.trim() || undefined,
        notes: notes.trim(),
      });
      toast.show(t("clinicalNote.savedToast"), "success");
      reset();
      onSaved(res?.record?.id ?? "");
    } catch (err: any) {
      toast.show(err?.message || t("clinicalNote.saveError"), "danger");
    }
  }

  function handleDismiss() {
    if (createNote.isPending) return;
    reset();
    onCancel();
  }

  return (
    <BottomSheet
      visible={visible}
      onDismiss={handleDismiss}
      title={t("consult.newNote", "New note")}
      height={560}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        <Card padded={false}>
          <View style={{ padding: spacing.md, gap: spacing.md }}>
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

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button
            title={t("clinicalNote.saveAction")}
            onPress={save}
            loading={createNote.isPending}
            icon={Save}
            size="lg"
            fullWidth
          />
          <Button
            title={t("common.cancel", "Cancel")}
            onPress={handleDismiss}
            variant="ghost"
            size="md"
            fullWidth
            disabled={createNote.isPending}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
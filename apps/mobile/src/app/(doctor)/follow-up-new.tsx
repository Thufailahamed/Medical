// @ts-nocheck

import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Save, FileText, CalendarClock } from "lucide-react-native";
import { useCreateFollowUp } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  FormField,
  TextInput,
  DateField,
  Button,
  useToast,
} from "@/components/ui";

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function NewFollowUpScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const toast = useToast();

  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  })();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<Date>(defaultDate);

  const createFollowUp = useCreateFollowUp();

  async function save() {
    if (!patientId || !title.trim() || !date) {
      toast.show(t("doctorFollowUpNew.requiredToast"), "warning");
      return;
    }
    try {
      await createFollowUp.mutateAsync({
        patientId,
        title: title.trim(),
        notes: notes.trim() || undefined,
        followUpDate: toYmd(date),
      });
      toast.show(t("doctorFollowUpNew.scheduledToast"), "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("doctorFollowUpNew.scheduleError"), "danger");
    }
  }

  if (!patientId) {
    return (
      <Screen padded>
        <ScreenHeader title={t("doctorFollowUpNew.fallbackTitle")} back onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorFollowUpNew.title")}
        subtitle={t("doctorFollowUpNew.subtitle")}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label={t("doctorFollowUpNew.titleField")} required>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t("doctorFollowUpNew.titlePlaceholder")}
                leadingIcon={CalendarClock}
              />
            </FormField>

            <FormField label={t("doctorFollowUpNew.date")} required>
              <DateField value={date} onChange={(d) => setDate(d)} />
            </FormField>

            <FormField label={t("doctorFollowUpNew.notes")}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("doctorFollowUpNew.notesPlaceholder")}
                leadingIcon={FileText}
                multiline
                numberOfLines={4}
                tone="soft"
              />
            </FormField>
          </View>
        </Card>

        <Button
          title={t("doctorFollowUpNew.scheduleAction")}
          onPress={save}
          loading={createFollowUp.isPending}
          icon={Save}
          size="lg"
        />
      </View>
    </Screen>
  );
}

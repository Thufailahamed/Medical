import { useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

function toDate(s: string): Date {
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function NewFollowUpScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
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
      toast.show("Title and date required", "warning");
      return;
    }
    try {
      await createFollowUp.mutateAsync({
        patientId,
        title: title.trim(),
        notes: notes.trim() || undefined,
        followUpDate: toYmd(date),
      });
      toast.show("Follow-up scheduled", "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Could not schedule", "danger");
    }
  }

  if (!patientId) {
    return (
      <Screen padded>
        <ScreenHeader title="Follow-up" back onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Schedule follow-up"
        subtitle="Pick a date and add context"
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <FormField label="Title" required>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., BP recheck"
                leadingIcon={CalendarClock}
              />
            </FormField>

            <FormField label="Date" required>
              <DateField value={date} onChange={(d) => setDate(d)} />
            </FormField>

            <FormField label="Notes">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Reason, instructions…"
                leadingIcon={FileText}
                multiline
                numberOfLines={4}
                tone="soft"
              />
            </FormField>
          </View>
        </Card>

        <Button
          title="Schedule follow-up"
          onPress={save}
          loading={createFollowUp.isPending}
          icon={Save}
          size="lg"
        />
      </View>
    </Screen>
  );
}
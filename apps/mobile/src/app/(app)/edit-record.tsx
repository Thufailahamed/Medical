// @ts-nocheck

import { useEffect, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Trash2,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react-native";
import {
  useMedicalRecord,
  useEditMedicalRecord,
  useDeleteMedicalRecord,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Card,
  Button,
  TextField,
  DateField,
  ScreenHeader,
  useToast,
  Skeleton,
  ErrorState,
} from "@/components/ui";
import { metaFor, type RecordType } from "@/lib/recordImportance";

const RECORD_TYPE_VALUES: RecordType[] = [
  "lab_report",
  "prescription",
  "imaging",
  "hospital_visit",
  "vaccination",
  "surgery",
  "op_note",
  "discharge_summary",
  "referral",
  "insurance",
  "pathology",
  "dental",
  "other",
];

export default function EditRecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { spacing, colors, typography, fontFamily } = useTheme();
  const toast = useToast();

  const { data: record, isLoading, isError, refetch } = useMedicalRecord(params.id);
  const updateRec = useEditMedicalRecord();
  const deleteRec = useDeleteMedicalRecord();

  const [type, setType] = useState<RecordType>("lab_report");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [diagnosis, setDiagnosis] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setType(record.recordType);
      setTitle(record.title || "");
      setDate(record.date ? new Date(record.date) : undefined);
      setDiagnosis(record.diagnosis || "");
      setSummary(record.summary || "");
      setNotes(record.notes || "");
    }
  }, [record]);

  async function save() {
    if (!title.trim()) {
      toast.show(t("editRecord.toast.titleRequired"), "warning");
      return;
    }
    setSaving(true);
    try {
      await updateRec.mutateAsync({
        id: params.id,
        recordType: type,
        title: title.trim(),
        date: date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        diagnosis: diagnosis.trim() || undefined,
        summary: summary.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.show(t("editRecord.toast.updated"), "success");
      router.back();
    } catch (err: any) {
      toast.show(
        err?.message || t("editRecord.toast.updateError"),
        "danger"
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      t("editRecord.deleteConfirm.title"),
      t("editRecord.deleteConfirm.body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("editRecord.deleteConfirm.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRec.mutateAsync(params.id);
              toast.show(t("editRecord.toast.deleted"), "success");
              router.back();
            } catch (err: any) {
              toast.show(
                err?.message || t("editRecord.toast.deleteError"),
                "danger"
              );
            }
          },
        },
      ]
    );
  }

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader
        title={t("editRecord.title")}
        subtitle={t("editRecord.subtitle")}
        onClose={() => router.back()}
      />

      <ScrollView
        style={{ backgroundColor: "#FAF9FC" }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {isLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Skeleton width="40%" height={20} radius={6} style={{ marginBottom: spacing.sm }} />
            <Skeleton width="100%" height={56} radius={12} />
            <Skeleton width="100%" height={56} radius={12} />
            <Skeleton width="100%" height={120} radius={12} />
            <Skeleton width={120} height={44} radius={22} />
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load record")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : (
          <View>
            {/* Attachment note */}
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                marginBottom: spacing.md,
              }}
            >
              <Card style={{ padding: spacing.md }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    marginBottom: spacing.xs,
                  }}
                >
                  <FileText size={16} color={colors.primary} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: "#1D1B20",
                      fontFamily: fontFamily.bodyBold,
                    }}
                  >
                    {t("editRecord.attachmentNote")}
                  </Text>
                </View>
              </Card>
            </View>

            {/* Record type chips */}
            <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: "#7F7B8C",
                  letterSpacing: 1,
                  marginBottom: spacing.xs,
                  fontFamily: fontFamily.displayBold,
                }}
              >
                {t("editRecord.recordTypeLabel").toUpperCase()}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.xs }}
              >
                {RECORD_TYPE_VALUES.map((rv) => {
                  const meta = metaFor(rv);
                  const isSel = type === rv;
                  return (
                    <Pressable
                      key={rv}
                      onPress={() => setType(rv)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 16,
                        backgroundColor: isSel ? colors.primary : "#F4F2F8",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <meta.icon
                        size={13}
                        color={isSel ? "#FFFFFF" : colors.text}
                        strokeWidth={2.25}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: isSel ? "#FFFFFF" : "#1D1B20",
                          fontFamily: isSel
                            ? fontFamily.bodyBold
                            : fontFamily.body,
                        }}
                      >
                        {t(`records.type.${rv}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Form fields */}
            <View
              style={{
                paddingHorizontal: spacing.lg,
                gap: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              <TextField
                label={t("editRecord.fields.title")}
                value={title}
                onChangeText={setTitle}
                placeholder={t("editRecord.placeholders.title")}
              />
              <DateField
                label={t("editRecord.fields.date")}
                value={date}
                onChange={setDate}
              />
              <TextField
                label={t("editRecord.fields.diagnosis")}
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholder={t("editRecord.placeholders.diagnosis")}
                helper={t("editRecord.optionalHelper")}
                multiline
              />
              <TextField
                label={t("editRecord.fields.summary")}
                value={summary}
                onChangeText={setSummary}
                placeholder={t("editRecord.placeholders.summary")}
                helper={t("editRecord.optionalHelper")}
                multiline
              />
              <TextField
                label={t("editRecord.fields.notes")}
                value={notes}
                onChangeText={setNotes}
                placeholder={t("editRecord.placeholders.notes")}
                helper={t("editRecord.optionalHelper")}
                multiline
              />
            </View>

            {/* Actions */}
            <View
              style={{
                paddingHorizontal: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <Button
                title={t("editRecord.actions.save")}
                variant="primary"
                size="lg"
                loading={saving}
                onPress={save}
                leftIcon={<CheckCircle2 size={18} color="#FFFFFF" />}
              />
              <Button
                title={t("editRecord.actions.delete")}
                variant="ghost"
                size="md"
                onPress={confirmDelete}
                leftIcon={<Trash2 size={16} color={colors.danger || "#FF3B30"} />}
                textStyle={{ color: colors.danger || "#FF3B30" }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
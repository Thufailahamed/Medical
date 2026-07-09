// @ts-nocheck

import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Upload,
  Camera,
  FileText,
  X,
  Check,
  Pill,
  AlertTriangle,
  ChevronRight,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useCreateMedicalRecord, useReadPrescription, api } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  Card,
  Button,
  Pill as PillComponent,
  TextField,
  DateField,
  ScreenHeader,
  useToast,
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

export default function AddRecordScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { spacing, colors, typography, fontFamily } = useTheme();
  const toast = useToast();

  const createRec = useCreateMedicalRecord();
  const readRx = useReadPrescription();

  // Look up this user's patient.id. Cached profile → /patients/me.
  async function getMyPatientId(): Promise<string | undefined> {
    const cached: any = queryClient.getQueryData(["patient", "me"]);
    const id =
      cached?.patient?.patients?.id || cached?.patient?.id || cached?.patientId;
    if (id) return id;
    const profile = await api<{ patient: { patients: { id: string } } }>(
      "/patients/me"
    ).catch(() => null);
    return profile?.patient?.patients?.id;
  }

  const [type, setType] = useState<RecordType>("lab_report");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  const [file, setFile] = useState<{
    uri: string;
    name: string;
    type: string;
    size: number;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [showOcrSheet, setShowOcrSheet] = useState(false);
  const [extractedMeds, setExtractedMeds] = useState<
    Array<{ name: string; dosage?: string }>
  >([]);
  const [ocrLoading, setOcrLoading] = useState(false);

  function pickImage() {
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    })
      .then((res) => {
        if (!res.canceled && res.assets[0]) {
          const a = res.assets[0];
          setFile({
            uri: a.uri,
            name: a.fileName || `photo-${Date.now()}.jpg`,
            type: a.mimeType || "image/jpeg",
            size: a.fileSize || 0,
          });
        }
      })
      .catch(() => {});
  }

  function pickDoc() {
    DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ["application/pdf", "image/*"],
    })
      .then((res) => {
        if (!res.canceled && res.assets[0]) {
          const a = res.assets[0];
          setFile({
            uri: a.uri,
            name: a.name,
            type: a.mimeType || "application/octet-stream",
            size: a.size || 0,
          });
        }
      })
      .catch(() => {});
  }

  async function submit() {
    if (!title.trim()) {
      toast.show(t("addRecord.toast.titleRequired"), "warning");
      return;
    }
    setSubmitting(true);
    try {
      let attachmentMeta: any = null;
      if (file) {
        attachmentMeta = {
          uri: file.uri,
          name: file.name,
          type: file.type,
          size: file.size,
        };
      }
      const payload: any = {
        recordType: type,
        title: title.trim(),
        date: date.toISOString().slice(0, 10),
        diagnosis: diagnosis.trim() || undefined,
        notes: notes.trim() || undefined,
        attachment: attachmentMeta,
      };
      const res = await createRec.mutateAsync(payload);
      toast.show(t("addRecord.toast.added"), "success");
      // If this was a prescription image, attempt OCR.
      if (type === "prescription" && file?.type.startsWith("image")) {
        setOcrLoading(true);
        try {
          const patientId = await getMyPatientId();
          if (!patientId) {
            // No patient profile → can't run OCR with PHI context;
            // skip silently (UX: user will see error in record-detail).
          } else {
            const r = await readRx.mutateAsync({
              recordId: res.record.id,
              imageUri: file.uri,
              mimeType: file.type,
              fileName: file.name,
              patientId,
            });
            if (r.medicines?.length) {
              setExtractedMeds(r.medicines);
              setShowOcrSheet(true);
            }
          }
        } catch {
          // Silently continue — OCR is a bonus.
        } finally {
          setOcrLoading(false);
        }
      }
      router.replace({
        pathname: "/(app)/record-detail",
        params: { id: res.record.id },
      });
    } catch (err: any) {
      toast.show(
        err?.message || t("addRecord.toast.uploadError"),
        "danger"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader
        title={t("addRecord.title")}
        back={() => router.back()}
      />

      <ScrollView
        style={{ backgroundColor: "#FAF9FC" }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Attachment card */}
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
              <Upload size={16} color={colors.primary} strokeWidth={2.25} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#1D1B20",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {t("addRecord.attachOptional")}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                color: colors.textMuted,
                marginBottom: spacing.sm,
                fontFamily: fontFamily.body,
              }}
            >
              {t("addRecord.attachHelper")}
            </Text>

            {file ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.sm,
                  borderRadius: 12,
                  backgroundColor: "#F4F2F8",
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#FFFFFF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {file.type.startsWith("image") ? (
                    <Camera size={20} color={colors.primary} />
                  ) : (
                    <FileText size={20} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#1D1B20",
                      fontFamily: fontFamily.bodyBold,
                    }}
                    numberOfLines={1}
                  >
                    {file.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      fontFamily: fontFamily.body,
                    }}
                  >
                    {(file.size / 1024).toFixed(1)} KB · {file.type}
                  </Text>
                </View>
                <Pressable onPress={() => setFile(null)} hitSlop={6}>
                  <X size={18} color={colors.danger || "#FF3B30"} />
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button
                  title={t("addRecord.chooseFile")}
                  variant="secondary"
                  size="md"
                  onPress={pickDoc}
                  style={{ flex: 1 }}
                  icon={FileText}
                />
                <Button
                  title={t("addRecord.takePhoto", "Take photo")}
                  variant="ghost"
                  size="md"
                  onPress={pickImage}
                  style={{ flex: 1 }}
                  iconRight={Camera}
                />
              </View>
            )}

            {file ? (
              <Button
                title={t("addRecord.chooseAnother")}
                variant="ghost"
                size="sm"
                onPress={() => setFile(null)}
                style={{ marginTop: spacing.xs, alignSelf: "flex-start" }}
              />
            ) : null}
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
            {t("addRecord.recordTypeLabel").toUpperCase()}
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
            label={t("addRecord.fields.title")}
            value={title}
            onChangeText={setTitle}
            placeholder={t("addRecord.placeholders.title")}
          />
          <DateField
            label={t("addRecord.fields.date")}
            value={date}
            onChange={setDate}
          />
          <TextField
            label={t("addRecord.fields.diagnosis")}
            value={diagnosis}
            onChangeText={setDiagnosis}
            placeholder={t("addRecord.placeholders.diagnosis")}
            helper={t("addRecord.optionalHelper")}
            multiline
          />
          <TextField
            label={t("addRecord.fields.notes")}
            value={notes}
            onChangeText={setNotes}
            placeholder={t("addRecord.placeholders.notes")}
            helper={t("addRecord.optionalHelper")}
            multiline
          />
        </View>

        {/* Submit */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Button
            title={t("addRecord.save")}
            variant="primary"
            size="lg"
            loading={submitting}
            onPress={submit}
          />
        </View>
      </ScrollView>

      {/* OCR sheet */}
      {showOcrSheet ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: spacing.lg,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#E6E4EA",
              marginBottom: spacing.md,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              marginBottom: spacing.xs,
            }}
          >
            <Pill size={18} color={colors.primary} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: "#1D1B20",
                fontFamily: fontFamily.displayBold,
              }}
            >
              {t("addRecord.ocrSheet.title")}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              color: colors.textMuted,
              marginBottom: spacing.sm,
              fontFamily: fontFamily.body,
            }}
          >
            {t("addRecord.ocrSheet.readMedicines", {
              count: extractedMeds.length,
            })}
          </Text>

          <View
            style={{
              gap: 6,
              marginBottom: spacing.md,
              maxHeight: 220,
            }}
          >
            {extractedMeds.map((m, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.sm,
                  borderRadius: 10,
                  backgroundColor: "#F4F2F8",
                }}
              >
                <Pill size={14} color={colors.primary} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: "#1D1B20",
                    fontFamily: fontFamily.body,
                  }}
                >
                  {m.name}
                  {m.dosage ? ` · ${m.dosage}` : ""}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title={t("addRecord.ocrSheet.skip")}
              variant="ghost"
              size="md"
              onPress={() => setShowOcrSheet(false)}
              style={{ flex: 1 }}
            />
            <Button
              title={t("addRecord.ocrSheet.addToList")}
              variant="primary"
              size="md"
              onPress={async () => {
                try {
                  // Add each OCR'd medicine to the patient's list.
                  // Sequential POSTs keep the payload shape simple.
                  const token = await (
                    await import("@/hooks/useApi")
                  ).getAuthToken();
                  const apiBase =
                    process.env.EXPO_PUBLIC_API_URL || "http://localhost:8787";
                  for (const m of extractedMeds) {
                    await fetch(`${apiBase}/medicines`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({
                        name: m.name,
                        dosage: m.dosage || undefined,
                        status: "active",
                      }),
                    });
                  }
                  toast.show(
                    t("addRecord.ocrSheet.addedMeds", {
                      count: extractedMeds.length,
                    }),
                    "success"
                  );
                  setShowOcrSheet(false);
                } catch (err: any) {
                  toast.show(
                    err?.message || t("addRecord.ocrSheet.addError"),
                    "danger"
                  );
                }
              }}
              style={{ flex: 1 }}
              rightIcon={<ChevronRight size={16} color="#FFFFFF" />}
            />
          </View>
        </View>
      ) : null}

      {ocrLoading ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : null}
    </Screen>
  );
}
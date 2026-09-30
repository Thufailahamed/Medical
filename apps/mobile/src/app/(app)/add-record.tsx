// @ts-nocheck

import { useState, type ReactNode } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
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
  ChevronRight,
  Image as ImageIcon,
  Save,
  Stethoscope,
  NotebookPen,
  Type,
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
  FormField,
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

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FormSection({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: string;
  children: ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          marginHorizontal: 4,
        }}
      >
        <Text style={[typography.overline, { color: colors.textMuted }]}>{title}</Text>
        {trailing ? (
          <Text style={[typography.caption, { color: colors.textSubtle }]}>{trailing}</Text>
        ) : null}
      </View>
      <Card padded={false}>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>{children}</View>
      </Card>
    </View>
  );
}

function SourceTile({
  icon: Icon,
  title,
  subtitle,
  onPress,
  primary,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.sm,
        borderRadius: 20,
        borderCurve: "continuous",
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: primary ? colors.primary : colors.borderStrong,
        backgroundColor: primary ? colors.primarySoft : colors.fill,
        gap: 6,
        opacity: pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: primary ? colors.primary : colors.surface,
          marginBottom: 4,
        }}
      >
        <Icon size={22} color={primary ? colors.onPrimary : colors.primary} strokeWidth={2.25} />
      </View>
      <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <Text
        style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}
        numberOfLines={2}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

export default function AddRecordScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { spacing, colors, typography, fontFamily, scheme } = useTheme();
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

  async function takePhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        // No camera access → fall back to the photo library.
        pickImage();
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (!res.canceled && res.assets[0]) {
        const a = res.assets[0];
        setFile({
          uri: a.uri,
          name: a.fileName || `photo-${Date.now()}.jpg`,
          type: a.mimeType || "image/jpeg",
          size: a.fileSize || 0,
        });
      }
    } catch {
      pickImage();
    }
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

  const selectedMeta = metaFor(type);
  const summaryParts = [
    t(`records.type.${type}`),
    date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    file ? t("addRecord.summary.withFile") : null,
  ].filter(Boolean);

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader title={t("addRecord.title")} back={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
      >
        {/* ─── Attachment ─── */}
        <FormSection
          title={t("addRecord.sections.attachment")}
          trailing={t("addRecord.optionalHelper")}
        >
          {file ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: 18,
                borderCurve: "continuous",
                backgroundColor: colors.successSoft,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {file.type.startsWith("image") ? (
                  <ImageIcon size={20} color={colors.success} strokeWidth={2.25} />
                ) : (
                  <FileText size={20} color={colors.success} strokeWidth={2.25} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.title.xs, { color: colors.text }]} numberOfLines={1}>
                  {file.name}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Check size={12} color={colors.success} strokeWidth={3} />
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {formatSize(file.size)}
                    {formatSize(file.size) ? " · " : ""}
                    {t("addRecord.fileReady")}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setFile(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("addRecord.removeFile")}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                }}
              >
                <X size={16} color={colors.textMuted} strokeWidth={2.5} />
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <SourceTile
                icon={Camera}
                title={t("addRecord.takePhoto", "Take photo")}
                subtitle={t("addRecord.takePhotoHelper")}
                onPress={takePhoto}
                primary
              />
              <SourceTile
                icon={Upload}
                title={t("addRecord.chooseFile")}
                subtitle={t("addRecord.chooseFileHelper")}
                onPress={pickDoc}
              />
            </View>
          )}
          <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center" }]}>
            {t("addRecord.attachHelper")}
          </Text>
        </FormSection>

        {/* ─── Record type ─── */}
        <FormSection title={t("addRecord.sections.type")}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {RECORD_TYPE_VALUES.map((rv) => {
              const meta = metaFor(rv);
              const isSel = type === rv;
              return (
                <Pressable
                  key={rv}
                  onPress={() => setType(rv)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSel }}
                  style={({ pressed }) => ({
                    paddingLeft: 6,
                    paddingRight: 14,
                    height: 40,
                    borderRadius: 20,
                    borderCurve: "continuous",
                    backgroundColor: isSel ? colors.primarySoft : colors.fill,
                    borderWidth: 1.5,
                    borderColor: isSel ? colors.primary : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSel ? colors.primary : colors.surface,
                    }}
                  >
                    <meta.icon
                      size={14}
                      color={isSel ? colors.onPrimary : colors.textMuted}
                      strokeWidth={2.25}
                    />
                  </View>
                  <Text
                    style={[
                      typography.label.md,
                      { color: isSel ? colors.primary : colors.text },
                    ]}
                  >
                    {t(`records.type.${rv}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        {/* ─── Details ─── */}
        <FormSection title={t("addRecord.sections.details")}>
          <FormField label={t("addRecord.fields.title")} required>
            <TextField
              value={title}
              onChangeText={setTitle}
              placeholder={t("addRecord.placeholders.title")}
              leadingIcon={Type}
              tone="soft"
              returnKeyType="next"
            />
          </FormField>
          <FormField label={t("addRecord.fields.date")}>
            <DateField value={date} onChange={setDate} maximumDate={new Date()} />
          </FormField>
          <FormField
            label={t("addRecord.fields.diagnosis")}
            helper={t("addRecord.optionalHelper")}
          >
            <TextField
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder={t("addRecord.placeholders.diagnosis")}
              leadingIcon={Stethoscope}
              tone="soft"
            />
          </FormField>
          <FormField
            label={t("addRecord.fields.notes")}
            helper={t("addRecord.optionalHelper")}
          >
            <TextField
              value={notes}
              onChangeText={setNotes}
              placeholder={t("addRecord.placeholders.notes")}
              leadingIcon={NotebookPen}
              tone="soft"
              multiline
              numberOfLines={3}
              style={{ minHeight: 84, textAlignVertical: "top" }}
            />
          </FormField>
        </FormSection>
      </ScrollView>

      {/* Sticky footer: live summary + save */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          gap: spacing.md,
          backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primarySoft,
            }}
          >
            <selectedMeta.icon size={18} color={colors.primary} strokeWidth={2.25} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
              {title.trim() || t("addRecord.summary.untitled")}
            </Text>
            <Text
              style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}
              numberOfLines={1}
            >
              {summaryParts.join(" · ")}
            </Text>
          </View>
        </View>
        <Button
          title={t("addRecord.save")}
          variant="primary"
          size="lg"
          icon={Save}
          loading={submitting}
          onPress={submit}
        />
      </View>

      {/* OCR sheet */}
      {showOcrSheet ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderCurve: "continuous",
            padding: spacing.lg,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: scheme === "dark" ? 0 : 0.12,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.fillStrong,
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
              style={[typography.title.lg, { color: colors.text }]}
            >
              {t("addRecord.ocrSheet.title")}
            </Text>
          </View>
          <Text
            style={[typography.body.sm, { color: colors.textMuted, marginBottom: spacing.md }]}
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
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                }}
              >
                <Pill size={14} color={colors.primary} />
                <Text
                  style={[typography.body.md, { flex: 1, color: colors.text }]}
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
                  const { api } = await import("@/lib/api");
                  for (const m of extractedMeds) {
                    await api("/medicines", {
                      method: "POST",
                      body: {
                        name: m.name,
                        dosage: m.dosage || undefined,
                        status: "active",
                      },
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
            backgroundColor: colors.scrim,
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
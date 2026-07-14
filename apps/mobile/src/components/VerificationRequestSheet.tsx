// @ts-nocheck
// apps/mobile/src/components/VerificationRequestSheet.tsx
//
// Caretaker Profiles: Verified Caretaker Tier — request sheet.
//
// Two-step flow: pick a document type → upload the image → submit
// the request. Image upload goes through the existing /files/upload
// endpoint (caretakers are auth-only there, no requireRole). The
// returned file.id is passed into /caretaker/verification/request.

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { BadgeCheck, Upload, X } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  BottomSheet,
  Button,
  FormField,
  Chip,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useRequestVerification } from "@/hooks/useCaretakerVerification";

type DocumentType = "nic" | "passport" | "drivers_license" | "other";

const DOC_TYPES: DocumentType[] = ["nic", "passport", "drivers_license", "other"];

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

type UploadedFile = {
  uri: string;
  name: string;
  type: string;
  size: number;
};

export function VerificationRequestSheet({ visible, onDismiss }: Props) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const request = useRequestVerification();

  const [documentType, setDocumentType] = useState<DocumentType>("nic");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setDocumentType("nic");
    setFile(null);
    setUploading(false);
    setSubmitting(false);
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  async function pickFile() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      setFile({
        uri: a.uri,
        name: a.fileName || `id-${Date.now()}.jpg`,
        type: a.mimeType || "image/jpeg",
        size: a.fileSize || 0,
      });
    } catch {
      toast.show(
        t("caretaker.verification.requestFailed"),
        "danger"
      );
    }
  }

  async function uploadAndSubmit() {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file as any);
      const uploadRes = await api<{ file: { id: string } }>("/files/upload", {
        method: "POST",
        body: fd,
        isFormData: true,
      });
      setUploading(false);

      if (!uploadRes?.file?.id) {
        throw new Error("Upload missing file id");
      }

      setSubmitting(true);
      await request.mutateAsync({
        documentType,
        documentFileId: uploadRes.file.id,
      });
      toast.show(
        t("caretaker.verification.pending"),
        "success"
      );
      handleDismiss();
    } catch (err: any) {
      setUploading(false);
      setSubmitting(false);
      toast.show(
        err?.message || t("caretaker.verification.requestFailed"),
        "danger"
      );
    }
  }

  return (
    <BottomSheet visible={visible} onDismiss={handleDismiss}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <BadgeCheck size={20} color={colors.primary} />
          <Text style={{ ...typography.h3, color: colors.text, flex: 1 }}>
            {t("caretaker.verification.sheetTitle")}
          </Text>
        </View>
        <Text style={{ ...typography.bodySmall, color: colors.textSecondary }}>
          {t("caretaker.verification.sheetHelper")}
        </Text>

        <FormField label={t("caretaker.verification.documentTypeLabel")}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {DOC_TYPES.map((dt) => (
              <Chip
                key={dt}
                label={t(`caretaker.verification.documentType.${dt}`)}
                selected={documentType === dt}
                onPress={() => setDocumentType(dt)}
              />
            ))}
          </View>
        </FormField>

        <FormField label={t("caretaker.verification.uploadCta")}>
          {file ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Upload size={16} color={colors.primary} />
              <Text
                style={{
                  ...typography.bodySmall,
                  color: colors.text,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {file.name}
              </Text>
              <Button
                label=""
                icon={<X size={14} color={colors.textSecondary} />}
                onPress={() => setFile(null)}
                variant="ghost"
                compact
              />
            </View>
          ) : (
            <Button
              label={t("caretaker.verification.uploadCta")}
              icon={<Upload size={16} />}
              onPress={pickFile}
              variant="outline"
              fullWidth
            />
          )}
          {file ? (
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                marginTop: spacing.xs,
              }}
            >
              {t("caretaker.verification.uploadedHint")}
            </Text>
          ) : null}
        </FormField>

        <Button
          label={
            submitting
              ? t("caretaker.verification.submitting")
              : t("caretaker.verification.submitCta")
          }
          onPress={uploadAndSubmit}
          disabled={!file || uploading || submitting}
          loading={uploading || submitting}
          icon={<BadgeCheck size={16} />}
          fullWidth
        />
      </ScrollView>
    </BottomSheet>
  );
}

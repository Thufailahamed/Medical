// @ts-nocheck
// Submit reimbursement claim. Treatment details + amount + real document
// upload via expo-document-picker / expo-image-picker → /files/upload.

import { useState } from "react";
import { View, Text, ScrollView, TextInput, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Upload,
  FilePlus,
  Camera,
  FileText,
  X,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  SectionHeader,
  Chip,
  ChipGroup,
  Pill,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useMyInsuranceEnrollments,
  useCreateInsuranceClaim,
  useSubmitInsuranceClaim,
  useUploadFile,
} from "@/hooks/useApi";

const TREATMENTS = [
  "hospitalization",
  "day_care",
  "opd",
  "dental",
  "diagnostic",
  "maternity",
] as const;

const DOC_KINDS = [
  "bill",
  "discharge_summary",
  "prescription",
  "lab_report",
  "id_proof",
] as const;

type DocKind = (typeof DOC_KINDS)[number];

type AttachedDoc = {
  kind: DocKind;
  fileKey: string;
  fileName: string;
  contentType: string;
};

export default function NewClaim() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, typography, radius } = useTheme();
  const fieldStyle = {
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    borderCurve: "continuous" as const,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.text,
    ...typography.body.md,
  };
  const { data: enrollmentsData } = useMyInsuranceEnrollments();
  const createMut = useCreateInsuranceClaim();
  const submitMut = useSubmitInsuranceClaim();
  const uploadMut = useUploadFile();

  const activeEnrollments = (enrollmentsData?.enrollments ?? []).filter(
    (e: any) => e.status === "active",
  );

  const [enrollmentId, setEnrollmentId] = useState<string | undefined>(
    activeEnrollments[0]?.id,
  );
  const [treatmentType, setTreatmentType] = useState<typeof TREATMENTS[number]>(
    "hospitalization",
  );
  const [facility, setFacility] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [docs, setDocs] = useState<AttachedDoc[]>([]);
  const [pendingDocKind, setPendingDocKind] = useState<DocKind>("bill");

  const uploadOne = async (
    file: { uri: string; name: string; mimeType: string | null },
  ): Promise<AttachedDoc | null> => {
    const fd: any = {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    };
    const res: any = await uploadMut.mutateAsync({
      file: fd,
    } as any);
    const f = res?.file ?? res;
    if (!f?.r2Key) {
      Alert.alert(
        t("common.error") || "Error",
        t("insurance.claim.uploadFailed") || "Upload failed",
      );
      return null;
    }
    return {
      kind: pendingDocKind,
      fileKey: f.r2Key,
      fileName: f.fileName ?? file.name,
      contentType: f.mimeType ?? file.mimeType ?? "application/octet-stream",
    };
  };

  const onPickDocument = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/heic",
          "image/webp",
        ],
      });
      if (pick.canceled || !pick.assets?.[0]) return;
      const a = pick.assets[0];
      const uploaded = await uploadOne({
        uri: a.uri,
        name: a.name ?? `document-${Date.now()}.pdf`,
        mimeType: a.mimeType ?? "application/pdf",
      });
      if (uploaded) setDocs((prev) => [...prev, uploaded]);
    } catch (err: any) {
      Alert.alert(
        t("common.error") || "Error",
        err?.message || "Pick failed",
      );
    }
  };

  const onTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t("insurance.claim.cameraDenied") || "Camera denied",
          t("insurance.claim.cameraDeniedDetail") ||
            "Allow camera access to attach a photo.",
        );
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (shot.canceled || !shot.assets?.[0]) return;
      const a = shot.assets[0];
      const uploaded = await uploadOne({
        uri: a.uri,
        name: `claim-photo-${Date.now()}.jpg`,
        mimeType: a.mimeType ?? "image/jpeg",
      });
      if (uploaded) setDocs((prev) => [...prev, uploaded]);
    } catch (err: any) {
      Alert.alert(
        t("common.error") || "Error",
        err?.message || "Camera failed",
      );
    }
  };

  const removeDoc = (idx: number) => {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async () => {
    if (!enrollmentId || !amount) return;
    const created = await createMut.mutateAsync({
      enrollmentId,
      treatmentType,
      incurringFacility: facility || undefined,
      diagnosis: diagnosis || undefined,
      admissionDate: admissionDate || undefined,
      dischargeDate: dischargeDate || undefined,
      amountRequestedLkr: Number(amount),
      patientRemarks: remarks || undefined,
      documents: docs.map((d) => ({
        kind: d.kind,
        fileKey: d.fileKey,
        fileName: d.fileName,
        contentType: d.contentType,
      })),
    });
    await submitMut.mutateAsync(created.claim.id);
    router.replace(`/insurance/claims/${created.claim.id}`);
  };

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.claim.new")}
        subtitle=""
        kicker={t("insurance.claim.kicker")}
      />

      <ScrollView
        contentContainerStyle={{ paddingVertical: 12, gap: 14, paddingBottom: 120 }}
      >
        <SectionHeader title={t("insurance.claim.policy")} />
        <Card style={{ padding: 16, gap: 8 }}>
          {activeEnrollments.length === 0 ? (
            <AppText size="sm" color="muted">
              {t("insurance.claim.noActivePolicy")}
            </AppText>
          ) : (
            <ChipGroup>
              {activeEnrollments.map((e: any) => (
                <Chip
                  key={e.id}
                  label={
                    e.policyNumber ??
                    t("insurance.policy.policyNumber")
                  }
                  selected={enrollmentId === e.id}
                  onPress={() => setEnrollmentId(e.id)}
                />
              ))}
            </ChipGroup>
          )}
        </Card>

        <SectionHeader title={t("insurance.claim.treatment")} />
        <Card style={{ padding: 20, gap: 18 }}>
          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.claim.treatmentType")}
            </AppText>
            <ChipGroup>
              {TREATMENTS.map((tt) => (
                <Chip
                  key={tt}
                  label={t(`insurance.claim.treatments.${tt}`)}
                  selected={treatmentType === tt}
                  onPress={() => setTreatmentType(tt)}
                />
              ))}
            </ChipGroup>
          </View>

          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.claim.facility")}
            </AppText>
            <TextInput
              value={facility}
              onChangeText={setFacility}
              placeholder={t("insurance.claim.facilityPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={{
                ...fieldStyle,
              }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <AppText size="sm" weight="600" color="muted">
                {t("insurance.claim.admissionDate")}
              </AppText>
              <TextInput
                value={admissionDate}
                onChangeText={setAdmissionDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                placeholderTextColor={colors.textSubtle}
                style={{
                  ...fieldStyle,
                }}
              />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <AppText size="sm" weight="600" color="muted">
                {t("insurance.claim.dischargeDate")}
              </AppText>
              <TextInput
                value={dischargeDate}
                onChangeText={setDischargeDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                placeholderTextColor={colors.textSubtle}
                style={{
                  ...fieldStyle,
                }}
              />
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.claim.diagnosis")}
            </AppText>
            <TextInput
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder={t("insurance.claim.diagnosisPlaceholder")}
              multiline
              placeholderTextColor={colors.textSubtle}
              style={{
                ...fieldStyle,
                minHeight: 88,
                paddingTop: 12,
                textAlignVertical: "top",
              }}
            />
          </View>

          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.claim.amount")}
            </AppText>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSubtle}
              style={{
                ...fieldStyle,
              }}
            />
          </View>

          <View style={{ gap: 8 }}>
            <AppText size="sm" weight="600" color="muted">
              {t("insurance.claim.remarks")}
            </AppText>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              multiline
              placeholderTextColor={colors.textSubtle}
              style={{
                ...fieldStyle,
                minHeight: 88,
                paddingTop: 12,
                textAlignVertical: "top",
              }}
            />
          </View>
        </Card>

        <SectionHeader title={t("insurance.claim.documents")} />
        <Card style={{ padding: 20, gap: 14 }}>
          <AppText size="xs" color="muted">
            {t("insurance.claim.docKindHint") ||
              "Pick the document type before adding."}
          </AppText>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {DOC_KINDS.map((d) => (
              <Chip
                key={d}
                label={t(`insurance.claim.docKinds.${d}`)}
                selected={pendingDocKind === d}
                onPress={() => setPendingDocKind(d)}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              variant="secondary"
              label={t("insurance.claim.uploadDoc") || "Upload file"}
              icon={Upload}
              onPress={onPickDocument}
              loading={uploadMut.isPending}
              style={{ flex: 1 }}
            />
            <Button
              variant="secondary"
              label={t("insurance.claim.takePhoto") || "Photo"}
              icon={Camera}
              onPress={onTakePhoto}
              loading={uploadMut.isPending}
              style={{ flex: 1 }}
            />
          </View>
          {docs.length === 0 ? (
            <AppText size="xs" color="muted">
              {t("insurance.claim.noDocs") || "No documents attached yet."}
            </AppText>
          ) : (
            docs.map((d, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 14,
                  borderCurve: "continuous",
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileText size={15} color={colors.primary} strokeWidth={2.3} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText size="sm" weight="600">
                    {t(`insurance.claim.docKinds.${d.kind}`)}
                  </AppText>
                  <AppText size="xs" color="muted" numberOfLines={1}>
                    {d.fileName}
                  </AppText>
                </View>
                <Pill
                  tone="neutral"
                  onPress={() => removeDoc(i)}
                  style={{ paddingHorizontal: 6 }}
                >
                  <X size={12} color={colors.textMuted} />
                </Pill>
              </View>
            ))
          )}
        </Card>

        <Button
          label={t("insurance.claim.submit")}
          size="lg"
          onPress={onSubmit}
          disabled={!enrollmentId || !amount}
          loading={createMut.isPending || submitMut.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

// Theme-aware text used by this screen: maps the terse size/weight/color
// props onto typography tokens + theme colours so text stays legible in dark
// mode (the shared AppText hard-codes light-mode hex colours).
function AppText({
  size,
  weight,
  color,
  style,
  ...rest
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  weight?: string;
  color?: "muted" | "subtle" | "primary" | "accent" | "danger" | "text";
  style?: any;
  [key: string]: any;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const tone =
    color === "muted"
      ? colors.textMuted
      : color === "subtle"
        ? colors.textSubtle
        : color === "primary"
          ? colors.primary
          : color === "accent"
            ? colors.accent
            : color === "danger"
              ? colors.danger
              : colors.text;
  const bold = weight === "700" || weight === "800" || weight === "900" || weight === "bold";
  const semi = weight === "600" || weight === "500";
  const base =
    size === "2xl"
      ? typography.display.md
      : size === "xl"
        ? typography.display.sm
        : size === "lg"
          ? bold
            ? typography.title.lg
            : typography.body.lg
          : size === "md"
            ? bold
              ? typography.title.md
              : typography.body.md
            : size === "xs"
              ? typography.caption
              : bold
                ? typography.title.xs
                : typography.body.sm;
  const family = bold
    ? size === "xl" || size === "2xl" || size === "lg" || size === "md"
      ? base.fontFamily
      : fontFamily.bodyBold
    : semi
      ? fontFamily.bodySemibold
      : base.fontFamily;
  return (
    <Text
      {...rest}
      style={[{ ...base, fontFamily: family, color: tone }, style]}
    />
  );
}

// @ts-nocheck
// Submit reimbursement claim. Treatment details + amount + real document
// upload via expo-document-picker / expo-image-picker → /files/upload.

import { useState } from "react";
import { View, Text, ScrollView, TextInput, Alert, StyleSheet, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Camera,
  CheckCircle2,
  Circle,
  FileText,
  Send,
  Upload,
  X,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  SectionHeader,
  Chip,
  DateField,
  IconTile,
  Pressable,
} from "@/components/ui";
import {
  PolicyPicker,
  TreatmentGrid,
  formatLkr,
  type TreatmentType,
} from "@/components/insurance/ClaimFormParts";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useMyInsuranceEnrollments,
  useCreateInsuranceClaim,
  useSubmitInsuranceClaim,
  useUploadFile,
} from "@/hooks/useApi";

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

// Treatments with an overnight stay: ask for a discharge date + summary.
const INPATIENT: TreatmentType[] = ["hospitalization", "maternity"];

const toIsoDate = (d?: Date) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : undefined;

export default function NewClaim() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, typography, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const fieldShell = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    borderCurve: "continuous" as const,
    paddingHorizontal: 14,
    minHeight: 52,
  };
  const multilineStyle = {
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    borderCurve: "continuous" as const,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 92,
    textAlignVertical: "top" as const,
    color: colors.text,
    ...typography.body.md,
  };

  const enrollmentsQ = useMyInsuranceEnrollments();
  const createMut = useCreateInsuranceClaim();
  const submitMut = useSubmitInsuranceClaim();
  const uploadMut = useUploadFile();

  const activeEnrollments = (enrollmentsQ.data?.enrollments ?? []).filter(
    (e: any) => e.status === "active",
  );

  const [enrollmentId, setEnrollmentId] = useState("");
  const effectiveEnrollmentId = enrollmentId || activeEnrollments[0]?.id || "";
  const [treatmentType, setTreatmentType] = useState<TreatmentType>("hospitalization");
  const [facility, setFacility] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [admissionDate, setAdmissionDate] = useState<Date | undefined>();
  const [dischargeDate, setDischargeDate] = useState<Date | undefined>();
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [docs, setDocs] = useState<AttachedDoc[]>([]);
  const [pendingDocKind, setPendingDocKind] = useState<DocKind>("bill");
  const [uploadingVia, setUploadingVia] = useState<"file" | "camera" | null>(null);

  const inpatient = INPATIENT.includes(treatmentType);
  const amountNum = Number(amount) || 0;
  const canSubmit = !!effectiveEnrollmentId && amountNum > 0;
  const requiredDocs: DocKind[] = inpatient ? ["bill", "discharge_summary"] : ["bill"];

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
      setUploadingVia("file");
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
    } finally {
      setUploadingVia(null);
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
      setUploadingVia("camera");
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
    } finally {
      setUploadingVia(null);
    }
  };

  const removeDoc = (idx: number) => {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    const created = await createMut.mutateAsync({
      enrollmentId: effectiveEnrollmentId,
      treatmentType,
      incurringFacility: facility || undefined,
      diagnosis: diagnosis || undefined,
      admissionDate: toIsoDate(admissionDate),
      dischargeDate: inpatient ? toIsoDate(dischargeDate) : undefined,
      amountRequestedLkr: amountNum,
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

  const step = (n: number) => t("insurance.coverage.step", { n, defaultValue: "Step {{n}}" });

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.claim.new")}
        subtitle={t("insurance.claim.newSubtitle", "Get reimbursed for treatment you've paid for.")}
        kicker={t("insurance.claim.kicker")}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Policy ─────────────────────────────────────────── */}
        <SectionHeader kicker={step(1)} title={t("insurance.claim.policy")} />
        <PolicyPicker
          enrollments={activeEnrollments}
          selectedId={effectiveEnrollmentId}
          onSelect={setEnrollmentId}
          loading={enrollmentsQ.isLoading}
          emptyMessage={t("insurance.claim.noActivePolicy")}
        />

        {/* ── Treatment ──────────────────────────────────────── */}
        <SectionHeader kicker={step(2)} title={t("insurance.claim.treatmentType")} />
        <TreatmentGrid
          value={treatmentType}
          onChange={setTreatmentType}
          labelFor={(k) => t(`insurance.claim.treatments.${k}`)}
        />

        {/* ── Details ────────────────────────────────────────── */}
        <SectionHeader kicker={step(3)} title={t("insurance.claim.treatment")} />
        <Card style={{ padding: 18, gap: 18 }}>
          <Field label={t("insurance.claim.facility")}>
            <View style={fieldShell}>
              <Building2 size={18} color={colors.textSubtle} strokeWidth={2} />
              <TextInput
                value={facility}
                onChangeText={setFacility}
                placeholder={t("insurance.claim.facilityPlaceholder")}
                placeholderTextColor={colors.textSubtle}
                style={{ flex: 1, ...typography.body.md, color: colors.text, paddingVertical: 0 }}
              />
            </View>
          </Field>

          <Field label={t("insurance.claim.admissionDate")}>
            <DateField
              value={admissionDate}
              onChange={setAdmissionDate}
              maximumDate={new Date()}
              placeholder={t("insurance.claim.pickDate", "Select date")}
            />
          </Field>

          {inpatient ? (
            <Field label={t("insurance.claim.dischargeDate")}>
              <DateField
                value={dischargeDate}
                onChange={setDischargeDate}
                minimumDate={admissionDate}
                maximumDate={new Date()}
                placeholder={t("insurance.claim.pickDate", "Select date")}
              />
            </Field>
          ) : null}

          <Field label={t("insurance.claim.diagnosis")}>
            <TextInput
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder={t("insurance.claim.diagnosisPlaceholder")}
              multiline
              placeholderTextColor={colors.textSubtle}
              style={multilineStyle}
            />
          </Field>
        </Card>

        {/* ── Amount ─────────────────────────────────────────── */}
        <SectionHeader kicker={step(4)} title={t("insurance.claim.amount")} />
        <Card style={{ padding: 18, gap: 8 }}>
          <View style={[fieldShell, { minHeight: 64 }]}>
            <AppText weight="700" size="md" color="subtle">
              LKR
            </AppText>
            <TextInput
              value={amount ? formatLkr(amountNum) : ""}
              onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, "").slice(0, 10))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSubtle}
              style={{ flex: 1, ...typography.display.sm, color: colors.text, paddingVertical: 0 }}
            />
          </View>
          <AppText size="xs" color="subtle">
            {t("insurance.claim.amountHint", "Enter the total on your final bill.")}
          </AppText>
        </Card>

        {/* ── Documents ──────────────────────────────────────── */}
        <SectionHeader
          kicker={step(5)}
          title={t("insurance.claim.documents")}
          count={docs.length || undefined}
        />
        <Card style={{ padding: 18, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <AppText size="xs" weight="600" color="muted">
              {t("insurance.claim.required", "Required for review")}
            </AppText>
            {requiredDocs.map((k) => {
              const done = docs.some((d) => d.kind === k);
              const Icon = done ? CheckCircle2 : Circle;
              return (
                <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Icon size={18} color={done ? colors.accent : colors.textSubtle} strokeWidth={2.2} />
                  <AppText
                    size="sm"
                    weight={done ? "600" : undefined}
                    color={done ? "text" : "muted"}
                  >
                    {t(`insurance.claim.docKinds.${k}`)}
                  </AppText>
                </View>
              );
            })}
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />

          <View style={{ gap: 10 }}>
            <AppText size="xs" weight="600" color="muted">
              {t("insurance.claim.docKindHint", "Pick the document type before adding.")}
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -18 }}
              contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}
            >
              {DOC_KINDS.map((d) => (
                <Chip
                  key={d}
                  label={t(`insurance.claim.docKinds.${d}`)}
                  selected={pendingDocKind === d}
                  onPress={() => setPendingDocKind(d)}
                />
              ))}
            </ScrollView>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <UploadTile
              icon={Upload}
              label={t("insurance.claim.uploadDoc", "Upload file")}
              sub={t("insurance.claim.uploadDocSub", "PDF or image")}
              busy={uploadingVia === "file"}
              disabled={!!uploadingVia}
              onPress={onPickDocument}
            />
            <UploadTile
              icon={Camera}
              label={t("insurance.claim.takePhoto", "Take photo")}
              sub={t("insurance.claim.takePhotoSub", "Scan a paper bill")}
              busy={uploadingVia === "camera"}
              disabled={!!uploadingVia}
              onPress={onTakePhoto}
            />
          </View>

          {docs.map((d, i) => (
            <View
              key={`${d.fileKey}-${i}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 10,
                backgroundColor: colors.well,
                borderRadius: radius.field,
                borderCurve: "continuous",
              }}
            >
              <IconTile icon={FileText} tone="primary" size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText size="sm" weight="600">
                  {t(`insurance.claim.docKinds.${d.kind}`)}
                </AppText>
                <AppText size="xs" color="muted" numberOfLines={1}>
                  {d.fileName}
                </AppText>
              </View>
              <Pressable
                haptic="light"
                onPress={() => removeDoc(i)}
                accessibilityRole="button"
                accessibilityLabel={t("common.remove", "Remove")}
                hitSlop={8}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                }}
              >
                <X size={14} color={colors.textMuted} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
        </Card>

        {/* ── Notes ──────────────────────────────────────────── */}
        <SectionHeader title={t("insurance.claim.remarks")} />
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
          multiline
          placeholder={t("insurance.claim.remarksPlaceholder", "Optional — anything the reviewer should know")}
          placeholderTextColor={colors.textSubtle}
          style={{ ...multilineStyle, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline }}
        />
      </ScrollView>

      {/* ── Sticky submit ────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <AppText size="xs" color="subtle">
            {t("insurance.claim.claiming", "Claiming")}
          </AppText>
          <AppText weight="700" size="md" numberOfLines={1}>
            LKR {formatLkr(amountNum)}
          </AppText>
        </View>
        <Button
          title={t("insurance.claim.submit")}
          icon={Send}
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={createMut.isPending || submitMut.isPending}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <AppText size="sm" weight="600" color="muted">
        {label}
      </AppText>
      {children}
    </View>
  );
}

function UploadTile({ icon, label, sub, busy, disabled, onPress }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      haptic="light"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      wrapperStyle={{ flex: 1 }}
      style={{
        alignItems: "center",
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
        opacity: disabled && !busy ? 0.5 : 1,
      }}
    >
      {busy ? (
        <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <IconTile icon={icon} tone="primary" appearance="solid" size={40} />
      )}
      <AppText size="sm" weight="600" color="primary" numberOfLines={1}>
        {label}
      </AppText>
      <AppText size="xs" color="muted" numberOfLines={1}>
        {sub}
      </AppText>
    </Pressable>
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

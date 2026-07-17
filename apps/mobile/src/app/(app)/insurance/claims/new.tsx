// @ts-nocheck
// Submit reimbursement claim. Treatment details + amount + file refs.

import { useState } from "react";
import { View, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Upload, FilePlus } from "lucide-react-native";
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
import { AppText } from "@/components/ui/AppText";
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

const DOC_KINDS = ["bill", "discharge_summary", "prescription", "lab_report", "id_proof"] as const;

export default function NewClaim() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
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
  const [docs, setDocs] = useState<Array<{ kind: typeof DOC_KINDS[number]; fileKey: string }>>(
    [],
  );
  const [pendingDocKind, setPendingDocKind] = useState<typeof DOC_KINDS[number]>("bill");

  const onAddDoc = async () => {
    // Native file picker not wired — placeholder fileKey from URL hash placeholder.
    const fakeKey = `pending-${Date.now()}`;
    setDocs((prev) => [...prev, { kind: pendingDocKind, fileKey: fakeKey }]);
    uploadMut.reset();
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
      documents: docs,
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

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
        <SectionHeader title={t("insurance.claim.policy")} />
        <Card style={{ padding: 12, gap: 8 }}>
          {activeEnrollments.length === 0 ? (
            <AppText size="sm" color="muted">
              {t("insurance.claim.noActivePolicy")}
            </AppText>
          ) : (
            <ChipGroup>
              {activeEnrollments.map((e: any) => (
                <Chip
                  key={e.id}
                  label={e.policyNumber ?? t("insurance.policy.policyNumber")}
                  selected={enrollmentId === e.id}
                  onPress={() => setEnrollmentId(e.id)}
                />
              ))}
            </ChipGroup>
          )}
        </Card>

        <SectionHeader title={t("insurance.claim.treatment")} />
        <Card style={{ padding: 16, gap: 12 }}>
          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
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

          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.claim.facility")}
            </AppText>
            <TextInput
              value={facility}
              onChangeText={setFacility}
              placeholder={t("insurance.claim.facilityPlaceholder")}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
              }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <AppText size="sm" color="muted">
                {t("insurance.claim.admissionDate")}
              </AppText>
              <TextInput
                value={admissionDate}
                onChangeText={setAdmissionDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  padding: 12,
                  color: colors.text,
                }}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <AppText size="sm" color="muted">
                {t("insurance.claim.dischargeDate")}
              </AppText>
              <TextInput
                value={dischargeDate}
                onChangeText={setDischargeDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  padding: 12,
                  color: colors.text,
                }}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.claim.diagnosis")}
            </AppText>
            <TextInput
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder={t("insurance.claim.diagnosisPlaceholder")}
              multiline
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
                minHeight: 70,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.claim.amount")}
            </AppText>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <AppText size="sm" color="muted">
              {t("insurance.claim.remarks")}
            </AppText>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              multiline
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
                minHeight: 70,
              }}
            />
          </View>
        </Card>

        <SectionHeader title={t("insurance.claim.documents")} />
        <Card style={{ padding: 16, gap: 10 }}>
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
          <Button
            variant="outline"
            label={t("insurance.claim.uploadDoc")}
            leftIcon={<Upload size={14} />}
            onPress={onAddDoc}
            loading={uploadMut.isPending}
          />
          {docs.map((d, i) => (
            <Pill key={i} tone="primary" icon={<FilePlus size={12} />}>
              {t(`insurance.claim.docKinds.${d.kind}`)} · {d.fileKey.slice(0, 16)}
            </Pill>
          ))}
        </Card>

        <Button
          label={t("insurance.claim.submit")}
          onPress={onSubmit}
          disabled={!enrollmentId || !amount}
          loading={createMut.isPending || submitMut.isPending}
        />
      </ScrollView>
    </Screen>
  );
}
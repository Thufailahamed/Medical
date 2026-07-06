// @ts-nocheck

// Phase 3.1 slice 2 — Prescription detail + PDF download.
// Mirrors the visual rhythm of record-detail.tsx (header → meta card
// → content cards → primary action) so doctors don't learn a new
// pattern. The download button is the same `downloadPrescriptionPdf`
// helper that the list-screen row icon uses.

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  Pill,
  Stethoscope,
  Download,
  FileText,
  CalendarDays,
  IdCard,
  ShieldCheck,
  ScanLine,
  XCircle,
  PackageCheck,
} from "lucide-react-native";
import {
  useDoctorPrescription,
  downloadPrescriptionPdf,
  useSignPrescription,
  useCancelPrescription,
  useDispensePrescription,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  EmptyState,
  TextInput,
  BottomSheet,
  useToast,
} from "@/components/ui";

export default function PrescriptionDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useDoctorPrescription(id);
  const [downloading, setDownloading] = useState(false);
  const signMutation = useSignPrescription();
  const cancelMutation = useCancelPrescription();
  const dispenseMutation = useDispensePrescription();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const rx = data?.prescription;
  const patient = rx?.patient;
  const status: string = rx?.status ?? "draft";
  const isDraft = status === "draft";
  const isSigned = status === "signed";
  // Cancel is allowed from draft or signed; dispense only from signed.
  const canCancel = isDraft || isSigned;

  async function onSign() {
    if (!id) return;
    try {
      await signMutation.mutateAsync({ id });
      toast.show(t("doctorPrescriptionDetail.signedToast"), "success");
    } catch (err: any) {
      toast.show(
        err?.message ?? t("doctorPrescriptionDetail.signError"),
        "danger"
      );
    }
  }

  async function onCancelConfirm() {
    if (!id) return;
    try {
      await cancelMutation.mutateAsync({
        id,
        reason: cancelReason.trim() || undefined,
      });
      setCancelOpen(false);
      setCancelReason("");
      toast.show(t("doctorPrescriptionDetail.cancelledToast"), "success");
    } catch (err: any) {
      toast.show(
        err?.message ?? t("doctorPrescriptionDetail.cancelError"),
        "danger"
      );
    }
  }

  async function onDispense() {
    if (!id) return;
    try {
      await dispenseMutation.mutateAsync({ id });
      toast.show(t("doctorPrescriptionDetail.dispensedToast"), "success");
    } catch (err: any) {
      toast.show(
        err?.message ?? t("doctorPrescriptionDetail.dispenseError"),
        "danger"
      );
    }
  }

  async function onDownload() {
    if (!id) return;
    setDownloading(true);
    try {
      await downloadPrescriptionPdf(id);
    } catch (err: any) {
      const msg =
        err?.message && err.message !== "{}" && err.message !== "[object Object]"
          ? err.message
          : t("doctorPrescriptionDetail.error");
      toast.show(msg, "danger");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <ScreenHeader
        title={t("doctorPrescriptionDetail.title")}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={120} radius={radius.lg} />
          <Skeleton height={180} radius={radius.lg} />
          <Skeleton height={80} radius={radius.lg} />
        </View>
      ) : !rx ? (
        <View style={{ padding: spacing.xl }}>
          <EmptyState
            icon={FileText}
            title={t("doctorPrescriptionDetail.notFound")}
            message={t("doctorPrescriptionDetail.notFoundBody")}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: spacing.xxl,
          }}
        >
          {/* Patient card */}
          <Card>
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, marginBottom: spacing.xs },
              ]}
            >
              {t("doctorPrescriptionDetail.patient").toUpperCase()}
            </Text>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, fontWeight: "700" },
              ]}
            >
              {patient?.name || t("doctorPrescriptions.unknownPatient")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.md,
                marginTop: spacing.sm,
              }}
            >
              {patient?.nic ? (
                <MetaChip
                  icon={IdCard}
                  label={patient.nic}
                />
              ) : null}
              <MetaChip icon={CalendarDays} label={rx.date} />
            </View>
          </Card>

          {/* Diagnosis + notes */}
          {rx.diagnosis ? (
            <Card>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginBottom: spacing.xs },
                ]}
              >
                {t("doctorPrescriptionDetail.diagnosis").toUpperCase()}
              </Text>
              <Text
                style={[
                  typography.body.md,
                  { color: colors.text, lineHeight: 22 },
                ]}
              >
                {rx.diagnosis}
              </Text>
            </Card>
          ) : null}

          {rx.notes ? (
            <Card>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginBottom: spacing.xs },
                ]}
              >
                {t("doctorPrescriptionDetail.notes").toUpperCase()}
              </Text>
              <Text
                style={[
                  typography.body.md,
                  { color: colors.text, lineHeight: 22 },
                ]}
              >
                {rx.notes}
              </Text>
            </Card>
          ) : null}

          {/* Medicines */}
          <Card>
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, marginBottom: spacing.sm },
              ]}
            >
              {t("doctorPrescriptionDetail.medicines").toUpperCase()}
            </Text>
            {rx.medicines?.length ? (
              <View style={{ gap: spacing.sm }}>
                {rx.medicines.map((med: any, i: number) => (
                  <View
                    key={med.id || i}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: spacing.md,
                      paddingVertical: spacing.xs,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Pill size={16} color={colors.primary} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          typography.body.md,
                          { color: colors.text, fontWeight: "700" },
                        ]}
                      >
                        {med.name}
                      </Text>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted, marginTop: 2 },
                        ]}
                      >
                        {[med.dosage, med.frequency, med.timing]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                      {med.endDate ? (
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textSubtle, marginTop: 2 },
                          ]}
                        >
                          {med.startDate} → {med.endDate}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                —
              </Text>
            )}
          </Card>

          {/* Doctor sign-off */}
          <Card>
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, marginBottom: spacing.xs },
              ]}
            >
              {t("doctorPrescriptionDetail.doctor").toUpperCase()}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: colors.successSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Stethoscope size={18} color={colors.success} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.body.md,
                    { color: colors.text, fontWeight: "700" },
                  ]}
                >
                  {rx.doctorName}
                </Text>
                {rx.doctorSpecialization ? (
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {rx.doctorSpecialization}
                    {rx.doctorSlmcNo ? ` · SLMC ${rx.doctorSlmcNo}` : ""}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>

          {/* Phase E-Rx 6+7: signature status + actions. The
              status pill mirrors prescriptions.status: signed shows
              the signedAt + payload hash; draft offers a Sign action;
              both signed + draft expose a Verify link. */}
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: isSigned
                    ? colors.successSoft
                    : colors.warningSoft ?? colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck
                  size={18}
                  color={isSigned ? colors.success : colors.warning ?? colors.textMuted}
                  strokeWidth={2.2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.body.md,
                    { color: colors.text, fontWeight: "700" },
                  ]}
                >
                  {status === "cancelled"
                    ? t("doctorPrescriptionDetail.statusCancelled")
                    : status === "dispensed"
                    ? t("doctorPrescriptionDetail.statusDispensed")
                    : isSigned
                    ? t("doctorPrescriptionDetail.statusSigned")
                    : t("doctorPrescriptionDetail.statusDraft")}
                </Text>
                {isSigned && rx.signedAt ? (
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {t("doctorPrescriptionDetail.signedAtLabel")} {rx.signedAt}
                  </Text>
                ) : null}
                {isSigned && rx.signedPayloadHash ? (
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSubtle, marginTop: 2 },
                    ]}
                  >
                    {t("doctorPrescriptionDetail.payloadHashLabel")}{" "}
                    {rx.signedPayloadHash.slice(0, 12)}…
                  </Text>
                ) : null}
              </View>
              <StatusPill status={status} />
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              {isDraft ? (
                <Button
                  title={t("doctorPrescriptionDetail.sign")}
                  onPress={onSign}
                  loading={signMutation.isPending}
                  disabled={signMutation.isPending}
                  iconLeft={ShieldCheck}
                  size="md"
                  style={{ flex: 1 }}
                />
              ) : null}
              <Button
                title={t("doctorPrescriptionDetail.verify")}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/verify/[id]" as any,
                    params: { id: id as string },
                  })
                }
                variant="secondary"
                iconLeft={ScanLine}
                size="md"
                style={{ flex: 1 }}
              />
            </View>

            {/* Phase E-Rx 8: lifecycle actions. Dispense (signed only)
                + cancel (draft or signed). Both hit the status-guarded
                endpoints, so a concurrent flip surfaces as a 409 toast. */}
            {isSigned || canCancel ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                {isSigned ? (
                  <Button
                    title={t("doctorPrescriptionDetail.dispense")}
                    onPress={onDispense}
                    loading={dispenseMutation.isPending}
                    disabled={dispenseMutation.isPending}
                    variant="secondary"
                    iconLeft={PackageCheck}
                    size="md"
                    style={{ flex: 1 }}
                  />
                ) : null}
                {canCancel ? (
                  <Button
                    title={t("doctorPrescriptionDetail.cancel")}
                    onPress={() => setCancelOpen(true)}
                    variant="danger"
                    iconLeft={XCircle}
                    size="md"
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>

          {/* Phase E-Rx 7: PDF download is gated server-side on
              status="signed" — drafts return 409 with a "sign first"
              message that the toast surfaces. Disable the button
              client-side too so the doctor sees a clear affordance. */}
          <Button
            title={
              downloading
                ? t("doctorPrescriptionDetail.downloading")
                : isSigned
                ? t("doctorPrescriptionDetail.downloadPdf")
                : t("doctorPrescriptionDetail.signFirstDownload")
            }
            onPress={onDownload}
            loading={downloading}
            disabled={downloading || !isSigned}
            iconRight={Download}
            size="lg"
            fullWidth
          />
        </ScrollView>
      )}

      {/* Cancel confirmation sheet — destructive action, so we ask for
          confirmation and capture an optional reason for the audit log. */}
      <BottomSheet
        visible={cancelOpen}
        onDismiss={() => setCancelOpen(false)}
        title={t("doctorPrescriptionDetail.cancelConfirmTitle")}
      >
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.body.md, { color: colors.textMuted }]}>
            {t("doctorPrescriptionDetail.cancelConfirmBody")}
          </Text>
          <TextInput
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder={t("doctorPrescriptionDetail.cancelReasonPlaceholder")}
            multiline
          />
          <Button
            title={t("doctorPrescriptionDetail.cancelConfirm")}
            onPress={onCancelConfirm}
            loading={cancelMutation.isPending}
            disabled={cancelMutation.isPending}
            variant="danger"
            iconLeft={XCircle}
            size="lg"
            fullWidth
          />
          <Button
            title={t("doctorPrescriptionDetail.cancelKeep")}
            onPress={() => setCancelOpen(false)}
            variant="ghost"
            size="md"
            fullWidth
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function StatusPill({ status }: { status: string }) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = {
    draft: {
      bg: colors.warningSoft ?? colors.surfaceMuted,
      fg: colors.warning ?? colors.textMuted,
      label: status,
    },
    signed: {
      bg: colors.successSoft,
      fg: colors.success,
      label: status,
    },
    cancelled: {
      bg: colors.dangerSoft ?? colors.surfaceMuted,
      fg: colors.danger ?? colors.textMuted,
      label: status,
    },
    dispensed: {
      bg: colors.primarySoft,
      fg: colors.primary,
      label: status,
    },
  }[status] ?? {
    bg: colors.surfaceMuted,
    fg: colors.textMuted,
    label: status,
  };
  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.full,
        backgroundColor: palette.bg,
      }}
    >
      <Text
        style={[
          typography.caption,
          { color: palette.fg, fontWeight: "700", textTransform: "uppercase" },
        ]}
      >
        {palette.label}
      </Text>
    </View>
  );
}

function MetaChip({
  icon: Icon,
  label,
}: {
  icon: any;
  label: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Icon size={12} color={colors.textMuted} strokeWidth={2.2} />
      <Text
        style={[typography.caption, { color: colors.textMuted, fontWeight: "700" }]}
      >
        {label}
      </Text>
    </View>
  );
}
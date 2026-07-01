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
} from "lucide-react-native";
import {
  useDoctorPrescription,
  downloadPrescriptionPdf,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  EmptyState,
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

  const rx = data?.prescription;
  const patient = rx?.patient;

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

          <Button
            title={
              downloading
                ? t("doctorPrescriptionDetail.downloading")
                : t("doctorPrescriptionDetail.downloadPdf")
            }
            onPress={onDownload}
            loading={downloading}
            disabled={downloading}
            iconRight={Download}
            size="lg"
            fullWidth
          />
        </ScrollView>
      )}
    </Screen>
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
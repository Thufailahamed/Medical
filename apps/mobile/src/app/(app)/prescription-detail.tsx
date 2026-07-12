// @ts-nocheck

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Pill,
  Stethoscope,
  Download,
  FileText,
  CalendarDays,
  ShieldCheck,
  ScanLine,
  Share2,
} from "lucide-react-native";
import {
  useMyPrescription,
  downloadMyPrescriptionPdf,
  useCreateShareLink,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { getPublicBaseUrl } from "@/lib/api";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  EmptyState,
  ErrorState,
  useToast,
} from "@/components/ui";

export default function PatientPrescriptionDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useMyPrescription(id);
  const [downloading, setDownloading] = useState(false);
  const createShare = useCreateShareLink();
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const rx = data?.prescription;
  const status: string = rx?.status ?? "signed";
  const isSigned = status === "signed";

  async function onDownload() {
    if (!id) return;
    setDownloading(true);
    try {
      await downloadMyPrescriptionPdf(id);
    } catch (err: any) {
      const msg =
        err?.message && err.message !== "{}" && err.message !== "[object Object]"
          ? err.message
          : t("patientPrescriptionDetail.error");
      toast.show(msg, "danger");
    } finally {
      setDownloading(false);
    }
  }

  async function onShareWithDoctor() {
    if (!id) return;
    try {
      const res = await createShare.mutateAsync({
        prescriptionId: id,
        label: t("patientPrescriptionDetail.shareLabel"),
        // Default 7-day TTL — share-with-doctor links are short-lived by design.
        expiresInHours: 168,
      });
      const base = getPublicBaseUrl() || "https://app.healthhub.app";
      setShareUrl(`${base}${res.url}`);
      toast.show(t("patientPrescriptionDetail.shareCreated"), "success");
    } catch (err: any) {
      const msg =
        err?.message && err.message !== "{}" && err.message !== "[object Object]"
          ? err.message
          : t("patientPrescriptionDetail.error");
      toast.show(msg, "danger");
    }
  }

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <ScreenHeader
        title={t("patientPrescriptionDetail.title")}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={120} radius={radius.lg} />
          <Skeleton height={180} radius={radius.lg} />
          <Skeleton height={80} radius={radius.lg} />
        </View>
      ) : isError ? (
        <View style={{ padding: spacing.xl }}>
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load prescription")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        </View>
      ) : !rx ? (
        <View style={{ padding: spacing.xl }}>
          <EmptyState
            icon={FileText}
            title={t("patientPrescriptionDetail.notFound")}
            message={t("patientPrescriptionDetail.notFoundBody")}
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
          <Card>
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, marginBottom: spacing.xs },
              ]}
            >
              {t("patientPrescriptionDetail.doctor").toUpperCase()}
            </Text>
            <Text
              style={[
                typography.title.md,
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
            <View style={{ marginTop: spacing.sm }}>
              <MetaChip icon={CalendarDays} label={rx.date} />
            </View>
          </Card>

          {rx.diagnosis ? (
            <Card>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginBottom: spacing.xs },
                ]}
              >
                {t("patientPrescriptionDetail.diagnosis").toUpperCase()}
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
                {t("patientPrescriptionDetail.notes").toUpperCase()}
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

          <Card>
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, marginBottom: spacing.sm },
              ]}
            >
              {t("patientPrescriptionDetail.medicines").toUpperCase()}
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
                      {med.instructions ? (
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textSubtle, marginTop: 2 },
                          ]}
                        >
                          {med.instructions}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                —
              </Text>
            )}
          </Card>

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
                    : colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck
                  size={18}
                  color={isSigned ? colors.success : colors.textMuted}
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
                    ? t("patientPrescriptionDetail.statusCancelled")
                    : status === "dispensed"
                    ? t("patientPrescriptionDetail.statusDispensed")
                    : isSigned
                    ? t("patientPrescriptionDetail.statusSigned")
                    : status}
                </Text>
                {isSigned && rx.signedAt ? (
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {t("patientPrescriptionDetail.signedAtLabel")} {rx.signedAt}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                title={t("patientPrescriptionDetail.verify")}
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
          </Card>

          <Button
            title={
              downloading
                ? t("patientPrescriptionDetail.downloading")
                : isSigned
                ? t("patientPrescriptionDetail.downloadPdf")
                : t("patientPrescriptionDetail.notAvailableDownload")
            }
            onPress={onDownload}
            loading={downloading}
            disabled={downloading || !isSigned}
            iconRight={Download}
            size="lg"
            fullWidth
          />

          {isSigned ? (
            <Card>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginBottom: spacing.xs },
                ]}
              >
                {t("patientPrescriptionDetail.shareWithDoctor").toUpperCase()}
              </Text>
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                {t("patientPrescriptionDetail.shareWithDoctorBody")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                <Button
                  title={
                    shareUrl
                      ? t("patientPrescriptionDetail.shareLinkCreated")
                      : createShare.isPending
                      ? t("patientPrescriptionDetail.creatingShare")
                      : t("patientPrescriptionDetail.createShareLink")
                  }
                  onPress={onShareWithDoctor}
                  loading={createShare.isPending}
                  disabled={createShare.isPending}
                  iconLeft={Share2}
                  variant="secondary"
                  size="md"
                  style={{ flex: 1 }}
                />
              </View>
              {shareUrl ? (
                <Text
                  selectable
                  style={[
                    typography.caption,
                    {
                      color: colors.primary,
                      marginTop: spacing.sm,
                      fontFamily: "monospace",
                    },
                  ]}
                  onPress={() => {
                    // Best-effort: copy to clipboard if available; the
                    // long-press menu also exposes copy on iOS/Android.
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-var-requires
                      require("expo-clipboard").setStringAsync(shareUrl);
                      toast.show(
                        t("patientPrescriptionDetail.shareCopied"),
                        "success"
                      );
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {shareUrl}
                </Text>
              ) : null}
            </Card>
          ) : null}
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
        alignSelf: "flex-start",
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

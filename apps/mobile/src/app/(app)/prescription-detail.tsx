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
  Repeat,
  CheckCircle2,
  PackageCheck,
  XCircle,
  Clock,
  Sparkles,
  Copy,
  Check,
  Activity,
} from "lucide-react-native";
import {
  useMyPrescription,
  downloadMyPrescriptionPdf,
  useCreateShareLink,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong, fmtLKR } from "@/lib/format";
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
  Pressable,
} from "@/components/ui";

const FREQUENCY_LABELS: Record<string, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  three_times_daily: "Three times daily",
  four_times_daily: "Four times daily",
  every_morning: "Every morning",
  every_night: "Every night",
  as_needed: "As needed (PRN)",
  every_other_day: "Every other day",
  weekly: "Once weekly",
};

const TIMING_LABELS: Record<string, string> = {
  before_food: "Before meals",
  after_food: "After meals",
  with_food: "With meals",
  empty_stomach: "On an empty stomach",
  bedtime: "At bedtime",
  morning: "In the morning",
};

function humanizeDirection(val?: string | null): string {
  if (!val) return "";
  const clean = val.trim().toLowerCase();
  if (FREQUENCY_LABELS[clean]) return FREQUENCY_LABELS[clean];
  if (TIMING_LABELS[clean]) return TIMING_LABELS[clean];
  return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSlmc(slmc?: string | null): string | null {
  if (!slmc) return null;
  const num = slmc.replace(/^SLMC-?/i, "").trim();
  return num ? `SLMC #${num}` : null;
}

function formatDateTime(iso: string | null | undefined, locale: any): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const dateStr = fmtDateLong(d, locale);
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${dateStr} at ${timeStr}`;
}

export default function PatientPrescriptionDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, scheme } = useTheme();
  const isDark = scheme === "dark";
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useMyPrescription(id);
  const [downloading, setDownloading] = useState(false);
  const createShare = useCreateShareLink();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const rx = data?.prescription;
  const status: string = rx?.status ?? "signed";
  const isSigned = status === "signed" || status === "active";
  const isDispensed = status === "dispensed" || status === "completed";
  const isCancelled = status === "cancelled";

  const slmcBadge = formatSlmc(rx?.doctorSlmcNo);
  const formattedDate = rx?.date ? fmtDateLong(new Date(rx.date), locale) : "—";
  const formattedSignedAt = rx?.signedAt ? formatDateTime(rx.signedAt, locale) : null;

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
        expiresInHours: 168,
      });
      const base = getPublicBaseUrl() || "https://app.healthhub.app";
      const fullUrl = `${base}${res.url}`;
      setShareUrl(fullUrl);
      copyToClipboard(fullUrl);
      toast.show(t("patientPrescriptionDetail.shareCreated"), "success");
    } catch (err: any) {
      const msg =
        err?.message && err.message !== "{}" && err.message !== "[object Object]"
          ? err.message
          : t("patientPrescriptionDetail.error");
      toast.show(msg, "danger");
    }
  }

  function copyToClipboard(url: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("expo-clipboard").setStringAsync(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      toast.show(t("patientPrescriptionDetail.shareCopied"), "success");
    } catch {
      // fallback
    }
  }

  return (
    <Screen scroll padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("patientPrescriptionDetail.title")}
        subtitle={formattedDate}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={140} radius={radius.xl} />
          <Skeleton height={120} radius={radius.xl} />
          <Skeleton height={200} radius={radius.xl} />
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: 120,
          }}
        >
          {/* Prescribing Practitioner Header Card */}
          <Card
            style={{
              padding: spacing.md + 2,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.border,
            }}
          >
            {/* Top row: Label & Status Badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.sm,
              }}
            >
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, letterSpacing: 0.8 },
                ]}
              >
                {t("patientPrescriptionDetail.doctor").toUpperCase()}
              </Text>
              <StatusBadge status={status} />
            </View>

            {/* Doctor Info Row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Stethoscope
                  size={24}
                  color={colors.primary}
                  strokeWidth={2.2}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.title.md,
                    { color: colors.text, fontWeight: "800" },
                  ]}
                  numberOfLines={1}
                >
                  {rx.doctorName || "Licensed Practitioner"}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 3,
                  }}
                >
                  {rx.doctorSpecialization && (
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, fontWeight: "600" },
                      ]}
                    >
                      {rx.doctorSpecialization}
                    </Text>
                  )}
                  {slmcBadge && (
                    <View
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 1,
                        borderRadius: radius.xs,
                        backgroundColor: colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: colors.textSubtle,
                        }}
                      >
                        {slmcBadge}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Meta Row: Issue Date & Fee */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: spacing.md,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <CalendarDays size={13} color={colors.textSubtle} strokeWidth={2.2} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.textSubtle,
                  }}
                >
                  {formattedDate}
                </Text>
              </View>

              {rx.doctorConsultationFee ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.text,
                    }}
                  >
                    {fmtLKR(Number(rx.doctorConsultationFee), locale)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textMuted,
                    }}
                  >
                    ({t("patientPrescriptionDetail.feePaidNote")})
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>

          {/* Clinical Assessment & Instructions Card (Merged Diagnosis & Notes) */}
          {(rx.diagnosis || rx.notes) && (
            <Card
              style={{
                padding: spacing.md + 2,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.border,
                gap: spacing.sm,
              }}
            >
              {rx.diagnosis && (
                <View>
                  <Text
                    style={[
                      typography.overline,
                      { color: colors.textMuted, marginBottom: 4 },
                    ]}
                  >
                    {t("patientPrescriptionDetail.diagnosis").toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      typography.body.md,
                      { color: colors.text, fontWeight: "600", lineHeight: 22 },
                    ]}
                  >
                    {rx.diagnosis}
                  </Text>
                </View>
              )}

              {rx.diagnosis && rx.notes && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.border,
                    marginVertical: spacing.xs,
                  }}
                />
              )}

              {rx.notes && (
                <View>
                  <Text
                    style={[
                      typography.overline,
                      { color: colors.textMuted, marginBottom: 4 },
                    ]}
                  >
                    {t("patientPrescriptionDetail.notes").toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, lineHeight: 20 },
                    ]}
                  >
                    {rx.notes}
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* Medicines Schedule Card */}
          <Card
            style={{
              padding: spacing.md + 2,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.md,
              }}
            >
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, letterSpacing: 0.8 },
                ]}
              >
                {t("patientPrescriptionDetail.medicines").toUpperCase()}
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: colors.primarySoft,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: colors.primary,
                  }}
                >
                  {rx.medicines?.length || 0}{" "}
                  {rx.medicines?.length === 1 ? "Item" : "Items"}
                </Text>
              </View>
            </View>

            {rx.medicines?.length ? (
              <View style={{ gap: spacing.md }}>
                {rx.medicines.map((med: any, i: number) => {
                  const frequencyHuman = humanizeDirection(med.frequency);
                  const timingHuman = humanizeDirection(med.timing);

                  return (
                    <View
                      key={med.id || i}
                      style={{
                        paddingTop: i === 0 ? 0 : spacing.md,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderColor: isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : colors.border,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: spacing.md,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: colors.primarySoft,
                            alignItems: "center",
                            justifyContent: "center",
                            marginTop: 2,
                          }}
                        >
                          <Pill size={18} color={colors.primary} strokeWidth={2.4} />
                        </View>

                        <View style={{ flex: 1 }}>
                          {/* Name and Dosage */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: spacing.xs,
                            }}
                          >
                            <Text
                              style={[
                                typography.body.md,
                                { color: colors.text, fontWeight: "700" },
                              ]}
                            >
                              {med.name}
                            </Text>

                            {med.dosage && (
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: radius.xs,
                                  backgroundColor: isDark
                                    ? "rgba(255, 255, 255, 0.08)"
                                    : colors.surfaceMuted,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: colors.text,
                                  }}
                                >
                                  {med.dosage}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Directions Tags (Humanized frequency & timing) */}
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 6,
                              marginTop: 6,
                            }}
                          >
                            {frequencyHuman ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 4,
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: radius.full,
                                  backgroundColor: isDark
                                    ? "rgba(59, 130, 246, 0.12)"
                                    : colors.primarySoft,
                                }}
                              >
                                <Clock size={11} color={colors.primary} />
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "600",
                                    color: colors.primary,
                                  }}
                                >
                                  {frequencyHuman}
                                </Text>
                              </View>
                            ) : null}

                            {timingHuman ? (
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: radius.full,
                                  backgroundColor: colors.surfaceMuted,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "600",
                                    color: colors.textMuted,
                                  }}
                                >
                                  {timingHuman}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          {/* Instructions note callout if present */}
                          {med.instructions ? (
                            <View
                              style={{
                                marginTop: 6,
                                paddingHorizontal: spacing.sm,
                                paddingVertical: 4,
                                borderRadius: radius.sm,
                                backgroundColor: isDark
                                  ? "rgba(255, 255, 255, 0.04)"
                                  : "rgba(0, 0, 0, 0.02)",
                                borderWidth: 1,
                                borderColor: isDark
                                  ? "rgba(255, 255, 255, 0.05)"
                                  : "rgba(0, 0, 0, 0.04)",
                              }}
                            >
                              <Text
                                style={[
                                  typography.caption,
                                  { color: colors.textSubtle, fontStyle: "italic" },
                                ]}
                              >
                                Note: {med.instructions}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                No medicines recorded in this prescription.
              </Text>
            )}
          </Card>

          {/* Cryptographic Digital Signature & Verification Card */}
          <Card
            style={{
              padding: spacing.md + 2,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: isSigned
                    ? colors.successSoft
                    : colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck
                  size={22}
                  color={isSigned ? colors.success : colors.textMuted}
                  strokeWidth={2.4}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.body.md,
                    { color: colors.text, fontWeight: "800" },
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

                {isSigned && formattedSignedAt ? (
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {t("patientPrescriptionDetail.signedAtLabel")} {formattedSignedAt}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={{ marginTop: spacing.md }}>
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
                fullWidth
              />
            </View>
          </Card>

          {/* Action Buttons: Download PDF & Quick Refill */}
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
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

            {isSigned && (
              <Button
                title={t("myPrescriptions.requestRefill", "Request refill")}
                onPress={() => router.push("/(app)/refill")}
                variant="outline"
                iconLeft={Repeat}
                size="md"
                fullWidth
              />
            )}
          </View>

          {/* Secure 7-Day Sharing Hub */}
          {isSigned ? (
            <Card
              style={{
                padding: spacing.md + 2,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.border,
                marginTop: spacing.xs,
              }}
            >
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginBottom: 4 },
                ]}
              >
                {t("patientPrescriptionDetail.shareWithDoctor").toUpperCase()}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, lineHeight: 18 },
                ]}
              >
                {t("patientPrescriptionDetail.shareWithDoctorBody")}
              </Text>

              <View style={{ marginTop: spacing.md }}>
                <Button
                  title={
                    shareUrl
                      ? copied
                        ? "Copied to clipboard ✓"
                        : t("patientPrescriptionDetail.shareLinkCreated")
                      : createShare.isPending
                      ? t("patientPrescriptionDetail.creatingShare")
                      : t("patientPrescriptionDetail.createShareLink")
                  }
                  onPress={shareUrl ? () => copyToClipboard(shareUrl) : onShareWithDoctor}
                  loading={createShare.isPending}
                  disabled={createShare.isPending}
                  iconLeft={shareUrl ? (copied ? Check : Copy) : Share2}
                  variant="secondary"
                  size="md"
                  fullWidth
                />
              </View>

              {shareUrl ? (
                <Pressable
                  onPress={() => copyToClipboard(shareUrl)}
                  style={{
                    marginTop: spacing.sm,
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: colors.primary,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {shareUrl}
                  </Text>
                  <Copy size={13} color={colors.primary} />
                </Pressable>
              ) : null}
            </Card>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  const isSigned = status === "signed" || status === "active";
  const isDispensed = status === "dispensed" || status === "completed";
  const isCancelled = status === "cancelled";

  if (isSigned) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: radius.full,
          backgroundColor: colors.successSoft,
        }}
      >
        <ShieldCheck size={11} color={colors.success} strokeWidth={2.6} />
        <Text
          style={{
            fontSize: 10,
            fontWeight: "800",
            color: colors.success,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {t("patientPrescriptionDetail.statusSigned")}
        </Text>
      </View>
    );
  }

  if (isDispensed) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: radius.full,
          backgroundColor: colors.primarySoft,
        }}
      >
        <PackageCheck size={11} color={colors.primary} strokeWidth={2.6} />
        <Text
          style={{
            fontSize: 10,
            fontWeight: "800",
            color: colors.primary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {t("patientPrescriptionDetail.statusDispensed")}
        </Text>
      </View>
    );
  }

  if (isCancelled) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: radius.full,
          backgroundColor: colors.dangerSoft ?? colors.surfaceMuted,
        }}
      >
        <XCircle size={11} color={colors.danger ?? colors.textMuted} strokeWidth={2.6} />
        <Text
          style={{
            fontSize: 10,
            fontWeight: "800",
            color: colors.danger ?? colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {t("patientPrescriptionDetail.statusCancelled")}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "800",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {status}
      </Text>
    </View>
  );
}

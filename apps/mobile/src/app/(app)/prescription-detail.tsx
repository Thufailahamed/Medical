// @ts-nocheck

import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Pill,
  Stethoscope,
  Download,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Share2,
  Repeat,
  PackageCheck,
  XCircle,
  Clock,
  Copy,
  Check,
  ChevronRight,
  ClipboardList,
  Link2,
} from "lucide-react-native";
import {
  useMyPrescription,
  downloadMyPrescriptionPdf,
  useCreateShareLink,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
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
  SectionHeader,
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


function statusMeta(status: string): { tone: Tone; icon: any; key: string | null } {
  if (status === "signed" || status === "active")
    return { tone: "success", icon: ShieldCheck, key: "patientPrescriptionDetail.statusSigned" };
  if (status === "dispensed" || status === "completed")
    return { tone: "primary", icon: PackageCheck, key: "patientPrescriptionDetail.statusDispensed" };
  if (status === "cancelled")
    return { tone: "danger", icon: XCircle, key: "patientPrescriptionDetail.statusCancelled" };
  return { tone: "neutral", icon: ShieldAlert, key: null };
}

export default function PatientPrescriptionDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
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
  const sMeta = statusMeta(status);
  const statusPal = useTone(sMeta.tone);

  const slmcBadge = formatSlmc(rx?.doctorSlmcNo);
  const formattedDate = rx?.date ? fmtDateLong(new Date(rx.date), locale) : "—";
  const formattedSignedAt = rx?.signedAt ? formatDateTime(rx.signedAt, locale) : null;
  const medCount = rx?.medicines?.length ?? 0;

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

  function openVerify() {
    router.push({
      pathname: "/(app)/verify/[id]" as any,
      params: { id: id as string },
    });
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("patientPrescriptionDetail.title")}
        subtitle={rx ? formattedDate : undefined}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={200} radius={radius.xl} />
          <Skeleton height={90} radius={radius.xl} />
          <Skeleton height={160} radius={radius.xl} />
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
            paddingTop: spacing.sm,
            paddingBottom: 120,
          }}
        >
          {/* ─── Doctor + signature ─── */}
          <Card padded={false} style={{ overflow: "hidden" }}>
            <View style={{ padding: spacing.lg, gap: spacing.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: radius.lg,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Stethoscope size={24} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase" }]}>
                    {t("patientPrescriptionDetail.doctor")}
                  </Text>
                  <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
                    {rx.doctorName || "Licensed Practitioner"}
                  </Text>
                  <Text style={[typography.body.sm, { color: colors.textMuted }]} numberOfLines={1}>
                    {[rx.doctorSpecialization, slmcBadge].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <MetaTile label={t("patientPrescriptionDetail.issued")} value={formattedDate} />
                <MetaTile
                  label={t("patientPrescriptionDetail.medicines")}
                  value={t("patientPrescriptionDetail.itemCount", { count: medCount })}
                />
                {rx.doctorConsultationFee ? (
                  <MetaTile
                    label={t("patientPrescriptionDetail.consultationFee")}
                    value={fmtLKR(Number(rx.doctorConsultationFee), locale)}
                  />
                ) : null}
              </View>
            </View>

            {/* Signature strip — tap to verify */}
            <Pressable
              onPress={isSigned ? openVerify : undefined}
              haptic="light"
              accessibilityRole={isSigned ? "button" : undefined}
              accessibilityLabel={t("patientPrescriptionDetail.verify")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                backgroundColor: statusPal.bg,
              }}
            >
              <sMeta.icon size={20} color={statusPal.fg} strokeWidth={2.4} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.label.md, { color: statusPal.fg }]} numberOfLines={1}>
                  {sMeta.key ? t(sMeta.key) : status}
                </Text>
                {isSigned && formattedSignedAt ? (
                  <Text style={[typography.caption, { color: statusPal.fg, opacity: 0.8 }]} numberOfLines={1}>
                    {t("patientPrescriptionDetail.signedOn", { when: formattedSignedAt })}
                  </Text>
                ) : null}
              </View>
              {isSigned ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <Text style={[typography.label.md, { color: statusPal.fg }]}>
                    {t("patientPrescriptionDetail.verifyShort")}
                  </Text>
                  <ChevronRight size={16} color={statusPal.fg} strokeWidth={2.4} />
                </View>
              ) : null}
            </Pressable>
          </Card>

          {/* ─── Diagnosis & notes ─── */}
          {rx.diagnosis || rx.notes ? (
            <>
              <SectionHeader title={t("patientPrescriptionDetail.diagnosis")} />
              <Card style={{ flexDirection: "row", gap: spacing.md }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.md,
                    borderCurve: "continuous",
                    backgroundColor: colors.well,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ClipboardList size={17} color={colors.textMuted} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, gap: 4, paddingTop: 2 }}>
                  {rx.diagnosis ? (
                    <Text style={[typography.title.sm, { color: colors.text }]}>{rx.diagnosis}</Text>
                  ) : null}
                  {rx.notes ? (
                    <Text style={[typography.body.sm, { color: colors.textMuted, lineHeight: 20 }]}>
                      {rx.notes}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </>
          ) : null}

          {/* ─── Medicines ─── */}
          <SectionHeader title={t("patientPrescriptionDetail.medicines")} count={medCount} />
          <Card padded={false}>
            {medCount ? (
              rx.medicines.map((med: any, i: number) => (
                <MedicineRow key={med.id || i} med={med} first={i === 0} />
              ))
            ) : (
              <Text style={[typography.body.sm, { color: colors.textMuted, padding: spacing.lg }]}>
                {t("patientPrescriptionDetail.noMedicines")}
              </Text>
            )}
          </Card>

          {/* ─── Actions ─── */}
          <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
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
              icon={Download}
              size="lg"
            />
            {isSigned ? (
              <Button
                title={t("myPrescriptions.requestRefill", "Request refill")}
                onPress={() => router.push("/(app)/refill")}
                variant="secondary"
                icon={Repeat}
              />
            ) : null}
          </View>

          {/* ─── Share with another doctor ─── */}
          {isSigned ? (
            <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.md,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Share2 size={17} color={colors.primary} strokeWidth={2.3} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("patientPrescriptionDetail.shareWithDoctor")}
                  </Text>
                  <Text style={[typography.body.sm, { color: colors.textMuted, lineHeight: 19 }]}>
                    {t("patientPrescriptionDetail.shareWithDoctorBody")}
                  </Text>
                </View>
              </View>

              {shareUrl ? (
                <Pressable
                  onPress={() => copyToClipboard(shareUrl)}
                  haptic="light"
                  accessibilityRole="button"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    borderCurve: "continuous",
                    backgroundColor: colors.fill,
                  }}
                >
                  <Link2 size={16} color={colors.primary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.label.md, { color: colors.primary }]} numberOfLines={1}>
                      {shareUrl}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {copied
                        ? t("patientPrescriptionDetail.copied")
                        : `${t("patientPrescriptionDetail.shareLinkReady")} · ${t("patientPrescriptionDetail.shareExpires")}`}
                    </Text>
                  </View>
                  {copied ? (
                    <Check size={16} color={colors.success} strokeWidth={2.6} />
                  ) : (
                    <Copy size={16} color={colors.primary} />
                  )}
                </Pressable>
              ) : (
                <Button
                  title={
                    createShare.isPending
                      ? t("patientPrescriptionDetail.creatingShare")
                      : t("patientPrescriptionDetail.createShareLink")
                  }
                  onPress={onShareWithDoctor}
                  loading={createShare.isPending}
                  disabled={createShare.isPending}
                  icon={Link2}
                  variant="outline"
                />
              )}
            </Card>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  const { colors, typography, radius, spacing } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.fill,
        gap: 2,
      }}
    >
      <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[typography.label.md, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function MedicineRow({ med, first }: { med: any; first: boolean }) {
  const { t } = useTranslation();
  const { colors, typography, radius, spacing } = useTheme();
  const frequencyHuman = humanizeDirection(med.frequency);
  const timingHuman = humanizeDirection(med.timing);
  const duration = med.durationDays ? `${med.durationDays}d` : med.duration;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: colors.separator,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          borderCurve: "continuous",
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Pill size={18} color={colors.primary} strokeWidth={2.4} />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6 }}>
          <Text style={[typography.title.sm, { color: colors.text }]}>{med.name}</Text>
          {med.dosage ? (
            <Text style={[typography.body.sm, { color: colors.textMuted, fontWeight: "600" }]}>
              {med.dosage}
            </Text>
          ) : null}
        </View>

        {frequencyHuman || timingHuman || duration ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {frequencyHuman ? <DirectionChip icon={Clock} label={frequencyHuman} strong /> : null}
            {timingHuman ? <DirectionChip label={timingHuman} /> : null}
            {duration ? <DirectionChip label={String(duration)} /> : null}
          </View>
        ) : null}

        {med.instructions ? (
          <Text style={[typography.body.sm, { color: colors.textMuted, lineHeight: 19 }]}>
            <Text style={{ fontWeight: "700", color: colors.text }}>
              {t("patientPrescriptionDetail.instructionNote")}:{" "}
            </Text>
            {med.instructions}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DirectionChip({ label, icon: Icon, strong }: { label: string; icon?: any; strong?: boolean }) {
  const { colors, typography, radius } = useTheme();
  const fg = strong ? colors.primary : colors.textMuted;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        height: 26,
        borderRadius: radius.full,
        backgroundColor: strong ? colors.primarySoft : colors.fill,
      }}
    >
      {Icon ? <Icon size={12} color={fg} strokeWidth={2.4} /> : null}
      <Text style={[typography.caption, { color: fg, fontWeight: "600" }]}>{label}</Text>
    </View>
  );
}

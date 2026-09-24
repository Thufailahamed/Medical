// @ts-nocheck

import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Linking,
  Share,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong, intlLocale } from "@/lib/format";
import {
  ChevronLeft,
  FileText,
  Calendar,
  Hospital,
  User,
  ImageIcon,
  ExternalLink,
  Pill,
  Tag,
  Share2,
  Pencil,
  Users,
  Archive,
  RotateCcw,
  Trash2,
  X,
  Check,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Sparkles,
  RefreshCw,
  FlaskConical,
  ScanLine,
  Syringe,
  ListChecks,
  Stethoscope,
  Activity,
} from "lucide-react-native";
import {
  useMedicalRecord,
  useUpdateRecordTags,
  useArchiveRecord,
  useRestoreRecord,
  useMoveRecordToFamily,
  useReturnRecordToOwn,
  useDeleteRecord,
  useRecordLabResults,
  useRecordImagingFindings,
  useRecordDischargeEvents,
  useRecordVaccinationDoses,
  useRecordPrescriptionItems,
  useReExtractRecord,
  usePresignFile,
} from "@/hooks/useApi";
import { api, getApiBaseUrl } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Card,
  Button,
  Pill as PillComponent,
  useToast,
  Screen,
  IconButton,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { metaFor, type RecordType } from "@/lib/recordImportance";
import { FamilyPickerSheet } from "@/components/FamilyPickerSheet";
import { TagPickerSheet } from "@/components/TagPickerSheet";
import { DicomPreviewCard } from "@/components/records/DicomPreviewCard";

type BottomSheetAction =
  | "edit"
  | "editTags"
  | "moveToFamily"
  | "archive"
  | "restore"
  | "share"
  | "delete";

function buildTypeMeta(
  t: (k: string) => string,
  colors: any
): Record<RecordType, { label: string; icon: any; tone: string }> {
  const base = (key: string, fallback: string) =>
    t(`recordDetail.type.${key}`, { defaultValue: fallback });
  return {
    lab_report: {
      label: base("lab_report", "Lab Report"),
      icon: FileText,
      tone: colors.warning,
    },
    prescription: {
      label: base("prescription", "Prescription"),
      icon: Pill,
      tone: colors.primary,
    },
    imaging: {
      label: base("imaging", "Imaging"),
      icon: ImageIcon,
      tone: colors.info,
    },
    hospital_visit: {
      label: base("hospital_visit", "Visit"),
      icon: Hospital,
      tone: colors.primary,
    },
    vaccination: {
      label: base("vaccination", "Vaccination"),
      icon: Pill,
      tone: colors.success,
    },
    surgery: {
      label: base("surgery", "Surgery"),
      icon: Hospital,
      tone: colors.danger,
    },
    op_note: {
      label: base("op_note", "Op Note"),
      icon: FileText,
      tone: colors.warning,
    },
    discharge_summary: {
      label: base("discharge_summary", "Discharge"),
      icon: FileText,
      tone: colors.warning,
    },
    referral: {
      label: base("referral", "Referral"),
      icon: FileText,
      tone: colors.primary,
    },
    insurance: {
      label: base("insurance", "Insurance"),
      icon: FileText,
      tone: colors.success,
    },
    pathology: {
      label: base("pathology", "Pathology"),
      icon: FileText,
      tone: colors.warning,
    },
    dental: {
      label: base("dental", "Dental"),
      icon: FileText,
      tone: colors.info,
    },
    other: {
      label: base("other", "Other"),
      icon: FileText,
      tone: colors.textMuted,
    },
  };
}

// Kind-graded gradient used for the hero icon tile — mirrors the palette
// on the Records hub cards so the detail view reads as the same object.
const DETAIL_GRADIENT: Record<string, readonly [string, string]> = {
  lab_report: ["#FBBF24", "#F59E0B"],
  prescription: ["#A78BFA", "#7C3AED"],
  imaging: ["#38BDF8", "#0284C7"],
  hospital_visit: ["#2DD4BF", "#0D9488"],
  vaccination: ["#FB923C", "#EA580C"],
  surgery: ["#F87171", "#DC2626"],
  op_note: ["#F472B6", "#DB2777"],
  discharge_summary: ["#A78BFA", "#6D28D9"],
  referral: ["#60A5FA", "#2563EB"],
  insurance: ["#34D399", "#059669"],
  pathology: ["#FBBF24", "#B45309"],
  dental: ["#38BDF8", "#0284C7"],
  other: ["#94A3B8", "#475569"],
};

export default function RecordDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography, fontFamily, radius, shadow, scheme } = useTheme();
  const toast = useToast();
  const isDark = scheme === "dark";
  const cardLift = isDark ? null : shadow.sm;

  const TYPE_META = useMemo(() => buildTypeMeta(t, colors), [t, colors]);

  const { data: record, isLoading, isError, refetch } = useMedicalRecord(params.id);
  const updateTags = useUpdateRecordTags();
  const archiveRec = useArchiveRecord();
  const restoreRec = useRestoreRecord();
  const moveToFamily = useMoveRecordToFamily();
  const returnToOwn = useReturnRecordToOwn();
  const deleteRec = useDeleteRecord();

  const [showSheet, setShowSheet] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const recordId = record?.id;
  const attachments = useMemo(() => {
    if (!record) return [];
    if (Array.isArray(record.files)) return record.files;
    if (Array.isArray(record.attachments)) return record.attachments;
    return [];
  }, [record]);
  // Presign each attachment so `<Image source>` and `Linking.openURL` can
  // fetch the bytes without attaching a Bearer header. The proxy
  // `/files/download/:key` is auth-gated and would 401 on a raw Image.
  const presign = usePresignFile();
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = attachments
        .map((a: any) => a?.id)
        .filter((x: unknown): x is string => typeof x === "string");
      if (!ids.length) return;
      try {
        const results = await Promise.all(
          ids.map((id) =>
            api<{ token: string; url: string }>("/files/presign", {
              method: "POST",
              body: { fileId: id },
              silent401: true,
            }).catch(() => null)
          )
        );
        if (cancelled) return;
        const next: Record<string, string> = {};
        const base = getApiBaseUrl();
        results.forEach((r, i) => {
          if (r && ids[i]) {
            // r.url is a server-relative path; prepend the API origin.
            next[ids[i]] = r.url.startsWith("http")
              ? r.url
              : `${base}${r.url}`;
          }
        });
        setSignedUrls(next);
      } catch {
        // best-effort — thumbnails just won't render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  const lastActionRef = useRef<null | (() => Promise<void>)>(null);

  function doArchive() {
    if (!recordId) return;
    archiveRec.mutate(recordId, {
      onSuccess: () => {
        toast.show(t("recordDetail.toast.archived"), "success", {
          actionLabel: t("recordDetail.archivedBadge.restore"),
          onAction: () => doRestore(),
        });
      },
      onError: (err: any) =>
        toast.show(
          err?.message || t("recordDetail.toast.archiveError"),
          "danger"
        ),
    });
  }

  function doRestore() {
    if (!recordId) return;
    restoreRec.mutate(recordId, {
      onSuccess: () =>
        toast.show(t("recordDetail.toast.restored"), "success"),
      onError: (err: any) =>
        toast.show(
          err?.message || t("recordDetail.toast.restoreError"),
          "danger"
        ),
    });
  }

  function onPickFamily(memberId: string | null) {
    if (!recordId) return;
    const action = memberId ? moveToFamily : returnToOwn;
    action.mutate(
      { id: recordId, familyMemberId: memberId },
      {
        onSuccess: () => {
          toast.show(
            memberId
              ? t("recordDetail.toast.moveSuccess")
              : t("recordDetail.toast.returnSuccess"),
            "success"
          );
        },
        onError: (err: any) =>
          toast.show(
            err?.message || t("recordDetail.toast.moveError"),
            "danger"
          ),
      }
    );
  }

  function applyTags(nextTags: string[]) {
    if (!recordId) return;
    updateTags.mutate(
      { id: recordId, tags: nextTags },
      {
        onSuccess: () =>
          toast.show(t("recordDetail.toast.tagsUpdated"), "success"),
        onError: (err: any) =>
          toast.show(
            err?.message || t("recordDetail.toast.tagUpdateError"),
            "danger"
          ),
      }
    );
  }

  function doDelete(forever: boolean) {
    if (!recordId) return;
    setShowDeleteConfirm(false);
    if (forever) {
      deleteRec.mutate(recordId, {
        onSuccess: () =>
          toast.show(t("recordDetail.toast.deleted"), "success"),
        onError: (err: any) =>
          toast.show(
            err?.message || t("recordDetail.toast.deletedError"),
            "danger"
          ),
      });
    } else {
      archiveRec.mutate(recordId, {
        onSuccess: () =>
          toast.show(t("recordDetail.toast.archiveToggle"), "info", {
            actionLabel: t("recordDetail.archivedBadge.restore"),
            onAction: () => doRestore(),
          }),
        onError: (err: any) =>
          toast.show(
            err?.message || t("recordDetail.toast.archiveFailed"),
            "danger"
          ),
      });
    }
  }

  async function doShare() {
    if (!record) return;
    const diagnosis = record.diagnosis || record.summary || "";
    const followUp =
      record.followUpDate && record.followUpDate.length > 0
        ? new Date(record.followUpDate).toDateString()
        : "";
    const lines: string[] = [];
    lines.push(
      `${t("recordDetail.shareLabel.diagnosis")}: ${record.title}`
    );
    if (record.doctor?.name) {
      lines.push(
        `${t("recordDetail.shareLabel.doctor")}: ${record.doctor.name}`
      );
    }
    if (record.hospital?.name) {
      lines.push(
        `${t("recordDetail.shareLabel.hospital")}: ${record.hospital.name}`
      );
    }
    if (diagnosis) {
      lines.push(`${t("recordDetail.shareLabel.diagnosis")}: ${diagnosis}`);
    }
    if (followUp) {
      lines.push(`${t("recordDetail.shareLabel.followUp")}: ${followUp}`);
    }
    lines.push("");
    lines.push(t("recordDetail.shareFooter"));
    try {
      await Share.share({
        message: lines.join("\n"),
        title: t("recordDetail.shareTitleFallback"),
      });
    } catch {}
  }

  function onAction(act: BottomSheetAction) {
    setShowSheet(false);
    if (act === "edit") {
      router.push({
        pathname: "/(app)/edit-record",
        params: { id: params.id },
      });
      return;
    }
    if (act === "editTags") {
      setShowTagPicker(true);
      return;
    }
    if (act === "moveToFamily") {
      setShowFamilyPicker(true);
      return;
    }
    if (act === "archive") {
      doArchive();
      return;
    }
    if (act === "restore") {
      doRestore();
      return;
    }
    if (act === "share") {
      doShare();
      return;
    }
    if (act === "delete") {
      setShowDeleteConfirm(true);
      return;
    }
  }

  // Open the first attachment in the system viewer. Uses the presigned
  // token (unauthenticated `/files/download/:token`) because Linking
  // cannot attach the Bearer header and the auth-gated proxy would 401.
  async function openAttachment(att: any) {
    const signed = att?.id ? signedUrls[att.id] : null;
    if (!signed) {
      toast.show(t("recordDetail.toast.noFileKey"), "warning");
      return;
    }
    try {
      const ok = await Linking.canOpenURL(signed);
      if (!ok) {
        toast.show(t("recordDetail.toast.noFileKey"), "warning");
        return;
      }
      await Linking.openURL(signed);
    } catch (err: any) {
      toast.show(
        err?.message || t("recordDetail.toast.openError"),
        "danger"
      );
    }
  }

  if (isLoading || (!record && !isError)) {
    return (
      <Screen padded={false} edges={["top"]}>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="60%" height={28} radius={6} />
          <Skeleton width="40%" height={14} radius={4} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
            <Skeleton width={80} height={22} radius={11} />
            <Skeleton width={90} height={22} radius={11} />
          </View>
          <Skeleton width="100%" height={120} radius={12} style={{ marginTop: spacing.md }} />
          <Skeleton width="100%" height={120} radius={12} />
          <Skeleton width="100%" height={120} radius={12} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen padded={false} edges={["top"]}>
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load record")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen padded={false} edges={["top"]}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Card style={{ margin: spacing.lg, padding: spacing.lg }}>
            <Text style={[typography.title.md, { color: colors.text }]}>
              {t("recordDetail.notFound.title")}
            </Text>
            <Text
              style={[
                typography.body.sm,
                {
                  color: colors.textMuted,
                  marginTop: spacing.xs,
                },
              ]}
            >
              {t("recordDetail.notFound.body")}
            </Text>
            <Button
              title={t("recordDetail.notFound.back")}
              variant="primary"
              size="md"
              onPress={() => router.back()}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      </Screen>
    );
  }

  // `kind` is the canonical record-type field added in v3; `recordType`
  // is the legacy enum (17 values). Prefer `kind` when present, fall
  // back to `recordType` for older rows. Both come from
  // packages/shared/src/records.ts RECORD_KINDS.
  const recordKind = (record.kind ?? record.recordType) as RecordType | undefined;
  const meta =
    (recordKind && TYPE_META[recordKind]) || TYPE_META.other;
  const IconComp = meta.icon;
  const isArchived = !!record.archivedAt;
  const ownerLabel = record.familyMember?.name || t("common.you");

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      {/* Top Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          backgroundColor: colors.bg,
        }}
      >
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel={t("recordDetail.notFound.back")}
          onPress={() => router.back()}
          variant="ghost"
          tint={colors.primary}
          size="md"
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            height: 30,
            borderRadius: radius.full,
            backgroundColor: `${meta.tone}1F`,
          }}
        >
          <IconComp size={14} color={meta.tone} strokeWidth={2.5} />
          <Text style={[typography.label.sm, { color: meta.tone }]}>
            {meta.label}
          </Text>
        </View>

        <Pressable
          onPress={() => setShowSheet(true)}
          accessibilityLabel={t("recordDetail.a11y.moreOptions")}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.fillStrong : colors.fill,
          })}
        >
          <MoreHorizontal size={20} color={colors.text} strokeWidth={2.25} />
        </Pressable>
      </View>

      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 148 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xl,
          }}
        >
          <View
            style={[
              isDark ? null : shadow.md,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.xxl,
                borderCurve: "continuous",
                padding: spacing.xl,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isDark ? colors.borderStrong : colors.separator,
                gap: spacing.lg,
              },
            ]}
          >
            {/* Kind identity row — gradient icon tile + type + owner/date */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LinearGradient
                  colors={DETAIL_GRADIENT[recordKind ?? "other"] ?? DETAIL_GRADIENT.other}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <IconComp size={24} color="#FFFFFF" strokeWidth={2.25} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text
                  style={[typography.overline, { color: meta.tone }]}
                  numberOfLines={1}
                >
                  {meta.label.toUpperCase()}
                </Text>
                <Text
                  style={[typography.body.sm, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {ownerLabel} · {formatDate(record.date, locale)}
                </Text>
              </View>
            </View>

            <Text style={[typography.display.sm, { color: colors.text }]}>
              {record.title}
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
                paddingTop: spacing.lg,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
              }}
            >
              {record.doctor?.name ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: colors.infoSoft,
                    paddingHorizontal: 12,
                    height: 32,
                    borderRadius: radius.full,
                  }}
                >
                  <User size={14} color={colors.info} strokeWidth={2.25} />
                  <Text style={[typography.label.md, { color: colors.info }]}>
                    {record.doctor.name}
                  </Text>
                </View>
              ) : null}
              {record.hospital?.name ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: colors.accentSoft,
                    paddingHorizontal: 12,
                    height: 32,
                    borderRadius: radius.full,
                  }}
                >
                  <Hospital size={14} color={colors.accent} strokeWidth={2.25} />
                  <Text style={[typography.label.md, { color: colors.accent }]}>
                    {record.hospital.name}
                  </Text>
                </View>
              ) : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: colors.fill,
                  paddingHorizontal: 12,
                  height: 32,
                  borderRadius: radius.full,
                }}
              >
                <Calendar size={14} color={colors.textMuted} strokeWidth={2.25} />
                <Text style={[typography.label.md, { color: colors.textMuted }]}>
                  {formatDate(record.date, locale)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {isArchived ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Card
              style={{
                borderColor: colors.warning,
                backgroundColor: `${colors.warning}10`,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Archive size={18} color={colors.warning} strokeWidth={2.25} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.warning,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {t("recordDetail.archivedBadge.title")}
                </Text>
              </View>
              <Text
                style={[
                  typography.body.sm,
                  {
                    color: colors.textMuted,
                    marginTop: 4,
                  },
                ]}
              >
                {t("recordDetail.archivedBadge.body")}
              </Text>
              <Button
                title={t("recordDetail.archivedBadge.restore")}
                variant="ghost"
                size="sm"
                onPress={doRestore}
                style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}
              />
            </Card>
          </View>
        ) : null}

        {/* Sections */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.md,
            gap: spacing.md,
          }}
        >
          {[
            { key: "diagnosis", value: record.diagnosis, icon: Stethoscope, color: colors.accent },
            { key: "summary", value: record.summary, icon: FileText, color: colors.primary },
            { key: "notes", value: record.notes, icon: Pencil, color: colors.info },
            { key: "followUp", value: record.followUpDate, icon: Calendar, color: colors.warning },
          ].map((sec) => {
            if (!sec.value || (sec.key === "followUp" && !record.followUpDate))
              return null;
            const SecIcon = sec.icon;
            return (
              <Card key={sec.key} style={{ padding: spacing.lg + 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      backgroundColor: `${sec.color}1F`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <SecIcon size={15} color={sec.color} strokeWidth={2.5} />
                  </View>
                  <Text
                    style={[typography.overline, { color: colors.textSubtle }]}
                  >
                    {t(`recordDetail.sections.${sec.key}`).toUpperCase()}
                  </Text>
                </View>
                {sec.key === "followUp" ? (
                  <Text
                    style={[typography.title.md, { color: colors.text }]}
                  >
                    {new Date(sec.value).toDateString()}
                  </Text>
                ) : (
                  <Text
                    style={[typography.body.md, { color: colors.text, lineHeight: 22 }]}
                  >
                    {sec.value}
                  </Text>
                )}
              </Card>
            );
          })}
        </View>

        {/* Structured data (migration 0070) — child-table counts
            per extraction kind + re-extract button. Shown only for
            record kinds the extraction pipeline understands. */}
        {recordKind &&
        ["lab_report", "imaging", "discharge_summary", "vaccination", "prescription"].includes(
          recordKind,
        ) ? (
          <StructuredDataCard
            recordId={recordId as string}
            recordKind={recordKind}
          />
        ) : null}

        {/* Tags — tap anywhere on the card to edit */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Pressable
            onPress={() => setShowTagPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t("recordDetail.a11y.editTags", "Edit tags")}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card style={{ padding: spacing.lg + 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
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
                  <Tag size={15} color={colors.primary} strokeWidth={2.5} />
                </View>
                <Text
                  style={[typography.overline, { flex: 1, color: colors.textSubtle }]}
                >
                  {t("recordDetail.tagsHeading").toUpperCase()}
                </Text>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={15} color={colors.primary} strokeWidth={2.75} />
                </View>
              </View>
              {record.tags?.length ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  {record.tags.map((tag: string) => (
                    <View
                      key={tag}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 12,
                        height: 30,
                        borderRadius: 999,
                        backgroundColor: colors.primarySoft,
                      }}
                    >
                      <Tag size={11} color={colors.primary} strokeWidth={2.5} />
                      <Text
                        style={[typography.label.sm, { color: colors.primary }]}
                      >
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={{
                    borderRadius: 16,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.fill,
                    paddingVertical: 16,
                    paddingHorizontal: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={[typography.body.sm, { color: colors.textMuted }]}
                  >
                    {t("recordDetail.noTags")}
                  </Text>
                </View>
              )}
            </Card>
          </Pressable>
        </View>

        {/* Details — extracted fields as key/value rows */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Card style={{ padding: spacing.lg + 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ListChecks size={16} color={colors.textMuted} strokeWidth={2.5} />
              </View>
              <Text
                style={[typography.overline, { color: colors.textSubtle }]}
              >
                {t("recordDetail.detailsHeading").toUpperCase()}
              </Text>
            </View>
            {record.extractedData && Object.keys(record.extractedData).length ? (
              <View>
                {Object.entries(record.extractedData)
                  .slice(0, 14)
                  .map(([key, val], i) => (
                    <View
                      key={key}
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 12,
                        paddingVertical: 11,
                        borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: colors.separator,
                      }}
                    >
                      <Text
                        style={[
                          typography.body.sm,
                          {
                            flex: 1,
                            color: colors.textMuted,
                            textTransform: "capitalize",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {prettifyDetailKey(key)}
                      </Text>
                      <Text
                        style={[
                          typography.label.md,
                          {
                            flex: 1.4,
                            color: colors.text,
                            textAlign: "right",
                          },
                        ]}
                        numberOfLines={3}
                      >
                        {formatDetailValue(val)}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : (
              <View
                style={{
                  borderRadius: 16,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.fill,
                  paddingVertical: 16,
                  paddingHorizontal: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}
                >
                  {t("recordDetail.emptyDetails")}
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* DICOM metadata preview — only surfaces when the record
            carries extracted study/series/modality data (e.g. when the
            list endpoint joined document_dicom_metadata). */}
        {recordKind === "imaging" ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <DicomPreviewCard
              metadata={(() => {
                const first: any = attachments.find(
                  (a: any) => a?.dicomMetadata || a?.metadata?.dicom
                );
                const m =
                  first?.dicomMetadata ||
                  first?.metadata?.dicom ||
                  (record as any)?.dicomMetadata ||
                  null;
                if (!m) return null;
                return {
                  modality: m.modality ?? m.Modality ?? null,
                  bodyPart:
                    m.bodyPart ?? m.BodyPartExamined ?? null,
                  studyDate:
                    m.studyDate ?? m.StudyDate ?? m.study_date ?? null,
                  manufacturer: m.manufacturer ?? m.Manufacturer ?? null,
                };
              })()}
            />
          </View>
        ) : null}

        {/* Attachments */}
        {attachments.length ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Card style={{ padding: spacing.lg + 2 }}>
              <Text
                style={[typography.overline, { color: colors.textSubtle, marginBottom: 12 }]}
              >
                {t("recordDetail.attachments", {
                  count: attachments.length,
                })}
              </Text>
              <View style={{ gap: spacing.sm }}>
                {attachments.map((att: any) => {
                  const isImage = att.type === "image";
                  const sizeKb =
                    att.sizeBytes != null
                      ? att.sizeBytes / 1024
                      : att.fileSize != null
                      ? att.fileSize / 1024
                      : null;
                  const displayName =
                    att.filename ||
                    att.fileName ||
                    att.r2Key?.split("/").pop() ||
                    t("recordDetail.attachmentFallback", { defaultValue: "Attachment" });
                  return (
                    <Pressable
                      key={att.id}
                      onPress={() => openAttachment(att)}
                      accessibilityLabel={t("recordDetail.a11y.openFile")}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        borderRadius: 16,
                        borderCurve: "continuous",
                        backgroundColor: pressed ? colors.fillStrong : colors.fill,
                      })}
                    >
                      {isImage && att.id && signedUrls[att.id] ? (
                        <Image
                          source={{
                            uri: signedUrls[att.id],
                          }}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 14,
                            borderCurve: "continuous",
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            borderCurve: "continuous",
                            backgroundColor: colors.primarySoft,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <FileText
                            size={20}
                            color={colors.primary}
                            strokeWidth={2.25}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[typography.title.xs, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {displayName}
                        </Text>
                        <Text
                          style={[typography.caption, { color: colors.textSubtle, marginTop: 2 }]}
                        >
                          {sizeKb != null
                            ? `${sizeKb.toFixed(1)} KB · ${att.type}`
                            : att.type}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: colors.primarySoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ExternalLink
                          size={15}
                          color={colors.primary}
                          strokeWidth={2.25}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>

      {/* Fixed elevated quick actions bar at bottom */}
      <View
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          right: 12,
          backgroundColor: colors.glassStrong,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? colors.borderStrong : colors.separator,
          borderRadius: 24,
          borderCurve: "continuous",
          paddingHorizontal: 10,
          paddingTop: 10,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          shadowColor: "#0B2942",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDark ? 0 : 0.14,
          shadowRadius: 24,
          elevation: 12,
        }}
      >
        <Button
          title={t("recordDetail.quickActions.edit")}
          variant="primary"
          size="md"
          onPress={() =>
            router.push({
              pathname: "/(app)/edit-record",
              params: { id: params.id },
            })
          }
          style={{ flex: 1, height: 48, borderRadius: 16 }}
          icon={Pencil}
        />
        <Button
          title={t("recordDetail.quickActions.share")}
          variant="secondary"
          size="md"
          onPress={doShare}
          style={{ flex: 1, height: 48, borderRadius: 16 }}
          icon={Share2}
        />
        <Button
          title={t("recordDetail.quickActions.link")}
          variant="outline"
          size="md"
          onPress={() => router.push("/(app)/notifications")}
          style={{ flex: 1, height: 48, borderRadius: 16 }}
          icon={ExternalLink}
        />
      </View>

      {/* ─── Bottom-sheet of actions ─────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={showSheet}
        onRequestClose={() => setShowSheet(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: colors.scrim }}
          onPress={() => setShowSheet(false)}
        />
        <View
          style={{
            backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderCurve: "continuous",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
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
          <Text
            style={[typography.title.lg, { color: colors.text, marginBottom: spacing.sm }]}
          >
            {t("recordDetail.actions.title")}
          </Text>

          <SheetRow
            icon={<Pencil size={20} color={colors.primary} />}
            label={t("recordDetail.actions.edit")}
            onPress={() => onAction("edit")}
          />
          <SheetRow
            icon={<Tag size={20} color={colors.primary} />}
            label={t("recordDetail.actions.editTags")}
            onPress={() => onAction("editTags")}
          />
          <SheetRow
            icon={<Users size={20} color={colors.primary} />}
            label={t("recordDetail.actions.moveToFamily")}
            onPress={() => onAction("moveToFamily")}
          />
          <SheetRow
            icon={
              isArchived ? (
                <RotateCcw size={20} color={colors.primary} />
              ) : (
                <Archive size={20} color={colors.primary} />
              )
            }
            label={
              isArchived
                ? t("recordDetail.actions.restore")
                : t("recordDetail.actions.archive")
            }
            onPress={() => onAction(isArchived ? "restore" : "archive")}
          />
          <SheetRow
            icon={<Share2 size={20} color={colors.primary} />}
            label={t("recordDetail.actions.share")}
            onPress={() => onAction("share")}
          />
          <SheetRow
            icon={<Trash2 size={20} color={colors.danger} />}
            label={t("recordDetail.actions.delete")}
            destructive
            onPress={() => onAction("delete")}
          />
          <Button
            title={t("recordDetail.actions.cancel")}
            variant="ghost"
            size="md"
            onPress={() => setShowSheet(false)}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </Modal>

      {/* ─── Delete confirm dialog ───────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.scrim,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <Card style={{ width: "100%" }}>
            <Text
              style={[typography.title.lg, { color: colors.text }]}
            >
              {t("recordDetail.deleteConfirm.title")}
            </Text>
            <Text
              style={[typography.body.md, { color: colors.textMuted, marginTop: spacing.xs }]}
            >
              {t("recordDetail.deleteConfirm.body")}
            </Text>

            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                title={t("recordDetail.deleteConfirm.archive")}
                variant="secondary"
                size="md"
                onPress={() => doDelete(false)}
              />
              <Button
                title={t("recordDetail.deleteConfirm.deleteForever")}
                variant="primary"
                size="md"
                onPress={() => doDelete(true)}
              />
              <Button
                title={t("recordDetail.actions.cancel")}
                variant="ghost"
                size="md"
                onPress={() => setShowDeleteConfirm(false)}
              />
            </View>
          </Card>
        </View>
      </Modal>

      <TagPickerSheet
        visible={showTagPicker}
        onDismiss={() => setShowTagPicker(false)}
        currentTags={record.tags || []}
        onApply={applyTags}
      />
      <FamilyPickerSheet
        visible={showFamilyPicker}
        onDismiss={() => setShowFamilyPicker(false)}
        onPick={onPickFamily}
        excludeOwn={false}
      />
    </Screen>
  );
}

function SheetRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { spacing, fontFamily, colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 52,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.separator,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 16,
          fontWeight: "600",
          color: destructive ? colors.danger : colors.text,
          fontFamily: fontFamily.bodySemibold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function formatDate(dateStr: string, locale: string) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat(intlLocale(locale as any), {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

// "hemoglobinValue" / "patient_dob" → "Hemoglobin value" / "Patient dob"
function prettifyDetailKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}

function formatDetailValue(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number" || typeof val === "string") return String(val);
  if (Array.isArray(val)) {
    return val
      .slice(0, 4)
      .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
      .join(", ");
  }
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

// ─── Structured data card ───────────────────────────────
//
// Shown on lab_report / imaging / discharge_summary / vaccination /
// prescription records. Lists child-row counts per kind + a
// Re-extract button. Reads from the same query keys the trend chart
// uses, so the UI re-renders once the new rows land.
function StructuredDataCard({
  recordId,
  recordKind,
}: {
  recordId: string;
  recordKind: string;
}) {
  const { t } = useTranslation();
  const { spacing, typography, colors, fontFamily } = useTheme();
  const toast = useToast();
  const reExtract = useReExtractRecord();

  const lab = useRecordLabResults(recordKind === "lab_report" ? recordId : undefined);
  const img = useRecordImagingFindings(recordKind === "imaging" ? recordId : undefined);
  const dis = useRecordDischargeEvents(recordKind === "discharge_summary" ? recordId : undefined);
  const vac = useRecordVaccinationDoses(recordKind === "vaccination" ? recordId : undefined);
  const rx = useRecordPrescriptionItems(recordKind === "prescription" ? recordId : undefined);

  const counts: Array<{ key: string; label: string; icon: any; n: number }> = [];
  if (recordKind === "lab_report") {
    counts.push({
      key: "tests",
      label: t("recordDetail.structured.tests", "Test results"),
      icon: FlaskConical,
      n: lab.data?.results?.length ?? 0,
    });
  }
  if (recordKind === "imaging") {
    counts.push({
      key: "findings",
      label: t("recordDetail.structured.findings", "Imaging findings"),
      icon: ScanLine,
      n: img.data?.findings?.length ?? 0,
    });
  }
  if (recordKind === "discharge_summary") {
    counts.push({
      key: "events",
      label: t("recordDetail.structured.events", "Discharge events"),
      icon: ListChecks,
      n: dis.data?.events?.length ?? 0,
    });
  }
  if (recordKind === "vaccination") {
    counts.push({
      key: "doses",
      label: t("recordDetail.structured.doses", "Vaccination doses"),
      icon: Syringe,
      n: vac.data?.doses?.length ?? 0,
    });
  }
  if (recordKind === "prescription") {
    counts.push({
      key: "items",
      label: t("recordDetail.structured.items", "Prescription items"),
      icon: ListChecks,
      n: rx.data?.items?.length ?? 0,
    });
  }

  const totalCount = counts.reduce((s, c) => s + c.n, 0);
  const isLoading =
    lab.isLoading || img.isLoading || dis.isLoading || vac.isLoading || rx.isLoading;
  const isExtracting = reExtract.isPending;

  function onReExtract() {
    reExtract.mutate(recordId, {
      onSuccess: (res: any) => {
        if (res?.status === "completed") {
          toast.show(t("recordDetail.structured.reExtractOk"), "success");
        } else if (res?.status === "skipped") {
          toast.show(t("recordDetail.structured.reExtractSkip"), "info");
        } else {
          toast.show(
            res?.error || t("recordDetail.structured.reExtractFail"),
            "danger",
          );
        }
      },
      onError: () =>
        toast.show(t("recordDetail.structured.reExtractFail"), "danger"),
    });
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <Card style={{ padding: spacing.lg + 2 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              borderCurve: "continuous",
              backgroundColor: colors.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={16} color={colors.accent} strokeWidth={2.5} />
          </View>
          <Text
            style={[typography.overline, { color: colors.textSubtle }]}
          >
            {t("recordDetail.structured.title", "STRUCTURED DATA").toUpperCase()}
          </Text>
        </View>
        {isLoading ? (
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {t("common.loading", "Loading…")}
          </Text>
        ) : totalCount === 0 ? (
          <View style={{ gap: 12 }}>
            <Text style={[typography.body.sm, { color: colors.textMuted }]}>
              {t(
                "recordDetail.structured.empty",
                "No structured medical rows extracted yet. Tap below to run AI Multimodal Extraction.",
              )}
            </Text>
            <Button
              title={
                isExtracting
                  ? t("recordDetail.structured.reExtracting", "Extracting with AI…")
                  : t("recordDetail.structured.reExtract", "Re-extract with AI")
              }
              variant="primary"
              size="md"
              onPress={onReExtract}
              disabled={isExtracting}
              style={{ borderRadius: 12, height: 42 }}
              icon={<Sparkles size={15} color="#FFFFFF" />}
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={{ gap: 8, marginBottom: 4 }}>
              {counts.map((c) => {
                const Icon = c.icon;
                return (
                  <View
                    key={c.key}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <Icon size={15} color={colors.primary} strokeWidth={2.25} />
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.text, fontFamily: fontFamily.body, fontWeight: "600" },
                      ]}
                    >
                      {c.label}
                    </Text>
                    <View
                      style={{
                        marginLeft: "auto",
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: colors.primarySoft,
                      }}
                    >
                      <Text
                        style={[typography.label.md, { color: colors.primary }]}
                      >
                        {c.n}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <Button
              title={
                isExtracting
                  ? t("recordDetail.structured.reExtracting", "Extracting with AI…")
                  : t("recordDetail.structured.reExtract", "Re-extract with AI")
              }
              variant="secondary"
              size="sm"
              onPress={onReExtract}
              disabled={isExtracting}
              style={{ borderRadius: 10, height: 38 }}
              icon={<RefreshCw size={14} color={colors.primary} />}
            />
          </View>
        )}
      </Card>
    </View>
  );
}